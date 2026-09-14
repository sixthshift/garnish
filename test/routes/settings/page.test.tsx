// The Foods and Units tabs' pure helpers: aggregating usage across a
// multi-row delete, and the label shown for one row or several. The route's
// end-to-end rendering of the default Foods tab (tabs, the table, its
// dialogs staying closed) lives in test/routes/loaders.test.tsx alongside the
// other routes.
//
// Aisles, Tags and Style are not the default tab, so their tabs are rendered
// directly here instead: AislesTab's drag list and rename/delete triggers,
// TagsTab's A–Z grouping (pure `groupTagsAZ`) and its tag-chip links,
// rename/merge/delete triggers, and closed-by-default dialogs, and StyleTab's
// statement rows — switch, editable text, note, reorder and add (M37.2).
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import type { Aisle, RecipeSummary, Tag, Unit } from "../../../src/domain/recipe/recipe";
import type { StyleRule } from "../../../src/domain/style/style";
import { AislesTab, dedupeSummaries, ExportTab, foodsLabel, groupTagsAZ, StyleTab, TagsTab, unitsLabel } from "../../../src/routes/settings/components/SettingsTabs";
import { type FoodRow } from "../../../src/routes/settings/route";

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
    tags: [],
    ingredientPreview: [],
  };
}

function food(id: string, name: string): FoodRow {
  return { id, name, pluralName: null, aliases: [], aisleId: null, recipeId: null, skipShopping: false, conversions: [] };
}

function unit(id: string, name: string): Unit {
  return { id, name, pluralName: null, abbreviation: "", useAbbreviation: false, fraction: true, standardQuantity: null, standardUnitId: null };
}

function aisle(id: string, name: string, position: number): Aisle {
  return { id, name, position };
}

function tag(id: string, name: string): Tag {
  return { id, name, slug: name.toLowerCase() };
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

describe("groupTagsAZ", () => {
  test("groups by first letter, upper-cased, each group sorted by name", () => {
    const weeknight = tag("t1", "Weeknight");
    const almonds = tag("t2", "almonds"); // lower-case name still groups under A
    const baking = tag("t3", "Baking");
    const groups = groupTagsAZ([weeknight, almonds, baking]);
    expect(groups).toEqual([
      { letter: "A", tags: [almonds] },
      { letter: "B", tags: [baking] },
      { letter: "W", tags: [weeknight] },
    ]);
  });

  test("a name starting with anything but A–Z falls into a trailing # group", () => {
    const weeknight = tag("t1", "Weeknight");
    const thirty = tag("t2", "30 minute");
    expect(groupTagsAZ([thirty, weeknight])).toEqual([
      { letter: "W", tags: [weeknight] },
      { letter: "#", tags: [thirty] },
    ]);
  });

  test("empty input gives no groups", () => {
    expect(groupTagsAZ([])).toEqual([]);
  });
});

describe("AislesTab render", () => {
  test("lists aisles in order with a drag handle and rename/delete triggers, no dialog open", () => {
    const html = renderToString(
      <AislesTab aisles={[aisle("a1", "Frozen", 0), aisle("a2", "Dairy", 1)]} />,
    );
    expect(html).toContain("Frozen");
    expect(html).toContain("Dairy");
    expect(html).toContain('aria-label="Drag aisle 1"');
    expect(html).toContain('aria-label="Drag aisle 2"');
    expect(html.match(/>Rename</g)?.length).toBe(2);
    expect(html.match(/>Delete</g)?.length).toBe(2);
    expect(html).not.toContain("will be deleted");
    expect(html).not.toContain('aria-label="Delete Frozen"');
  });

  test("no aisles says so instead of an empty list", () => {
    expect(renderToString(<AislesTab aisles={[]} />)).toContain("No aisles yet.");
  });
});

describe("TagsTab render", () => {
  test("groups tags A–Z, each name links to the filtered recipe list, with rename/merge/delete triggers", async () => {
    const html = await renderWithRouter(() => <TagsTab tags={[tag("t1", "Weeknight"), tag("t2", "Baking")]} />);
    expect(html).toContain('aria-label="Tags starting with B"');
    expect(html).toContain('aria-label="Tags starting with W"');
    expect(html).toContain('href="/?tag=baking"');
    expect(html).toContain('href="/?tag=weeknight"');
    expect(html.match(/>Rename</g)?.length).toBe(2);
    expect(html.match(/>Merge</g)?.length).toBe(2);
    expect(html.match(/>Delete</g)?.length).toBe(2);
    // No dialog is open by default.
    expect(html).not.toContain("will be deleted");
    expect(html).not.toContain("Merge into");
  });

  test("no tags says so instead of an empty list", async () => {
    expect(await renderWithRouter(() => <TagsTab tags={[]} />)).toContain("No tags yet.");
  });
});

describe("ExportTab render", () => {
  test("links at the whole-database export as a download and says images are not in the file", async () => {
    const html = await renderWithRouter(() => <ExportTab />);
    expect(html).toContain('href="/api/export.json"');
    expect(html).toContain("download");
    expect(html).toContain('data-testid="export-download"');
    expect(html).toMatch(/Images are referenced by their URLs, not included/);
    // The per-recipe endpoint is named so a reader can find it.
    expect(html).toContain("/api/recipes/");
  });

  test("the AI import note names the three variables and the free tier's catch (M36.1)", async () => {
    const html = await renderWithRouter(() => <ExportTab />);
    expect(html).toContain('data-testid="ai-import-note"');
    expect(html).toContain("AI_API_KEY");
    expect(html).toContain("AI_BASE_URL");
    expect(html).toContain("AI_MODEL");
    expect(html).not.toContain("setup-token");
    expect(html).toMatch(/only appears when/);
    expect(html).toMatch(/may train on what is sent/);
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

  test("the metric statement prints the facts-check caveat and the others do not", () => {
    const html = renderToString(<StyleTab rules={RULES} />);
    expect(html).toContain("until it understands them");
    expect(html.match(/until it understands them/g)?.length).toBe(1);
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

  test("an empty guide says so instead of an empty list, and still offers the add box", () => {
    const html = renderToString(<StyleTab rules={[]} />);
    expect(html).toContain("No statements yet.");
    expect(html).toContain('aria-label="New statement"');
  });
});
