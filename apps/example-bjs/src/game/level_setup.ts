import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateGround } from "@babylonjs/core/Meshes/Builders/groundBuilder";
import { PhysicsShapeType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { Scene } from "@babylonjs/core/scene";

export function setupLevel(scene: Scene) {
  const ground = CreateGround("ground", { width: 20, height: 20 }, scene);
  const groundMat = new StandardMaterial("groundMat", scene);
  groundMat.diffuseColor = new Color3(0.2, 0.2, 0.25);
  groundMat.specularColor = new Color3(0.1, 0.1, 0.1);
  ground.material = groundMat;
  new PhysicsAggregate(ground, PhysicsShapeType.BOX, { mass: 0 }, scene);

  // Walls
  const wallMat = new StandardMaterial("wallNMat", scene);
  wallMat.diffuseColor = new Color3(0.5, 0.5, 0.35);
  wallMat.specularColor = new Color3(0.1, 0.1, 0.1);
  const wallN = CreateBox("wallN", { width: 20, height: 2, depth: 0.5 }, scene);
  wallN.position.set(0, 1, 10);
  new PhysicsAggregate(wallN, PhysicsShapeType.BOX, { mass: 0 }, scene);
  wallN.material = wallMat;
  const wallS = CreateBox("wallS", { width: 20, height: 2, depth: 0.5 }, scene);
  wallS.position.set(0, 1, -10);
  new PhysicsAggregate(wallS, PhysicsShapeType.BOX, { mass: 0 }, scene);
  wallS.material = wallMat;
  const wallEN = CreateBox(
    "wallEN",
    { width: 0.5, height: 2, depth: 8 },
    scene
  );
  wallEN.position.set(10, 1, 6);
  new PhysicsAggregate(wallEN, PhysicsShapeType.BOX, { mass: 0 }, scene);
  wallEN.material = wallMat;
  const wallES = CreateBox(
    "wallES",
    { width: 0.5, height: 2, depth: 8 },
    scene
  );
  wallES.position.set(10, 1, -6);
  new PhysicsAggregate(wallES, PhysicsShapeType.BOX, { mass: 0 }, scene);
  wallES.material = wallMat;
  const wallW = CreateBox("wallW", { width: 0.5, height: 2, depth: 20 }, scene);
  wallW.position.set(-10, 1, 0);
  new PhysicsAggregate(wallW, PhysicsShapeType.BOX, { mass: 0 }, scene);
  wallW.material = wallMat;
}
