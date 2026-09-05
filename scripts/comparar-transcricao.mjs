// Mede o erro real da transcrição: gera fala com o Piper a partir de texto que a gente
// escreveu, manda o áudio para a API e compara com esse texto. Comparar duas transcrições
// entre si não serve — quando as duas erram a mesma palavra, a medição diz que está tudo
// certo, e foi assim que "escoar" virou "consome" sem ninguém ver.
//
//   npm run comparar
//   MOSTRAR_TEXTO=1 npm run comparar
import { execFile, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";

const rodar = promisify(execFile);

// `execFile` assíncrono não tem opção `input`: quem passa texto por ali espera um stdin que
// nunca fecha, e o processo trava sem dizer nada. O Piper lê a fala do stdin.
const rodarComTexto = (comando, args, texto) =>
  new Promise((resolve, reject) => {
    const filho = spawn(comando, args, { stdio: ["pipe", "ignore", "pipe"] });
    let erro = "";
    filho.stderr.on("data", (pedaco) => (erro += pedaco));
    filho.on("error", reject);
    filho.on("close", (codigo) => (codigo === 0 ? resolve() : reject(new Error(erro.slice(-200) || `saiu ${codigo}`))));
    filho.stdin.end(texto);
  });

const RAIZ = new URL("..", import.meta.url).pathname;
const PIPER = join(RAIZ, ".piper/venv/bin/python");
const VOZES_DIR = join(RAIZ, ".piper/vozes");
const SAIDA = process.env.SAIDA ?? join(RAIZ, ".piper/corpus");
const BASE = process.env.BASE_URL ?? "https://formula-de-impacto.pages.dev";

const VOZES = (process.env.VOZES ?? "faber,cadu,jeff").split(",").filter(Boolean);
const { falas } = JSON.parse(readFileSync(join(RAIZ, "data/falas-de-teste.json"), "utf8"));

if (!existsSync(PIPER)) {
  console.error(`Piper não instalado. Rode:\n  python3 -m venv .piper/venv && .piper/venv/bin/pip install piper-tts`);
  process.exit(2);
}

// O aparelho grava opus, não WAV. Gerar em WAV e mandar assim mediria um caminho que não
// existe em campo: a compressão com perda é parte do que a transcrição enfrenta.
async function gerar(voz, fala) {
  const destino = join(SAIDA, `${voz}-${fala.id}.ogg`);
  if (existsSync(destino)) return destino;
  const wav = `${destino}.tmp.wav`;
  await rodarComTexto(PIPER, ["-m", "piper", "-m", join(VOZES_DIR, `pt_BR-${voz}-medium.onnx`), "-f", wav], fala.texto);
  await rodar("ffmpeg", ["-y", "-v", "error", "-i", wav, "-c:a", "libopus", "-b:a", "32k", "-ar", "16000", "-ac", "1", destino]);
  rmSync(wav, { force: true });
  return destino;
}

async function transcrever(caminho) {
  const resposta = await fetch(`${BASE}/api/transcrever`, {
    method: "POST",
    headers: { "content-type": "audio/ogg" },
    body: readFileSync(caminho),
  });
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error(dados.erro || `falha ${resposta.status}`);
  return (dados.texto ?? "").trim();
}

// O Whisper escreve na norma padrão o que foi dito no coloquial. "pra" virando "para" não é
// erro de transcrição, e contar como erro afoga o que importa: nome de instituição torcido.
const EQUIVALENTES = new Map([["pra", "para"], ["pro", "para"], ["tá", "está"], ["né", "não é"]]);

// Pontuação e caixa saem da conta: variam sem mudar o que foi dito. Acento fica, porque em
// português ele separa palavras diferentes.
const palavras = (texto) =>
  texto
    .toLowerCase()
    .replace(/[.,!?;:…"'“”‘’()\[\]—–]/g, " ")
    .replace(/(\d)[.-](\d)/g, "$1$2")
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((palavra) => (EQUIVALENTES.get(palavra) ?? palavra).split(" "));

// Matriz inteira, não duas linhas: o número do erro sozinho não diz nada acionável. O que
// importa é qual palavra virou qual — é isso que aponta o vocabulário que o modelo não pega.
function alinhar(ref, saiu) {
  const m = ref.length;
  const n = saiu.length;
  const d = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => (i ? (j ? 0 : i) : j)));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (ref[i - 1] === saiu[j - 1] ? 0 : 1));
    }
  }
  const trocas = [];
  let [i, j] = [m, n];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + (ref[i - 1] === saiu[j - 1] ? 0 : 1)) {
      if (ref[i - 1] !== saiu[j - 1]) trocas.push({ tipo: "trocou", de: ref[i - 1], para: saiu[j - 1] });
      i--; j--;
    } else if (i > 0 && d[i][j] === d[i - 1][j] + 1) {
      trocas.push({ tipo: "sumiu", de: ref[i - 1] });
      i--;
    } else {
      trocas.push({ tipo: "inventou", para: saiu[j - 1] });
      j--;
    }
  }
  return { erros: d[m][n], trocas: trocas.reverse() };
}

mkdirSync(SAIDA, { recursive: true });

console.log(`${falas.length} falas × ${VOZES.length} vozes = ${falas.length * VOZES.length} áudios\ndestino da API: ${BASE}\n`);

const porVoz = new Map(VOZES.map((v) => [v, { erros: 0, palavras: 0 }]));
const todasTrocas = [];
const detalhes = [];

for (const voz of VOZES) {
  for (const fala of falas) {
    const ref = palavras(fala.texto);
    try {
      const caminho = await gerar(voz, fala);
      const saida = await transcrever(caminho);
      const { erros, trocas } = alinhar(ref, palavras(saida));
      const acumulado = porVoz.get(voz);
      acumulado.erros += erros;
      acumulado.palavras += ref.length;
      todasTrocas.push(...trocas);
      detalhes.push({ voz, id: fala.id, taxa: erros / ref.length, ref: fala.texto, saida });
      console.log(
        `${voz.padEnd(7)} ${fala.id.padEnd(20)} ${((erros / ref.length) * 100).toFixed(1).padStart(5)}%  ${erros}/${ref.length} palavras`,
      );
    } catch (erro) {
      console.log(`${voz.padEnd(7)} ${fala.id.padEnd(20)} FALHA — ${String(erro.message ?? erro).slice(0, 70)}`);
    }
  }
}

console.log("\npor voz:");
let erros = 0;
let total = 0;
for (const [voz, a] of porVoz) {
  erros += a.erros;
  total += a.palavras;
  if (a.palavras) console.log(`  ${voz.padEnd(8)} ${((a.erros / a.palavras) * 100).toFixed(1).padStart(5)}%  ${a.erros}/${a.palavras}`);
}

const contagem = new Map();
for (const t of todasTrocas) {
  const chave = t.tipo === "trocou" ? `${t.de} → ${t.para}` : t.tipo === "sumiu" ? `${t.de} → (sumiu)` : `(inventou) → ${t.para}`;
  contagem.set(chave, (contagem.get(chave) ?? 0) + 1);
}
const recorrentes = [...contagem].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]);
if (recorrentes.length) {
  console.log("\npalavras que erram em mais de uma voz — são estas que chegam torcidas ao relatório:");
  for (const [troca, n] of recorrentes.slice(0, 20)) console.log(`  ${String(n).padStart(2)}×  ${troca}`);
}

if (process.env.MOSTRAR_TEXTO) {
  for (const d of detalhes.filter((x) => x.taxa > 0)) {
    console.log(`\n--- ${d.voz}/${d.id} (${(d.taxa * 100).toFixed(1)}%) ---\nescrito: ${d.ref}\nvoltou:  ${d.saida}`);
  }
}

const geral = total ? erros / total : 1;
console.log(`\nerro geral: ${(geral * 100).toFixed(1)}% em ${total} palavras`);

const TETO = Number(process.env.TETO ?? 0.15);
console.log(geral <= TETO ? "dentro do teto" : `ACIMA do teto de ${(TETO * 100).toFixed(0)}%`);
process.exit(geral <= TETO ? 0 : 1);
