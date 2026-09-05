// Gera a narração com o Piper e mede a duração real de cada trecho. O tempo das cenas sai
// daqui: escrever a duração à mão e depois encaixar a voz produz corte no meio da frase.
import { execFile, spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";

const rodar = promisify(execFile);
const RAIZ = new URL("..", import.meta.url).pathname;
const APP = join(RAIZ, "..");
const PYTHON = join(APP, ".piper/venv/bin/python");
const VOZ = join(APP, `.piper/vozes/pt_BR-${process.env.VOZ ?? "cadu"}-medium.onnx`);
const SAIDA = join(RAIZ, "public/narracao");

// Cada voz guarda a própria cópia: re-renderizar depois de mexer na animação não pode
// custar caractere da API de novo, e foi isso que travou o refazer do primeiro lote.
const COFRE = join(RAIZ, ".narracoes");

export const TRECHOS = [
  { id: "dor", texto: "Todo diagnóstico de território começa com um formulário de papel igual para todo mundo. O prefeito responde a mesma folha que a agricultora familiar. E anotação solta ninguém consegue somar." },
  { id: "virada", texto: "Fórmula de Impacto é o formulário que muda conforme quem está na frente. Um instrumento da Caixa para o diagnóstico junto a agricultores familiares, quilombolas e assentados." },
  { id: "como", texto: "Você escolhe quem vai entrevistar, e o aparelho monta na hora só as perguntas daquela pessoa. Quando a resposta é longa, o entrevistado fala, e o áudio vira texto sozinho. No fim, sai a ficha do entrevistado e sai o consolidado do território." },
  { id: "prova", texto: "E funciona sem sinal de celular, que é justamente onde a entrevista acontece. Tudo fica guardado no aparelho, e quando a rede volta, a transcrição acontece sozinha." },
  { id: "fecho", texto: "Da conversa em campo ao dado que sustenta a decisão. Fórmula de Impacto. Dados, pessoas, sustentabilidade." },
];

const MOTOR = process.env.MOTOR ?? "eleven";

// A chave mora fora do repositório e nunca aparece em log: ler de arquivo evita que ela
// entre em histórico de shell ou em variável exportada para todo processo filho.
const CHAVE_ELEVEN = (() => {
  try {
    return readFileSync(`${process.env.HOME}/.elevenlabs/key`, "utf8").trim();
  } catch {
    return "";
  }
})();
const VOZ_ELEVEN = process.env.VOZ_ELEVEN ?? "bIHbv24MWmeRgasZH58o";

// `stability` baixo demais vira teatral e alto demais volta a ser plano; 0.42 com um pouco
// de `style` dá locução institucional sem soar de trailer.
async function falarEleven(texto, destino) {
  if (!CHAVE_ELEVEN) throw new Error("chave do ElevenLabs ausente em ~/.elevenlabs/key");
  const resposta = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOZ_ELEVEN}`, {
    method: "POST",
    headers: { "xi-api-key": CHAVE_ELEVEN, "content-type": "application/json" },
    body: JSON.stringify({
      text: texto,
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.42, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true },
    }),
  });
  if (!resposta.ok) {
    const erro = await resposta.text();
    throw new Error(`${resposta.status} ${erro.slice(0, 180)}`);
  }
  const mp3 = `${destino}.mp3`;
  writeFileSync(mp3, Buffer.from(await resposta.arrayBuffer()));
  await rodar("ffmpeg", ["-y", "-v", "error", "-i", mp3, "-ar", "48000", "-ac", "1", destino]);
  rmSync(mp3, { force: true });
}
const KOKORO_PY = join(APP, ".kokoro/venv/bin/python");
const VOZ_KOKORO = process.env.VOZ_KOKORO ?? "pm_santa";

const falarKokoro = (texto, destino) =>
  new Promise((resolve, reject) => {
    const codigo = [
      "import sys, soundfile as sf",
      "from kokoro_onnx import Kokoro",
      `k = Kokoro(${JSON.stringify(join(APP, ".kokoro/modelo/kokoro-v1.0.onnx"))}, ${JSON.stringify(join(APP, ".kokoro/modelo/voices-v1.0.bin"))})`,
      "texto = sys.stdin.read()",
      `a, taxa = k.create(texto, voice=${JSON.stringify(VOZ_KOKORO)}, speed=${process.env.VELOCIDADE ?? 1.0}, lang="pt-br")`,
      `sf.write(${JSON.stringify(destino)}, a, taxa)`,
    ].join("\n");
    const filho = spawn(KOKORO_PY, ["-c", codigo], { stdio: ["pipe", "ignore", "pipe"] });
    let erro = "";
    filho.stderr.on("data", (p) => (erro += p));
    filho.on("error", reject);
    filho.on("close", (c) => (c === 0 ? resolve() : reject(new Error(erro.slice(-300)))));
    filho.stdin.end(texto);
  });

const falarPiper = (texto, destino) =>
  new Promise((resolve, reject) => {
    const filho = spawn(PYTHON, ["-m", "piper", "-m", VOZ, "-f", destino], { stdio: ["pipe", "ignore", "pipe"] });
    let erro = "";
    filho.stderr.on("data", (p) => (erro += p));
    filho.on("error", reject);
    filho.on("close", (c) => (c === 0 ? resolve() : reject(new Error(erro.slice(-200)))));
    filho.stdin.end(texto);
  });

const MOTORES = { eleven: falarEleven, kokoro: falarKokoro, piper: falarPiper };
const falar = (texto, destino) => MOTORES[MOTOR](texto, destino);

const duracao = async (arquivo) => {
  const { stdout } = await rodar("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", arquivo]);
  return Number(stdout.trim());
};

mkdirSync(SAIDA, { recursive: true });
const VOZ_ATUAL = MOTOR === "eleven" ? VOZ_ELEVEN : MOTOR === "kokoro" ? VOZ_KOKORO : (process.env.VOZ ?? "cadu");
const guardado = join(COFRE, `${MOTOR}-${VOZ_ATUAL}`);
mkdirSync(guardado, { recursive: true });

const tempos = [];
for (const trecho of TRECHOS) {
  const arquivo = join(SAIDA, `${trecho.id}.wav`);
  const copia = join(guardado, `${trecho.id}.wav`);
  if (existsSync(copia) && !process.env.REFAZER) copyFileSync(copia, arquivo);
  else {
    await falar(trecho.texto, arquivo);
    copyFileSync(arquivo, copia);
  }
  const segundos = await duracao(arquivo);
  tempos.push({ id: trecho.id, segundos: Number(segundos.toFixed(2)), texto: trecho.texto });
  console.log(`${trecho.id.padEnd(8)} ${segundos.toFixed(2)}s  ${trecho.texto.slice(0, 60)}…`);
}

const total = tempos.reduce((s, t) => s + t.segundos, 0);
writeFileSync(join(RAIZ, "src/narracao.json"), JSON.stringify({ motor: MOTOR, voz: MOTOR === "eleven" ? VOZ_ELEVEN : MOTOR === "kokoro" ? VOZ_KOKORO : (process.env.VOZ ?? "cadu"), total, tempos }, null, 2) + "\n");
console.log(`\ntotal ${total.toFixed(1)}s · src/narracao.json escrito`);
