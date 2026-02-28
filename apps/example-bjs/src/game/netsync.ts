import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Scene } from "@babylonjs/core/scene";
import {
  addNodeEntity,
  Comp,
  Entity,
  queryXforms,
  xform,
} from "@skyboxgg/bjs-ecs";
import { GameClient } from "node_modules/@gamenet/core/dist/game_client";
import { player } from "./player_comp";
import { setupPlayer } from "./player_setup";

export function writeEntity(e: Entity<["netsync"]>, isUpdate = false) {
  let name = "nameless";
  const comps = Object.entries(e.comps).map(([key, comp]) => {
    let compData = undefined;
    if (key === "player" && !isUpdate) {
      compData = {
        id: (comp as ReturnType<typeof player>).value.id,
        nickname: (comp as ReturnType<typeof player>).value.nickname,
        color: (comp as ReturnType<typeof player>).value.color,
      };
    }
    if (key === "xform") {
      const xformVal = (comp as ReturnType<typeof xform>).value;
      name = xformVal.name;
      compData = xformVal.rotationQuaternion
        ? {
            pos: xformVal.position,
            quat: xformVal.rotationQuaternion,
          }
        : {
            pos: xformVal.position,
            rot: xformVal.rotation,
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
  let xformNode: TransformNode | undefined = undefined;
  const compsToAdd: (Comp | string)[] = ["netsync"];
  if (comps.player) {
    // create player
    const playerComp = comps.player as {
      id: string;
      nickname: string;
      color: Color3;
    };

    // skip if already exists
    const players = queryXforms([player]);
    if (players.find((p) => p.player.id === playerComp.id)) {
      console.debug(
        `Player with id ${playerComp.id} already exists, skipping creation`
      );
      return;
    }

    if (playerComp.id === gameClient.clientId) {
      compsToAdd.push("me");
    }

    const color = new Color3().copyFrom(playerComp.color);
    const { playerNode } = setupPlayer(
      {
        id: playerComp.id,
        nickname: playerComp.nickname,
        color,
      },
      scene
    );
    compsToAdd.push(player(playerComp.id, playerComp.nickname, color));
    xformNode = playerNode;
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
  entities.forEach((e) => readEntity(gameClient, e, idMap, scene));
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
      // console.debug(
      //   `Updating entity serverId:${e.id} (${e.name}) with comps:`,
      //   e.comps
      // );
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
