import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vitest/config";

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
  ],
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
  },
});
