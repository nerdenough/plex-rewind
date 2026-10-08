import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type ProxyOptions } from "vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "TAUTULLI_");
  const target = env.TAUTULLI_URL || "http://localhost:8181";
  const apiKey = env.TAUTULLI_API_KEY || "";

  // The browser calls /tautulli?cmd=...; the dev/preview server appends the
  // API key so it never ships to the client.
  const proxy: Record<string, ProxyOptions> = {
    "/tautulli": {
      target,
      changeOrigin: true,
      rewrite: (path) => {
        const url = new URL(path, "http://local");
        url.searchParams.set("apikey", apiKey);
        return `/api/v2${url.search}`;
      },
    },
  };

  return {
    plugins: [react()],
    define: { __PLEX_USER__: JSON.stringify(env.TAUTULLI_USER) },
    server: { proxy, host: true },
    preview: { proxy, host: true },
  };
});
