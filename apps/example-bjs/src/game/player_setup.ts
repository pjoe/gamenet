import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";

export function setupPlayer(scene: Scene) {
  const player = new TransformNode("player", scene);
  player.position = new Vector3(0, 0, 0);

  const height = 1.8;
  const mesh = CreateCylinder(
    "playerMesh",
    { height, diameter: 0.6, tessellation: 16 },
    scene
  );
  mesh.position.y = height / 2;
  mesh.parent = player;

  const mat = new StandardMaterial("playerMat", scene);
  mat.diffuseColor = new Color3(0.8, 0.3, 0.2);
  mat.specularColor = new Color3(0.3, 0.3, 0.3);
  mesh.material = mat;

  return player;
}
