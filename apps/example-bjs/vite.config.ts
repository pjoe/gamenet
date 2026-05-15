import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import wasm from "vite-plugin-wasm";
import { createWorkspaceAliases } from "../../vite.workspace-aliases";

const inspectorLoaderId = "/packages/gamenet-bjs/src/inspector_loader.ts";

function normalizeModuleId(id: string) {
  return id.replaceAll("\\", "/");
}

function isInspectorOnlyModule(
  id: string,
  getModuleInfo: (id: string) => { importers: string[]; dynamicImporters: string[] } | null,
  seen = new Set<string>()
): boolean {
  const normalizedId = normalizeModuleId(id);

  if (seen.has(normalizedId)) {
    return true;
  }
  seen.add(normalizedId);

  if (normalizedId.includes(inspectorLoaderId)) {
    return true;
  }
  if (!normalizedId.includes("/node_modules/")) {
    return false;
  }

  const moduleInfo = getModuleInfo(id);
  if (!moduleInfo) {
    return false;
  }

  const parents = [...moduleInfo.importers, ...moduleInfo.dynamicImporters];
  if (parents.length === 0) {
    return false;
  }

  return parents.every((parentId) =>
    isInspectorOnlyModule(parentId, getModuleInfo, seen)
  );
}
// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  base: mode === "production" ? "/gamenet/" : "/",
  build: {
    rollupOptions: {
      output: {
        manualChunks(id, { getModuleInfo }) {
          if (isInspectorOnlyModule(id, getModuleInfo)) {
            return "babylon-inspector";
          }
        },
      },
    },
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: createWorkspaceAliases(__dirname),
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
  },
  worker: {
    format: "es",
    plugins: () => [wasm()],
  },
  optimizeDeps: {
    exclude: ["@babylonjs/havok"],
  },
}));
