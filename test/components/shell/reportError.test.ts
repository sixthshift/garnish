// What a browser sends back when it catches an error: a report worth keeping,
// once per message and place, never more than a handful per load, and never a
// failure of its own.
import { notFound, redirect } from "@tanstack/react-router";
import { expect, test } from "vitest";
import { type ClientErrorReport, clientErrorReport, createReporter, installErrorReporting, REPORTS_PER_LOAD } from "../../../src/components/shell/reportError";

const context = { page: "/recipes/new?step=style", userAgent: "Mozilla/5.0 (iPhone)", build: "1.4.0 (c4bd82d)" };

test("an Error becomes a report with its message, stack, page and the browser's build", () => {
  const error = new TypeError("(0 , k.createRequire) is not a function");
  expect(clientErrorReport(error, "route", context)).toEqual({
    where: "route",
    message: "(0 , k.createRequire) is not a function",
    stack: error.stack,
    page: "/recipes/new?step=style",
    build: "1.4.0 (c4bd82d)",
    userAgent: "Mozilla/5.0 (iPhone)",
  });
});

test("a string or a thrown object is reported as its text", () => {
  expect(clientErrorReport("plain", "window", context)?.message).toBe("plain");
  expect(clientErrorReport({ code: 7 }, "promise", context)?.message).toBe('{"code":7}');
});

test("a network failure, a redirect and a not-found are not reported", () => {
  expect(clientErrorReport(new TypeError("Failed to fetch"), "route", context)).toBeNull();
  expect(clientErrorReport(redirect({ to: "/" }), "route", context)).toBeNull();
  expect(clientErrorReport(notFound(), "route", context)).toBeNull();
});

test("a long message and stack are cut to what the server accepts", () => {
  const error = new Error("m".repeat(5_000));
  error.stack = "s".repeat(20_000);
  const report = clientErrorReport(error, "shell", context)!;
  expect(report.message).toHaveLength(4_000);
  expect(report.stack).toHaveLength(16_000);
});

const report = (message: string, where: ClientErrorReport["where"] = "route"): ClientErrorReport => ({ ...context, where, message, stack: "" });

test("the reporter sends each message and place once, up to its limit, and ignores nothing-to-send", () => {
  const sent: string[] = [];
  const reporter = createReporter(async (r) => sent.push(`${r.where}:${r.message}`), 3);
  reporter(report("a"));
  reporter(report("a"));
  reporter(report("a", "window"));
  reporter(null);
  reporter(report("b"));
  reporter(report("c"));
  expect(sent).toEqual(["route:a", "window:a", "route:b"]);
  expect(REPORTS_PER_LOAD).toBeGreaterThan(0);
});

test("a send that fails is swallowed", async () => {
  const reporter = createReporter(() => Promise.reject(new Error("offline")));
  expect(() => reporter(report("a"))).not.toThrow();
  await new Promise((resolve) => setTimeout(resolve, 0));
});

test("installErrorReporting listens for errors and unhandled rejections, and undoes itself", () => {
  const added: string[] = [];
  const removed: string[] = [];
  const target = {
    addEventListener: (type: string) => added.push(type),
    removeEventListener: (type: string) => removed.push(type),
  } as unknown as Window;
  const undo = installErrorReporting(target);
  expect(added).toEqual(["error", "unhandledrejection"]);
  undo();
  expect(removed).toEqual(["error", "unhandledrejection"]);
});
