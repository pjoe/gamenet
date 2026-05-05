import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Scene } from "@babylonjs/core/scene";
import {
  readCreateEntities,
  readEntity,
  ServerEntityIdMap,
  setupReconcile,
  storeEntityXformDiffs,
  type EntitiesSync,
} from "@gamenet/bjs";
import { clientReady, createSnapshotVault, GameClient } from "@gamenet/core";
import { queryXforms, removeEntity } from "@skyboxgg/bjs-ecs";
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

      // store entitiy xform diffs
      const entities = data.entities as EntitiesSync;
      storeEntityXformDiffs(
        entities,
        data.time - gameClient.timeDiff,
        vault,
        serverIdMap
      );
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
    queryXforms(["netsync"]).forEach((e) => {
      vault.push(e.id, "xform", now, {
        pos: e.xform.position,
        quat:
          e.xform.rotationQuaternion ??
          Quaternion.FromEulerVector(e.xform.rotation),
        linearVel: e.xform.physicsBody?.getLinearVelocity(),
        angularVel: e.xform.physicsBody?.getAngularVelocity(),
      });
    });
  });

  // initial handshake
  await clientReady(gameClient);

  setupPlayerInput(gameClient, scene);
}
