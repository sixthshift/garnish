import { expect, test } from "vitest";
import { VERSION } from "../../../src/lib/version";
import { handleHealth, healthRoute } from "../../../src/routes/api/health";

test("GET /api/health returns {ok:true} and the version as JSON", async () => {
  const res = handleHealth(new Request("http://localhost/api/health"));
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toMatch(/application\/json/);
  expect(await res.json()).toEqual({ ok: true, version: VERSION });
});

test("route wires a GET handler that delegates to handleHealth", async () => {
  const handlers = healthRoute.options.server?.handlers as Record<string, (ctx: { request: Request }) => Response | Promise<Response>> | undefined;
  expect(typeof handlers?.GET).toBe("function");
  const res = await handlers!.GET!({ request: new Request("http://localhost/api/health") });
  expect(await res.json()).toEqual({ ok: true, version: VERSION });
});
