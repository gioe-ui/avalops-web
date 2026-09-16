import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

/**
 * Num site de projeto do GitHub Pages a aplicação é servida em
 * https://<utilizador>.github.io/<repositório>/, por isso o `base` tem de ser
 * "/<repositório>/". O workflow de deploy define BASE_PATH automaticamente a
 * partir do nome do repositório; localmente fica "/".
 */
const base = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base,
  root: path.resolve(import.meta.dirname, "client"),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
    },
  },
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
    sourcemap: false,
  },
  server: {
    port: 3000,
  },
});
