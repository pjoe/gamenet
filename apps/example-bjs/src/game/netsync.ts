import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Scene } from "@babylonjs/core/scene";
import { GameClient, type SnapshotVault } from "@gamenet/core";
import {
  addNodeEntity,
  Comp,
  Entity,
  queryXforms,
  xform,
} from "@skyboxgg/bjs-ecs";
import { playerSerde } from "./player_comp";
import { ComponentSerde } from "./serde";
import { sphereSerde } from "./sphere_comp";

const componentSerdes: Record<string, ComponentSerde> = {
  sphere: sphereSerde,
  player: playerSerde,
};

export function writeEntity(e: Entity<["netsync"]>, isUpdate = false) {
  let name = "nameless";
  const comps = Object.entries(e.comps).map(([key, comp]) => {
    let compData = undefined;
    if (key in componentSerdes && !isUpdate) {
      compData = componentSerdes[key].serialize(comp);
    }
    if (key === "xform") {
      const xformVal = (comp as ReturnType<typeof xform>).value;
      name = xformVal.name;
      compData = {
        pos: xformVal.position,
        quat:
          xformVal.rotationQuaternion ??
          Quaternion.FromEulerVector(xformVal.rotation),
      };
    }
    if (compData) {
      return { k: key, v: compData };
    }
    return { k: key };
  });
  return { id: e.id, name, comps };
}

export function writeCreateEntities(isUpdate = false) {
  const entities = queryXforms(["netsync"]);
  const data = entities.map((e) => writeEntity(e, isUpdate));
  return data;
}

export type ServerEntityIdMap = Map<number, Entity<["netsync"]>>;

export function readEntity(
  gameClient: GameClient,
  e: { id: number; name: string; comps: Array<{ k: string; v?: unknown }> },
  idMap: ServerEntityIdMap,
  scene: Scene
) {
  const comps = e.comps.reduce(
    (acc, { k, v }) => {
      acc[k] = v ?? {};
      return acc;
    },
    {} as Record<string, unknown>
  );
  console.debug(
    `Creating entity serverId:${e.id} (${e.name}) with comps:`,
    comps
  );
  let xformNode: TransformNode | null = null;
  const compsToAdd: (Comp | string)[] = ["netsync"];

  for (const [key, val] of Object.entries(comps)) {
    if (key in componentSerdes && val) {
      const { comp, node } = componentSerdes[key].deserialize(val, scene);
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
      const xformComp = comps.xform as {
        pos: Vector3;
        rot: Vector3 | undefined;
        quat: Quaternion | undefined;
      };
      xformNode.position.copyFrom(xformComp.pos);
      if (xformComp.quat) {
        xformNode.rotationQuaternion = new Quaternion().copyFrom(
          xformComp.quat
        );
      } else if (xformComp.rot) {
        xformNode.rotation.copyFrom(xformComp.rot);
      }
    }
    const entity = addNodeEntity(xformNode, compsToAdd);
    idMap.set(Number(e.id), entity);
  }
}

export function readCreateEntities(
  gameClient: GameClient,
  data: unknown,
  idMap: ServerEntityIdMap,
  scene: Scene
) {
  const entities = data as Array<{
    id: number;
    name: string;
    comps: Array<{ k: string; v?: unknown }>;
  }>;
  entities
    .filter((e) => !idMap.has(e.id)) // skip existing entitites
    .forEach((e) => readEntity(gameClient, e, idMap, scene));
}

export function readUpdateEntities(data: unknown, idMap: ServerEntityIdMap) {
  const entities = data as Array<{
    id: number;
    name: string;
    comps: Array<{ k: string; v?: unknown }>;
  }>;
  entities.forEach((e) => {
    const existingEntity = idMap.get(e.id);
    if (existingEntity) {
      const xformComp = e.comps.find((c) => c.k === "xform")?.v as
        | {
            pos: Vector3;
            rot: Vector3 | undefined;
            quat: Quaternion | undefined;
          }
        | undefined;
      if (xformComp) {
        const xformData = {
          position: xformComp.pos,
          rotation: xformComp.rot,
          rotationQuaternion: xformComp.quat,
        };
        const existingXform = existingEntity.comps.xform;
        const xformVal = (existingXform as ReturnType<typeof xform>).value;
        if (xformVal) {
          xformVal.position.copyFrom(xformData.position);
          if (xformData.rotationQuaternion) {
            xformVal.rotationQuaternion = new Quaternion().copyFrom(
              xformData.rotationQuaternion
            );
          } else if (xformData.rotation) {
            xformVal.rotation.copyFrom(xformData.rotation);
          }
        }
      }
    }
  });
}

export function pushEntitySnapshots(
  vault: SnapshotVault,
  time: number,
  data: unknown
) {
  const entities = data as Array<{
    id: number;
    comps: Array<{ k: string; v?: Record<string, unknown> }>;
  }>;
  for (const e of entities) {
    for (const c of e.comps) {
      if (c.v) {
        vault.push(e.id, c.k, time, c.v);
      }
    }
  }
}
