// /api/mcp end to end: the SDK's own client, a real token, the tools over a real migrated database.
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { beforeEach, expect, test } from "vitest";
import mcp from "../../../src/db/models/mcp/repo";
import { handleMcp } from "../../../src/server/api/mcp";
import { hashSecret } from "../../../src/server/mcp/oauth/tokens";
import { resetSafetyBackups } from "../../../src/server/mcp/safety";
import { useTempDataDir } from "../../helpers/server";

const temp = useTempDataDir({ starterFoods: true });
const ORIGIN = "https://garnish.example";
const ENDPOINT = `${ORIGIN}/api/mcp`;

beforeEach(() => {
  resetSafetyBackups();
});

/** A token under a grant of `scope`, as the token endpoint would have issued it. */
function grantToken(scope: string): string {
  const client = mcp.registerClient({ name: "Claude", redirectUris: ["https://claude.ai/api/mcp/auth_callback"], secretHash: null });
  const grant = mcp.createGrant(client.id, scope);
  const token = `gat_test_${scope.replaceAll(" ", "_")}`;
  mcp.storeToken({ hash: hashSecret(token), grantId: grant.id, kind: "access", resource: ENDPOINT, expiresAt: "2999-01-01T00:00:00.000Z" });
  return token;
}

async function connect(token: string): Promise<Client> {
  const client = new Client({ name: "test", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(ENDPOINT), {
    fetch: (url, init) => handleMcp(new Request(url, init)),
    requestInit: { headers: { authorization: `Bearer ${token}` } },
  });
  await client.connect(transport);
  return client;
}

/** A tool's JSON answer, or its refusal text. */
async function call(client: Client, name: string, args: Record<string, unknown> = {}) {
  const result = (await client.callTool({ name, arguments: args })) as { isError?: boolean; content: { type: string; text: string }[] };
  const text = result.content[0]!.text;
  return result.isError ? { error: text } : JSON.parse(text);
}

test("without a token, the 401 that starts the OAuth flow, naming the address the request reached", async () => {
  const response = await handleMcp(new Request(ENDPOINT, { method: "POST", body: "{}", headers: { "content-type": "application/json" } }));
  expect(response.status).toBe(401);
  expect(response.headers.get("www-authenticate")).toContain(`resource_metadata="${ORIGIN}/.well-known/oauth-protected-resource/api/mcp"`);
});

test("a read-only connection sees only the read tools", async () => {
  const client = await connect(grantToken("read"));
  const names = (await client.listTools()).tools.map((tool) => tool.name);
  expect(names).toContain("search_recipes");
  expect(names).not.toContain("create_recipe");
  expect(names).not.toContain("delete_recipe");
  expect(client.getInstructions()).toContain("A recipe is an ordered list of parts");
  await client.close();
});

test("create, find, read, change, shop for and delete a recipe", async () => {
  const client = await connect(grantToken("read write delete"));
  const tools = (await client.listTools()).tools;
  expect(tools.find((tool) => tool.name === "delete_recipe")?.annotations?.destructiveHint).toBe(true);

  const created = await call(client, "create_recipe", {
    name: "Spring onion pancakes",
    servings: 2,
    tags: ["Weeknight"],
    parts: [
      {
        name: "",
        ingredients: ["250 g plain flour", "4 spring onions, thinly sliced", "1 tbsp doenjang"],
        steps: ["Mix the flour with water.", "Fold in the spring onions."],
      },
      { name: "Dipping sauce", ingredients: ["2 tbsp soy sauce"], steps: ["Stir together."] },
    ],
  });
  expect(created.error).toBeUndefined();
  expect(created.createdFoods).toEqual(["doenjang"]);
  expect(created.recipe.parts[0].ingredients.map((row: { food: string | null }) => row.food)).toEqual(["plain flour", "spring onion", "doenjang"]);

  const found = await call(client, "search_recipes", { query: "pancake" });
  expect(found.recipes.map((row: { name: string }) => row.name)).toEqual(["Spring onion pancakes"]);

  const read = await call(client, "get_recipe", { recipe: found.recipes[0].slug });
  expect(read.parts).toHaveLength(2);
  expect(read.parts[0].steps[1].uses).toEqual([read.parts[0].ingredients[1].id]);

  const changed = await call(client, "update_recipe", { id: read.id, servings: 4, description: "Crisp and chewy." });
  expect(changed.recipe).toMatchObject({ servings: 4, description: "Crisp and chewy.", name: "Spring onion pancakes" });
  expect(changed.recipe.parts).toEqual(read.parts);

  expect(await call(client, "add_to_shopping_list", { recipe: read.id, lines: ["dishwasher tablets"] })).toMatchObject({ added: 5 });
  const list = await call(client, "get_shopping_list");
  expect(list.items.map((item: { text: string }) => item.text)).toContain("dishwasher tablets");

  expect(await call(client, "add_to_meal_plan", { date: "2026-10-27", recipe: read.id, meal: "dinner" })).toMatchObject({
    recipe: "Spring onion pancakes",
    meal: "dinner",
  });

  const deleted = await call(client, "delete_recipe", { id: read.id });
  expect(deleted.deleted).toBe("Spring onion pancakes");
  expect(existsSync(join(temp.dir, "backups", deleted.backup))).toBe(true);
  expect(await call(client, "get_recipe", { recipe: read.id })).toMatchObject({ error: expect.stringContaining("search_recipes") });
  await client.close();
});

test("a bad write is refused with the reason, and nothing is saved", async () => {
  const client = await connect(grantToken("read write"));
  const result = await call(client, "update_recipe", { id: "nope", name: "X" });
  expect(result.error).toContain('No recipe has the id or slug "nope"');
  expect(readdirSync(temp.dir)).not.toContain("backups");
  await client.close();
});
