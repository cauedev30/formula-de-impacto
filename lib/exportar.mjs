import JSZip from "jszip";

import { audiosDaEntrevista, listarEntrevistas } from "./db.mjs";
import { montarFormulario } from "./montar-formulario.mjs";

const semAcento = (texto) =>
  texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

const pastaDa = (entrevista) =>
  `${entrevista.iniciadaEm.slice(0, 10)}-${semAcento(entrevista.respostas?.nome || entrevista.id.slice(0, 8))}`;

const celula = (valor) => {
  const texto = Array.isArray(valor) ? valor.join(" | ") : String(valor ?? "");
  return `"${texto.replaceAll('"', '""')}"`;
};

export function montarCsv(banco, entrevistas) {
  const colunas = banco.perguntas.map((p) => p.id);
  const cabecalho = ["id", "data", "categoria", "cargo", "faixa", "genero", "entrevistador", ...colunas];
  const linhas = entrevistas.map((e) =>
    [
      e.id,
      e.iniciadaEm,
      e.perfil.categoria,
      e.perfil.cargo ?? "",
      e.perfil.faixa,
      e.perfil.genero,
      e.entrevistador ?? "",
      ...colunas.map((id) => {
        const resposta = e.respostas[id];
        return resposta && typeof resposta === "object" && !Array.isArray(resposta)
          ? resposta.texto || (resposta.audioId ? "[áudio]" : "")
          : resposta;
      }),
    ]
      .map(celula)
      .join(","),
  );
  return [cabecalho.map(celula).join(","), ...linhas].join("\r\n");
}

const LEIAME = `Entrevistas exportadas do formulário de campo.

entrevistas.json  todas as entrevistas, com o perfil e as respostas
entrevistas.csv   as mesmas respostas em planilha, uma linha por entrevista
audios/           um .ogg por resposta gravada, nomeado com o id da pergunta

Para transcrever os áudios no PC, dentro da pasta do vox:

    for a in audios/*/*.ogg; do
      ffmpeg -y -v error -i "$a" -ar 16000 -ac 1 -c:a pcm_s16le "\${a%.ogg}.wav"
      VOX_WHISPER_TRANSLATE=0 VOX_WHISPER_LANGUAGE=pt ./vox transcribe "\${a%.ogg}.wav" > "\${a%.ogg}.txt"
    done

O nome do arquivo é o id da pergunta, então o texto volta para a resposta certa.
`;

export async function montarZip(banco) {
  const entrevistas = await listarEntrevistas();
  const zip = new JSZip();
  zip.file("entrevistas.json", JSON.stringify({ banco: banco.versao, entrevistas }, null, 2));
  zip.file("entrevistas.csv", "﻿" + montarCsv(banco, entrevistas));
  zip.file("LEIAME.txt", LEIAME);

  for (const entrevista of entrevistas) {
    for (const audio of await audiosDaEntrevista(entrevista.id)) {
      zip.file(`audios/${pastaDa(entrevista)}/${audio.perguntaId}.${audio.extensao ?? "ogg"}`, audio.blob);
    }
  }
  return { blob: await zip.generateAsync({ type: "blob" }), total: entrevistas.length };
}

export function baixar(blob, nome) {
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement("a"), { href: url, download: nome });
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function consolidar(banco, entrevistas) {
  return banco.perguntas
    .filter((p) => p.opcoes)
    .map((pergunta) => {
      const alcance = entrevistas.filter((e) =>
        montarFormulario(banco, e.perfil, e.respostas).some((p) => p.id === pergunta.id),
      );
      const contagem = pergunta.opcoes.map((opcao) => ({
        opcao,
        total: alcance.filter((e) => {
          const resposta = e.respostas[pergunta.id];
          return Array.isArray(resposta) ? resposta.includes(opcao) : resposta === opcao;
        }).length,
      }));
      return { pergunta, alcance: alcance.length, contagem };
    })
    .filter((linha) => linha.alcance > 0);
}
