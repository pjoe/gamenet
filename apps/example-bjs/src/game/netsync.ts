import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Scene } from "@babylonjs/core/scene";
import { queryXforms, xform } from "@skyboxgg/bjs-ecs";
import { player, setupPlayer } from "./player_setup";

export function writeCreateEntities() {
  const entities = queryXforms(["netsync"]);
  const data = entities.map((e) => {
    const comps = Object.entries(e.comps).map(([key, comp]) => {
      let compData = undefined;
      if (key === "player") {
        compData = {
          nickname: (comp as ReturnType<typeof player>).value.nickname,
          color: (comp as ReturnType<typeof player>).value.color,
        };
      }
      if (key === "xform") {
        const xformVal = (comp as ReturnType<typeof xform>).value;
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
    return { id: e.id, name: e.xform.name, comps };
  });
  return data;
}

export function readCreateEntities(data: unknown, scene: Scene) {
  const entities = data as Array<{
    id: string;
    name: string;
    comps: Array<{ k: string; v?: unknown }>;
  }>;
  entities.forEach((e) => {
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
    if (comps.player) {
      // create player
      const playerComp = comps.player as {
        nickname: string;
        color: Color3;
      };
      const playerNode = setupPlayer(
        {
          id: e.id,
          nickname: playerComp.nickname,
          color: new Color3().copyFrom(playerComp.color),
        },
        scene
      );
      xformNode = playerNode;
    }

    // xform
    if (comps.xform && xformNode) {
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
  });
}
