// Chrome Android grava webm/opus, Firefox grava ogg/opus e o Safari só entrega mp4.
// A lista mora aqui porque o gravador e as instruções do ZIP precisam concordar: quando
// ela estava duplicada, o comando do LEIAME varria só `*.ogg` e não achava nenhum áudio
// gravado em iPad ou em Android.
export const FORMATOS = [
  { mime: "audio/ogg;codecs=opus", extensao: "ogg" },
  { mime: "audio/webm;codecs=opus", extensao: "webm" },
  { mime: "audio/mp4", extensao: "m4a" },
];

export const EXTENSOES = FORMATOS.map((f) => f.extensao);
