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
import { playerSerde } from "./player_comp";
import { ComponentSerde } from "./serde";
import { sphereSerde } from "./sphere_comp";

export type XformSyncData = {
  pos: Vector3;
  quat: Quaternion;
  linearVel?: Vector3;
  angularVel?: Vector3;
};

export const xformSync = createComponent(
  "xformSync",
  (diff: XformSyncData) => ({ diff })
);

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
      const xformData: XformSyncData = {
        pos: xformVal.position,
        quat:
          xformVal.rotationQuaternion ??
          Quaternion.FromEulerVector(xformVal.rotation),
        linearVel: xformVal.physicsBody?.getLinearVelocity(),
        angularVel: xformVal.physicsBody?.getAngularVelocity(),
      };
      compData = xformData;
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
      const xformComp = comps.xform as XformSyncData;
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
        pos: Vector3.Zero(),
        quat: Quaternion.Identity(),
        linearVel: Vector3.Zero(),
        angularVel: Vector3.Zero(),
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
