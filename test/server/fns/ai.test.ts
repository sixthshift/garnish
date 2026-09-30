// The one gate every model-backed feature reads: the import, the restyle and
// the planner all ask `aiAvailable`, so it is tested once, here.
import { afterEach, expect, test } from "vitest";
import { aiAvailable } from "../../../src/server/fns/ai";
import { callServerFn, useTempDataDir } from "../../helpers/server";

useTempDataDir();

const saved = process.env.AI_API_KEY;
afterEach(() => {
  if (saved === undefined) delete process.env.AI_API_KEY;
  else process.env.AI_API_KEY = saved;
});

test("an unset key is unavailable and a set one is available: the key is the whole of the gate", async () => {
  delete process.env.AI_API_KEY;
  await expect(callServerFn(aiAvailable)).resolves.toEqual({ available: false });
  process.env.AI_API_KEY = "k";
  await expect(callServerFn(aiAvailable)).resolves.toEqual({ available: true });
});
