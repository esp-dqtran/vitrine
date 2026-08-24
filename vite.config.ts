import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const API_TARGET = process.env.VITRINE_API_TARGET ?? "http://127.0.0.1:3010";
const CANVAS_COLLAB_TARGET = process.env.VITRINE_CANVAS_COLLAB_TARGET
  ?? "http://127.0.0.1:3012";
const PROJECT_DOCUMENT_COLLAB_TARGET = process.env.VITRINE_PROJECT_DOCUMENT_COLLAB_TARGET
  ?? "http://127.0.0.1:3013";

// Catalog media lives in R2 and is served by the Cloudflare Worker, which does
// not run under `vite dev`. Point the same public prefixes at the deployed
// Worker — it reads the same prod bucket, so dev sees exactly what ships.
const MEDIA_TARGET = process.env.VITRINE_MEDIA_TARGET ?? "https://vitrines.ai";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Reconstructed components live beside their downloaded source project.
    // Keep their hooks on the Vitrines React runtime when Vite follows those imports.
    dedupe: ["react", "react-dom"],
  },
  server: {
    port: Number(process.env.PORT) || 5173,
    // ngrok's free-tier subdomain changes on every restart — allow the whole domain rather
    // than pinning one hostname that'll go stale next time the tunnel is recreated.
    allowedHosts: [".ngrok-free.app"],
    proxy: {
      "^/assets/(icons|thumbnails|sites|ui-elements)/": {
        target: MEDIA_TARGET,
        changeOrigin: true,
      },
      "/api/project-document-collaboration": {
        target: PROJECT_DOCUMENT_COLLAB_TARGET,
        ws: true,
      },
      "/api/designer-canvas-collaboration": {
        target: CANVAS_COLLAB_TARGET,
        ws: true,
      },
      "/api": {
        target: API_TARGET,
        ws: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
