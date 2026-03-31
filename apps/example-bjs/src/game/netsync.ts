import { Scene } from "@babylonjs/core/scene";
import {
  type ComponentSerde,
  type ServerEntityIdMap,
  readCreateEntities as _readCreateEntities,
  readEntity as _readEntity,
  writeCreateEntities as _writeCreateEntities,
  writeEntity as _writeEntity,
} from "@gamenet/bjs";
import { GameClient } from "@gamenet/core";
import { Entity } from "@skyboxgg/bjs-ecs";
import { playerSerde } from "./player_comp";
import { sphereSerde } from "./sphere_comp";

export { xformSync, type XformSyncData } from "@gamenet/bjs";
export type { ServerEntityIdMap } from "@gamenet/bjs";

const componentSerdes: Record<string, ComponentSerde> = {
  sphere: sphereSerde,
  player: playerSerde,
};

export function writeEntity(e: Entity<["netsync"]>, isUpdate = false) {
  return _writeEntity(e, componentSerdes, isUpdate);
}

export function writeCreateEntities(isUpdate = false) {
  return _writeCreateEntities(componentSerdes, isUpdate);
}

export function readEntity(
  gameClient: GameClient,
  e: { id: number; name: string; comps: Array<{ k: string; v?: unknown }> },
  idMap: ServerEntityIdMap,
  scene: Scene
) {
  return _readEntity(gameClient, e, idMap, componentSerdes, scene);
}

export function readCreateEntities(
  gameClient: GameClient,
  data: unknown,
  idMap: ServerEntityIdMap,
  scene: Scene
) {
  return _readCreateEntities(gameClient, data, idMap, componentSerdes, scene);
}
