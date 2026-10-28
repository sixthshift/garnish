import { expect, test } from "vitest";
import { type PlanDay, planEntrySchema } from "../../../../src/domain/plan";
import type { RecipeSummary } from "../../../../src/domain/recipe";
import {
  fillNights,
  fromProposal,
  missedRecipes,
  nightReason,
  openDays,
  reasonKey,
  reasonLabel,
  rotationPool,
  sessionEntries,
  swapNight,
  weekendShelf,
} from "../../../../src/routes/plan/fill/components/fill";

const MONDAY = "2026-09-14";

let n = 0;
function recipe(name: string, over: Partial<RecipeSummary> = {}): RecipeSummary {
  n += 1;
  return {
    id: `11111111-1111-4111-8111-${String(n).padStart(12, "0")}`,
    slug: name.toLowerCase().replaceAll(" ", "-"),
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
    ...over,
  };
}

function day(date: string, recipes: RecipeSummary[] = [], text: string[] = []): PlanDay {
  const entries = [
    ...recipes.map((r) => ({ recipe: { id: r.id, slug: r.slug, name: r.name, image: null }, text: r.name })),
    ...text.map((t) => ({ text: t })),
  ].map((over, i) => {
    n += 1;
    return planEntrySchema.parse({ id: `99999999-9999-4999-8999-${String(n).padStart(12, "0")}`, date, position: i, ...over });
  });
  return { date, entries };
}

test("open days are the empty ones from today on, split into weeknights and the weekend", () => {
  const days = [
    day("2026-09-14"),
    day("2026-09-15", [], ["Out"]),
    day("2026-09-16"),
    day("2026-09-17"),
    day("2026-09-18"),
    day("2026-09-19"),
    day("2026-09-20", [], ["Mum's"]),
  ];
  expect(openDays(MONDAY, days, "2026-09-10")).toEqual({ weeknights: ["2026-09-14", "2026-09-16", "2026-09-17", "2026-09-18"], weekend: ["2026-09-19"] });
  expect(openDays(MONDAY, days, "2026-09-17")).toEqual({ weeknights: ["2026-09-17", "2026-09-18"], weekend: ["2026-09-19"] });
});

test("a recipe planned on a day gone by and not made since is missed; one made that day or after is not", () => {
  const made = recipe("Tacos", { lastMade: "2026-09-08T19:00:00.000Z" });
  const notMade = recipe("Fried rice", { lastMade: "2026-08-01T19:00:00.000Z" });
  const never = recipe("Dal");
  const later = recipe("Risotto");
  const map = new Map([made, notMade, never, later].map((r) => [r.id, r]));
  const days = [day("2026-09-07", [made]), day("2026-09-08", [notMade, never]), day("2026-09-12", [later])];
  expect(missedRecipes(days, map, "2026-09-10").map((r) => r.name)).toEqual(["Fried rice", "Dal"]);
});

test("the rotation pool is the rotation alone, never made first then the longest since made, less the excluded", () => {
  const a = recipe("Laksa", { kind: "rotation", lastMade: "2026-09-01T00:00:00.000Z" });
  const b = recipe("Dal", { kind: "rotation", lastMade: "2026-07-01T00:00:00.000Z" });
  const c = recipe("Kofta", { kind: "rotation" });
  const d = recipe("Lamb", { kind: "weekend" });
  const e = recipe("Tacos", { kind: "rotation", lastMade: "2026-06-01T00:00:00.000Z" });
  expect(rotationPool([a, b, c, d, e], new Set([e.id])).map((r) => r.name)).toEqual(["Kofta", "Dal", "Laksa"]);
});

test("the nights take what was missed first, then the pool, and run out into nights off", () => {
  const missed = recipe("Fried rice");
  const pool = [recipe("Dal"), recipe("Kofta")];
  expect(fillNights(4, [missed], [pool[0]!, missed, pool[1]!])).toEqual([missed.id, pool[0]!.id, pool[1]!.id, null]);
});

test("a swap takes the next recipe no other night holds, wrapping round, and stays put when there is none", () => {
  const pool = ["A", "B", "C", "D"].map((name) => recipe(name));
  const ids = pool.map((r) => r.id);
  expect(swapNight([ids[0]!, ids[1]!], 0, pool)).toEqual([ids[2], ids[1]]);
  expect(swapNight([ids[3]!, ids[0]!], 0, pool)).toEqual([ids[1], ids[0]]);
  expect(swapNight([ids[0]!, ids[1]!, ids[2]!, ids[3]!], 1, pool)).toEqual(ids);
  // A carried recipe is not in the pool: the swap starts from the top.
  expect(swapNight([recipe("Carried").id], 0, pool)).toEqual([ids[0]]);
});

test("the weekend shelf is the weekend recipes, longest since made first, then the never-made ones outside the rotation", () => {
  const lamb = recipe("Lamb", { kind: "weekend", lastMade: "2026-09-01T00:00:00.000Z" });
  const ragu = recipe("Ragù", { kind: "weekend", lastMade: "2026-05-01T00:00:00.000Z" });
  const eggplant = recipe("Eggplant");
  const dal = recipe("Dal", { kind: "rotation" });
  expect(weekendShelf([eggplant, lamb, dal, ragu]).map((r) => r.name)).toEqual(["Ragù", "Lamb", "Eggplant"]);
});

test("a night's reason reads as carried, never made, or whole weeks since", () => {
  const r = recipe("Dal", { lastMade: "2026-08-20T19:00:00.000Z" });
  expect(reasonLabel(nightReason(r, new Set([r.id]), "2026-09-14"))).toBe("Didn't happen last week");
  expect(reasonLabel(nightReason(recipe("New"), new Set(), "2026-09-14"))).toBe("Not made yet");
  expect(reasonLabel(nightReason(r, new Set(), "2026-09-14"))).toBe("Last made 3 weeks ago");
  expect(reasonLabel(nightReason(r, new Set(), "2026-08-29"))).toBe("Last made a week ago");
  expect(reasonLabel(nightReason(r, new Set(), "2026-08-22"))).toBe("Made this week");
});

test("a proposal sets the dinners, the other meals and the reasons; a weeknight it left empty or doubled is filled from the fallback", () => {
  const [a, b, c, d] = ["Dal", "Kofta", "Lamb", "Fallback"].map((name) => recipe(name));
  const open = { weeknights: ["2026-09-14", "2026-09-15", "2026-09-16"], weekend: ["2026-09-19"] };
  const week = {
    entries: [
      {
        date: "2026-09-14",
        meal: "dinner" as const,
        recipeId: a!.id,
        reason: "not made since June",
        recipe: { id: a!.id, slug: "dal", name: "Dal", image: null },
      },
      { date: "2026-09-15", meal: "dinner" as const, recipeId: a!.id, reason: "", recipe: { id: a!.id, slug: "dal", name: "Dal", image: null } },
      {
        date: "2026-09-19",
        meal: "dinner" as const,
        recipeId: c!.id,
        reason: "a weekend cook",
        recipe: { id: c!.id, slug: "lamb", name: "Lamb", image: null },
      },
      { date: "2026-09-14", meal: "lunch" as const, recipeId: b!.id, reason: "", recipe: { id: b!.id, slug: "kofta", name: "Kofta", image: null } },
    ],
    dropped: [],
    unfilled: [],
    taken: [],
  };
  const first = fromProposal(week, open, [a!, d!]);
  expect(first.nights).toEqual([a!.id, d!.id, null]);
  expect(first.weekend).toEqual([c!.id]);
  expect(first.others).toEqual([{ date: "2026-09-14", meal: "lunch", recipeId: b!.id, skip: false }]);
  expect(first.reasons).toEqual({ [reasonKey("2026-09-14", a!.id)]: "not made since June", [reasonKey("2026-09-19", c!.id)]: "a weekend cook" });
});

test("the session writes its dinners in day order, then the other meals not skipped", () => {
  const open = { weeknights: ["2026-09-14", "2026-09-15"], weekend: ["2026-09-19"] };
  const others = [
    { date: "2026-09-14", meal: "lunch" as const, recipeId: "l1", skip: false },
    { date: "2026-09-15", meal: "breakfast" as const, recipeId: "b1", skip: true },
  ];
  expect(sessionEntries(open, ["n1", null], ["w1"], others)).toEqual([
    { date: "2026-09-14", meal: "dinner", recipeId: "n1" },
    { date: "2026-09-19", meal: "dinner", recipeId: "w1" },
    { date: "2026-09-14", meal: "lunch", recipeId: "l1" },
  ]);
});
