import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vitest/config";
import { serviceWorkerPlugin } from "./src/sw/plugin.ts";

// nitro is the deploy adapter (dev server + .output build). Under vitest it
// combines with tanstackStart to inline React's CJS build into the module
// runner ("module is not defined"), so it is left out of the test config.
const testing = Boolean(process.env.VITEST);

export default defineConfig({
  plugins: [
    tanstackStart({ spa: { enabled: true } }),
    ...(testing ? [] : [nitro({ preset: "bun" })]),
    viteReact(),
    tailwindcss(),
    // Emits public/sw.js from src/sw/ during the client build; see the plugin for why it is not a post-build step.
    serviceWorkerPlugin(),
  ],
  test: {
    include: ["test/**/*.test.{ts,tsx}"],
    environment: "node",
  },
});
