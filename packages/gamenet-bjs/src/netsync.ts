import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Scene } from "@babylonjs/core/scene";
import { GameClient } from "@gamenet/core";
import {
  addNodeEntity,
  Comp,
  createComponent,
  Entity,
  queryXforms,
  xform,
} from "@skyboxgg/bjs-ecs";
import { ComponentSerde } from "./serde";

export type XformSyncData = {
  pos: Vector3;
  quat: Quaternion;
  linearVel?: Vector3;
  angularVel?: Vector3;
  /** Server time (ms) of the last teleport for this xform, if any. */
  teleportTime?: number;
};

export function serializeXformSyncData(data: XformSyncData): number[] {
  const arr = [
    (data.linearVel ? 1 : 0) |
      (data.angularVel ? 2 : 0) |
      (data.teleportTime ? 4 : 0),
    data.pos.x,
    data.pos.y,
    data.pos.z,
    data.quat.x,
    data.quat.y,
    data.quat.z,
    data.quat.w,
  ];
  if (data.linearVel) {
    arr.push(data.linearVel.x, data.linearVel.y, data.linearVel.z);
  }
  if (data.angularVel) {
    arr.push(data.angularVel.x, data.angularVel.y, data.angularVel.z);
  }
  if (data.teleportTime) {
    arr.push(data.teleportTime);
  }
  return arr;
}

export function deserializeXformSyncData(arr: number[]): XformSyncData {
  const flags = arr[0];
  const data: XformSyncData = {
    pos: new Vector3(arr[1], arr[2], arr[3]),
    quat: new Quaternion(arr[4], arr[5], arr[6], arr[7]),
  };
  let index = 8;
  if (flags & 1) {
    data.linearVel = new Vector3(arr[index], arr[index + 1], arr[index + 2]);
    index += 3;
  }
  if (flags & 2) {
    data.angularVel = new Vector3(arr[index], arr[index + 1], arr[index + 2]);
    index += 3;
  }
  if (flags & 4) {
    data.teleportTime = arr[index];
  }
  return data;
}

export const xformSync = createComponent(
  "xformSync",
  (init: { diff: XformSyncData; lastTeleportTime?: number }) => ({
    diff: init.diff,
    lastTeleportTime: init.lastTeleportTime ?? 0,
  })
);

/**
 * Mark the given transform node as having teleported at `time` (ms).
 * The next networked update will carry this `teleportTime`, allowing
 * clients to snap the entity instead of interpolating toward the new state.
 */
export function markXformTeleport(
  node: TransformNode,
  time: number = Date.now()
): void {
  if (!node.metadata) {
    node.metadata = {};
  }
  (node.metadata as { teleportTime?: number }).teleportTime = time;
}

type SerializedEntity = {
  id: number;
  name?: string;
  [key: string]: unknown;
};
export function writeEntity(
  e: Entity<["netsync"]>,
  registry: Record<string, ComponentSerde>,
  isUpdate = false
): SerializedEntity {
  let name = "nameless";
  const comps: Record<string, unknown> = {};
  for (const [key, comp] of Object.entries(e.comps)) {
    let compData: unknown = undefined;
    if (key in registry && !isUpdate) {
      compData = registry[key].serialize(comp);
    }
    if (key === "xform") {
      const xformVal = (comp as ReturnType<typeof xform>).value;
      name = xformVal.name;
      const xformData: XformSyncData = {
        pos: xformVal.position,
        quat:
          xformVal.rotationQuaternion ??
          Quaternion.FromEulerVector(xformVal.rotation),
        linearVel: xformVal.physicsBody?.getLinearVelocity(),
        angularVel: xformVal.physicsBody?.getAngularVelocity(),
      };
      const teleportTime = (
        xformVal.metadata as { teleportTime?: number } | null
      )?.teleportTime;
      if (teleportTime !== undefined) {
        xformData.teleportTime = teleportTime;
      }
      compData = serializeXformSyncData(xformData);
    }
    if (compData !== undefined || !isUpdate) {
      // skip tag comps for updates to minimize bandwidth
      comps[key] = compData ?? true;
    }
  }
  if (isUpdate) {
    // for updates, don't include the name to minimize bandwidth
    return { id: e.id, ...comps };
  }
  return { id: e.id, name, ...comps };
}

export type EntitiesSync = ReturnType<typeof writeEntity>[];
export function writeCreateEntities(
  registry: Record<string, ComponentSerde>,
  isUpdate = false
): EntitiesSync {
  const entities = queryXforms(["netsync"]);
  const data = entities.map((e) => writeEntity(e, registry, isUpdate));
  return data;
}

export type ServerEntityIdMap = Map<number, Entity<["netsync"]>>;

export function readEntity(
  gameClient: GameClient,
  e: SerializedEntity,
  idMap: ServerEntityIdMap,
  registry: Record<string, ComponentSerde>,
  scene: Scene
) {
  const comps: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(e)) {
    if (k === "id" || k === "name") continue;
    comps[k] = v === true ? {} : (v ?? {});
  }
  console.debug(
    `Creating entity serverId:${e.id} (${e.name}) with comps:`,
    comps
  );
  let xformNode: TransformNode | null = null;
  const compsToAdd: (Comp | string)[] = ["netsync"];

  for (const [key, val] of Object.entries(comps)) {
    if (key in registry && val) {
      const { comp, node } = registry[key].deserialize(val, scene);
      if (comp) {
        compsToAdd.push(comp);
        if (node) {
          xformNode = node;
        }
        if (key === "player" && comp.value.id === gameClient.clientId) {
          compsToAdd.push("me");
        }
      }
    }
  }

  // xform
  if (xformNode) {
    if (comps.xform) {
      const xformComp = deserializeXformSyncData(comps.xform as number[]);
      xformNode.position.copyFrom(xformComp.pos);
      xformNode.rotationQuaternion = new Quaternion().copyFrom(xformComp.quat);
      if (xformNode.physicsBody) {
        if (xformComp.linearVel) {
          xformNode.physicsBody.setLinearVelocity(xformComp.linearVel);
        }
        if (xformComp.angularVel) {
          xformNode.physicsBody.setAngularVelocity(xformComp.angularVel);
        }
      }
    }
    // add xform sync comp
    compsToAdd.push(
      xformSync({
        diff: {
          pos: Vector3.Zero(),
          quat: Quaternion.Identity(),
          linearVel: Vector3.Zero(),
          angularVel: Vector3.Zero(),
        },
        lastTeleportTime:
          (comps.xform as XformSyncData | undefined)?.teleportTime ?? 0,
      })
    );
    const entity = addNodeEntity(xformNode, compsToAdd);
    idMap.set(Number(e.id), entity);
  }
}

export function readCreateEntities(
  gameClient: GameClient,
  data: unknown,
  idMap: ServerEntityIdMap,
  registry: Record<string, ComponentSerde>,
  scene: Scene
) {
  const entities = data as Array<{
    id: number;
    name: string;
    comps: Record<string, unknown>;
  }>;
  entities
    .filter((e) => !idMap.has(e.id)) // skip existing entitites
    .forEach((e) => readEntity(gameClient, e, idMap, registry, scene));
}
