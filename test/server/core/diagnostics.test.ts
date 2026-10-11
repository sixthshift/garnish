// Recording a failure: a JSON line for the log and a row for Settings ›
// Diagnostics, and never a second failure when either cannot be written.
import { notFound, redirect } from "@tanstack/react-router";
import { expect, test } from "vitest";
import type { DiagnosticInput } from "../../../src/db/models/diagnostic/repo";
import { createDiagnostics, DETAIL_LIMIT, describeThrown, fitDetail, isExpected, MESSAGE_LIMIT } from "../../../src/server/core/diagnostics";
import { NotFound } from "../../../src/server/core/errors";

const NOW = "2026-10-11T04:00:00.000Z";

function harness(options: { storeFails?: boolean; writeFails?: boolean } = {}) {
  const lines: Record<string, unknown>[] = [];
  const rows: DiagnosticInput[] = [];
  const diagnostics = createDiagnostics({
    store: () => ({
      record: (input) => {
        if (options.storeFails) throw new Error("disk full");
        rows.push(input);
        return { ...input, id: "x", occurredAt: input.occurredAt ?? NOW, detail: null };
      },
    }),
    write: (line) => {
      if (options.writeFails) throw new Error("EPIPE");
      lines.push(JSON.parse(line));
    },
    version: "1.4.1 (abc1234)",
    now: () => NOW,
  });
  return { diagnostics, lines, rows };
}

test("record writes one JSON line and keeps one row, stamped with the time and this build", () => {
  const { diagnostics, lines, rows } = harness();
  diagnostics.record({ source: "server", level: "error", name: "createRecipe", message: "boom", detail: { stack: "s" } });
  expect(lines).toEqual([
    { at: NOW, level: "error", source: "server", name: "createRecipe", message: "boom", version: "1.4.1 (abc1234)", detail: { stack: "s" } },
  ]);
  expect(rows).toEqual([
    { occurredAt: NOW, source: "server", level: "error", name: "createRecipe", message: "boom", detail: { stack: "s" }, version: "1.4.1 (abc1234)" },
  ]);
});

test("a report naming its own build keeps it: a browser on an older page says which", () => {
  const { diagnostics, rows } = harness();
  diagnostics.record({ source: "browser", level: "error", name: "/recipes/new", message: "x", version: "1.4.0 (c4bd82d)" });
  expect(rows[0]).toMatchObject({ version: "1.4.0 (c4bd82d)", detail: null });
});

test("a store that cannot be written leaves the log line and a line saying so, and does not throw", () => {
  const { diagnostics, lines } = harness({ storeFails: true });
  expect(() => diagnostics.record({ source: "ai", level: "error", name: "restyle", message: "timeout" })).not.toThrow();
  expect(lines.map((line) => line.message)).toEqual(["timeout", "Could not keep the event above: disk full"]);
});

test("a closed stdout still keeps the row", () => {
  const { diagnostics, rows } = harness({ writeFails: true });
  expect(() => diagnostics.record({ source: "server", level: "error", name: "x", message: "y" })).not.toThrow();
  expect(rows).toHaveLength(1);
});

test("failure records a thrown value with its stack, kind and cause, beside the caller's own detail", () => {
  const { diagnostics, rows } = harness();
  const error = Object.assign(new Error("The model timed out", { cause: new Error("socket hang up") }), { kind: "timeout" });
  diagnostics.failure("ai", "restyle", error, { model: "sonnet" });
  expect(rows[0]).toMatchObject({ source: "ai", level: "error", name: "restyle", message: "The model timed out" });
  expect(rows[0]!.detail).toMatchObject({
    model: "sonnet",
    error: "Error",
    kind: "timeout",
    cause: "socket hang up",
    stack: expect.stringContaining("The model timed out"),
  });
});

test("note writes a line and keeps nothing", () => {
  const { diagnostics, lines, rows } = harness();
  diagnostics.note({ source: "ai", name: "restyle", seconds: 11.4 });
  expect(lines).toEqual([{ at: NOW, level: "info", version: "1.4.1 (abc1234)", source: "ai", name: "restyle", seconds: 11.4 }]);
  expect(rows).toEqual([]);
});

test("a long message is clipped, and an empty detail is kept as none", () => {
  const { diagnostics, rows } = harness();
  diagnostics.record({ source: "server", level: "error", name: "x", message: "m".repeat(MESSAGE_LIMIT + 50), detail: {} });
  expect(rows[0]!.message).toHaveLength(MESSAGE_LIMIT);
  expect(rows[0]!.message.endsWith("…")).toBe(true);
  expect(rows[0]!.detail).toBeNull();
});

test("fitDetail leaves a small detail alone and trims the long strings of a big one", () => {
  expect(fitDetail({ a: 1 })).toEqual({ a: 1 });
  const fitted = fitDetail({ stack: "s".repeat(DETAIL_LIMIT * 2), model: "sonnet" });
  expect(JSON.stringify(fitted).length).toBeLessThanOrEqual(DETAIL_LIMIT);
  expect(fitted.model).toBe("sonnet");
  const circular: Record<string, unknown> = {};
  circular.self = circular;
  expect(fitDetail(circular)).toEqual({ unserialisable: true });
});

test("describeThrown reads an Error, a string and anything else", () => {
  expect(describeThrown(new TypeError("bad")).message).toBe("bad");
  expect(describeThrown(new TypeError("bad")).detail.error).toBe("TypeError");
  expect(describeThrown("plain")).toEqual({ message: "plain", detail: {} });
  expect(describeThrown({ code: 7 })).toEqual({ message: '{"code":7}', detail: {} });
});

test("a redirect and a not-found are answers, not failures", () => {
  expect(isExpected(redirect({ to: "/" }))).toBe(true);
  expect(isExpected(notFound())).toBe(true);
  expect(isExpected(new NotFound("recipe", "r1"))).toBe(true);
  expect(isExpected(new Error("boom"))).toBe(false);
});
