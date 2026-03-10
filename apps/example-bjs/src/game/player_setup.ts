import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
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

  const height = 1.8;
  const mesh = CreateCylinder(
    "playerMesh",
    { height, diameter: 0.6, tessellation: 16 },
    scene
  );
  mesh.position.y = height / 2;
  mesh.parent = node;

  const mat = new StandardMaterial("playerMat", scene);
  mat.diffuseColor = options.color;
  mat.specularColor = new Color3(0.3, 0.3, 0.3);
  mesh.material = mat;

  if (options.isServer || true) {
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

    // Clean up physics resources when player node is disposed
    node.onDisposeObservable.add(() => {
      body.dispose();
      shape.dispose();
    });
  }

  return { node };
}
