import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { useCallback, useEffect, useRef } from "react";

function BabylonScene({
  className,
  onSceneReady,
}: {
  className?: string;
  onSceneReady?: (scene: Scene) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<Engine | null>(null);

  const onSceneReadyRef = useRef(onSceneReady);
  useEffect(() => {
    onSceneReadyRef.current = onSceneReady;
  }, [onSceneReady]);

  const initScene = useCallback((canvas: HTMLCanvasElement) => {
    const engine = new Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
    });
    engineRef.current = engine;

    const scene = new Scene(engine);

    const triggerReady = () => onSceneReadyRef.current?.(scene);
    if (scene.isReady()) {
      triggerReady();
    } else {
      scene.onReadyObservable.addOnce(triggerReady);
    }

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
