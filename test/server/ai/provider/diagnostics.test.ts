// The server's AI client, timed and written down: every answer a log line,
// every failure a recorded error, and the error thrown on unchanged.
import { expect, test } from "vitest";
import { AiError, type AiRequest } from "../../../../src/server/ai/client";
import { withDiagnostics } from "../../../../src/server/ai/provider";
import { fakeAi } from "../../../helpers/ai";

const request: AiRequest = { prompt: "p", schema: {}, schemaName: "restyle", model: "sonnet", timeoutMs: 1_000 };

function recorder() {
  const notes: Record<string, unknown>[] = [];
  const failures: { source: string; name: string; error: unknown; extra: Record<string, unknown> }[] = [];
  return {
    notes,
    failures,
    log: {
      note: (fields: Record<string, unknown>) => notes.push(fields),
      failure: (source: "server" | "browser" | "ai", name: string, error: unknown, extra: Record<string, unknown> = {}) =>
        failures.push({ source, name, error, extra }),
    },
  };
}

/** A clock that moves 2.5 s between the two reads of one call. */
function clock() {
  let t = 0;
  return () => {
    const now = t;
    t += 2_500;
    return now;
  };
}

test("an answer is passed back and noted with the provider, model, what was asked and how long it took", async () => {
  const { log, notes, failures } = recorder();
  const ai = withDiagnostics(fakeAi('{"parts":[]}'), log, clock());
  await expect(ai.ask(request)).resolves.toBe('{"parts":[]}');
  expect(notes).toEqual([{ source: "ai", name: "restyle", message: "Answered", provider: "api", model: "sonnet", asked: "restyle", seconds: 2.5, chars: 12 }]);
  expect(failures).toEqual([]);
});

test("a failure is recorded with the same fields and thrown on unchanged", async () => {
  const { log, notes, failures } = recorder();
  const error = new AiError("timeout", "The model did not answer in time");
  const ai = withDiagnostics(
    fakeAi(() => Promise.reject(error)),
    log,
    clock()
  );
  await expect(ai.ask(request)).rejects.toBe(error);
  expect(failures).toEqual([{ source: "ai", name: "restyle", error, extra: { provider: "api", model: "sonnet", asked: "restyle", seconds: 2.5 } }]);
  expect(notes).toEqual([]);
});

test("everything but ask is the wrapped client's own", async () => {
  const inner = fakeAi("x", "gemini-flash");
  const ai = withDiagnostics(inner, recorder().log);
  expect(ai.configured()).toBe(true);
  expect(ai.model("import")).toBe("gemini-flash");
  expect(ai.status()).toEqual(inner.status());
  await expect(ai.check()).resolves.toEqual(await inner.check());
});
