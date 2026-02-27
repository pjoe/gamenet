import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";
import { addNodeEntity, createComponent } from "@skyboxgg/bjs-ecs";

export const player = createComponent(
  "player",
  (nickname: string, color: Color3) => ({ nickname, color })
);

export function setupPlayer(
  options: { id: string; nickname: string; color: Color3 },
  scene: Scene
) {
  const playerNode = new TransformNode("player_" + options.id, scene);
  playerNode.position = new Vector3(0, 0, 0);

  const height = 1.8;
  const mesh = CreateCylinder(
    "playerMesh",
    { height, diameter: 0.6, tessellation: 16 },
    scene
  );
  mesh.position.y = height / 2;
  mesh.parent = playerNode;

  const mat = new StandardMaterial("playerMat", scene);
  mat.diffuseColor = options.color;
  mat.specularColor = new Color3(0.3, 0.3, 0.3);
  mesh.material = mat;

  const entity = addNodeEntity(playerNode, [
    player(options.nickname, mat.diffuseColor),
    "netsync",
  ]);

  return entity;
}
