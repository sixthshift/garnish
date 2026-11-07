// An AI client that answers from a fixture, for the features' tests: the model is never called.
import { afterEach, beforeEach } from "vitest";
import { type AiClient, type AiRequest, type AiUse, type ConnectionCheck, readChosenModels } from "../../src/server/ai/client";

export type FakeAi = AiClient & { calls: AiRequest[] };

/** Answers every question with `answer` (or what it returns), recording each request. Configured, with one model for every use. */
export function fakeAi(answer: string | ((request: AiRequest) => Promise<string>), model = "fake-model"): FakeAi {
  const calls: AiRequest[] = [];
  const check: ConnectionCheck = { ok: true, baseUrl: "fake://", credentialProved: true, models: [], offered: [] };
  return {
    calls,
    configured: () => true,
    model: () => model,
    status: () => ({
      provider: "api",
      problem: null,
      credential: "AI_API_KEY",
      configured: true,
      baseUrl: "fake://",
      isDefaultProvider: false,
      models: [],
    }),
    check: async () => check,
    ask: async (request) => {
      calls.push(request);
      return typeof answer === "string" ? answer : answer(request);
    },
  };
}

/**
 * Models as if selected in Settings › AI, for the tests of one file: set a
 * use's entry to select its model, delete it for none. Put back to `initial`
 * before each test, and the server's reader put back after.
 */
export function useChosenModels(initial: Partial<Record<AiUse, string>> = {}): Partial<Record<AiUse, string>> {
  const chosen: Partial<Record<AiUse, string>> = {};
  let restore: ReturnType<typeof readChosenModels> | null = null;
  beforeEach(() => {
    for (const use of Object.keys(chosen) as AiUse[]) delete chosen[use];
    Object.assign(chosen, initial);
    restore = readChosenModels((use) => chosen[use] ?? null);
  });
  afterEach(() => {
    if (restore) readChosenModels(restore);
    restore = null;
  });
  return chosen;
}
