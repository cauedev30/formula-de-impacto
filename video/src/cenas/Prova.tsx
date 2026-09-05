import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

import { Cena, Entrada, Palavras, Tablet } from "../componentes";
import { theme } from "../theme";

// As barras caem uma a uma e a última vira o traço cortado: o sinal sumindo é o argumento
// inteiro da cena, então ele precisa acontecer na tela, não ser dito por legenda.
const Sinal: React.FC<{ atraso: number }> = ({ atraso }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const corte = spring({ frame: frame - atraso - 42, fps, config: theme.mola.rapida });
  return (
    <svg width="150" height="112" viewBox="0 0 150 112" fill="none">
      {[0, 1, 2, 3].map((i) => {
        const some = interpolate(frame, [atraso + i * 7, atraso + i * 7 + 12], [1, 0.16], {
          easing: theme.ease.saida,
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        return (
          <rect
            key={i}
            x={8 + i * 34}
            y={92 - (i + 1) * 20}
            width="22"
            height={(i + 1) * 20}
            rx="4"
            fill={theme.cores.textoFraco}
            opacity={some}
          />
        );
      })}
      <line
        x1="8"
        y1="102"
        x2={8 + 134 * corte}
        y2={102 - 94 * corte}
        stroke={theme.cores.heroi}
        strokeWidth="7"
        strokeLinecap="round"
      />
    </svg>
  );
};

export const Prova: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames: dur } = useVideoConfig();
  const voltou = spring({ frame: frame - Math.round(dur * 0.55), fps, config: theme.mola.suave });

  return (
    <Cena>
      <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", padding: "0 130px", gap: 100 }}>
        <div style={{ flex: 1 }}>
          <Entrada atraso={6}>
            <Sinal atraso={20} />
          </Entrada>
          <Palavras
            texto="E funciona sem sinal."
            atraso={40}
            style={{ fontSize: 92, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.06, marginTop: 26 }}
          />
          <Entrada atraso={92} style={{ marginTop: 34 }}>
            <span style={{ fontSize: 31, color: theme.cores.textoFraco, fontFamily: theme.fontes.corpo, lineHeight: 1.55 }}>
              Assentamento, quilombo, comunidade ribeirinha: é onde
              <br />a entrevista acontece, e é onde a internet não chega.
            </span>
          </Entrada>

          <div
            style={{
              marginTop: 46,
              opacity: voltou,
              transform: `translateY(${interpolate(voltou, [0, 1], [26, 0])}px)`,
              borderLeft: `4px solid ${theme.cores.verde}`,
              paddingLeft: 26,
            }}
          >
            <div style={{ fontSize: 38, fontWeight: 700, letterSpacing: "-0.02em" }}>
              Tudo fica guardado no aparelho.
            </div>
            <div style={{ fontSize: 29, color: theme.cores.textoFraco, fontFamily: theme.fontes.corpo, marginTop: 8 }}>
              Quando a rede volta, a transcrição acontece sozinha.
            </div>
          </div>
        </div>

        <Entrada atraso={24}>
          <Tablet tela="telas/tablet-4-ficha.png" rolagem={[40, dur - 40]} />
        </Entrada>
      </AbsoluteFill>
    </Cena>
  );
};
