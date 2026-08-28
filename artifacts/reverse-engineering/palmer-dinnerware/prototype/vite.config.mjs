import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const API_TARGET = process.env.VITRINE_API_TARGET ?? "http://127.0.0.1:3010";
const MEDIA_TARGET = process.env.VITRINE_MEDIA_TARGET ?? "https://vitrines.ai";

export default defineConfig({
  build: {
    outDir: "dist/client",
  },
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local"],
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
    proxy: {
      "^/assets/(icons|thumbnails)/": {
        target: MEDIA_TARGET,
        changeOrigin: true,
      },
      "/api": {
        target: API_TARGET,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  plugins: [react()],
});
