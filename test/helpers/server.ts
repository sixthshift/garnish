// Test-side plumbing for server functions.
//
// Under vitest the Start compiler runs in its server environment: the module
// that declares `createServerFn(...).handler(fn)` keeps only an RPC stub, and
// the real handler lives in a split module (`<file>?tss-serverfn-split`)
// normally reached through the server-function manifest. vitest has no
// manifest, so `callServerFn` reads the stub's id (dev mode encodes the split
// module path and export name), imports that module, and runs the export
// inside a fake Start request context, the way the request handler does.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runWithStartContext, type StartStorageContext } from "@tanstack/start-storage-context";
import { afterEach, beforeEach } from "vitest";
import { closeDb } from "../../src/server/db";

/**
 * Point DATA_DIR at a fresh temp directory for every test in the file and
 * close the cached database between them. Call at a test file's top level.
 */
export function useTempDataDir(): { readonly dir: string } {
  let dir = "";
  let previous: string | undefined;
  beforeEach(async () => {
    await closeDb();
    previous = process.env.DATA_DIR;
    dir = mkdtempSync(join(tmpdir(), "garnish-test-"));
    process.env.DATA_DIR = dir;
  });
  afterEach(async () => {
    await closeDb();
    if (previous === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = previous;
    rmSync(dir, { recursive: true, force: true });
  });
  return {
    get dir() {
      return dir;
    },
  };
}

type Fetcher = ((opts?: any) => Promise<any>) & { method?: "GET" | "POST"; serverFnMeta?: { id: string } };
type DataOf<F extends Fetcher> = Parameters<F>[0] extends { data?: infer D } ? D : never;
type ServerAction = (opts: { method: string; data: unknown; context: Record<string, unknown> }) => Promise<{
  result: unknown;
  error: unknown;
}>;

/** Decode a dev-mode server function id into its split module and export. Pure. */
export function decodeServerFnId(id: string): { file: string; export: string } {
  const decoded = JSON.parse(Buffer.from(id, "base64url").toString("utf8")) as { file?: string; export?: string };
  if (typeof decoded.file !== "string" || typeof decoded.export !== "string") {
    throw new Error(`Server function id ${id} does not decode to {file, export}`);
  }
  return { file: decoded.file, export: decoded.export };
}

async function resolveAction(fn: Fetcher): Promise<ServerAction> {
  const id = fn.serverFnMeta?.id;
  if (!id) throw new Error("Not a compiled server function: no serverFnMeta.id. Declare it with createServerFn at module top level.");
  const target = decodeServerFnId(id);
  const mod = (await import(/* @vite-ignore */ target.file)) as Record<string, unknown>;
  const action = mod[target.export];
  if (typeof action !== "function") throw new Error(`${target.file} has no export ${target.export}`);
  return action as ServerAction;
}

/** Minimal Start request context: enough for `__executeServer` and the global-middleware lookup. */
export function fakeStartContext(method: string): StartStorageContext {
  return {
    getRouter: () => {
      throw new Error("No router in server function tests");
    },
    request: new Request("http://localhost/_serverFn/test", { method }),
    startOptions: undefined,
    contextAfterGlobalMiddlewares: {},
    executedRequestMiddlewares: new Set(),
    handlerType: "serverFn",
  };
}

/**
 * Invoke a server function's server side directly: validator, middleware and
 * handler run exactly as under a request. Resolves with the handler's result;
 * rejects with whatever the chain threw (validation error, `notFound()`, ...).
 */
export async function callServerFn<F extends Fetcher>(fn: F, data?: DataOf<F>): Promise<Awaited<ReturnType<F>>> {
  const method = fn.method ?? "GET";
  const action = await resolveAction(fn);
  const outcome = await runWithStartContext(fakeStartContext(method), () => action({ method, data, context: {} }));
  if (outcome.error) throw outcome.error;
  return outcome.result as Awaited<ReturnType<F>>;
}

/**
 * For `vi.mock` factories in route tests. Under vitest a server function stub
 * resolves its handler through the Start manifest, which does not exist, so a
 * route loader cannot call one. This swaps every stub in a `src/server/*`
 * module for a same-signature wrapper that runs the handler in-process via
 * `callServerFn`, keeping the stub's own properties so `callServerFn` still
 * works on the wrapper too. Non-function exports (zod inputs) pass through.
 *
 *   vi.mock("../../src/server/recipes", async (importOriginal) => {
 *     const { runLocally } = await import("../helpers/server");
 *     return runLocally(await importOriginal());
 *   });
 */
export function runLocally<M extends Record<string, unknown>>(mod: M): M {
  const out: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(mod)) {
    const fn = value as Fetcher;
    out[name] =
      typeof fn === "function" && fn.serverFnMeta
        ? Object.assign((opts?: { data?: unknown }) => callServerFn(fn, opts?.data as DataOf<Fetcher>), fn)
        : value;
  }
  return out as M;
}
