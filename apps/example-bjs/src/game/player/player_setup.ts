import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CreateCapsule } from "@babylonjs/core/Meshes/Builders/capsuleBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Observer } from "@babylonjs/core/Misc/observable";
import {
  PhysicsConstraintAxis,
  PhysicsMotionType,
} from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import { PhysicsBody } from "@babylonjs/core/Physics/v2/physicsBody";
import { Physics6DoFConstraint } from "@babylonjs/core/Physics/v2/physicsConstraint";
import { PhysicsShapeCylinder } from "@babylonjs/core/Physics/v2/physicsShape";
import type { Scene } from "@babylonjs/core/scene";

export function setupPlayer(
  options: {
    id: string;
    nickname: string;
    color: Color3;
    isServer: boolean;
  },
  scene: Scene
) {
  const node = new TransformNode("player_" + options.id, scene);
  node.position = new Vector3(0, 0, 0);

  const dirNode = new TransformNode("playerDir_" + options.id, scene);
  dirNode.parent = node;

  const height = 1.8;
  const mesh = CreateCapsule(
    "playerMesh",
    { height, radius: 0.3, tessellation: 16 },
    scene
  );
  mesh.position.y = height / 2;
  mesh.parent = dirNode;

  const visor = CreateCapsule(
    "visor",
    { height: 0.6, radius: 0.15, tessellation: 16 },
    scene
  );
  visor.position.y = height * 0.7;
  visor.position.z = 0.25;
  visor.rotation.x = Math.PI / 2;
  visor.rotation.y = Math.PI / 2;
  visor.parent = dirNode;

  const tail = CreateCapsule(
    "tail",
    { height: 0.6, radius: 0.15, tessellation: 16 },
    scene
  );
  tail.position.y = height * 0.3;
  tail.position.z = -0.15;
  tail.rotation.x = Math.PI / 2;
  tail.parent = dirNode;

  const mat = new StandardMaterial("playerMat", scene);
  mat.diffuseColor = options.color;
  mat.specularColor = new Color3(0.3, 0.3, 0.3);
  mesh.material = mat;

  const radius = 0.3;
  const shape = new PhysicsShapeCylinder(
    new Vector3(0, 0, 0),
    new Vector3(0, height, 0),
    radius,
    scene
  );
  const body = new PhysicsBody(node, PhysicsMotionType.DYNAMIC, false, scene);
  shape.material = { restitution: 0.1 };
  body.shape = shape;
  body.setMassProperties({ mass: 1 });
  // Always update the physics body from the transform node.
  body.disablePreStep = false;

  const anchor = scene.getTransformNodeByName("PhysicsAnchor");
  if (anchor && anchor.physicsBody && node.physicsBody) {
    const constraint = new Physics6DoFConstraint(
      {
        collision: false,
      },
      [
        {
          axis: PhysicsConstraintAxis.ANGULAR_X,
          maxLimit: 0,
          minLimit: 0,
        },
        {
          axis: PhysicsConstraintAxis.ANGULAR_Y,
          maxLimit: 0,
          minLimit: 0,
        },
        {
          axis: PhysicsConstraintAxis.ANGULAR_Z,
          maxLimit: 0,
          minLimit: 0,
        },
      ],
      scene
    );
    body.addConstraint(anchor.physicsBody, constraint);
  }

  // Handle direction on client
  let dirObs: Observer<Scene>;
  let lastTime = Date.now();
  if (!options.isServer) {
    dirObs = scene.onAfterPhysicsObservable.add(() => {
      const now = Date.now();
      const dt = now - lastTime;
      lastTime = now;
      const vel = body.getLinearVelocity();
      if (!vel || vel.lengthSquared() < 0.1) {
        return;
      }
      const forward = body.getLinearVelocity() || Vector3.Zero();
      forward.rotateByQuaternionToRef(node.rotationQuaternion!, forward);
      forward.y = 0;
      forward.normalize();
      const currentDir = dirNode.forward;
      currentDir.y = 0;
      Vector3.LerpToRef(currentDir, forward, Math.min(1, 0.02 * dt), forward);
      dirNode.setDirection(forward);
    });
  }

  // Clean up physics resources when player node is disposed
  node.onDisposeObservable.add(() => {
    dirObs?.remove();
    body.dispose();
    shape.dispose();
  });

  return { node };
}
