// The one gate every model-backed feature reads: the import, the restyle and
// the planner all ask `aiAvailable`, so it is tested once, here.
import { afterEach, expect, test } from "vitest";
import { aiAvailable } from "../../../src/server/fns/ai";
import { callServerFn, useTempDataDir } from "../../helpers/server";

useTempDataDir();

const KEYS = ["AI_PROVIDER", "AI_API_KEY"] as const;
const saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));
afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

test("available only with a provider named and its credential set", async () => {
  delete process.env.AI_PROVIDER;
  delete process.env.AI_API_KEY;
  await expect(callServerFn(aiAvailable)).resolves.toEqual({ available: false });
  process.env.AI_API_KEY = "k";
  // A key alone does not choose a provider.
  await expect(callServerFn(aiAvailable)).resolves.toEqual({ available: false });
  process.env.AI_PROVIDER = "api";
  await expect(callServerFn(aiAvailable)).resolves.toEqual({ available: true });
});
