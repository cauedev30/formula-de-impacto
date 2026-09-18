// A pendência mora na própria entrevista, não numa fila à parte. A fila de transcrição vive no
// localStorage e some quando o armazenamento enche — o próprio módulo admite isso. Aqui a
// verdade está no IndexedDB junto do dado, então limpar o localStorage não faz o app esquecer
// o que falta subir.

// Entrevista gravada antes desta versão não tem carimbo nenhum: ausente vale como "nunca subiu".
const quandoMudou = (entrevista) => entrevista.alteradaEm ?? entrevista.iniciadaEm ?? "";

export const estaPendente = (entrevista) => quandoMudou(entrevista) > (entrevista.sincronizadaEm ?? "");

export const pendentes = (entrevistas) =>
  (entrevistas ?? [])
    .filter(estaPendente)
    .sort((a, b) => quandoMudou(a).localeCompare(quandoMudou(b)));

export const marcarEnviada = (entrevista, quando = new Date().toISOString()) => ({
  ...entrevista,
  sincronizadaEm: quando,
});

// `sincronizadaEm` é controle do aparelho e não significa nada no servidor; mandá-lo só
// convidaria alguém a confiar nele do outro lado.
export function paraEnvio(entrevista) {
  const { sincronizadaEm, ...resto } = entrevista;
  return resto;
}
