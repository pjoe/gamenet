import type { ComponentSerde } from "@gamenet/bjs";
import { playerSerde } from "./player/player_comp";
import { sphereSerde } from "./sphere/sphere_comp";

export const componentSerdes: Record<string, ComponentSerde> = {
  sphere: sphereSerde,
  player: playerSerde,
};
