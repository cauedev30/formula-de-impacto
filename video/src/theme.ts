import { Easing } from "remotion";

// Cores amostradas do PNG do logo, por família de matiz — mesma paleta que o aplicativo usa.
// O laranja é a cor herói: aparece em no máximo um elemento por quadro e é ele que conduz o
// olho. Sobre fundo escuro ele tem contraste; sobre branco não teria, e por isso o app o usa
// só como superfície.
export const theme = {
  cores: {
    fundo: "#03203E",
    fundoAlt: "#062F58",
    azul: "#0054A2",
    heroi: "#F0900C",
    dados: "#E4AE2A",
    verde: "#6FBF3F",
    texto: "#F2F7FB",
    textoFraco: "#9CB8D4",
    papel: "#EEF2F6",
  },
  fontes: { display: "Archivo", corpo: "Inter" },
  ease: {
    saida: Easing.bezier(0.16, 1, 0.3, 1),
    entreSai: Easing.bezier(0.83, 0, 0.17, 1),
    entrada: Easing.bezier(0.7, 0, 0.84, 0),
  },
  mola: {
    rapida: { damping: 14, stiffness: 160, mass: 0.6 },
    suave: { damping: 20, stiffness: 90, mass: 1 },
    solta: { damping: 11, stiffness: 170, mass: 0.7 },
  },
} as const;
