import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

import telas from "./telas.json";
import { theme } from "./theme";

export const Entrada: React.FC<{ atraso?: number; children: React.ReactNode; style?: React.CSSProperties }> = ({
  atraso = 0,
  children,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - atraso, fps, config: theme.mola.suave });
  return (
    <div
      style={{
        ...style,
        opacity: p,
        transform: `translateY(${interpolate(p, [0, 1], [40, 0])}px) scale(${interpolate(p, [0, 1], [0.94, 1])})`,
      }}
    >
      {children}
    </div>
  );
};

export const Palavras: React.FC<{
  texto: string;
  atraso?: number;
  passo?: number;
  destaque?: string;
  style?: React.CSSProperties;
}> = ({ texto, atraso = 0, passo = 3, destaque, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Os dois lados perdem a pontuação: com ela só na palavra, destaque="frente." nunca casava
  // com "frente." e o realce simplesmente não aparecia.
  const semPonto = (p: string) => p.replace(/[.,:;!?]+$/, "");
  const alvo = destaque ? semPonto(destaque) : null;
  return (
    // Gap em px, não em em: dentro de um flex o em resolve contra a fonte do pai, que é 16px,
    // e o espaço entre palavras de 120px sai quase zero.
    <div style={{ display: "flex", flexWrap: "wrap", gap: 18, ...style }}>
      {texto.split(" ").map((palavra, i) => {
        const p = spring({ frame: frame - atraso - i * passo, fps, config: theme.mola.rapida });
        const marcada = alvo !== null && semPonto(palavra) === alvo;
        return (
          <span
            key={`${palavra}-${i}`}
            style={{
              display: "inline-block",
              opacity: p,
              color: marcada ? theme.cores.heroi : undefined,
              transform: `translateY(${interpolate(p, [0, 1], [34, 0])}px)`,
            }}
          >
            {palavra}
          </span>
        );
      })}
    </div>
  );
};

export const Malha: React.FC = () => {
  const frame = useCurrentFrame();
  const d1 = Math.sin(frame / 55) * 50;
  const d2 = Math.cos(frame / 70) * 40;
  return (
    <AbsoluteFill style={{ background: `linear-gradient(160deg, ${theme.cores.fundo}, ${theme.cores.fundoAlt})` }}>
      <div
        style={{
          position: "absolute",
          width: 1500,
          height: 1500,
          borderRadius: "50%",
          top: -560,
          left: -360 + d1,
          filter: "blur(60px)",
          background: `radial-gradient(circle, ${theme.cores.azul}55, transparent 62%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 1100,
          height: 1100,
          borderRadius: "50%",
          bottom: -480,
          right: -300 - d2,
          filter: "blur(80px)",
          background: `radial-gradient(circle, ${theme.cores.verde}22, transparent 65%)`,
        }}
      />
    </AbsoluteFill>
  );
};

export const Grade: React.FC = () => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    <AbsoluteFill style={{ backgroundColor: theme.cores.azul, mixBlendMode: "soft-light", opacity: 0.2 }} />
    <AbsoluteFill
      style={{
        background:
          "linear-gradient(180deg, rgba(0,0,0,0.12), transparent 28%, transparent 72%, rgba(0,0,0,0.24))",
      }}
    />
  </AbsoluteFill>
);

export const Grao: React.FC = () => {
  const frame = useCurrentFrame();
  const ruido = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='220' height='220' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E")`;
  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        backgroundImage: ruido,
        backgroundSize: "220px",
        backgroundPosition: `${(frame * 7) % 220}px ${(frame * 13) % 220}px`,
        opacity: 0.045,
        mixBlendMode: "overlay",
      }}
    />
  );
};

export const Vinheta: React.FC = () => (
  <AbsoluteFill
    style={{
      pointerEvents: "none",
      background: "radial-gradient(ellipse at center, transparent 54%, rgba(0,0,0,0.34) 100%)",
    }}
  />
);

export const Cena: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill
    style={{
      fontFamily: theme.fontes.display,
      color: theme.cores.texto,
      backgroundColor: theme.cores.fundo,
    }}
  >
    <Malha />
    {children}
    <Grade />
    <Grao />
    <Vinheta />
  </AbsoluteFill>
);

// As capturas são de página inteira, o que permite rolar de verdade dentro do quadro em vez
// de fingir movimento com corte. As dimensões vêm de telas.json, gerado das imagens: assim
// recapturar em outra densidade não obriga a caçar número solto pelas cenas.
export const Tablet: React.FC<{
  tela: string;
  rolagem?: [number, number];
  largura?: number;
  altura?: number;
}> = ({ tela, rolagem, largura = 470, altura = 752 }) => {
  const frame = useCurrentFrame();
  const fonte = (telas as Record<string, { largura: number; altura: number }>)[tela];
  const maximo = Math.max(0, (fonte.altura * largura) / fonte.largura - altura);
  const y = rolagem
    ? interpolate(frame, [rolagem[0], rolagem[1]], [0, -maximo], {
        easing: theme.ease.entreSai,
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 0;
  const respiro = Math.sin(frame / 42) * 4;
  const entrada = spring({ frame, fps: 30, config: theme.mola.suave });

  return (
    <div
      style={{
        width: largura + 26,
        height: altura + 26,
        borderRadius: 34,
        padding: 13,
        background: "linear-gradient(150deg, #16324f, #0a1e33)",
        boxShadow: "0 60px 120px -30px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.12)",
        border: "1px solid rgba(255,255,255,0.10)",
        opacity: entrada,
        transform: `translateY(${interpolate(entrada, [0, 1], [50, respiro])}px) scale(${interpolate(entrada, [0, 1], [0.93, 1])})`,
      }}
    >
      <div style={{ width: largura, height: altura, borderRadius: 22, overflow: "hidden", background: "#0054A2" }}>
        <Img
          src={staticFile(tela)}
          style={{ width: largura, display: "block", transform: `translateY(${y}px)` }}
        />
      </div>
    </div>
  );
};

export const Contador: React.FC<{ ate: number; atraso?: number; sufixo?: string; decimais?: number }> = ({
  ate,
  atraso = 0,
  sufixo = "",
  decimais = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const valor = interpolate(
    spring({ frame: frame - atraso, fps, config: { damping: 30, stiffness: 60 } }),
    [0, 1],
    [0, ate],
  );
  return <span style={{ fontVariantNumeric: "tabular-nums" }}>{`${valor.toFixed(decimais)}${sufixo}`}</span>;
};
