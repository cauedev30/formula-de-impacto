import React from "react";
import { Img, staticFile, useCurrentFrame } from "remotion";

// A folha foi recortada do PNG por preenchimento a partir da borda, então ela vem inteira,
// com a nervura azul e o talo. Estes números são a caixa dela dentro do logo, em fração:
// posicionar por porcentagem faz a folha acompanhar qualquer tamanho de marca.
const FOLHA = { esquerda: 0.4974, topo: 0.1993, largura: 0.4991 };
const PROPORCAO = 823 / 577;

// Duas senoides de períodos que não são múltiplos: uma só produz vaivém de metrônomo, e o
// olho reconhece isso na hora como animação, não como vento.
const balanco = (frame: number) => ({
  angulo: Math.sin(frame / 37) * 1.7 + Math.sin(frame / 16.3) * 0.5,
  inclinacao: Math.sin(frame / 29 + 0.8) * 0.9,
  respiro: 1 + Math.sin(frame / 44) * 0.006,
});

export const Marca: React.FC<{ largura: number; style?: React.CSSProperties }> = ({ largura, style }) => {
  const frame = useCurrentFrame();
  const { angulo, inclinacao, respiro } = balanco(frame);

  return (
    <div style={{ position: "relative", width: largura, height: largura * PROPORCAO, ...style }}>
      <Img src={staticFile("logo-limpo.png")} style={{ width: "100%", display: "block" }} />
      <Img
        src={staticFile("folha.png")}
        style={{
          position: "absolute",
          left: `${FOLHA.esquerda * 100}%`,
          top: `${FOLHA.topo * 100}%`,
          width: `${FOLHA.largura * 100}%`,
          // Pivô no talo e escala um pouco acima de 1: assim a folha animada cobre a estática
          // do PNG de baixo em toda a amplitude, e não sobra franja quando ela se inclina.
          transformOrigin: "7.4% 94.9%",
          transform: `rotate(${angulo}deg) skewX(${inclinacao}deg) scale(${1.035 * respiro})`,
        }}
      />
    </div>
  );
};
