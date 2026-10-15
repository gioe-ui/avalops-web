import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

const clientRoot = path.resolve(import.meta.dirname, "client");

/**
 * Content-Security-Policy por <meta>, só no build de produção (o servidor de
 * desenvolvimento injeta scripts inline que ela bloquearia).
 *
 * O GitHub Pages não permite cabeçalhos HTTP, por isso a política vai no HTML.
 * Limita o que o browser aceita carregar e para onde aceita enviar dados:
 * scripts só da própria origem, pedidos só para o Supabase do projeto, imagens
 * só da origem e dos tiles do mapa. Se alguém conseguir injetar conteúdo na
 * página, não consegue carregar código de fora nem enviar a sessão para outro
 * servidor.
 *
 * `style-src 'unsafe-inline'` é necessário: o Leaflet, o Radix e o sonner
 * aplicam estilos inline. Não abre execução de código.
 */
function contentSecurityPolicy(supabaseUrl: string | undefined): Plugin {
  let origemSupabase = "";
  if (supabaseUrl) {
    const url = new URL(supabaseUrl);
    if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
      throw new Error(`VITE_SUPABASE_URL tem de usar https: ${supabaseUrl}`);
    }
    origemSupabase = url.origin;
  }

  const politica = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://tile.openstreetmap.org https://*.tile.openstreetmap.org",
    "font-src 'self' data:",
    `connect-src 'self'${origemSupabase ? ` ${origemSupabase}` : ""}`,
    "worker-src 'self' blob:",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "manifest-src 'self'",
    "upgrade-insecure-requests",
  ].join("; ");

  const marcador = '<meta charset="UTF-8" />';

  return {
    name: "gioe-content-security-policy",
    apply: "build",
    transformIndexHtml: {
      order: "pre",
      // Logo a seguir ao charset, antes de qualquer script.
      handler: (html) => {
        if (!html.includes(marcador)) throw new Error("index.html sem <meta charset> para ancorar a CSP");
        return html.replace(
          marcador,
          `${marcador}\n    <meta http-equiv="Content-Security-Policy" content="${politica}" />`,
        );
      },
    },
  };
}

/**
 * Num site de projeto do GitHub Pages a aplicação é servida em
 * https://<utilizador>.github.io/<repositório>/, por isso o `base` tem de ser
 * "/<repositório>/". O workflow de deploy define BASE_PATH automaticamente a
 * partir do nome do repositório; localmente fica "/".
 */
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, clientRoot, "VITE_"), ...process.env };

  return {
    base: process.env.BASE_PATH ?? "/",
    root: clientRoot,
    plugins: [react(), tailwindcss(), contentSecurityPolicy(env.VITE_SUPABASE_URL)],
    resolve: {
      alias: {
        "@": path.resolve(clientRoot, "src"),
      },
    },
    build: {
      outDir: path.resolve(import.meta.dirname, "dist"),
      emptyOutDir: true,
      sourcemap: false,
      rollupOptions: {
        output: {
          // Bibliotecas grandes em ficheiros próprios: o browser guarda-as em
          // cache entre versões da aplicação.
          manualChunks: {
            react: ["react", "react-dom", "wouter", "@tanstack/react-query"],
            supabase: ["@supabase/supabase-js"],
            graficos: ["recharts"],
            mapa: ["leaflet"],
          },
        },
      },
    },
    server: {
      port: 3000,
    },
  };
});
