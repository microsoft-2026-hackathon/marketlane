import { defineConfig } from "vite";

export default defineConfig({
  root: "client",
  build: {
    outDir: "../dist/client",
    emptyOutDir: true,
  },
  server: {
    host: "127.0.0.1",
    port: 5178,
    strictPort: true,
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${process.env.PORT ?? "4310"}`,
      },
    },
  },
});
