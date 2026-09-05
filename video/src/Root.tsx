import React from "react";
import { Composition } from "remotion";

import { Apresentacao } from "./Apresentacao";
import { FPS, TOTAL } from "./roteiro";

export const RemotionRoot: React.FC = () => (
  <Composition id="Apresentacao" component={Apresentacao} durationInFrames={TOTAL} fps={FPS} width={1920} height={1080} />
);
