import { obterAudio, obterEntrevista, salvarEntrevista } from "./db.mjs";

export const ENDERECO = "/api/transcrever";

export async function transcrever(blob) {
  const resposta = await fetch(ENDERECO, {
    method: "POST",
    headers: { "content-type": blob.type || "application/octet-stream" },
    body: blob,
  });
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    // 4xx é o áudio (silêncio, grande demais): mandar de novo dá o mesmo erro, então não
    // vira "sem sinal". 429 e 5xx passam com o tempo e continuam na fila.
    const erro = new Error(dados.erro || `falha ${resposta.status}`);
    erro.definitivo = resposta.status >= 400 && resposta.status < 500 && resposta.status !== 429;
    throw erro;
  }
  return dados.texto;
}

export function juntarTranscricao(valor, texto) {
  const atual = String(valor?.texto ?? "").trim();
  return { ...valor, texto: atual ? `${atual}\n\n${texto}` : texto, transcritoEm: new Date().toISOString() };
}

// Sem sinal a transcrição não acontece, mas a pendência não pode depender de o
// entrevistador lembrar: ela fica anotada e a volta da rede dispara sozinha.
const PENDENTES = "transcricoes-pendentes";

const lerFila = () => {
  try {
    return JSON.parse(localStorage.getItem(PENDENTES) || "[]");
  } catch {
    return [];
  }
};

const gravarFila = (fila) => {
  try {
    localStorage.setItem(PENDENTES, JSON.stringify(fila));
  } catch {
    /* armazenamento cheio: a pendência se perde, o áudio não */
  }
};

export function enfileirar(entrevistaId, perguntaId, audioId) {
  const fila = lerFila().filter((item) => item.audioId !== audioId);
  fila.push({ entrevistaId, perguntaId, audioId });
  gravarFila(fila);
}

export const pendentes = lerFila;

export const desenfileirar = (audioId) => gravarFila(lerFila().filter((i) => i.audioId !== audioId));

export function aoVoltarOnline(tarefa) {
  const rodar = () => navigator.onLine && tarefa();
  window.addEventListener("online", rodar);
  return () => window.removeEventListener("online", rodar);
}

let rodada = null;

export function processarFila() {
  if (!navigator.onLine) return Promise.resolve();
  rodada ??= esvaziarFila().finally(() => (rodada = null));
  return rodada;
}

async function esvaziarFila() {
  for (const { entrevistaId, perguntaId, audioId } of lerFila()) {
    const audio = await obterAudio(audioId);
    if (!audio) {
      desenfileirar(audioId);
      continue;
    }
    let texto;
    try {
      texto = await transcrever(audio.blob);
    } catch (erro) {
      if (erro.definitivo) desenfileirar(audioId);
      continue;
    }
    const entrevista = await obterEntrevista(entrevistaId);
    const valor = entrevista?.respostas?.[perguntaId];
    // Regravada ou apagada depois de entrar na fila: o texto não é mais desta resposta.
    if (valor?.audioId === audioId) {
      await salvarEntrevista({
        ...entrevista,
        respostas: { ...entrevista.respostas, [perguntaId]: juntarTranscricao(valor, texto) },
      });
    }
    desenfileirar(audioId);
    window.dispatchEvent(new CustomEvent("transcrito", { detail: { entrevistaId, perguntaId, audioId, texto } }));
  }
}
