import {
  NullEngine,
  type NullEngineOptions,
} from "@babylonjs/core/Engines/nullEngine";
import { Color3, Vector3 } from "@babylonjs/core/Maths/math";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Scene } from "@babylonjs/core/scene";
import { GameServer } from "@gamenet/core";
import { addNodeEntity, entityEvents } from "@skyboxgg/bjs-ecs";
import { writeCreateEntities, writeEntity } from "./netsync";
import { player } from "./player_comp";
import { setupPlayer } from "./player_setup";
import { setupScene } from "./scene_setup";
import { sphere } from "./sphere_comp";
import { setupSphere } from "./sphere_setup";

const DEFAULT_NULL_ENGINE_OPTIONS: NullEngineOptions = {
  renderWidth: 1,
  renderHeight: 1,
  textureSize: 512,
  deterministicLockstep: true,
  lockstepMaxSteps: 4,
  timeStep: 1.0 / 64, // 64 ticks per second
};

const PLAYER_SPEED = 4; // units per second

export async function setupBabylonServer() {
  console.debug("Setting up Babylon.js server...");
  //engine
  const engine = new NullEngine({
    ...DEFAULT_NULL_ENGINE_OPTIONS,
  });

  //scene
  const scene = new Scene(engine);

  // setup scene
  if (scene.isReady()) {
    console.debug("Scene is already ready. Setting up...");
    await setupScene(scene, true);
  } else {
    console.debug("Waiting for scene to be ready...");
    scene.onReadyObservable.addOnce(async () => {
      console.debug("Scene is now ready. Setting up...");
      await setupScene(scene, true);
    });
  }

  // Player input state and movement
  const playerInputs = new Map<string, { dx: number; dz: number }>();
  const playerNodes = new Map<string, TransformNode>();

  // Create sphere as a netsync ECS entity
  const diffuseColor = new Color3(0.2, 0.5, 0.9);
  const specularColor = new Color3(0.4, 0.4, 0.4);
  const { sphereNode } = setupSphere(
    { diameter: 1.5, segments: 32, diffuseColor, specularColor },
    scene,
    true
  );
  sphereNode.position.y = 0.75;
  addNodeEntity(sphereNode, [
    sphere(1.5, 32, diffuseColor, specularColor),
    "netsync",
  ]);

  let frame = 0;
  const render = () => {
    setTimeout(render, engine.getTimeStep());
    engine.beginFrame();
    scene.render();
    if (engine._gl) {
      engine.endFrame();
    }
    ++frame;
    if (frame % 64 === 0) {
      // console.debug(`Server time: ${frame / 64}`);
    }
  };

  render();

  console.debug("Babylon.js server setup complete");

  return {
    onGameServerReady: (gameServer: GameServer) => {
      // handle adding/removing of entities
      entityEvents.on("add", ["netsync"], (entity) => {
        gameServer.broadcast("add-entity", writeEntity(entity), {
          reliable: true,
        });
      });
      entityEvents.on("remove", ["netsync"], (entity) => {
        gameServer.broadcast(
          "remove-entity",
          { id: entity.id },
          { reliable: true }
        );
      });

      // each tick, update player positions based on input and broadcast entity states
      scene.onBeforeRenderObservable.add(() => {
        //const dt = engine.getTimeStep() / 1000; // seconds
        for (const [clientId, input] of playerInputs) {
          // if (input.dx === 0 && input.dz === 0) continue;
          const node = playerNodes.get(clientId);
          if (!node) continue;
          const pbody = node.physicsBody;
          if (pbody) {
            const velocity = pbody.getLinearVelocity() || new Vector3();
            velocity.x = input.dx * PLAYER_SPEED;
            velocity.z = input.dz * PLAYER_SPEED;
            pbody.setLinearVelocity(velocity);
          }
        }
        gameServer.broadcast("update-entities", writeCreateEntities(true));
      });

      gameServer.onConnection = async (channel) => {
        // initial handshake
        let clientReadyReceived = 0;
        channel.on("ready", (_, ack) => {
          clientReadyReceived = ack + 1;
        });
        for (let i = 0; i < 10; ++i) {
          channel.emit("ready", clientReadyReceived, { reliable: true });
          if (clientReadyReceived > 1) {
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        if (clientReadyReceived < 1) {
          console.error("Failed to handshake with client");
          throw new Error("Failed to handshake with client");
        }
        await new Promise((resolve) => setTimeout(resolve, 60));

        channel.emit("msg", "Welcome to the babylon server!");

        channel.emit("create-entities", writeCreateEntities(), {
          reliable: true,
        });

        // create player
        const nickname = channel.nickname;
        const color = Color3.Random();
        const { playerNode } = setupPlayer(
          {
            id: channel.clientId,
            nickname,
            color: color,
            isServer: true,
          },
          scene
        );
        playerNode.position.x = Math.random() * 4 - 2;
        playerNode.position.z = Math.random() * 4 - 2;
        addNodeEntity(playerNode, [
          player(channel.clientId, nickname, color),
          "netsync",
        ]);

        // Track player node and listen for input
        playerNodes.set(channel.clientId, playerNode);
        channel.on("player-input", (_, data: { dx: number; dz: number }) => {
          playerInputs.set(channel.clientId, data);
        });

        channel.onDisconnect(() => {
          console.debug(`Client ${channel.clientId} disconnected`);
          playerNodes.delete(channel.clientId);
          playerInputs.delete(channel.clientId);
          playerNode.dispose();
        });
      };
    },
  };
}
