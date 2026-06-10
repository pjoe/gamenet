import type { Scene } from "@babylonjs/core/scene";
import {
  xformSerde,
  type ComponentSerde,
  type NetsyncState,
} from "@gamenet/bjs";
import type { SnapshotVault } from "@gamenet/core";
import { playerSerde } from "./player/player_comp";
import { sphereSerde } from "./sphere/sphere_comp";

/** App-specific serde state shared by all component serdes. */
export interface GameSerdeState extends NetsyncState {
  scene: Scene;
  /** Local client id (client-side only). */
  clientId?: string;
  /** Snapshot vault for reconciliation (client-side only). */
  vault?: SnapshotVault;
  /** Render time (server-time ms) of the update being applied (client-side only). */
  renderTime?: number;
}

export const componentSerdes: Record<string, ComponentSerde<GameSerdeState>> = {
  xform: xformSerde,
  sphere: sphereSerde,
  player: playerSerde,
};
