import { Color3 } from "@babylonjs/core";
import { createComponent } from "@skyboxgg/bjs-ecs";
import { setupPlayer } from "./player_setup";
import { genericSerde } from "./serde";

type PlayerOptions = {
  id: string;
  nickname: string;
  color: Color3;
  isServer: boolean;
};

export const player = createComponent(
  "player",
  (options: PlayerOptions) => options
);

const playerNetSyncKeys = ["id", "nickname", "color"] as const;

export const playerSerde = genericSerde(player, playerNetSyncKeys, setupPlayer);
