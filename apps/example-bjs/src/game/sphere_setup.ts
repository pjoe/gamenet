import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
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
  const sphereNode = CreateSphere(
    "sphereMesh",
    { diameter: options.diameter, segments: options.segments },
    scene
  );
  sphereNode.position.set(0, options.diameter / 2, 0);

  const mat = new StandardMaterial("sphereMat", scene);
  mat.diffuseColor = options.diffuseColor;
  mat.specularColor = options.specularColor;
  sphereNode.material = mat;

  if (isServer || true) {
    const agg = new PhysicsAggregate(
      sphereNode,
      PhysicsShapeType.SPHERE,
      { mass: 20, restitution: 0.5 },
      scene
    );
    agg.body.disablePreStep = false;
  }

  return { sphereNode };
}
