// The Diagnostics server functions: a browser's report written down beside
// the server's own, the list Settings reads, and clearing it.
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import diagnosticEvents from "../../../src/db/models/diagnostic/repo";
import { clearDiagnostics, listDiagnostics, reportClientError } from "../../../src/server/fns/diagnostics";
import { callServerFn, useTempDataDir } from "../../helpers/server";

useTempDataDir();
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

const report = {
  where: "route" as const,
  message: "(0 , k.createRequire) is not a function",
  stack: "TypeError: (0 , k.createRequire) is not a function\n    at StyleSpace-DWXZQjZg.js:1:2",
  page: "/recipes/new",
  build: "1.4.0 (c4bd82d)",
  userAgent: "Mozilla/5.0 (iPhone)",
};

test("a browser's report is kept as a browser error under its page, with the browser's own build", async () => {
  await expect(callServerFn(reportClientError, report)).resolves.toEqual({ recorded: true });
  const [event] = diagnosticEvents.list();
  expect(event).toMatchObject({ source: "browser", level: "error", name: "/recipes/new", message: report.message, version: "1.4.0 (c4bd82d)" });
  expect(event!.detail).toEqual({ where: "route", stack: report.stack, userAgent: report.userAgent });
});

test("a report with no page is named by where it was caught, and an empty message still says something", async () => {
  await callServerFn(reportClientError, { ...report, page: "", message: "", stack: "", userAgent: "" });
  const [event] = diagnosticEvents.list();
  expect(event).toMatchObject({ name: "route", message: "An error with no message" });
  expect(event!.detail).toEqual({ where: "route" });
});

test("an oversized or unknown report is refused by the validator", async () => {
  await expect(callServerFn(reportClientError, { ...report, where: "worker" } as never)).rejects.toThrow();
  await expect(callServerFn(reportClientError, { ...report, stack: "s".repeat(16_001) })).rejects.toThrow();
  expect(diagnosticEvents.count()).toBe(0);
});

test("list reads the newest first, and clear forgets them", async () => {
  await callServerFn(reportClientError, { ...report, message: "first" });
  await callServerFn(reportClientError, { ...report, message: "second" });
  expect((await callServerFn(listDiagnostics)).map((event) => event.message)).toEqual(["second", "first"]);
  await expect(callServerFn(clearDiagnostics)).resolves.toEqual({ cleared: true });
  await expect(callServerFn(listDiagnostics)).resolves.toEqual([]);
});
