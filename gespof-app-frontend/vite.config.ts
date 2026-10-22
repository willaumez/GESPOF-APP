import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

/**
 * L’URL du backend est lue côté app via `VITE_API_BASE_URL` (.env).
 * Pas de proxy Vite : le navigateur appelle directement le backend.
 */
export default defineConfig({
  server: {
    host: "::",
    port: 8082,
    hmr: {
      overlay: false,
    },
  },
  preview: {
    port: 8082,
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
});
