import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Scene } from "@babylonjs/core/scene";
import {
  captureSnapshots,
  readCreateEntities,
  readEntity,
  readUpdateEntities,
  ServerEntityIdMap,
  setupReconcile,
  type EntitiesSync,
  type SerializedEntity,
} from "@gamenet/bjs";
import { clientReady, createSnapshotVault, GameClient } from "@gamenet/core";
import { removeEntity } from "@skyboxgg/bjs-ecs";
import { setupPlayerInput } from "./player/player_input_system";
import { setupScene } from "./scene_setup";
import { componentSerdes, type GameSerdeState } from "./serdes_config";

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
  const serdeState: GameSerdeState = {
    entity: null,
    node: null,
    scene,
    clientId: gameClient.clientId,
    vault,
  };
  gameClient.on("create-entities", async (data) => {
    readCreateEntities(data, serverIdMap, componentSerdes, serdeState);
  });
  gameClient.on("add-entity", async (data) => {
    readEntity(
      data as SerializedEntity,
      serverIdMap,
      componentSerdes,
      serdeState
    );
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

      // apply entity update sync via serdes
      const entities = data.entities as EntitiesSync;
      readUpdateEntities(entities, serverIdMap, componentSerdes, {
        ...serdeState,
        renderTime: data.time - gameClient.timeDiff,
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
    captureSnapshots(componentSerdes, vault, serdeState, now);
  });

  // initial handshake
  await clientReady(gameClient);

  setupPlayerInput(gameClient, scene);
}
