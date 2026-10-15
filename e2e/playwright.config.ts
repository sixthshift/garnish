// The e2e project: the production build, served the way the image serves it,
// driven by a real browser (decisions.md row 168). vitest proves the parts; this
// proves they were assembled — a client bundle that throws as it loads
// (v1.4.1's createRequire) passes every vitest file and fails here.
//
// One server, one database, one worker. Every spec shares the database, so
// each makes the names it reads unique, and the backup spec's restore — which
// replaces the whole database — cannot land under another spec's feet.
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

// Not 9988: that is the dev server's, and it is strictPort.
const PORT = 9989;

// A fixed path, emptied by the command, so a failed run's database is still
// there to open afterwards.
export const DATA_DIR = join(tmpdir(), "garnish-e2e");

export default defineConfig({
  testDir: ".",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never", outputFolder: "../playwright-report" }]] : "list",
  outputDir: "../test-results",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  // Phone-first (CLAUDE.md): the household's browser is a phone's.
  projects: [{ name: "phone", use: { ...devices["Pixel 7"] } }],
  webServer: {
    // --no-env-file: Bun would otherwise load the developer's .env, and with a
    // real AI_PROVIDER in it the import and plan pages would take their model
    // paths and ask a real model (vitest.env.ts guards the unit suite the same way).
    command: `rm -rf ${DATA_DIR} && mkdir -p ${DATA_DIR} && bun run build && bun --no-env-file run .output/server/index.mjs`,
    cwd: "..",
    url: `http://localhost:${PORT}/api/health`,
    // Never another server: one already running has a database these specs did not make.
    reuseExistingServer: false,
    timeout: 120_000,
    env: { PORT: String(PORT), DATA_DIR, AI_PROVIDER: "" },
    stdout: "ignore",
    stderr: "pipe",
  },
});
