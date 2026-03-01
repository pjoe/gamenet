import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import wasm from "vite-plugin-wasm";
import { createWorkspaceAliases } from "../../vite.workspace-aliases";
// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  base: mode === "production" ? "/gamenet/" : "/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: createWorkspaceAliases(__dirname),
  },
  worker: {
    format: "es",
    plugins: () => [wasm()],
  },
  optimizeDeps: {
    exclude: ["@babylonjs/havok"],
  },
}));
