import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { PhysicsShapeType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import type { Scene } from "@babylonjs/core/scene";

export function setupSphere(
  options: {
    diameter: number;
    segments: number;
    diffuseColor: Color3;
    specularColor: Color3;
  },
  scene: Scene,
  isServer = false
) {
  const sphereNode = new TransformNode("sphere", scene);

  const mesh = CreateSphere(
    "sphereMesh",
    { diameter: options.diameter, segments: options.segments },
    scene
  );
  mesh.parent = sphereNode;

  const mat = new StandardMaterial("sphereMat", scene);
  mat.diffuseColor = options.diffuseColor;
  mat.specularColor = options.specularColor;
  mesh.material = mat;

  if (isServer) {
    new PhysicsAggregate(
      sphereNode,
      PhysicsShapeType.SPHERE,
      { mass: 1, restitution: 0.5 },
      scene
    );
  }

  return { sphereNode };
}
