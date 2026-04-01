import type { ComponentSerde } from "@gamenet/bjs";
import { playerSerde } from "./player_comp";
import { sphereSerde } from "./sphere_comp";

export const componentSerdes: Record<string, ComponentSerde> = {
  sphere: sphereSerde,
  player: playerSerde,
};
