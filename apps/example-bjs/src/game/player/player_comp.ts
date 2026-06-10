import { Color3 } from "@babylonjs/core/Maths/math.color";
import { genericSerde, type ComponentSerde } from "@gamenet/bjs";
import { createComponent } from "@skyboxgg/bjs-ecs";
import type { GameSerdeState } from "../serdes_config";
import { setupPlayer } from "./player_setup";

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

const basePlayerSerde = genericSerde<ReturnType<typeof player>, GameSerdeState>(
  {
    compType: player,
    keys: playerNetSyncKeys,
    setupNode: (options, state) => setupPlayer(options, state.scene),
  }
);

export const playerSerde: ComponentSerde<GameSerdeState> = {
  ...basePlayerSerde,
  deserialize: (data, state) => {
    const result = basePlayerSerde.deserialize(data, state);
    const playerComp = result.comps[0] as ReturnType<typeof player>;
    if (playerComp.value.id === state.clientId) {
      result.comps.push("me");
    }
    return result;
  },
};
