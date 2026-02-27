import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Engine } from "@babylonjs/core/Engines/engine";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CreateGround } from "@babylonjs/core/Meshes/Builders/groundBuilder";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { Scene } from "@babylonjs/core/scene";
import { useCallback, useEffect, useRef } from "react";

function BabylonScene({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<Engine | null>(null);

  const initScene = useCallback((canvas: HTMLCanvasElement) => {
    const engine = new Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
    });
    engineRef.current = engine;

    const scene = new Scene(engine);
    scene.clearColor = new Color4(0.1, 0.1, 0.15, 1);

    // Camera — orbitable
    const camera = new ArcRotateCamera(
      "camera",
      -Math.PI / 2,
      Math.PI / 3,
      10,
      Vector3.Zero(),
      scene
    );
    camera.lowerRadiusLimit = 3;
    camera.upperRadiusLimit = 30;
    camera.attachControl(canvas, true);

    // Light
    const light = new HemisphericLight("light", new Vector3(0, 1, 0), scene);
    light.intensity = 0.9;

    // Ground
    const ground = CreateGround("ground", { width: 20, height: 20 }, scene);
    const groundMat = new StandardMaterial("groundMat", scene);
    groundMat.diffuseColor = new Color3(0.2, 0.2, 0.25);
    groundMat.specularColor = new Color3(0.1, 0.1, 0.1);
    ground.material = groundMat;

    // Demo sphere
    const sphere = CreateSphere(
      "sphere",
      { diameter: 1.5, segments: 32 },
      scene
    );
    sphere.position.y = 0.75;
    const sphereMat = new StandardMaterial("sphereMat", scene);
    sphereMat.diffuseColor = new Color3(0.2, 0.5, 0.9);
    sphereMat.specularColor = new Color3(0.4, 0.4, 0.4);
    sphere.material = sphereMat;

    // Render loop
    engine.runRenderLoop(() => {
      scene.render();
    });

    return { engine, scene };
  }, []);

  // Handle canvas ref callback
  const setCanvasRef = useCallback(
    (node: HTMLCanvasElement | null) => {
      if (canvasRef.current === node) return;
      // Cleanup previous engine
      if (engineRef.current) {
        engineRef.current.dispose();
        engineRef.current = null;
      }
      canvasRef.current = node;
      if (node) {
        initScene(node);
      }
    },
    [initScene]
  );

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      engineRef.current?.resize();
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

  return (
    <canvas
      ref={setCanvasRef}
      className={className}
      style={{
        width: "100%",
        height: "100%",
        display: "block",
        outline: "none",
      }}
    />
  );
}

export default BabylonScene;
