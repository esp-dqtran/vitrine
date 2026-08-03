import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const API_TARGET = process.env.VITRINE_API_TARGET ?? "http://127.0.0.1:3010";
const CANVAS_COLLAB_TARGET = process.env.VITRINE_CANVAS_COLLAB_TARGET
  ?? "http://127.0.0.1:3012";
const PROJECT_DOCUMENT_COLLAB_TARGET = process.env.VITRINE_PROJECT_DOCUMENT_COLLAB_TARGET
  ?? "http://127.0.0.1:3013";

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.PORT) || 5173,
    // ngrok's free-tier subdomain changes on every restart — allow the whole domain rather
    // than pinning one hostname that'll go stale next time the tunnel is recreated.
    allowedHosts: [".ngrok-free.app"],
    proxy: {
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
