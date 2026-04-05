import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Scene } from "@babylonjs/core/scene";
import {
  readCreateEntities,
  readEntity,
  ServerEntityIdMap,
  setupReconcile,
  xformSync,
  XformSyncData,
} from "@gamenet/bjs";
import { clientReady, createSnapshotVault, GameClient } from "@gamenet/core";
import { queryXforms, removeEntity, xform } from "@skyboxgg/bjs-ecs";
import { setupPlayerInput } from "./player_input_system";
import { setupScene } from "./scene_setup";
import { componentSerdes } from "./serdes_config";

export async function setupBabylonClient(gameClient: GameClient, scene: Scene) {
  console.debug("Setting up Babylon.js client scene...");
  await setupScene(scene, false);

  // set up message handlers
  const serverIdMap: ServerEntityIdMap = new Map();
  const vault = createSnapshotVault(64);
  vault.registerSchema("xform", {
    pos: { lerp: (a, b, t) => Vector3.Lerp(a as Vector3, b as Vector3, t) },
    quat: {
      lerp: (a, b, t) => Quaternion.Slerp(a as Quaternion, b as Quaternion, t),
    },
    linearVel: {
      lerp: (a, b, t) => Vector3.Lerp(a as Vector3, b as Vector3, t),
    },
    angularVel: {
      lerp: (a, b, t) => {
        const qa = Quaternion.FromEulerVector(a as Vector3);
        const qb = Quaternion.FromEulerVector(b as Vector3);
        const qResult = Quaternion.Slerp(qa, qb, t);
        return qResult.toEulerAngles();
      },
    },
  });
  gameClient.on("msg", async (data) => {
    console.debug("Received msg:", data);
  });
  gameClient.on("create-entities", async (data) => {
    readCreateEntities(gameClient, data, serverIdMap, componentSerdes, scene);
  });
  gameClient.on("add-entity", async (data) => {
    readEntity(gameClient, data, serverIdMap, componentSerdes, scene);
  });
  gameClient.on("remove-entity", async (data) => {
    const e = data as { id: number };
    const clientEntity = serverIdMap.get(e.id);
    if (clientEntity) {
      removeEntity(clientEntity);
      serverIdMap.delete(e.id);
      vault.remove(e.id);
    }
  });
  let lastServerUpdateTime = 0;
  gameClient.on(
    "update-entities",
    async (data: { time: number; entities: unknown[] }) => {
      if (data.time < lastServerUpdateTime) {
        // ignore out-of-order update
        return;
      }
      lastServerUpdateTime = data.time;

      // store entitiy diffs
      const entities = data.entities as Array<{
        id: number;
        name: string;
        comps: Array<{ k: string; v?: unknown }>;
      }>;
      entities.forEach((e) => {
        const existingEntity = serverIdMap.get(e.id);
        if (existingEntity) {
          const xformComp = e.comps.find((c) => c.k === "xform")?.v as
            | XformSyncData
            | undefined;
          if (xformComp) {
            const xformVal = (
              existingEntity.comps.xform as ReturnType<typeof xform>
            ).value;
            // lookup in snapshot vault
            const vaultXform = vault.query(
              existingEntity.id,
              "xform",
              data.time - gameClient.timeDiff
            ) as XformSyncData | null;
            if (xformVal && vaultXform) {
              const pos = new Vector3().copyFrom(xformComp.pos);
              const quat = new Quaternion().copyFrom(xformComp.quat);
              const linearVel = xformComp.linearVel
                ? new Vector3().copyFrom(xformComp.linearVel)
                : undefined;
              const angularVel = xformComp.angularVel
                ? new Vector3().copyFrom(xformComp.angularVel)
                : undefined;

              const xformSyncVal = (
                existingEntity.comps.xformSync as ReturnType<typeof xformSync>
              ).value;
              if (xformSyncVal) {
                const diff = xformSyncVal.diff;
                diff.pos = pos.subtract(vaultXform.pos);
                diff.quat = quat.multiply(vaultXform.quat.conjugate());
                diff.linearVel = linearVel?.subtract(
                  vaultXform.linearVel ?? Vector3.Zero()
                );
                diff.angularVel = angularVel?.subtract(
                  vaultXform.angularVel ?? Vector3.Zero()
                );
              }
            }
          }
        }
      });
    }
  );

  // reconcile
  setupReconcile(scene);

  // client snapshots (capped at 64 Hz)
  const snapshotIntervalMs = 1000 / 64;
  let lastSnapshotTime = 0;
  scene.onAfterRenderObservable.add(() => {
    const now = Date.now();
    const delta = now - lastSnapshotTime;
    if (delta < snapshotIntervalMs) return;
    if (lastSnapshotTime === 0) {
      lastSnapshotTime = now;
    } else {
      if (delta > snapshotIntervalMs * 1.2) {
        lastSnapshotTime = now;
      } else {
        lastSnapshotTime += snapshotIntervalMs;
      }
    }
    const snapshotXforms = queryXforms(["netsync"]).map((e) => ({
      id: e.id,
      pos: e.xform.position,
      quat:
        e.xform.rotationQuaternion ??
        Quaternion.FromEulerVector(e.xform.rotation),
    }));
    snapshotXforms.forEach((snap) => {
      vault.push(snap.id, "xform", now, {
        pos: snap.pos,
        quat: snap.quat,
      });
    });
  });

  // initial handshake
  await clientReady(gameClient);

  setupPlayerInput(gameClient, scene);
}
