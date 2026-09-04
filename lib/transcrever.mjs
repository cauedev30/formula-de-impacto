// Whisper roda dentro do navegador, via WebAssembly. O modelo baixa uma vez com sinal,
// fica no cache do navegador e a partir daí transcreve offline — que é o cenário de campo.
//
// A Web Speech API seria menos código, mas manda o áudio para o servidor do navegador
// e não funciona sem rede: as duas coisas que este app não pode aceitar.
const CDN = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.6";

// Trocável sem rebuild: `localStorage.setItem("modelo-transcricao", "Xenova/whisper-tiny")`
// no aparelho que arrastar. `base` acerta mais nome próprio, `tiny` roda em tablet fraco.
const MODELO_PADRAO = "onnx-community/whisper-base";

let carregando;

export const modeloEscolhido = () => {
  try {
    return localStorage.getItem("modelo-transcricao") || MODELO_PADRAO;
  } catch {
    return MODELO_PADRAO;
  }
};

async function pipelineDeFala(aoProgredir) {
  if (carregando) return carregando;
  carregando = (async () => {
    const { pipeline } = await import(/* webpackIgnore: true */ `${CDN}/+esm`);
    return pipeline("automatic-speech-recognition", modeloEscolhido(), {
      dtype: "q8",
      device: "wasm",
      progress_callback: (evento) => {
        if (evento.status === "progress" && evento.total) {
          aoProgredir?.(Math.round((evento.loaded / evento.total) * 100));
        }
      },
    });
  })().catch((erro) => {
    carregando = null;
    throw erro;
  });
  return carregando;
}

// Whisper só aceita mono a 16 kHz. O MediaRecorder entrega o que o aparelho quiser,
// então a conversão acontece aqui e não vira surpresa dentro do modelo.
async function amostras16k(blob) {
  const Contexto = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  const contexto = new Contexto();
  try {
    const decodificado = await contexto.decodeAudioData(await blob.arrayBuffer());
    const quadros = Math.ceil((decodificado.duration * 16000) / 1) || 1;
    const offline = new OfflineAudioContext(1, quadros, 16000);
    const fonte = offline.createBufferSource();
    fonte.buffer = decodificado;
    fonte.connect(offline.destination);
    fonte.start();
    return (await offline.startRendering()).getChannelData(0);
  } finally {
    contexto.close();
  }
}

export const modeloJaBaixado = async () => {
  if (!globalThis.caches) return false;
  const cache = await caches.open("transformers-cache").catch(() => null);
  return Boolean(cache && (await cache.keys()).length > 0);
};

export async function transcrever(blob, { aoProgredir } = {}) {
  const [transcritor, audio] = await Promise.all([pipelineDeFala(aoProgredir), amostras16k(blob)]);
  const saida = await transcritor(audio, { language: "portuguese", task: "transcribe", chunk_length_s: 30 });
  return (saida?.text ?? "").trim();
}
