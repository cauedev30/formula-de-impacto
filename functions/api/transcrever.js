// Roda aqui, não no aparelho: Whisper em WebAssembly usa uma thread só no Safari, leva
// minutos e esquenta o celular. O áudio continua salvo no aparelho de qualquer forma.
const MAX_BYTES = 24 * 1024 * 1024;

const responder = (dados, status = 200) =>
  new Response(JSON.stringify(dados), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

// O modelo recebe base64, não array de bytes. Em fatias porque `String.fromCharCode`
// com o arquivo inteiro estoura a pilha de argumentos.
const base64 = (bytes) => {
  let bruto = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bruto += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(bruto);
};

export async function onRequestPost({ request, env }) {
  if (!env.AI) return responder({ erro: "Transcrição não está configurada." }, 503);

  const bruto = await request.arrayBuffer();
  if (!bruto.byteLength) return responder({ erro: "Nenhum áudio recebido." }, 400);
  if (bruto.byteLength > MAX_BYTES) return responder({ erro: "Áudio grande demais." }, 413);

  try {
    const saida = await env.AI.run("@cf/openai/whisper-large-v3-turbo", {
      audio: base64(new Uint8Array(bruto)),
      language: "pt",
      task: "transcribe",
    });
    const texto = (saida?.text ?? "").trim();
    if (!texto) return responder({ erro: "Não saiu texto do áudio." }, 422);
    return responder({ texto });
  } catch (erro) {
    return responder({ erro: String(erro?.message || erro).slice(0, 200) }, 502);
  }
}
