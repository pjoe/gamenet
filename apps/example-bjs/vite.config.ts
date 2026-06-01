import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import wasm from "vite-plugin-wasm";
import { createWorkspaceAliases } from "../../vite.workspace-aliases";

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  base: mode === "production" ? "/gamenet/" : "/",
  build: {
    emptyOutDir: true,
    modulePreload: false,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "babylonjs-shaders",
              test: /[\\/]Shaders(?:WGSL)?[\\/]|[\\/](?:fragment|vertex)/i,
              priority: 50,
            },
            {
              name: "babylonjs-core",
              test: (id: string) => {
                const norm = id.replaceAll("\\", "/").toLowerCase();
                return (
                  (norm.includes("babylonjs/core") ||
                    norm.includes("babylonjs+core")) &&
                  !norm.includes("inspector") &&
                  !norm.includes("gui")
                );
              },
              priority: 20,
            },
            {
              name: "vendor",
              test: (id: string) => {
                const norm = id.replaceAll("\\", "/").toLowerCase();
                if (norm.includes("node_modules") || norm.includes("/.pnpm/")) {
                  if (
                    norm.includes("babylonjs/inspector") ||
                    norm.includes("babylonjs+inspector") ||
                    norm.includes("babylonjs/gui") ||
                    norm.includes("babylonjs+gui")
                  ) {
                    return false;
                  }
                  return true;
                }
                return false;
              },
              priority: 10,
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
    rolldownOptions: {
      output: {
        codeSplitting: false,
      },
    },
  },
  optimizeDeps: {
    exclude: ["@babylonjs/havok"],
  },
}));
