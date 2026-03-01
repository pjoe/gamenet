import { Scene } from "@babylonjs/core/scene";

let inspectorImported = false;
let inspectorLoading = false;

export async function showInspector(show: boolean, scene: Scene) {
  console.info("showInspector", show);
  if (inspectorLoading) {
    return;
  }
  if (!inspectorImported) {
    inspectorLoading = true;
    console.debug("importing inspector");
    const modal = document.createElement("div");
    modal.innerHTML = "Loading inspector ...";
    modal.style.position = "absolute";
    modal.style.top = "0";
    modal.style.backgroundColor = "rgba(255,255,255,0.5)";
    document.body.append(modal);
    // await import('@babylonjs/core/Debug/debugLayer');
    const inspectorModule = await import("@babylonjs/inspector");
    (scene.debugLayer as any).BJSINSPECTOR = inspectorModule;
    inspectorLoading = false;
    inspectorImported = true;
    modal.remove();
  }
  if (show) {
    void scene.debugLayer.show({
      globalRoot: document.body,
      overlay: true,
      embedMode: true,
    });
  } else {
    scene.debugLayer.hide();
  }
}

export function setupInspector(scene: Scene) {
  window.addEventListener("keydown", (event) => {
    // toggle inspector
    if (event.code === "KeyI" && event.shiftKey) {
      if (scene.debugLayer?.isVisible()) {
        showInspector(false, scene);
      } else {
        showInspector(true, scene);
      }
    }
  });
}
