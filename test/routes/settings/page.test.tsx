// The Foods and Units tabs' pure helpers: aggregating usage across a
// multi-row delete, and the label shown for one row or several. The route's
// end-to-end rendering of the default Foods tab (tabs, the table, its
// dialogs staying closed) lives in test/routes/loaders.test.tsx alongside the
// other routes.
//
// Aisles, Tags and Style are not the default tab, so their tabs are rendered
// directly here instead: AislesTab's drag list and rename/delete triggers,
// TagsTab's table (counts, tag-chip links, row actions, closed-by-default
// dialogs) and its rename clash check, and StyleTab's
// statement rows — switch, editable text, note, reorder and add (M37.2).
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import type { PlannerRule } from "../../../src/domain/planner";
import type { RecipeSummary } from "../../../src/domain/recipe";
import type { Aisle, TagUsage, Unit } from "../../../src/domain/reference";
import type { StyleRule } from "../../../src/domain/style";
import { buildLabel } from "../../../src/lib/version";
import { dedupeSummaries, foodsLabel, unitsLabel } from "../../../src/routes/settings/components/settingsLabels";
import { AislesTab } from "../../../src/routes/settings/components/tabs/AislesTab";
import { AiTab, connectedMessage, connectedTitle, OfferedModels } from "../../../src/routes/settings/components/tabs/AiTab";
import { BackupTab } from "../../../src/routes/settings/components/tabs/BackupTab";
import { connectionDescription, McpTab, maskedCode } from "../../../src/routes/settings/components/tabs/McpTab";
import { PlannerTab } from "../../../src/routes/settings/components/tabs/PlannerTab";
import { StyleTab } from "../../../src/routes/settings/components/tabs/StyleTab";
import { renameClash, TagsTab } from "../../../src/routes/settings/components/tabs/TagsTab";
import { Version } from "../../../src/routes/settings/components/Version";
import type { FoodRow } from "../../../src/routes/settings/route";

function summary(id: string, name: string): RecipeSummary {
  return {
    id,
    slug: name.toLowerCase(),
    name,
    image: null,
    rating: null,
    prepTime: null,
    performTime: null,
    totalTime: null,
    lastMade: null,
    favourite: false,
    kind: null,
    tags: [],
    ingredientPreview: [],
  };
}

function food(id: string, name: string): FoodRow {
  return { id, name, pluralName: null, aliases: [], aisleId: null, recipeId: null, skipShopping: false, conversions: [] };
}

function unit(id: string, name: string): Unit {
  return { id, name, pluralName: null, abbreviation: "", useAbbreviation: false, fraction: true, portion: false, standardQuantity: null, standardUnitId: null };
}

function aisle(id: string, name: string, position: number): Aisle {
  return { id, name, position };
}

function tag(id: string, name: string, recipes = 1): TagUsage {
  return { id, name, slug: name.toLowerCase(), recipes };
}

/** Render a component inside a throwaway router, so a `Link` it renders resolves. */
async function renderWithRouter(component: () => ReactNode): Promise<string> {
  const rootRoute = createRootRoute({ component });
  const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: () => null });
  const router = createRouter({ routeTree: rootRoute.addChildren([indexRoute]), history: createMemoryHistory({ initialEntries: ["/"] }) });
  await router.load();
  return renderToString(<RouterProvider router={router} />);
}

describe("dedupeSummaries", () => {
  test("keeps the first occurrence across several lists, dropping later duplicates", () => {
    const shortbread = summary("r1", "Shortbread");
    const toast = summary("r2", "Toast");
    expect(dedupeSummaries([[shortbread, toast], [toast], []])).toEqual([shortbread, toast]);
  });

  test("empty lists give an empty result", () => {
    expect(dedupeSummaries([[], []])).toEqual([]);
    expect(dedupeSummaries([])).toEqual([]);
  });
});

describe("foodsLabel", () => {
  test("names the single row, or counts several", () => {
    expect(foodsLabel([food("f1", "Butter")])).toBe("Butter");
    expect(foodsLabel([food("f1", "Butter"), food("f2", "Salt")])).toBe("2 foods");
  });
});

describe("unitsLabel", () => {
  test("names the single row, or counts several", () => {
    expect(unitsLabel([unit("u1", "gram")])).toBe("gram");
    expect(unitsLabel([unit("u1", "gram"), unit("u2", "cup")])).toBe("2 units");
  });
});

describe("renameClash", () => {
  const weeknight = tag("t1", "Weeknight");
  const dinner = tag("t2", "Weeknight dinners");
  test("a rename onto another tag's name, in any case, is that tag", () => {
    expect(renameClash([weeknight, dinner], dinner, "weeknight")).toBe(weeknight);
    expect(renameClash([weeknight, dinner], dinner, "  #WEEKNIGHT ")).toBe(weeknight);
  });

  test("a new name, or the tag's own in another case, is no clash", () => {
    expect(renameClash([weeknight, dinner], dinner, "School nights")).toBeNull();
    expect(renameClash([weeknight, dinner], weeknight, "weeknight")).toBeNull();
  });
});

describe("AislesTab render", () => {
  test("lists aisles in order with a drag handle and an actions menu (rename, delete), no dialog open", () => {
    const html = renderToString(<AislesTab aisles={[aisle("a1", "Frozen", 0), aisle("a2", "Dairy", 1)]} />);
    expect(html).toContain("Frozen");
    expect(html).toContain("Dairy");
    expect(html).toContain('aria-label="Drag aisle 1"');
    expect(html).toContain('aria-label="Drag aisle 2"');
    expect(html).toContain('aria-label="Actions for Frozen"');
    expect(html).toContain('aria-label="Actions for Dairy"');
    expect(html).not.toContain("will be deleted");
    expect(html).not.toContain('aria-label="Delete Frozen"');
  });

  test("no aisles says so instead of an empty list", () => {
    expect(renderToString(<AislesTab aisles={[]} />)).toContain("No aisles yet.");
  });
});

describe("TagsTab render", () => {
  test("a table of tags with how many recipes carry each, each name linking to its recipes, with row actions", async () => {
    const html = await renderWithRouter(() => <TagsTab tags={[tag("t1", "Weeknight", 6), tag("t2", "Baking", 0)]} />);
    expect(html).toContain("Recipes");
    expect(html).toMatch(/Weeknight[\s\S]*>6</);
    expect(html).toContain('href="/recipes?tag=baking"');
    expect(html).toContain('href="/recipes?tag=weeknight"');
    expect(html).toContain('aria-label="Actions for Weeknight"');
    expect(html).toContain('aria-label="Select Baking"');
    // No dialog is open by default.
    expect(html).not.toContain("will be deleted");
    expect(html).not.toContain("Merge into");
  });

  test("no tags says so instead of an empty table", async () => {
    expect(await renderWithRouter(() => <TagsTab tags={[]} />)).toContain("No tags yet.");
  });
});

describe("BackupTab render", () => {
  test("offers the backup as a download and a restore, and says export is per recipe", async () => {
    const html = await renderWithRouter(() => <BackupTab />);
    expect(html).toContain('href="/api/backup.zip"');
    expect(html).toContain("download");
    expect(html).toContain('data-testid="backup-download"');
    expect(html).toContain(">Back up<");
    expect(html).toContain("Download backup");
    expect(html).toContain(">Restore<");
    expect(html).toContain("Choose backup…");
    expect(html).toContain('accept=".zip,application/zip"');
    expect(html).toMatch(/Export is per recipe/);
    expect(html).not.toContain("/api/export.json");
    // No confirm until a file has passed the check.
    expect(html).not.toContain("I understand this replaces everything");
  });
});

describe("McpTab render", () => {
  const connection = {
    id: "00000000-0000-4000-8000-000000000001",
    clientId: "https://claude.ai/oauth/mcp-oauth-client-metadata",
    clientName: "Claude",
    scope: "read write delete",
    createdAt: "2026-10-03T01:00:00.000Z",
    lastUsedAt: null,
  };

  test("an open door shows the address to paste, how to connect, and each connection with Disconnect", async () => {
    const status = { url: "https://garnish.example/api/mcp", problem: null, pairingCode: "K7QF-M2XP-9RTD", connections: [connection] };
    const html = await renderWithRouter(() => <McpTab status={status} />);
    expect(html).toContain("https://garnish.example/api/mcp");
    expect(html).toContain("claude mcp add --transport http garnish");
    expect(html).toContain("Any MCP client");
    expect(html).toContain("Claude");
    expect(html).toContain("Disconnect");
    expect(html).not.toContain("GARNISH_PUBLIC_URL is not used");
    expect(html).toContain("Give this to the assistant as a remote MCP server.");
    // The pairing code starts hidden, with its controls beside it.
    expect(html).not.toContain("K7QF-M2XP-9RTD");
    expect(html).toContain("••••-••••-••••");
    for (const label of ["Show", "Regenerate"]) expect(html).toContain(`>${label}</button>`);
  });

  test("a LAN address says it is for clients on the network; a wrong GARNISH_PUBLIC_URL says why it is not used", async () => {
    const status = {
      url: "http://192.168.1.5:9988/api/mcp",
      problem: "GARNISH_PUBLIC_URL is not an address: x",
      pairingCode: "K7QF-M2XP-9RTD",
      connections: [],
    };
    const html = await renderWithRouter(() => <McpTab status={status} />);
    expect(html).toContain("http://192.168.1.5:9988/api/mcp");
    expect(html).toContain("right for clients on this network");
    expect(html).toContain("GARNISH_PUBLIC_URL is not an address: x");
    expect(html).toContain("Pairing code");
    expect(html).toContain("Nothing connected");
  });

  test("maskedCode hides every character and keeps the dashes", () => {
    expect(maskedCode("K7QF-M2XP-9RTD")).toBe("••••-••••-••••");
  });

  test("connectionDescription says when, how recently and what it may do", () => {
    expect(connectionDescription(connection)).toBe("Connected 3 Oct 2026, not used yet. May read, write, delete.");
    expect(connectionDescription({ ...connection, lastUsedAt: "2026-10-25T01:00:00.000Z" })).toBe(
      "Connected 3 Oct 2026, last used 25 Oct 2026. May read, write, delete."
    );
  });
});

describe("AiTab render", () => {
  const status = {
    provider: "api" as const,
    problem: null,
    credential: "AI_API_KEY",
    configured: true,
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    isDefaultProvider: true,
    models: [
      { use: "import" as const, model: "gemini-flash-lite-latest" },
      { use: "restyle" as const, model: "gemini-flash-lite-latest" },
      { use: "planner" as const, model: "gemini-pro-latest" },
    ],
  };

  test("shows the configuration as rows, naming each variable, and never the key", () => {
    const html = renderToString(<AiTab status={status} />);
    for (const name of ["AI_API_KEY", "AI_BASE_URL", "AI_IMPORT_MODEL", "AI_RESTYLE_MODEL", "AI_PLANNER_MODEL"]) expect(html).toContain(name);
    expect(html).toContain("gemini-pro-latest");
    expect(html).toMatch(/data-testid="ai-key-status"[^>]*>.*●●●●.*>Set</);
    expect(html).not.toContain("Not set");
    expect(html).toMatch(/may train on what is sent/);
    expect(html).toContain("Test");
  });

  test("without a key it says so, drops the free-tier caveat for another provider, and the test is disabled", () => {
    const html = renderToString(<AiTab status={{ ...status, configured: false, isDefaultProvider: false, baseUrl: "http://llm.lan/v1" }} />);
    expect(html).toMatch(/data-testid="ai-key-status"[^>]*>Not set</);
    expect(html).not.toMatch(/may train on what is sent/);
    expect(html).toMatch(/<button[^>]*disabled/);
  });

  test("a check that proved the key says it works; one that could not says the first import will", () => {
    const models = [{ use: "import" as const, model: "haiku", listed: true }];
    expect(connectedMessage({ ok: true, baseUrl: "x", credentialProved: true, models, offered: [] }, "key")).toBe(
      "The key works, and every model named above is offered."
    );
    const unproved = connectedMessage({ ok: true, baseUrl: "x", credentialProved: false, models, offered: [] }, "token");
    expect(unproved).toMatch(/picked up the token; the token itself is proved by the first import/);
    expect(unproved).not.toMatch(/token works/);
    expect(connectedTitle({ ok: true, baseUrl: "x", credentialProved: false, models: [{ ...models[0]!, listed: false }], offered: [] })).toBe(
      "Connected, but a model is not listed"
    );
  });

  test("with no provider it says Not set and why, shows no credential row, and the test is disabled", () => {
    const problem = "No AI provider is set. Set AI_PROVIDER to api (with AI_API_KEY) or claude-code (with CLAUDE_CODE_OAUTH_TOKEN) to use this.";
    const html = renderToString(
      <AiTab status={{ provider: null, problem, credential: "", configured: false, baseUrl: "", isDefaultProvider: false, models: [] }} />
    );
    expect(html).toMatch(/data-testid="ai-provider-status"[^>]*>Not set</);
    expect(html).toContain("No AI provider is set.");
    expect(html).not.toContain("ai-key-status");
    expect(html).not.toContain("AI_BASE_URL");
    expect(html).toMatch(/<button[^>]*disabled/);
  });

  test("the offered models are listed by name, with the full id a name stands for and the features that ask it", () => {
    const html = renderToString(
      <OfferedModels
        offered={[
          { name: "haiku", resolvesTo: "claude-haiku-4-5-20251001" },
          { name: "opus", resolvesTo: "claude-opus-5-5" },
          { name: "claude-fable-5-1", resolvesTo: "claude-fable-5-1" },
        ]}
        models={[
          { use: "import", model: "haiku", listed: true },
          { use: "restyle", model: "claude-opus-5-5", listed: true },
          { use: "planner", model: "claude-mystery", listed: false },
        ]}
      />
    );
    expect(html).toContain("Models it offers");
    expect(html).toContain("<code>haiku</code>");
    expect(html).toContain("<code>claude-haiku-4-5-20251001</code>");
    // A name that is its own full id does not repeat it.
    expect(html.match(/claude-fable-5-1/g)).toHaveLength(1);
    // Badged by the features that ask it, whether by name or by full id.
    expect(html).toMatch(/haiku<\/code>[\s\S]*?Recipe import/);
    expect(html).toMatch(/opus<\/code>[\s\S]*?Restyle/);
    expect(html).not.toContain("Planner");
  });

  test("an empty offer says so in a row rather than an empty card", () => {
    const html = renderToString(<OfferedModels offered={[]} models={[]} />);
    expect(html).toContain("No models listed");
  });

  test("on Claude Code it names the token's variable and has no endpoint row", () => {
    const html = renderToString(
      <AiTab
        status={{
          ...status,
          provider: "claude-code",
          credential: "CLAUDE_CODE_OAUTH_TOKEN",
          isDefaultProvider: false,
          baseUrl: "Claude Code, on the subscription",
        }}
      />
    );
    expect(html).toContain("CLAUDE_CODE_OAUTH_TOKEN");
    expect(html).toContain("claude-code");
    expect(html).not.toContain("AI_API_KEY");
    expect(html).not.toContain("AI_BASE_URL");
    expect(html).not.toMatch(/may train on what is sent/);
  });
});

function styleRule(id: string, text: string, enabled: boolean, position: number): StyleRule {
  return { id, position, text, enabled, createdAt: "2026-09-14T00:00:00.000Z", updatedAt: "2026-09-14T00:00:00.000Z" };
}

describe("StyleTab render", () => {
  const RULES = [
    styleRule("s1", "One action per step: split a paragraph that does several things.", true, 0),
    styleRule("s2", "Prefer metric: where a step gives both, keep only metric.", false, 1),
  ];

  test("lists the statements in order, each with a switch showing its default and its text in an editable field", () => {
    const html = renderToString(<StyleTab rules={RULES} />);
    expect(html).toContain("One action per step");
    expect(html).toContain("Prefer metric");
    expect(html).toContain('role="switch"');
    expect(html.match(/role="switch"/g)?.length).toBe(2);
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain('aria-checked="false"');
    expect(html).toContain('aria-label="Statement: One action per step: split a paragraph that does several things."');
  });

  test("no statement prints a caveat: none needs one any more", () => {
    const html = renderToString(<StyleTab rules={RULES} />);
    expect(html).not.toContain("data-statement-note");
  });

  test("every row can be moved and removed, and there is an add box at the foot", () => {
    const html = renderToString(<StyleTab rules={RULES} />);
    expect(html).toContain('aria-label="Move statement 1 down"');
    expect(html).toContain('aria-label="Move statement 2 up"');
    expect(html).toContain('aria-label="Drag statement 1"');
    expect(html).toContain('aria-label="Remove statement 2"');
    expect(html).toContain('aria-label="New statement"');
    expect(html).toContain(">Add<");
  });

  test("on a narrow list the move and remove buttons take a line over the statement, after its number; the switch stays beside the text", () => {
    const html = renderToString(<StyleTab rules={RULES} />);
    expect(html).toContain('data-narrow="above"');
    expect(html).toMatch(/aria-hidden="true">statement 1</);
    // The switch is still named for its own statement.
    expect(html).toContain('aria-label="Use &quot;Prefer metric: where a step gives both, keep only metric.&quot; by default"');
  });

  test("an empty guide says so instead of an empty list, and still offers the add box", () => {
    const html = renderToString(<StyleTab rules={[]} />);
    expect(html).toContain("No statements yet.");
    expect(html).toContain('aria-label="New statement"');
  });
});

function plannerRule(id: string, text: string, enabled: boolean, position: number): PlannerRule {
  return { id, position, text, enabled, createdAt: "2026-09-18T00:00:00.000Z", updatedAt: "2026-09-18T00:00:00.000Z" };
}

describe("PlannerTab render", () => {
  const RULES = [
    plannerRule("p1", "Nothing we ate in the last three weeks, unless it is a favourite.", true, 0),
    plannerRule("p2", "Two vegetarian dinners a week.", false, 1),
  ];
  test("is the statements alone: the meal checkboxes went to the proposal sheet (M39.7)", () => {
    const html = renderToString(<PlannerTab rules={RULES} />);
    expect(html).not.toContain('role="checkbox"');
    for (const label of ["Breakfast", "Lunch", "Dinner"]) expect(html).not.toContain(`>${label}<`);
    expect(html).not.toContain("Meals planned");
  });

  test("the statements are the same list the Style tab renders: switch, editable text, move, remove and an add box", () => {
    const html = renderToString(<PlannerTab rules={RULES} />);
    expect(html).toContain("Nothing we ate in the last three weeks");
    expect(html).toContain("Two vegetarian dinners a week.");
    expect(html.match(/role="switch"/g)?.length).toBe(2);
    expect(html).toContain('aria-label="Statement: Two vegetarian dinners a week."');
    expect(html).toContain('aria-label="Move statement 1 down"');
    expect(html).toContain('aria-label="Remove statement 2"');
    expect(html).toContain('data-narrow="above"');
    expect(html).toContain('aria-label="New statement"');
    expect(html).toContain(">Add<");
    // The style guide's caveat belongs to the style guide only.
    expect(html).not.toContain("until it understands them");
  });

  test("an empty guide says so instead of an empty list, and still offers the add box", () => {
    const html = renderToString(<PlannerTab rules={[]} />);
    expect(html).toContain("No statements yet.");
    expect(html).toContain('aria-label="New statement"');
  });
});

test("the Settings footer names the version this build was stamped with", () => {
  const html = renderToString(<Version />);
  expect(html).toContain(`Garnish ${buildLabel()}`);
});
