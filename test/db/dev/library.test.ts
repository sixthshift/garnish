// The dev library: twenty hand-written recipes in the house style, varied
// the way a real household's are.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { DEV_PHOTOS_DIR } from "../../../src/db/dev/apply";
import { DEV_LIBRARY, DEV_PLAN } from "../../../src/db/dev/library";
import { recipeInputSchema } from "../../../src/domain/recipes/recipe";
import { slugify } from "../../../src/lib/names";

const parsed = DEV_LIBRARY.map((r) => ({ dev: r, doc: recipeInputSchema.parse(r.input) }));

test("twenty valid recipes with distinct names, slugs and ids", () => {
  expect(DEV_LIBRARY).toHaveLength(20);
  expect(new Set(parsed.map((r) => slugify(r.doc.name))).size).toBe(20);
  const ids = parsed.flatMap(({ doc }) => [doc.id, ...doc.parts.flatMap((p) => [...p.ingredients.map((i) => i.id), ...p.steps.map((s) => s.id)])]);
  expect(new Set(ids).size).toBe(ids.length);
});

test("every step reads as the house style wants", () => {
  for (const { doc } of parsed) {
    const steps = doc.parts.flatMap((p) => p.steps);
    for (const step of steps) {
      expect(step.title, `${doc.name}: ${step.text}`).not.toBe("");
      expect(`${step.text} ${step.summary}`, `${doc.name}: ${step.title}`).not.toMatch(/\d-\d| - |\bhrs\b|\bmins\b|°F/);
    }
    expect(
      steps.some((s) => s.summary !== ""),
      doc.name
    ).toBe(true);
    expect(
      steps.some((s) => s.ingredientIds.length > 0),
      doc.name
    ).toBe(true);
    // A link names a row of the step's own part.
    for (const part of doc.parts) {
      const rows = new Set(part.ingredients.map((i) => i.id));
      for (const step of part.steps) for (const id of step.ingredientIds) expect(rows.has(id), `${doc.name}: ${step.title}`).toBe(true);
    }
  }
});

test("ages are consistent: updated after created, cooks after created", () => {
  for (const { dev, doc } of parsed) {
    expect(dev.updatedDaysAgo, doc.name).toBeLessThanOrEqual(dev.createdDaysAgo);
    for (const c of dev.cooks) expect(c.daysAgo, doc.name).toBeLessThanOrEqual(dev.createdDaysAgo);
  }
});

test("varied the way a real library is", () => {
  const docs = parsed.map((r) => r.doc);
  const has = (predicate: (r: (typeof parsed)[number]) => boolean) => parsed.some(predicate);
  expect(new Set(docs.flatMap((d) => d.facets.cuisine)).size).toBeGreaterThanOrEqual(8);
  expect(new Set(docs.flatMap((d) => d.facets.course)).size).toBeGreaterThanOrEqual(6);
  expect(docs.filter((d) => d.facets.week.includes("weeknight")).length).toBeGreaterThanOrEqual(8);
  expect(docs.some((d) => d.facets.week.includes("weekend"))).toBe(true);
  expect(docs.some((d) => d.facets.week.length === 0)).toBe(true);
  expect(has((r) => r.dev.cooks.length === 0)).toBe(true); // never made
  expect(docs.some((d) => d.rating === null)).toBe(true);
  expect(DEV_LIBRARY.filter((r) => r.makesFood !== undefined).length).toBeGreaterThanOrEqual(2);
});

test("between them they use every feature a recipe has", () => {
  const lines = parsed.flatMap(({ doc }) => doc.parts.flatMap((p) => p.ingredients));
  const alternatives = lines.flatMap((l) => l.alternatives);
  expect(parsed.some(({ doc }) => doc.parts.length >= 3)).toBe(true);
  expect(lines.some((l) => l.fixed)).toBe(true);
  expect(lines.some((l) => l.food === null && l.originalText !== "")).toBe(true);
  expect(lines.some((l) => l.quantity === null && l.food !== null)).toBe(true);
  expect(alternatives.some((a) => a.planPicks)).toBe(true);
  expect(alternatives.some((a) => a.basisQuantity !== null && a.items.length > 1)).toBe(true);
  expect(parsed.some(({ doc }) => doc.yieldUnit !== null)).toBe(true);
  expect(parsed.some(({ dev }) => (dev.stepImages?.length ?? 0) > 0)).toBe(true);
});

test("every photo the library names is on disk, and credited", () => {
  const credits = readFileSync(join(DEV_PHOTOS_DIR, "CREDITS.md"), "utf8");
  const files = DEV_LIBRARY.flatMap((r) => [r.image, ...(r.stepImages ?? []).map((s) => s.file)]).filter((f): f is string => f !== null);
  expect(new Set(files).size).toBe(files.length);
  for (const file of files) {
    expect(existsSync(join(DEV_PHOTOS_DIR, file)), file).toBe(true);
    expect(credits, file).toContain(file);
  }
});

test("the plan names only library recipes", () => {
  for (const entry of DEV_PLAN) {
    expect(entry.recipe !== undefined || (entry.text ?? "") !== "").toBe(true);
    if (entry.recipe) expect(DEV_LIBRARY).toContain(entry.recipe);
  }
});
