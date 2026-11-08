// What the planner asks the model and how it reads the answer (M39.3): the
// fixed lines, the week's slots, the statements, the library line and the cut
// notice, the JSON Schema held to its zod twin, and the parser. Pure; no model
// is ever called.
import { describe, expect, test } from "vitest";
import {
  type LibraryRecipe,
  MAX_LIBRARY_LINES,
  PROPOSAL_JSON_SCHEMA,
  ProposalError,
  type ProposalInput,
  parseProposalAnswer,
  proposalPrompt,
} from "../../../../src/domain/plan/planner";
import {
  FACET_LINE,
  facetsLine,
  libraryLine,
  ProposalAnswerEntrySchema,
  ProposalAnswerSchema,
  varietyLine,
} from "../../../../src/domain/plan/planner/proposal";
import { noFacets } from "../../../../src/domain/recipes/recipe";

function recipe(id: string, name: string, over: Partial<LibraryRecipe> = {}): LibraryRecipe {
  return { id, name, tags: [], totalMinutes: null, rating: null, favourite: false, facets: noFacets(), lastMade: null, ...over };
}

const INPUT: ProposalInput = {
  today: "2026-09-18",
  week: { monday: "2026-09-21", dates: ["2026-09-21", "2026-09-22"] },
  meals: ["dinner"],
  slots: [
    { date: "2026-09-21", meal: "dinner", taken: null },
    { date: "2026-09-22", meal: "dinner", taken: "Roast chicken" },
  ],
  rules: ["Nothing we ate in the last three weeks.", "Weeknights are quick."],
  library: [
    recipe("r1", "Lasagne", { tags: ["pasta", "beef"], totalMinutes: 90, rating: 4, favourite: true, lastMade: "2026-08-30" }),
    recipe("r2", "Omelette"),
  ],
  recent: [{ date: "2026-09-10", name: "Pad thai" }],
};

describe("the prompt", () => {
  test("leads with the facts of the run: today and the hemisphere", () => {
    const prompt = proposalPrompt(INPUT);
    expect(prompt).toContain("Today is 2026-09-18.");
    expect(prompt).toMatch(/Australia/);
    expect(prompt).toMatch(/southern hemisphere/);
    // The month is the model's to read; the prompt carries no table of seasons.
    expect(prompt).toMatch(/read the month/);
    expect(prompt).toContain("The week begins Monday 2026-09-21.");
    expect(prompt).toContain("The meals being planned are dinner.");
  });

  test("lists the open slots and names the taken ones so the week reads as a whole", () => {
    const prompt = proposalPrompt(INPUT);
    expect(prompt).toContain("2026-09-21 dinner — OPEN");
    expect(prompt).toContain("2026-09-22 dinner — TAKEN: Roast chicken");
  });

  test("says how the answer must be shaped: one per open slot, no slot twice, ids from the library, a reason", () => {
    const prompt = proposalPrompt(INPUT);
    expect(prompt).toMatch(/one recipe for every slot marked OPEN/);
    expect(prompt).toMatch(/never two for the same slot/);
    expect(prompt).toMatch(/may appear once in the week, unless a statement/);
    expect(prompt).toMatch(/must be an id from the LIBRARY/);
    expect(prompt).toMatch(/`reason` is one short sentence to the household, in plain words/);
    expect(prompt).toMatch(/Never refer to a statement by its position or number/);
    expect(prompt).toMatch(/never answer for one/);
  });

  test("lists the statements in the guide's order, unnumbered so the reason cannot cite a number", () => {
    const prompt = proposalPrompt(INPUT);
    const first = prompt.indexOf("- Nothing we ate in the last three weeks.");
    const second = prompt.indexOf("- Weeknights are quick.");
    expect(first).toBeGreaterThan(-1);
    expect(second).toBeGreaterThan(first);
    expect(prompt).not.toMatch(/^\d+\. /m);
  });

  test("carries the recent meals and the library, one compact line per recipe", () => {
    const prompt = proposalPrompt(INPUT);
    expect(prompt).toContain("2026-09-10  Pad thai");
    expect(prompt).toContain("r1 | Lasagne | pasta, beef | 90 min | ★4 | fav | last 2026-08-30");
    // What a recipe does not have is left out rather than sent as null, but
    // never having been made is itself a fact a statement weighs.
    expect(prompt).toContain("r2 | Omelette |  | never made");
    expect(prompt).not.toMatch(/the library was cut/i);
  });

  test("an empty week, guide, library and history all say so rather than leaving a blank", () => {
    const prompt = proposalPrompt({ ...INPUT, slots: [], rules: [], library: [], recent: [], meals: [] });
    expect(prompt).toContain("(no slots)");
    expect(prompt).toContain("(no statements are on");
    expect(prompt).toContain("(nothing recorded)");
    expect(prompt).toContain("(the library is empty)");
    expect(prompt).toContain("The meals being planned are none.");
  });

  test("a library past the cap sends the favourites and the highest rated, and says it was cut", () => {
    const many: LibraryRecipe[] = Array.from({ length: MAX_LIBRARY_LINES + 10 }, (_, index) => recipe(`r${index}`, `Recipe ${index}`, { rating: 1 }));
    many.push(recipe("fav", "Favourite", { favourite: true }), recipe("top", "Top rated", { rating: 5 }));
    const prompt = proposalPrompt({ ...INPUT, library: many });
    const lines = prompt.split("\n");
    const start = lines.findIndex((line) => line.startsWith("(the library holds"));
    expect(start).toBeGreaterThan(-1);
    expect(lines[start]).toContain(`was cut to ${MAX_LIBRARY_LINES}`);
    expect(lines[start + 1]).toContain("fav | Favourite");
    expect(lines[start + 2]).toContain("top | Top rated");
    expect(lines.filter((line) => /^r\d+ \|/.test(line) || /^(fav|top) \|/.test(line))).toHaveLength(MAX_LIBRARY_LINES);
  });

  test("the library line names the facts it has and only those", () => {
    expect(libraryLine(recipe("r3", "Toast", { totalMinutes: 5 }))).toBe("r3 | Toast |  | 5 min | never made");
    expect(libraryLine(recipe("r4", "Curry", { tags: ["thai"], rating: 3, lastMade: "2026-01-02" }))).toBe("r4 | Curry | thai | ★3 | last 2026-01-02");
    expect(libraryLine(recipe("r5", "Dal", { facets: { ...noFacets(), week: ["weeknight"] } }))).toBe("r5 | Dal |  | week: weeknight | never made");
    expect(libraryLine(recipe("r6", "Lamb", { facets: { ...noFacets(), week: ["weekend"] }, favourite: true }))).toBe(
      "r6 | Lamb |  | fav | week: weekend | never made"
    );
  });

  test("the library line carries the facets said, layer by layer, leaving the empty ones out", () => {
    const facets = { ...noFacets(), course: ["main" as const], cuisine: ["thai" as const, "vietnamese" as const], diet: ["vegetarian" as const] };
    expect(facetsLine(noFacets())).toBe("");
    expect(facetsLine({ ...noFacets(), mainIngredient: ["tofu"], season: ["winter"] })).toBe("main ingredient: tofu; season: winter");
    expect(libraryLine(recipe("r7", "Pad see ew", { facets: { ...facets, week: ["weeknight"] } }))).toBe(
      "r7 | Pad see ew |  | course: main; week: weeknight; cuisine: thai, vietnamese; diet: vegetarian | never made"
    );
    expect(libraryLine(recipe("r8", "Salsa verde", { facets: { ...noFacets(), course: ["sauce"] } }))).toBe("r8 | Salsa verde |  | course: sauce | never made");
  });

  test("the prompt says what the facets mean for a slot, beside the week", () => {
    const prompt = proposalPrompt(INPUT);
    expect(prompt).toContain(FACET_LINE);
    expect(FACET_LINE).toMatch(/main, soup or salad/);
    expect(FACET_LINE).toMatch(/never planned on its own/);
    expect(prompt).toContain("LIBRARY (id | name | tags | time | rating | fav | facets | last made):");
  });

  test("the JSON Schema names exactly the fields the zod schema does, and requires all of them", () => {
    const answerKeys = Object.keys(ProposalAnswerSchema.shape).sort();
    expect(Object.keys(PROPOSAL_JSON_SCHEMA.properties).sort()).toEqual(answerKeys);
    expect([...PROPOSAL_JSON_SCHEMA.required].sort()).toEqual(answerKeys);
    expect(PROPOSAL_JSON_SCHEMA.additionalProperties).toBe(false);

    const entryKeys = Object.keys(ProposalAnswerEntrySchema.shape).sort();
    const entry = PROPOSAL_JSON_SCHEMA.properties.entries.items;
    expect(Object.keys(entry.properties).sort()).toEqual(entryKeys);
    expect([...entry.required].sort()).toEqual(entryKeys);
    expect(entry.additionalProperties).toBe(false);
    expect([...entry.properties.meal.enum]).toEqual(["breakfast", "lunch", "dinner"]);
  });
});

describe("parseProposalAnswer", () => {
  const answer = JSON.stringify({
    entries: [{ date: "2026-09-21", meal: "dinner", recipeId: "r1", reason: "Statement 3: a quick weeknight." }],
  });

  test("reads the entries out of the message content", () => {
    expect(parseProposalAnswer(answer)).toEqual([{ date: "2026-09-21", meal: "dinner", recipeId: "r1", reason: "Statement 3: a quick weeknight." }]);
  });

  test("reads a fenced answer from a model that fences anyway", () => {
    expect(parseProposalAnswer(`\`\`\`json\n${answer}\n\`\`\``)[0]?.recipeId).toBe("r1");
  });

  test("fills what a line left out, and an unknown meal parses so the check can drop it", () => {
    expect(parseProposalAnswer(JSON.stringify({ entries: [{ recipeId: "r1", meal: "supper" }] }))).toEqual([
      { date: "", meal: "supper", recipeId: "r1", reason: "" },
    ]);
    expect(parseProposalAnswer(JSON.stringify({}))).toEqual([]);
  });

  test("garbage, prose and the wrong shape are all malformed", () => {
    for (const content of ["", "not json at all", "Sorry, I could not plan that week.", JSON.stringify({ entries: "dinner" }), JSON.stringify([])]) {
      const caught = (() => {
        try {
          parseProposalAnswer(content);
        } catch (cause) {
          return cause;
        }
      })();
      expect(caught, content).toBeInstanceOf(ProposalError);
      expect((caught as ProposalError).kind, content).toBe("malformed");
    }
  });
});

test("the prompt says what a recipe's week means (row 219), and the library header names the columns", () => {
  const prompt = proposalPrompt(INPUT);
  expect(prompt).toContain("A recipe whose week is weeknight fits a weeknight's time");
  expect(prompt).toContain("LIBRARY (id | name | tags | time | rating | fav | facets | last made):");
});

describe("a varied week (decisions.md row 212)", () => {
  test("the prompt always asks for no main ingredient two nights running and no cuisine more than twice", () => {
    const prompt = proposalPrompt(INPUT);
    expect(prompt).toContain(varietyLine(0));
    expect(prompt).toMatch(/never the same main ingredient on two nights in a row/);
    expect(prompt).toMatch(/no cuisine more than twice/);
    expect(prompt).not.toMatch(/vegetarian \(diet/);
  });

  test("the household's vegetarian nights are asked for by number, spread through the week", () => {
    expect(proposalPrompt({ ...INPUT, vegetarianNights: 2 })).toContain(
      "Make at least 2 dinners vegetarian (diet vegetarian or vegan), spread through the week"
    );
    expect(varietyLine(1)).toContain("Make at least one dinner vegetarian");
  });
});
