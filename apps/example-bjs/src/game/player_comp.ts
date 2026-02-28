import { Color3 } from "@babylonjs/core";
import { createComponent } from "@skyboxgg/bjs-ecs";

export const player = createComponent(
  "player",
  (id: string, nickname: string, color: Color3) => ({ id, nickname, color })
);
