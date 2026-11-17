import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  base: "/",
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      input: {
        app: path.resolve(import.meta.dirname, "client", "index.html"),
        landing: path.resolve(import.meta.dirname, "client", "landing.html"),
      },
      output: {
        manualChunks: { charts: ["recharts"] },
      },
    },
  },
  server: {
    // `npm run dev:client` for hot reload; API is served by `npm run dev` (wrangler) on :8787
    proxy: { "/api": "http://127.0.0.1:8787" },
    fs: { strict: true, deny: ["**/.*"] },
  },
});
