import { resolve } from "path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, "src/index.ts"),
        "react/BabylonScene": resolve(__dirname, "src/react/BabylonScene.tsx"),
      },
      formats: ["es"],
    },
    rollupOptions: {
      external: [
        /^@babylonjs\//,
        /^@gamenet\//,
        /^@skyboxgg\//,
        "react",
        "react/jsx-runtime",
      ],
    },
  },
});
