import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

import { Cena, Entrada, Palavras } from "../componentes";
import { theme } from "../theme";

// Ícone desenhado, não emoji: emoji vem com a cor da plataforma, ignora a paleta e quebra a
// regra de uma cor herói por quadro.
const Ficha: React.FC = () => (
  <svg width="86" height="112" viewBox="0 0 86 112" fill="none">
    <rect x="1" y="1" width="84" height="110" rx="6" fill="#DDE4EA" stroke="#B7C4D0" />
    {[22, 40, 58, 76, 94].map((y, i) => (
      <rect key={y} x="13" y={y} width={i % 2 ? 44 : 60} height="6" rx="3" fill="#9BAAB8" />
    ))}
  </svg>
);

const Pessoa: React.FC<{ rotulo: string; atraso: number }> = ({ rotulo, atraso }) => (
  <Entrada atraso={atraso} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
    <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
      <circle cx="36" cy="24" r="14" stroke={theme.cores.textoFraco} strokeWidth="3" />
      <path d="M10 66c0-14 12-24 26-24s26 10 26 24" stroke={theme.cores.textoFraco} strokeWidth="3" strokeLinecap="round" />
    </svg>
    <span style={{ fontSize: 25, color: theme.cores.textoFraco, fontFamily: theme.fontes.corpo }}>{rotulo}</span>
    <Ficha />
  </Entrada>
);

// Ângulo e posição vêm de índice fixo, não de aleatório: render não determinístico faz cada
// quadro sair diferente e a verificação por quadro deixa de provar coisa alguma.
const FichaSolta: React.FC<{ i: number; atraso: number }> = ({ i, atraso }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - atraso, fps, config: theme.mola.solta });
  const angulo = [-18, 12, -7, 22, -25, 5][i % 6];
  const x = [-640, -330, 90, 420, 690, -110][i % 6];
  const y = [-170, 150, -230, 190, -120, 260][i % 6];
  return (
    <div
      style={{
        position: "absolute",
        left: `calc(50% + ${x}px)`,
        top: `calc(50% + ${y}px)`,
        opacity: p * 0.92,
        transform: `translate(-50%, -50%) rotate(${interpolate(p, [0, 1], [0, angulo])}deg) scale(${interpolate(p, [0, 1], [0.6, 1.35])})`,
      }}
    >
      <Ficha />
    </div>
  );
};

export const Dor: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames: dur } = useVideoConfig();
  const corte1 = Math.round(dur * 0.35);
  const corte2 = Math.round(dur * 0.68);
  const sai = (de: number) =>
    interpolate(frame, [de, de + 14], [1, 0], {
      easing: theme.ease.entrada,
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

  return (
    <Cena>
      {frame < corte1 ? (
        <AbsoluteFill style={{ padding: 130, justifyContent: "center", opacity: sai(corte1 - 14) }}>
          <Palavras
            texto="Um formulário de papel"
            atraso={14}
            style={{ fontSize: 106, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.06 }}
          />
          <Palavras
            texto="igual para todo mundo."
            atraso={32}
            destaque="mundo"
            style={{ fontSize: 106, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.06, marginTop: 10 }}
          />
          <Entrada atraso={74} style={{ marginTop: 46 }}>
            <span style={{ fontSize: 33, color: theme.cores.textoFraco, fontFamily: theme.fontes.corpo }}>
              É assim que começa todo diagnóstico de território.
            </span>
          </Entrada>
        </AbsoluteFill>
      ) : null}

      {frame >= corte1 && frame < corte2 ? (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: sai(corte2 - 14) }}>
          <Entrada atraso={corte1 + 4}>
            <span style={{ fontSize: 48, fontWeight: 600, letterSpacing: "-0.02em" }}>
              A mesma folha para cada um.
            </span>
          </Entrada>
          <div style={{ display: "flex", gap: 88, marginTop: 64 }}>
            {["Prefeito", "Agricultora", "Jovem do campo", "Secretário"].map((rotulo, i) => (
              <Pessoa key={rotulo} rotulo={rotulo} atraso={corte1 + 14 + i * 6} />
            ))}
          </div>
        </AbsoluteFill>
      ) : null}

      {frame >= corte2 ? (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <FichaSolta key={i} i={i} atraso={corte2 + 6 + i * 5} />
          ))}
          <Entrada atraso={corte2 + 38} style={{ position: "relative", zIndex: 2 }}>
            <div
              style={{
                background: "rgba(3,32,62,0.88)",
                padding: "28px 50px",
                borderRadius: 18,
                border: `1px solid ${theme.cores.azul}`,
              }}
            >
              <span style={{ fontSize: 62, fontWeight: 700, letterSpacing: "-0.02em" }}>
                Anotação solta ninguém <span style={{ color: theme.cores.heroi }}>soma</span>.
              </span>
            </div>
          </Entrada>
        </AbsoluteFill>
      ) : null}
    </Cena>
  );
};
