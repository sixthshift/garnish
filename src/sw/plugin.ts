// Emitted as a client-bundle asset rather than written after the build: nitro serves only the files in the manifest it bakes when the server bundle is built.

import { createHash } from "node:crypto";
import { readdir } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import type { Plugin } from "vite";
import type { SwConfig } from "./worker.ts";

/** The client environment's name in a TanStack Start build. */
const CLIENT_ENVIRONMENT = "client";
export const SW_FILE = "sw.js";
/** Nitro serves the SSR shell for `/`; the prerendered _shell.html is not routable. */
export const SHELL_URL = "/";
const VERSION_PLACEHOLDER = "__SW_VERSION__";

/**
 * The same-origin paths to precache: every emitted bundle file (minus source
 * maps) and every file from public/ (minus the worker itself), as URL paths,
 * sorted and deduplicated. Pure. Inputs are paths relative to the web root
 * with either separator.
 */
export function precacheList(bundleFiles: readonly string[], publicFiles: readonly string[]): string[] {
  const toPath = (file: string) => `/${file.split(sep).join("/").replace(/^\/+/, "")}`;
  const paths = new Set<string>();
  for (const file of bundleFiles) if (!file.endsWith(".map")) paths.add(toPath(file));
  for (const file of publicFiles) if (toPath(file) !== `/${SW_FILE}`) paths.add(toPath(file));
  return [...paths].sort();
}

/** Short content hash of the bundled worker; stable for identical builds. Pure. */
export function versionOf(code: string): string {
  return createHash("sha256").update(code).digest("hex").slice(0, 12);
}

/** Replace the version placeholder with a hash of the code around it. Pure. */
export function stampVersion(code: string): { code: string; version: string } {
  const version = versionOf(code);
  return { code: code.split(VERSION_PLACEHOLDER).join(version), version };
}

/** Every file under `dir`, as paths relative to it. */
export async function listFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  return entries.filter((entry) => entry.isFile()).map((entry) => relative(dir, resolve(entry.parentPath, entry.name)));
}

/**
 * Bundle src/sw/entry.ts as a classic script with `config` inlined and the
 * version stamped in. Runs under Bun (`bun --bun vite build`).
 */
export async function buildServiceWorker(config: Omit<SwConfig, "version">): Promise<{ code: string; version: string }> {
  if (typeof Bun === "undefined") throw new Error("the service worker build needs Bun: run the build with `bun --bun vite build`");
  const result = await Bun.build({
    entrypoints: [resolve(import.meta.dirname, "entry.ts")],
    target: "browser",
    format: "esm",
    minify: true,
    define: { __SW_CONFIG__: JSON.stringify({ version: VERSION_PLACEHOLDER, ...config } satisfies SwConfig) },
  });
  if (!result.success || result.outputs[0] === undefined) {
    throw new Error(`service worker bundle failed: ${result.logs.map((log) => log.message).join("; ")}`);
  }
  return stampVersion(await result.outputs[0].text());
}

/** Emit `sw.js` into the client bundle. Build only; a no-op in dev, where the worker is not registered. */
export function serviceWorkerPlugin(): Plugin {
  let publicDir = "";
  return {
    name: "garnish:service-worker",
    apply: "build",
    configResolved(config) {
      publicDir = config.publicDir;
    },
    async generateBundle(_options, bundle) {
      if (this.environment.name !== CLIENT_ENVIRONMENT) return;
      const publicFiles = publicDir ? await listFiles(publicDir).catch(() => [] as string[]) : [];
      const precache = precacheList(Object.keys(bundle), publicFiles);
      const { code } = await buildServiceWorker({ shell: SHELL_URL, precache });
      this.emitFile({ type: "asset", fileName: SW_FILE, source: code });
    },
  };
}
