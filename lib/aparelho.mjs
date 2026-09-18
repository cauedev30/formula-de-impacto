// O id do aparelho responde "de qual tablet veio esta entrevista" quando um deles some ou
// começa a mandar dado estranho. Fica no localStorage porque é do aparelho, não da entrevista.
const CHAVE = "aparelho-formula-impacto";

const gerar = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export function idDoAparelho() {
  try {
    const guardado = localStorage.getItem(CHAVE);
    if (guardado) return guardado;
    const novo = gerar();
    localStorage.setItem(CHAVE, novo);
    return novo;
  } catch {
    // Armazenamento bloqueado: o aparelho fica sem nome, e a entrevista sobe do mesmo jeito.
    return "";
  }
}

export const carimbar = (entrevista, agora = new Date().toISOString()) => ({
  ...entrevista,
  aparelhoId: entrevista.aparelhoId || idDoAparelho(),
  alteradaEm: agora,
});
