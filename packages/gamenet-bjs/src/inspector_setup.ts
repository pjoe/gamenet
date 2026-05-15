import { Scene } from "@babylonjs/core/scene";

let inspectorLoading = false;
let inspectorModulePromise: Promise<unknown> | undefined;

function showLoadingModal() {
  const modal = document.createElement("div");
  modal.innerHTML = "Loading inspector ...";
  modal.style.position = "absolute";
  modal.style.top = "0";
  modal.style.backgroundColor = "rgba(255,255,255,0.5)";
  document.body.append(modal);
  return modal;
}

async function loadInspectorModule() {
  if (inspectorModulePromise) {
    return inspectorModulePromise;
  }

  const modal = showLoadingModal();
  inspectorModulePromise = import("./inspector_loader").finally(() => {
    modal.remove();
  });

  return inspectorModulePromise;
}

export async function showInspector(show: boolean, scene: Scene) {
  console.info("showInspector", show);

  if (show) {
    if (inspectorLoading) {
      return;
    }

    inspectorLoading = true;
    try {
      console.debug("importing inspector");
      await loadInspectorModule();

      await scene.debugLayer.show({
        globalRoot: document.body,
        overlay: true,
        embedMode: true,
      });
    } finally {
      inspectorLoading = false;
    }
  } else {
    scene.debugLayer.hide();
  }
}

export function setupInspector(scene: Scene) {
  window.addEventListener("keydown", (event) => {
    // toggle inspector
    if (
      event.code === "KeyI" &&
      event.shiftKey &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey
    ) {
      if (scene.debugLayer?.isVisible()) {
        void showInspector(false, scene);
      } else {
        void showInspector(true, scene);
      }
    }
  });
}
