import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

import { Cena, Contador, Entrada, Tablet } from "../componentes";
import { theme } from "../theme";

const Passo: React.FC<{ numero: string; titulo: string; linha: string; atraso: number }> = ({
  numero,
  titulo,
  linha,
  atraso,
}) => (
  <Entrada atraso={atraso} style={{ display: "flex", gap: 22, alignItems: "flex-start" }}>
    <span
      style={{
        fontSize: 22,
        fontWeight: 700,
        color: theme.cores.fundo,
        background: theme.cores.dados,
        borderRadius: 999,
        width: 42,
        height: 42,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {numero}
    </span>
    <div>
      <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: "-0.02em" }}>{titulo}</div>
      <div style={{ fontSize: 27, color: theme.cores.textoFraco, fontFamily: theme.fontes.corpo, marginTop: 6 }}>
        {linha}
      </div>
    </div>
  </Entrada>
);

export const Como: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames: dur } = useVideoConfig();
  const a = Math.round(dur * 0.34);
  const b = Math.round(dur * 0.68);
  // Três blocos dentro da mesma cena: trocar de tela do tablet sem trocar de cena mantém o
  // aparelho no lugar, e é o conteúdo dele que muda — que é exatamente o argumento.
  const bloco = frame < a ? 0 : frame < b ? 1 : 2;
  const telas = ["telas/tablet-3-formulario.png", "telas/tablet-3-formulario.png", "telas/tablet-5-consolidado.png"];
  const rolagens: Array<[number, number] | undefined> = [[16, a - 4], [a + 16, b - 4], [b + 12, dur - 14]];

  return (
    <Cena>
      <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", padding: "0 130px", gap: 100 }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 40 }}>
          <Entrada atraso={4}>
            <span style={{ fontSize: 30, letterSpacing: "0.16em", color: theme.cores.dados, fontWeight: 600 }}>
              COMO FUNCIONA
            </span>
          </Entrada>
          <Passo
            numero="1"
            titulo="Você escolhe quem vai entrevistar"
            linha="17 perfis possíveis, do prefeito à jovem quilombola."
            atraso={16}
          />
          <Passo
            numero="2"
            titulo="O aparelho monta as perguntas na hora"
            linha="Entre 20 e 25, quase todas objetivas: é marcar e seguir."
            atraso={26}
          />
          <Passo
            numero="3"
            titulo="Resposta longa, o entrevistado fala"
            linha="O áudio vira texto sozinho e a gravação continua guardada."
            atraso={36}
          />
          <Passo
            numero="4"
            titulo="Sai a ficha e sai o consolidado"
            linha="Uma entrevista vira registro. Muitas viram diagnóstico."
            atraso={46}
          />
          {bloco === 2 ? (
            <Entrada
              atraso={b + 6}
              style={{
                display: "flex",
                gap: 54,
                marginTop: 12,
                borderTop: `1px solid ${theme.cores.azul}`,
                paddingTop: 30,
              }}
            >
              <div>
                <div style={{ fontSize: 62, fontWeight: 800, color: theme.cores.heroi }}>
                  <Contador ate={17} atraso={b + 14} />
                </div>
                <div style={{ fontSize: 24, color: theme.cores.textoFraco, fontFamily: theme.fontes.corpo }}>
                  perfis de entrevistado
                </div>
              </div>
              <div>
                <div style={{ fontSize: 62, fontWeight: 800 }}>
                  <Contador ate={25} atraso={b + 24} />
                </div>
                <div style={{ fontSize: 24, color: theme.cores.textoFraco, fontFamily: theme.fontes.corpo }}>
                  perguntas no máximo
                </div>
              </div>
            </Entrada>
          ) : null}
        </div>

        <div
          style={{
            opacity: interpolate(frame, [0, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          }}
        >
          <Tablet tela={telas[bloco]} rolagem={rolagens[bloco]} />
        </div>
      </AbsoluteFill>
    </Cena>
  );
};
