// The proposal read (M39.4): the gathering, the pass and the two server
// functions over it. No provider is ever called — a test that spends a request
// is not a test — so the pass runs against an injected runner and the HTTP
// path against a fake `fetch`.

import { afterEach, describe, expect, test } from "vitest";
import type { RecipeInput } from "../../../src/domain/recipe";
import { AiError, type AiRunner } from "../../../src/server/ai/client";
import {
  createPlannerRunner,
  libraryRecipe,
  mergeRecent,
  plannerSettings,
  proposalInput,
  proposeWeek,
  resolveProposal,
  runProposal,
  weekSlots,
} from "../../../src/server/ai/planner";
import { addPlanEntry, listPlanWeek } from "../../../src/server/fns/plan";
import { applyPlanProposal, plannerAvailable, proposePlanWeek, setPlannerMeals } from "../../../src/server/fns/planner";
import { createRecipe, deleteRecipe } from "../../../src/server/fns/recipes";
import { createTimelineEvent } from "../../../src/server/fns/timeline";
import { callServerFn, useTempDataDir } from "../../helpers/server";

useTempDataDir();

const MONDAY = "2026-09-21";
const TUESDAY = "2026-09-22";
const WEDNESDAY = "2026-09-23";

afterEach(() => {
  delete process.env.AI_PLANNER_MODEL;
  delete process.env.AI_MODEL;
  delete process.env.AI_API_KEY;
  delete process.env.AI_BASE_URL;
});

const newRecipe = (name: string) => callServerFn(createRecipe, { name, parts: [{ name: "", ingredients: [], steps: [] }] } as RecipeInput);

/** A runner that answers with `content` and records what it was asked. */
function fakeRunner(content: string): AiRunner & { calls: { prompt: string; timeoutMs: number }[] } {
  const calls: { prompt: string; timeoutMs: number }[] = [];
  const run = (async (prompt, timeoutMs) => {
    calls.push({ prompt, timeoutMs });
    return content;
  }) as AiRunner & { calls: typeof calls };
  run.calls = calls;
  return run;
}

/** A chat completion envelope carrying `content`. */
const completion = (content: string) => ({ choices: [{ message: { content } }] });

function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetcher = async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  };
  return Object.assign(fetcher, { calls });
}

/** A week with one open dinner and one taken, over a library of two. */
function fixture(ids: { open: string; taken: string }) {
  return {
    today: "2026-09-20",
    week: { monday: MONDAY, dates: [MONDAY, TUESDAY] },
    meals: ["dinner" as const],
    slots: [
      { date: MONDAY, meal: "dinner" as const, taken: null },
      { date: TUESDAY, meal: "dinner" as const, taken: "Lemon tart" },
    ],
    rules: ["Weeknights are quick."],
    library: [
      libraryRecipe({
        id: ids.open,
        slug: "beef-ragu",
        name: "Beef ragu",
        image: null,
        rating: 4,
        prepTime: 10,
        performTime: 50,
        totalTime: 60,
        lastMade: "2026-08-30T00:00:00.000Z",
        favourite: true,
        tags: [{ id: "t", name: "Pasta", slug: "pasta" }],
        ingredientPreview: [],
      }),
      libraryRecipe({
        id: ids.taken,
        slug: "lemon-tart",
        name: "Lemon tart",
        image: null,
        rating: null,
        prepTime: null,
        performTime: null,
        totalTime: null,
        lastMade: null,
        favourite: false,
        tags: [],
        ingredientPreview: [],
      }),
    ],
    recent: [{ date: "2026-09-14", name: "Beef ragu" }],
  };
}

const IDS = { open: "11111111-1111-4111-8111-111111111111", taken: "22222222-2222-4222-8222-222222222222" };

describe("the model", () => {
  test("AI_PLANNER_MODEL overrides the model for this pass and defaults to AI_MODEL", () => {
    process.env.AI_MODEL = "import-model";
    expect(plannerSettings().model).toBe("import-model");
    process.env.AI_PLANNER_MODEL = "big-model";
    expect(plannerSettings().model).toBe("big-model");
  });

  test("the request asks for the proposal schema and the planner model", async () => {
    process.env.AI_API_KEY = "secret";
    process.env.AI_BASE_URL = "https://provider.test/v1";
    process.env.AI_MODEL = "import-model";
    process.env.AI_PLANNER_MODEL = "big-model";
    const fetcher = fakeFetch(200, completion(JSON.stringify({ entries: [] })));
    await createPlannerRunner(fetcher)("PROMPT", 1000);
    const body = JSON.parse(String(fetcher.calls[0]!.init?.body)) as Record<string, unknown>;
    expect(fetcher.calls[0]!.url).toBe("https://provider.test/v1/chat/completions");
    expect(body.model).toBe("big-model");
    expect((body.response_format as { json_schema: { name: string } }).json_schema.name).toBe("proposal");
  });

  test("a fetch that times out is an AiError of kind timeout", async () => {
    process.env.AI_API_KEY = "secret";
    const slow = async () => {
      const error = new Error("The operation timed out.");
      error.name = "TimeoutError";
      throw error;
    };
    const caught = await createPlannerRunner(slow)("PROMPT", 1).catch((cause: unknown) => cause);
    expect(caught).toBeInstanceOf(AiError);
    expect((caught as AiError).kind).toBe("timeout");
  });
});

describe("runProposal", () => {
  test("a clean answer comes back as the week, with the prompt carrying the slots and the statements", async () => {
    const run = fakeRunner(JSON.stringify({ entries: [{ date: MONDAY, meal: "dinner", recipeId: IDS.open, reason: "Quick (1)." }] }));
    const result = await runProposal(fixture(IDS), { run });

    expect(result.entries).toEqual([{ date: MONDAY, meal: "dinner", recipeId: IDS.open, reason: "Quick (1)." }]);
    expect(result.dropped).toEqual([]);
    expect(result.unfilled).toEqual([]);
    expect(run.calls[0]!.timeoutMs).toBe(60_000);
    expect(run.calls[0]!.prompt).toContain(`${MONDAY} dinner — OPEN`);
    expect(run.calls[0]!.prompt).toContain(`${TUESDAY} dinner — TAKEN: Lemon tart`);
    expect(run.calls[0]!.prompt).toContain("1. Weeknights are quick.");
  });

  test("a foreign id and a taken slot are dropped, and the open slot is reported unfilled", async () => {
    const run = fakeRunner(
      JSON.stringify({
        entries: [
          { date: MONDAY, meal: "dinner", recipeId: "00000000-0000-4000-8000-000000000000", reason: "Made it up." },
          { date: TUESDAY, meal: "dinner", recipeId: IDS.open, reason: "Already taken." },
        ],
      })
    );
    const result = await runProposal(fixture(IDS), { run });

    expect(result.entries).toEqual([]);
    expect(result.dropped.map((line) => line.kind)).toEqual(["unknown-recipe", "not-open"]);
    expect(result.dropped[1]!.reason).toContain("already taken by Lemon tart");
    expect(result.unfilled).toEqual([{ date: MONDAY, meal: "dinner" }]);
  });

  test("an answer that is not a week at all is malformed, as the client's other failures are", async () => {
    const caught = await runProposal(fixture(IDS), { run: fakeRunner("Sorry, I cannot plan a week.") }).catch((cause: unknown) => cause);
    expect(caught).toBeInstanceOf(AiError);
    expect((caught as AiError).kind).toBe("malformed");
  });

  test("the runner's own failures come through untouched, and a week with nothing open never calls it", async () => {
    const boom: AiRunner = async () => {
      throw new AiError("unavailable", "No model is configured here.");
    };
    const caught = await runProposal(fixture(IDS), { run: boom }).catch((cause: unknown) => cause);
    expect((caught as AiError).kind).toBe("unavailable");

    const full = { ...fixture(IDS), slots: [{ date: MONDAY, meal: "dinner" as const, taken: "Lemon tart" }] };
    expect(await runProposal(full, { run: boom })).toEqual({ entries: [], dropped: [], unfilled: [] });
  });
});

describe("weekSlots and mergeRecent", () => {
  test("a day with no entries is open for every meal asked for", () => {
    const days = [{ date: MONDAY, entries: [] }];
    expect(weekSlots(days, [MONDAY], ["lunch", "dinner"])).toEqual([
      { date: MONDAY, meal: "lunch", taken: null },
      { date: MONDAY, meal: "dinner", taken: null },
    ]);
  });

  test("the two lists merge newest first, and the same meal on the same day is one line", () => {
    expect(
      mergeRecent(
        [
          { date: "2026-09-01", name: "Beef ragu" },
          { date: "2026-09-05", name: "Lemon tart" },
        ],
        [{ date: "2026-09-01", name: "Beef ragu" }]
      )
    ).toEqual([
      { date: "2026-09-05", name: "Lemon tart" },
      { date: "2026-09-01", name: "Beef ragu" },
    ]);
  });
});

describe("proposalInput", () => {
  test("a typed dinner closes its slot, an untyped entry does not, and the library and recent come through", async () => {
    await callServerFn(setPlannerMeals, { meals: [{ meal: "dinner", enabled: true }] });
    const ragu = await newRecipe("Beef ragu");
    const tart = await newRecipe("Lemon tart");
    await callServerFn(addPlanEntry, { date: MONDAY, recipeId: tart.id, text: tart.name, meal: "dinner" });
    await callServerFn(addPlanEntry, { date: TUESDAY, recipeId: ragu.id, text: ragu.name });
    // Four weeks back: a planned week and a logged cook both count as recent.
    await callServerFn(addPlanEntry, { date: "2026-09-14", recipeId: ragu.id, text: ragu.name, meal: "dinner" });
    await callServerFn(createTimelineEvent, { recipeId: tart.id, event: { occurredOn: "2026-09-08", message: "" } });

    const input = proposalInput({ monday: MONDAY, dates: [MONDAY, TUESDAY, WEDNESDAY] });

    expect(input.meals).toEqual(["dinner"]);
    expect(input.week).toEqual({ monday: MONDAY, dates: [MONDAY, TUESDAY, WEDNESDAY] });
    expect(input.slots).toEqual([
      { date: MONDAY, meal: "dinner", taken: "Lemon tart" },
      { date: TUESDAY, meal: "dinner", taken: null },
      { date: WEDNESDAY, meal: "dinner", taken: null },
    ]);
    expect(input.rules.length).toBeGreaterThan(0);
    expect(input.library.map((recipe) => recipe.name)).toContain("Beef ragu");
    expect(input.recent).toEqual([
      { date: "2026-09-14", name: "Beef ragu" },
      { date: "2026-09-08", name: "Lemon tart" },
    ]);
    expect(input.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("proposePlanWeek", () => {
  test("refuses no days and a day outside the week", async () => {
    await expect(callServerFn(proposePlanWeek, { monday: MONDAY, dates: [] })).rejects.toThrow();
    await expect(callServerFn(proposePlanWeek, { monday: MONDAY, dates: ["2026-09-30"] })).rejects.toThrow();
  });

  test("with no key configured the pass is unavailable rather than silently empty", async () => {
    delete process.env.AI_API_KEY;
    const caught = await callServerFn(proposePlanWeek, { monday: MONDAY, dates: [MONDAY] }).catch((cause: unknown) => cause);
    expect((caught as AiError).kind).toBe("unavailable");
  });
});

describe("applyPlanProposal", () => {
  test("writes each accepted entry with its meal and the recipe's name, and answers with the week", async () => {
    const ragu = await newRecipe("Beef ragu");
    const tart = await newRecipe("Lemon tart");

    const week = await callServerFn(applyPlanProposal, {
      entries: [
        { date: MONDAY, meal: "dinner", recipeId: ragu.id },
        { date: TUESDAY, meal: "lunch", recipeId: tart.id },
      ],
    });

    expect(week[0]!.entries).toMatchObject([{ date: MONDAY, meal: "dinner", text: "Beef ragu" }]);
    expect(week[0]!.entries[0]!.recipe).toMatchObject({ id: ragu.id, name: "Beef ragu" });
    expect(week[1]!.entries).toMatchObject([{ date: TUESDAY, meal: "lunch", text: "Lemon tart" }]);
  });

  test("a recipe that has since been deleted fails the whole write: no half week", async () => {
    const ragu = await newRecipe("Beef ragu");
    const gone = await newRecipe("Gone");
    await callServerFn(deleteRecipe, { id: gone.id });

    await expect(
      callServerFn(applyPlanProposal, {
        entries: [
          { date: MONDAY, meal: "dinner", recipeId: ragu.id },
          { date: TUESDAY, meal: "dinner", recipeId: gone.id },
        ],
      })
    ).rejects.toBeDefined();

    const week = await callServerFn(listPlanWeek, { monday: MONDAY });
    expect(week.every((day) => day.entries.length === 0)).toBe(true);
  });
});

describe("plannerAvailable", () => {
  test("is the same gate the import reads: a key and nothing else", async () => {
    delete process.env.AI_API_KEY;
    expect(await callServerFn(plannerAvailable)).toEqual({ available: false });
    process.env.AI_API_KEY = "secret";
    expect(await callServerFn(plannerAvailable)).toEqual({ available: true });
  });
});

// --- The answer the sheet reads (M39.5) ------------------------------------

const OCTOBER = "2026-10-05"; // a Monday, four weeks clear of the fixtures above
const OCTOBER_TUESDAY = "2026-10-06";

describe("resolveProposal", () => {
  const recipe = { id: IDS.open, slug: "beef-ragu", name: "Beef ragu", image: "ragu.jpg" };

  test("each kept entry carries its recipe, and the taken slots come through as their own list", () => {
    const week = resolveProposal(
      {
        entries: [{ date: MONDAY, meal: "dinner", recipeId: IDS.open, reason: "Quick." }],
        dropped: [{ entry: { date: MONDAY, meal: "lunch", recipeId: "nope", reason: "" }, kind: "unknown-recipe", reason: "not in the library." }],
        unfilled: [{ date: TUESDAY, meal: "lunch" }],
      },
      [
        { date: MONDAY, meal: "dinner", taken: null },
        { date: TUESDAY, meal: "dinner", taken: "Lemon tart" },
      ],
      [recipe]
    );

    expect(week.entries).toEqual([{ date: MONDAY, meal: "dinner", recipeId: IDS.open, reason: "Quick.", recipe }]);
    expect(week.taken).toEqual([{ date: TUESDAY, meal: "dinner", name: "Lemon tart" }]);
    expect(week.unfilled).toEqual([{ date: TUESDAY, meal: "lunch" }]);
    expect(week.dropped).toHaveLength(1);
  });

  test("an entry whose recipe went away between the two reads is left out rather than drawn without a name", () => {
    const week = resolveProposal({ entries: [{ date: MONDAY, meal: "dinner", recipeId: IDS.taken, reason: "" }], dropped: [], unfilled: [] }, [], [recipe]);
    expect(week.entries).toEqual([]);
  });
});

describe("proposeWeek", () => {
  test("answers with the recipe to draw and the week's taken slots", async () => {
    await callServerFn(setPlannerMeals, { meals: [{ meal: "dinner", enabled: true }] });
    const laksa = await newRecipe("Laksa");
    const congee = await newRecipe("Congee");
    await callServerFn(addPlanEntry, { date: OCTOBER, recipeId: congee.id, text: congee.name, meal: "dinner" });

    const run = fakeRunner(JSON.stringify({ entries: [{ date: OCTOBER_TUESDAY, meal: "dinner", recipeId: laksa.id, reason: "Nothing like it lately." }] }));
    const week = await proposeWeek({ monday: OCTOBER, dates: [OCTOBER, OCTOBER_TUESDAY] }, { run });

    expect(week.entries).toEqual([
      {
        date: OCTOBER_TUESDAY,
        meal: "dinner",
        recipeId: laksa.id,
        reason: "Nothing like it lately.",
        recipe: { id: laksa.id, slug: laksa.slug, name: "Laksa", image: null },
      },
    ]);
    expect(week.taken).toEqual([{ date: OCTOBER, meal: "dinner", name: "Congee" }]);
    expect(week.unfilled).toEqual([]);
  });
});
