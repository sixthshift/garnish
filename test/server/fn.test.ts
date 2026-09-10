import { isNotFound } from "@tanstack/react-router";
import { expect, test } from "vitest";
import { NotFound } from "../../src/db/errors";
import { DEFAULT_UNITS } from "../../src/db/seed";
import { toNotFound, type NotFoundData } from "../../src/server/fn";
import { ping } from "../../src/server/ping";
import { explode, findThing, unitCount } from "../helpers/fixtures";
import { callServerFn, decodeServerFnId, useTempDataDir } from "../helpers/server";

useTempDataDir();

test("ping runs through validator and handler", async () => {
  await expect(callServerFn(ping, { echo: "hello" })).resolves.toEqual({ ok: true, echo: "hello" });
});

test("a validation failure rejects before the handler runs", async () => {
  await expect(callServerFn(ping, { echo: 5 } as never)).rejects.toThrow(/expected string/);
  await expect(callServerFn(ping, { echo: "" })).rejects.toThrow(/too_small|at least 1/);
});

test("a thrown NotFound becomes the router's not-found error with typed data", async () => {
  const caught = await callServerFn(findThing, { id: "t-1" }).catch((e: unknown) => e);
  expect(isNotFound(caught)).toBe(true);
  expect(caught).not.toBeInstanceOf(NotFound);
  expect((caught as { data: NotFoundData }).data).toEqual({ entity: "thing", id: "t-1", message: "thing t-1 not found" });
});

test("other errors pass through the middleware untouched", async () => {
  await expect(callServerFn(explode)).rejects.toThrow(RangeError);
});

test("a server function reads the temp database via getDb", async () => {
  await expect(callServerFn(unitCount)).resolves.toEqual({ count: DEFAULT_UNITS.length });
});

test("toNotFound maps NotFound only", () => {
  const mapped = toNotFound(new NotFound("recipe", "r1"));
  expect(isNotFound(mapped)).toBe(true);
  const plain = new Error("nope");
  expect(toNotFound(plain)).toBe(plain);
});

test("decodeServerFnId reads dev-mode ids and rejects others", () => {
  const id = Buffer.from(JSON.stringify({ file: "/x.ts?tss-serverfn-split", export: "x_createServerFn_handler" })).toString("base64url");
  expect(decodeServerFnId(id)).toEqual({ file: "/x.ts?tss-serverfn-split", export: "x_createServerFn_handler" });
  expect(() => decodeServerFnId(Buffer.from("{}").toString("base64url"))).toThrow(/does not decode/);
});
