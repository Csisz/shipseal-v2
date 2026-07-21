import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  build: {
    rollupOptions: {
      output: {
        // The browser AST extractor intentionally uses TypeScript. Keep that optional compiler payload
        // separate from verification/review code so it is cached and loaded only with repository review.
        manualChunks(id) {
          return id.includes('/node_modules/typescript/') ? 'typescript-compiler' : undefined;
        },
      },
    },
  },
}));
