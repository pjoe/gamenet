import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import wasm from "vite-plugin-wasm";
import { createWorkspaceAliases } from "../../vite.workspace-aliases";

const viteIdPrefix = "/@id/";
const viteFsPrefix = "/@fs/";

function stripVitePrefixes(id: string) {
  if (id.startsWith(viteIdPrefix)) {
    return id.slice(viteIdPrefix.length);
  }

  if (id.startsWith(viteFsPrefix)) {
    return id.slice(viteFsPrefix.length);
  }

  return id;
}

function matchesPackageModule(id: string, packageName: string) {
  return (
    id === packageName ||
    id.startsWith(`${packageName}/`) ||
    id.includes(`/node_modules/${packageName}/`) ||
    id.includes(`:${packageName}`)
  );
}

function normalizeModuleId(id: string) {
  return stripVitePrefixes(
    id.replaceAll("\\", "/").replaceAll("\0", "").split("?")[0]
  );
}

function isReactVendorChunkModule(id: string): boolean {
  const normalizedId = normalizeModuleId(id);

  return (
    matchesPackageModule(normalizedId, "react") ||
    matchesPackageModule(normalizedId, "react-dom") ||
    matchesPackageModule(normalizedId, "react-router") ||
    matchesPackageModule(normalizedId, "react-router-dom") ||
    matchesPackageModule(normalizedId, "scheduler")
  );
}

function getManualChunkName(id: string) {
  if (isReactVendorChunkModule(id)) {
    return "react-vendor";
  }

  return undefined;
}
// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  base: mode === "production" ? "/gamenet/" : "/",
  build: {
    emptyOutDir: true,
    rollupOptions: {
      preserveEntrySignatures: "allow-extension",
      output: {
        strictExecutionOrder: true,
        codeSplitting: {
          includeDependenciesRecursively: false,
          groups: [
            {
              name(id) {
                return getManualChunkName(id);
              },
            },
          ],
        },
      },
    },
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: createWorkspaceAliases(__dirname),
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
    ],
  },
  worker: {
    format: "es",
    plugins: () => [wasm()],
  },
  optimizeDeps: {
    exclude: ["@babylonjs/havok"],
  },
}));
