import narracao from "./narracao.json";

export const FPS = 30;
const s = (segundos: number) => Math.round(segundos * FPS);

// Só os inícios são escolhidos à mão, para dar respiro entre as frases. Tudo o mais —
// duração de cena, corte interno — sai medido do áudio, então trocar de voz não obriga a
// recalibrar quadro nenhum.
const INICIOS: Record<string, number> = {
  dor: 0.7,
  virada: 13.9,
  como: 24.9,
  prova: 42.4,
  fecho: 54.6,
};

const RESPIRO = 0.7;

export const TRECHOS = narracao.tempos.map((t) => ({
  ...t,
  inicio: s(INICIOS[t.id]),
  quadros: s(t.segundos),
}));

const ORDEM = ["dor", "virada", "como", "prova", "fecho"] as const;
const NOME_CENA: Record<string, string> = {
  dor: "Dor",
  virada: "Virada",
  como: "Como",
  prova: "Prova",
  fecho: "Fecho",
};

export const CENAS = ORDEM.map((id, i) => {
  const proximo = ORDEM[i + 1];
  const fim = proximo ? INICIOS[proximo] - RESPIRO / 2 : INICIOS[id] + narracao.tempos.find((t) => t.id === id)!.segundos + 1.4;
  return { nome: NOME_CENA[id], de: s(i === 0 ? 0 : INICIOS[id] - RESPIRO / 2), ate: s(fim) };
});

export const TOTAL = CENAS[CENAS.length - 1].ate;
export const cena = (nome: string) => {
  const c = CENAS.find((x) => x.nome === nome)!;
  return { de: c.de, duracao: c.ate - c.de };
};
