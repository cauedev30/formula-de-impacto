import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

import { Cena, Entrada, Palavras, Tablet } from "../componentes";
import { Marca } from "../Marca";
import { theme } from "../theme";

export const Virada: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const marca = spring({ frame: frame - 6, fps, config: theme.mola.solta });
  const respiro = Math.sin(frame / 40) * 5;

  return (
    <Cena>
      <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", padding: "0 130px", gap: 96 }}>
        <div style={{ flex: 1 }}>
          <Marca
            largura={212}
            style={{
              opacity: marca,
              transform: `translateY(${interpolate(marca, [0, 1], [30, respiro])}px) scale(${interpolate(marca, [0, 1], [0.86, 1])})`,
            }}
          />
          <Palavras
            texto="O formulário que muda"
            atraso={34}
            style={{ fontSize: 68, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.08, marginTop: 34 }}
          />
          <Palavras
            texto="conforme quem está na frente."
            atraso={52}
            destaque="frente."
            style={{ fontSize: 68, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.08 }}
          />
          <Entrada atraso={104} style={{ marginTop: 40 }}>
            <span style={{ fontSize: 31, color: theme.cores.textoFraco, fontFamily: theme.fontes.corpo, lineHeight: 1.5 }}>
              Um instrumento da Caixa para diagnóstico territorial junto
              <br />a agricultores familiares, quilombolas e assentados.
            </span>
          </Entrada>
        </div>
        <Entrada atraso={60}>
          <Tablet tela="telas/tablet-1-inicio.png" />
        </Entrada>
      </AbsoluteFill>
    </Cena>
  );
};
