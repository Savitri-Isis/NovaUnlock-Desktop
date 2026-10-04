/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  base: "./",
  build: {
    outDir: "dist/renderer",
    emptyOutDir: true,
  },
  // Les hôtes de prévisualisation (tunnels de développement) doivent pouvoir
  // atteindre le serveur : sans cela Vite refuse la requête avec un HTTP 403.
  server: {
    port: 5173,
    allowedHosts: true,
  },
  preview: {
    port: 4173,
    allowedHosts: true,
  },
  test: {
    environment: "jsdom",
  },
});
