export const ENDERECO = "/api/transcrever";

export async function transcrever(blob) {
  const resposta = await fetch(ENDERECO, {
    method: "POST",
    headers: { "content-type": blob.type || "application/octet-stream" },
    body: blob,
  });
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error(dados.erro || `falha ${resposta.status}`);
  return dados.texto;
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
