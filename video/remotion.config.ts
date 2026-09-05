import { Config } from "@remotion/cli/config";

// PNG nos quadros intermediários: em JPEG o degradê azul do fundo ganha faixa visível, e é
// justamente ele que ocupa a tela inteira em toda cena.
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
