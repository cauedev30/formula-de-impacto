import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

import { Cena, Entrada } from "../componentes";
import { Marca } from "../Marca";
import { theme } from "../theme";

export const Fecho: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const marca = spring({ frame: frame - 8, fps, config: theme.mola.solta });
  const respiro = Math.sin(frame / 44) * 5;
  const linha = interpolate(frame, [70, 104], [0, 1], {
    easing: theme.ease.saida,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <Cena>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", textAlign: "center" }}>
        <Marca
          largura={288}
          style={{
            opacity: marca,
            transform: `translateY(${interpolate(marca, [0, 1], [40, respiro])}px) scale(${interpolate(marca, [0, 1], [0.84, 1])})`,
          }}
        />
        <Entrada atraso={44} style={{ marginTop: 42 }}>
          <span style={{ fontSize: 60, fontWeight: 700, letterSpacing: "-0.02em" }}>
            Da conversa em campo ao dado que <span style={{ color: theme.cores.heroi }}>sustenta a decisão</span>.
          </span>
        </Entrada>
        <div
          style={{
            marginTop: 40,
            height: 3,
            width: 520 * linha,
            background: `linear-gradient(90deg, ${theme.cores.dados}, ${theme.cores.heroi}, ${theme.cores.verde})`,
            borderRadius: 3,
          }}
        />
        <Entrada atraso={108} style={{ marginTop: 34 }}>
          <span
            style={{
              fontSize: 30,
              letterSpacing: "0.34em",
              color: theme.cores.textoFraco,
              fontFamily: theme.fontes.corpo,
            }}
          >
            DADOS · PESSOAS · SUSTENTABILIDADE
          </span>
        </Entrada>
      </AbsoluteFill>
    </Cena>
  );
};
