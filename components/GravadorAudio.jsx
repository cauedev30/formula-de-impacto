"use client";

import { useEffect, useRef, useState } from "react";

import { novoId, obterAudio, salvarAudio } from "@/lib/db.mjs";
import { modeloJaBaixado, transcrever } from "@/lib/transcrever.mjs";
import Icone from "./Icone";

// Chrome Android grava webm/opus e o Firefox grava ogg/opus. Guardamos a extensão real
// junto do blob: o arquivo exportado precisa dizer a verdade sobre o que tem dentro.
const FORMATOS = [
  { mime: "audio/ogg;codecs=opus", extensao: "ogg" },
  { mime: "audio/webm;codecs=opus", extensao: "webm" },
  { mime: "audio/mp4", extensao: "m4a" },
];

const formatoSuportado = () =>
  FORMATOS.find((f) => globalThis.MediaRecorder?.isTypeSupported?.(f.mime)) ?? { mime: "", extensao: "webm" };

const relogio = (segundos) =>
  `${String(Math.floor(segundos / 60)).padStart(2, "0")}:${String(segundos % 60).padStart(2, "0")}`;

export default function GravadorAudio({ entrevistaId, perguntaId, valor, aoGravar }) {
  const [gravando, setGravando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [erro, setErro] = useState("");
  const [url, setUrl] = useState("");
  const [transcrevendo, setTranscrevendo] = useState(null);
  const [modeloPronto, setModeloPronto] = useState(false);
  const gravadorRef = useRef(null);

  useEffect(() => {
    modeloJaBaixado().then(setModeloPronto);
  }, []);

  useEffect(() => {
    if (!valor?.audioId) return setUrl("");
    let vivo = true;
    let criada = "";
    obterAudio(valor.audioId).then((audio) => {
      if (!vivo || !audio) return;
      criada = URL.createObjectURL(audio.blob);
      setUrl(criada);
    });
    return () => {
      vivo = false;
      if (criada) URL.revokeObjectURL(criada);
    };
  }, [valor?.audioId]);

  useEffect(() => {
    if (!gravando) return;
    const timer = setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [gravando]);

  async function transcreverAgora(audioId) {
    const audio = await obterAudio(audioId);
    if (!audio) return;
    setErro("");
    setTranscrevendo({ etapa: modeloPronto ? "transcrevendo" : "baixando", pct: 0 });
    try {
      const texto = await transcrever(audio.blob, {
        aoProgredir: (pct) => setTranscrevendo({ etapa: "baixando", pct }),
      });
      setModeloPronto(true);
      // O áudio continua guardado: transcrição é rascunho, a gravação é o registro.
      aoGravar({ audioId, duracao: segundos || valor?.duracao, texto, transcritoAqui: true });
    } catch {
      setErro("Não consegui transcrever agora. O áudio está salvo — dá para transcrever depois no computador.");
    } finally {
      setTranscrevendo(null);
    }
  }

  async function iniciar() {
    setErro("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const formato = formatoSuportado();
      const gravador = new MediaRecorder(stream, formato.mime ? { mimeType: formato.mime } : undefined);
      const pedacos = [];
      gravador.ondataavailable = (evento) => evento.data.size && pedacos.push(evento.data);
      gravador.onstop = async () => {
        stream.getTracks().forEach((faixa) => faixa.stop());
        const blob = new Blob(pedacos, { type: gravador.mimeType });
        const id = novoId();
        await salvarAudio({ id, entrevistaId, perguntaId, blob, extensao: formato.extensao });
        aoGravar({ ...valor, audioId: id, duracao: segundos });
        setGravando(false);
        transcreverAgora(id);
      };
      gravadorRef.current = gravador;
      setSegundos(0);
      gravador.start();
      setGravando(true);
    } catch {
      setErro("Não consegui acessar o microfone. Autorize o microfone para este site.");
    }
  }

  const parar = () => gravadorRef.current?.stop();

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <button
        type="button"
        className={`botao ${gravando ? "gravando" : ""}`}
        onClick={gravando ? parar : iniciar}
        disabled={Boolean(transcrevendo)}
      >
        <Icone nome={gravando ? "parar" : "microfone"} />
        {gravando ? `Parar — ${relogio(segundos)}` : valor?.audioId ? "Gravar de novo" : "Gravar resposta"}
      </button>

      {transcrevendo && (
        <div className="processando">
          <div className="trilho">
            <span style={{ width: transcrevendo.pct ? `${transcrevendo.pct}%` : "100%" }} />
          </div>
          <p className="discreto" style={{ margin: "8px 0 0" }}>
            {transcrevendo.etapa === "baixando"
              ? `Baixando o modelo de voz… ${transcrevendo.pct}% (só na primeira vez, depois funciona sem internet)`
              : "Transcrevendo aqui no aparelho…"}
          </p>
        </div>
      )}

      {erro && <p className="aviso">{erro}</p>}

      {url && !gravando && <audio src={url} controls style={{ width: "100%" }} />}
    </div>
  );
}
