import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";
import { entityEvents, queryXforms, xform } from "@skyboxgg/bjs-ecs";
import { sphere } from "./sphere_comp";

const RESPAWN_Y_THRESHOLD = -10;

export function setupSphereRespawnSystem(scene: Scene) {
  // Capture the starting position of each sphere when its entity is added
  const startPositions = new Map<number, Vector3>();

  entityEvents.on("add", [sphere, xform], (entity) => {
    startPositions.set(entity.id, entity.xform.position.clone());
  });

  entityEvents.on("remove", [sphere], (entity) => {
    startPositions.delete(entity.id);
  });

  scene.onBeforeRenderObservable.add(() => {
    const spheres = queryXforms([sphere]);
    for (const entity of spheres) {
      const node = entity.xform;
      if (node.position.y >= RESPAWN_Y_THRESHOLD) continue;

      const start = startPositions.get(entity.id);
      if (!start) continue;

      node.position.copyFrom(start);
      node.rotationQuaternion?.set(0, 0, 0, 1);

      const pbody = node.physicsBody;
      if (pbody) {
        pbody.setLinearVelocity(Vector3.Zero());
        pbody.setAngularVelocity(Vector3.Zero());
      }
    }
  });
}
