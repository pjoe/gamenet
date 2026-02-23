import { resolve } from "path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, "src/index.ts"),
        "react/GameContext": resolve(__dirname, "src/react/GameContext.tsx"),
        "routing/host_server_worker_setup": resolve(
          __dirname,
          "src/routing/host_server_worker_setup.ts"
        ),
      },
      formats: ["es"],
    },
    rollupOptions: {
      external: [
        "react",
        "react/jsx-runtime",
        "@msgpack/msgpack",
        "mitt",
        "mqtt",
        "nanoid",
        "ws",
      ],
    },
  },
});
