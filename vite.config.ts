import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  worker: {
    format: "es",
  },
  resolve: {
    alias: {
      "@gamenet": resolve(__dirname, "./src/gamenet"),
    },
  },
});
