// The app-wide middleware: a failure on its way out is written down, then
// thrown on unchanged; an answer that is not a failure is left alone.
import { notFound } from "@tanstack/react-router";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import diagnosticEvents from "../../../src/db/models/diagnostic/repo";
import { isApiPath, recordApiFailures, recordFunctionFailures } from "../../../src/server/core/middleware";
import { useTempDataDir } from "../../helpers/server";

useTempDataDir();
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

type Server = (options: Record<string, unknown>) => Promise<unknown>;
const functionServer = (recordFunctionFailures as unknown as { options: { server: Server } }).options.server;
const requestServer = (recordApiFailures as unknown as { options: { server: Server } }).options.server;
const meta = { id: "fn-1", name: "createRecipe", filename: "src/server/fns/recipes.ts" };

test("a server function that throws is recorded under its name, and the error goes on to the caller", async () => {
  const error = new RangeError("out of range");
  await expect(functionServer({ next: () => Promise.reject(error), serverFnMeta: meta })).rejects.toBe(error);
  const [event] = diagnosticEvents.list();
  expect(event).toMatchObject({ source: "server", level: "error", name: "createRecipe", message: "out of range" });
  expect(event!.detail).toMatchObject({ file: "src/server/fns/recipes.ts", error: "RangeError" });
  expect(console.error).toHaveBeenCalledOnce();
});

test("a not-found passes through without being recorded, and a success is returned as is", async () => {
  const missing = notFound();
  await expect(functionServer({ next: () => Promise.reject(missing), serverFnMeta: meta })).rejects.toBe(missing);
  await expect(functionServer({ next: async () => ({ result: 1 }), serverFnMeta: meta })).resolves.toEqual({ result: 1 });
  expect(diagnosticEvents.list()).toEqual([]);
});

const request = (path: string, method = "GET") => new Request(`http://localhost${path}`, { method });

test("an /api route that throws or answers 5xx is recorded under its method and path; a 4xx is not", async () => {
  const boom = new Error("zip broke");
  await expect(
    requestServer({ request: request("/api/backup.zip"), pathname: "/api/backup.zip", handlerType: "router", next: () => Promise.reject(boom) })
  ).rejects.toBe(boom);
  const answered = { response: new Response("", { status: 503 }) };
  await expect(
    requestServer({ request: request("/api/restore", "POST"), pathname: "/api/restore", handlerType: "router", next: async () => answered })
  ).resolves.toBe(answered);
  await requestServer({
    request: request("/api/restore", "POST"),
    pathname: "/api/restore",
    handlerType: "router",
    next: async () => ({ response: new Response("", { status: 400 }) }),
  });
  expect(diagnosticEvents.list().map((event) => [event.name, event.message])).toEqual([
    ["POST /api/restore", "Answered 503"],
    ["GET /api/backup.zip", "zip broke"],
  ]);
});

test("server function requests and pages are left to others", async () => {
  const boom = new Error("not mine");
  await expect(
    requestServer({ request: request("/_serverFn/x", "POST"), pathname: "/_serverFn/x", handlerType: "serverFn", next: () => Promise.reject(boom) })
  ).rejects.toBe(boom);
  await expect(requestServer({ request: request("/settings"), pathname: "/settings", handlerType: "router", next: () => Promise.reject(boom) })).rejects.toBe(
    boom
  );
  expect(diagnosticEvents.list()).toEqual([]);
});

test("isApiPath is /api and below it, nothing that merely starts with the letters", () => {
  expect(isApiPath("/api")).toBe(true);
  expect(isApiPath("/api/health")).toBe(true);
  expect(isApiPath("/apiary")).toBe(false);
  expect(isApiPath("/recipes/api")).toBe(false);
});
