// An AI client that answers from a fixture, for the features' tests: the model is never called.
import type { AiClient, AiRequest, ConnectionCheck } from "../../src/server/ai/client";

export type FakeAi = AiClient & { calls: AiRequest[] };

/** Answers every question with `answer` (or what it returns), recording each request. Configured, with one model for every use. */
export function fakeAi(answer: string | ((request: AiRequest) => Promise<string>), model = "fake-model"): FakeAi {
  const calls: AiRequest[] = [];
  const check: ConnectionCheck = { ok: true, baseUrl: "fake://", credentialProved: true, models: [], offered: [] };
  return {
    calls,
    configured: () => true,
    model: () => model,
    status: () => ({ provider: "api", problem: null, credential: "AI_API_KEY", configured: true, baseUrl: "fake://", isDefaultProvider: false, models: [] }),
    check: async () => check,
    ask: async (request) => {
      calls.push(request);
      return typeof answer === "string" ? answer : answer(request);
    },
  };
}
