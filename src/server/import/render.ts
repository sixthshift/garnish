// The importer's `renderPage` port: a headless Chromium, run as one command, for a page the plain fetch could not get (decisions.md row 202).

import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PageResponse } from "../../domain/recipes/import";
import { fetchProfileForAttempt } from "./fetchProfiles";

/** How long the page is given to load and run its scripts; the dump is whatever is there by then. */
export const RENDER_SETTLE_MS = 10_000;

/** The outer bound on one render: a browser that has not exited by now is killed. */
export const RENDER_TIMEOUT_MS = 30_000;

/** Where Debian's `chromium-headless-shell` puts its binary: the image's (docker/Dockerfile). */
export const DEFAULT_CHROMIUM = "/usr/bin/chromium-headless-shell";

/** The slice of `Bun.spawn` used here; injectable for tests. */
export type Spawn = (cmd: string[], options: { timeout: number }) => { stdout: ReadableStream<Uint8Array>; exited: Promise<number> };

const bunSpawn: Spawn = (cmd, { timeout }) => Bun.spawn(cmd, { stdout: "pipe", stderr: "ignore", stdin: "ignore", timeout, killSignal: "SIGKILL" });

/** The browser to render with: `CHROMIUM_PATH` when set, else the image's, when the file is there; null when there is none. */
export function findChromium(env: Record<string, string | undefined> = process.env, exists: (path: string) => boolean = existsSync): string | null {
  const path = env.CHROMIUM_PATH?.trim() || DEFAULT_CHROMIUM;
  return exists(path) ? path : null;
}

/**
 * The command line for one render. The old headless shell, not full Chromium's
 * new headless mode: a CDN that refused the second at connect answered the
 * first (row 202's trial). The user agent is the fetch's Chrome profile, so
 * the header says Chrome rather than HeadlessChrome. `--timeout` stops the
 * load at a wall-clock limit and dumps what is there; `--virtual-time-budget`
 * never settles on a page with endless timers. Pure.
 */
export function renderCommand(executable: string, url: URL, profileDir: string): string[] {
  return [
    executable,
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--no-first-run",
    `--user-agent=${fetchProfileForAttempt(0).headers["User-Agent"]}`,
    "--lang=en-AU",
    `--timeout=${RENDER_SETTLE_MS}`,
    `--user-data-dir=${profileDir}`,
    "--dump-dom",
    url.href,
  ];
}

/**
 * Render `url` and answer with its DOM as the browser drew it, as a 200: the
 * dump carries no status, and a wall's own page reads as no recipe, which is
 * how the importer tells. One render at a time, since each is a few hundred MB
 * on a home server; a second waits for the first. A fresh profile each time,
 * removed after. A browser that exits non-zero, is killed at
 * `RENDER_TIMEOUT_MS`, or dumps nothing throws, as `fetchPage` does for a
 * host it cannot reach.
 */
export function createPageRenderer(executable: string, spawn: Spawn = bunSpawn): (url: URL) => Promise<PageResponse> {
  let queue: Promise<unknown> = Promise.resolve();
  const renderOne = async (url: URL): Promise<PageResponse> => {
    const profileDir = mkdtempSync(join(tmpdir(), "garnish-render-"));
    try {
      const child = spawn(renderCommand(executable, url, profileDir), { timeout: RENDER_TIMEOUT_MS });
      const [bytes, code] = await Promise.all([new Response(child.stdout).bytes(), child.exited]);
      if (code !== 0) throw new Error(`Chromium exited ${code} on ${url.hostname}`);
      if (new TextDecoder().decode(bytes).trim() === "") throw new Error(`Chromium drew nothing for ${url.hostname}`);
      return { status: 200, url: url.href, bytes };
    } finally {
      rmSync(profileDir, { recursive: true, force: true });
    }
  };
  return (url) => {
    const turn = queue.then(() => renderOne(url));
    queue = turn.catch(() => undefined);
    return turn;
  };
}
