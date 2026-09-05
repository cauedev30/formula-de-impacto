import React from "react";
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { loadFont as carregarArchivo } from "@remotion/google-fonts/Archivo";
import { loadFont as carregarInter } from "@remotion/google-fonts/Inter";

import { Como } from "./cenas/Como";
import { Dor } from "./cenas/Dor";
import { Fecho } from "./cenas/Fecho";
import { Prova } from "./cenas/Prova";
import { Virada } from "./cenas/Virada";
import { cena, TOTAL, TRECHOS } from "./roteiro";
import { theme } from "./theme";

carregarArchivo();
carregarInter();

const CENAS = [
  { nome: "Dor", Componente: Dor },
  { nome: "Virada", Componente: Virada },
  { nome: "Como", Componente: Como },
  { nome: "Prova", Componente: Prova },
  { nome: "Fecho", Componente: Fecho },
];

// Corte seco entre cenas deixava um salto de cor visível porque toda cena tem a mesma malha
// de fundo. Doze quadros de cruzamento escondem a emenda sem virar dissolve preguiçoso.
const CRUZAMENTO = 12;

const ComTransicao: React.FC<{ duracao: number; children: React.ReactNode }> = ({ duracao, children }) => {
  const frame = useCurrentFrame();
  const entra = interpolate(frame, [0, CRUZAMENTO], [0, 1], {
    easing: theme.ease.saida,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const sai = interpolate(frame, [duracao - CRUZAMENTO, duracao], [1, 0], {
    easing: theme.ease.entrada,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return <AbsoluteFill style={{ opacity: Math.min(entra, sai) }}>{children}</AbsoluteFill>;
};

export const Apresentacao: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: theme.cores.fundo }}>
    {CENAS.map(({ nome, Componente }) => {
      const { de, duracao } = cena(nome);
      return (
        <Sequence key={nome} from={de} durationInFrames={duracao} name={nome}>
          <ComTransicao duracao={duracao}>
            <Componente />
          </ComTransicao>
        </Sequence>
      );
    })}

    {TRECHOS.map((t) => (
      <Sequence key={t.id} from={t.inicio} durationInFrames={t.quadros} name={`voz ${t.id}`}>
        <Audio src={staticFile(`narracao/${t.id}.wav`)} />
      </Sequence>
    ))}

    <Sequence from={0} durationInFrames={TOTAL} name="fim" />
  </AbsoluteFill>
);
