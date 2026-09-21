import { readFileSync } from "node:fs";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { rootRoute } from "@tanstack/virtual-file-routes";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vitest/config";
import { serviceWorkerPlugin } from "./src/sw/plugin.ts";

// nitro is the deploy adapter (dev server + .output build). Under vitest it
// combines with tanstackStart to inline React's CJS build into the module
// runner ("module is not defined"), so it is left out of the test config.
const testing = Boolean(process.env.VITEST);

// package.json's version, bumped on every push to main by the release workflow
// and inlined into both bundles as __GARNISH_VERSION__ (src/lib/version.ts).
const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };

export default defineConfig({
  define: { __GARNISH_VERSION__: JSON.stringify(version) },
  plugins: [
    tanstackStart({
      spa: { enabled: true },
      // Routing is code: src/routes/routes.ts builds the tree with createRoute.
      // Start still runs its route generator to build the asset manifest, so
      // it is handed the root alone and an output path nothing imports.
      router: { virtualRouteConfig: rootRoute("root.tsx"), generatedRouteTree: "../.tanstack/routeTree.gen.ts" },
    }),
    ...(testing ? [] : [nitro({ preset: "bun" })]),
    viteReact(),
    tailwindcss(),
    // Emits public/sw.js from src/sw/ during the client build; see the plugin for why it is not a post-build step.
    serviceWorkerPlugin(),
  ],
  test: {
    // Two projects, told apart by file name. Everything is node — pure domain
    // logic, repositories, server functions, and components through
    // `renderToString` — except `*.dom.test.tsx`, which gets happy-dom and
    // Testing Library so an interaction can be driven rather than read. The
    // design system splits its suite the same way, and for the same reason
    // (its vitest.config.ts): a DOM for every file would cost every file.
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          include: ["test/**/*.test.{ts,tsx}"],
          exclude: ["test/**/*.dom.test.tsx"],
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          name: "dom",
          include: ["test/**/*.dom.test.tsx"],
          environment: "happy-dom",
          setupFiles: ["./vitest.setup.ts"],
        },
      },
    ],
  },
});
