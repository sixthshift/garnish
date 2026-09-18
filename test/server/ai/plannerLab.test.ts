// The planner lab's pure half: flags, the week they resolve to, and the report. The CLI itself is one wiring block and is not run here.
import { describe, expect, test } from "vitest";
import type { LibraryRecipe, ProposalCheck, ProposalInput } from "../../../src/domain/planner";
import { AiError, type AiRunner } from "../../../src/server/ai/client";
import {
  DAY_TOKENS,
  daysFlag,
  failureLine,
  LAB_USAGE,
  parseLabFlags,
  proposalRows,
  proposalTable,
  reportLines,
  rulesFromText,
  runLab,
  weekMondayFlag,
} from "../../../src/server/ai/plannerLab";

const MONDAY = "2026-09-21"; // a real Monday
const TUESDAY = "2026-09-22";

describe("parseLabFlags", () => {
  test("no flags runs the default model over the coming week, all seven days", () => {
    expect(parseLabFlags([], "lite")).toEqual({ week: null, days: null, models: ["lite"], rulesFile: null, showPrompt: false });
  });

  test("reads every flag, and splits the model and day lists", () => {
    expect(parseLabFlags(["--week", MONDAY, "--days", "Mon, tue,", "--model", "a, b,", "--rules", "r.txt", "--prompt"], "lite")).toEqual({
      week: MONDAY,
      days: ["mon", "tue"],
      models: ["a", "b"],
      rulesFile: "r.txt",
      showPrompt: true,
    });
  });

  test("refuses an unknown flag, a flag without a value, an unknown day, and an empty list", () => {
    expect(() => parseLabFlags(["--loud"], "lite")).toThrow(/Unknown argument --loud/);
    expect(() => parseLabFlags(["--week"], "lite")).toThrow(/--week needs a value/);
    expect(() => parseLabFlags(["--days", "mon,funday"], "lite")).toThrow(/Unknown day "funday"/);
    expect(() => parseLabFlags(["--model", " , "], "lite")).toThrow(/--model needs at least one model/);
  });

  test("DAY_TOKENS is Monday first, the order weekDates gives a week's dates", () => {
    expect(DAY_TOKENS).toEqual(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
  });

  test("LAB_USAGE names every flag", () => {
    expect(LAB_USAGE).toContain("--week");
    expect(LAB_USAGE).toContain("--days");
    expect(LAB_USAGE).toContain("--model");
    expect(LAB_USAGE).toContain("--rules");
    expect(LAB_USAGE).toContain("--prompt");
  });
});

describe("weekMondayFlag", () => {
  test("unset is the coming week: one week past the week today sits in", () => {
    expect(weekMondayFlag(null, "2026-09-16")).toBe("2026-09-21"); // today is a Wednesday; the coming Monday's week is the one after this one
  });

  test("a date is normalised to its own week's Monday, as ?week= is", () => {
    expect(weekMondayFlag("2026-09-23", "2026-09-16")).toBe(MONDAY); // a Wednesday lands on its Monday
    expect(weekMondayFlag(MONDAY, "2026-09-16")).toBe(MONDAY);
  });
});

describe("daysFlag", () => {
  test("unset is every day of the week, Monday first", () => {
    expect(daysFlag(null, MONDAY)).toEqual(["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27"]);
  });

  test("a subset comes back in week order regardless of the order given", () => {
    expect(daysFlag(["sat", "mon"], MONDAY)).toEqual([MONDAY, "2026-09-26"]);
  });
});

test("rulesFromText is one statement per line, blanks dropped", () => {
  expect(rulesFromText("One recipe a night.\n\n  Favour what is in season.  \n")).toEqual(["One recipe a night.", "Favour what is in season."]);
});

const library: LibraryRecipe[] = [
  { id: "r1", name: "Beef ragu", tags: [], totalMinutes: 60, rating: 4, favourite: true, lastMade: null },
  { id: "r2", name: "Laksa", tags: [], totalMinutes: 30, rating: null, favourite: false, lastMade: "2026-09-01" },
];

describe("proposalRows and proposalTable", () => {
  const check: ProposalCheck = {
    entries: [
      { date: MONDAY, meal: "dinner", recipeId: "r1", reason: "Quick (1)." },
      { date: TUESDAY, meal: "dinner", recipeId: "r2", reason: "Not had it in a while." },
    ],
    dropped: [],
    unfilled: [],
  };

  test("one row per slot, named from the library", () => {
    expect(proposalRows(check, library)).toEqual([
      { date: MONDAY, meal: "dinner", recipe: "Beef ragu", reason: "Quick (1)." },
      { date: TUESDAY, meal: "dinner", recipe: "Laksa", reason: "Not had it in a while." },
    ]);
  });

  test("an id the library no longer names falls back to the id itself rather than nothing", () => {
    const gone: ProposalCheck = { ...check, entries: [{ date: MONDAY, meal: "dinner", recipeId: "gone", reason: "" }] };
    expect(proposalRows(gone, library)[0]!.recipe).toBe("gone");
  });

  test("the table is headed and each slot names one row", () => {
    const table = proposalTable(proposalRows(check, library));
    expect(table).toHaveLength(3); // heading + two slots, each named once
    expect(table[0]!.split(/\s{2,}/)).toEqual(["Day", "Meal", "Recipe", "Reason"]);
    expect(table[1]!.split(/\s{2,}/)).toEqual(["Mon 21 Sep", "dinner", "Beef ragu", "Quick (1)."]);
    expect(table[2]!.split(/\s{2,}/)).toEqual(["Tue 22 Sep", "dinner", "Laksa", "Not had it in a while."]);
  });

  test("nothing proposed says so rather than printing an empty table", () => {
    expect(proposalTable([])).toEqual(["(nothing proposed)"]);
  });
});

describe("reportLines", () => {
  test("heads with the model, the table, then one line with the dropped and unfilled counts and the time", () => {
    const check: ProposalCheck = {
      entries: [{ date: MONDAY, meal: "dinner", recipeId: "r1", reason: "Quick." }],
      dropped: [{ entry: { date: TUESDAY, meal: "dinner", recipeId: "r2", reason: "" }, kind: "not-open", reason: "Tuesday dinner is already taken." }],
      unfilled: [{ date: TUESDAY, meal: "lunch" }],
    };
    const lines = reportLines("lite", 2.345, check, library);
    expect(lines[0]).toBe("## lite");
    expect(lines[1]!.split(/\s{2,}/)).toEqual(["Day", "Meal", "Recipe", "Reason"]);
    expect(lines[2]!.split(/\s{2,}/)).toEqual(["Mon 21 Sep", "dinner", "Beef ragu", "Quick."]);
    expect(lines[3]).toBe("dropped 1, unfilled 1, 2.3s");
    expect(lines).toHaveLength(4);
  });
});

test("failureLine is one line with the model, the time and the message", () => {
  expect(failureLine("lite", 60, new Error("The model took too long to answer."))).toBe("## lite  60.0s  FAILED: The model took too long to answer.");
  expect(failureLine("lite", 0.5, "boom")).toBe("## lite  0.5s  FAILED: boom");
});

const input: ProposalInput = {
  today: "2026-09-18",
  week: { monday: MONDAY, dates: [MONDAY, TUESDAY] },
  meals: ["dinner"],
  slots: [
    { date: MONDAY, meal: "dinner", taken: null },
    { date: TUESDAY, meal: "dinner", taken: null },
  ],
  rules: [],
  library,
  recent: [],
};

/** A runner that answers with `content` regardless of the prompt. */
function fakeRunner(content: string): AiRunner {
  return async () => content;
}

describe("runLab", () => {
  test("the table names each slot once, even when the model answers a slot twice", async () => {
    const run = fakeRunner(
      JSON.stringify({
        entries: [
          { date: MONDAY, meal: "dinner", recipeId: "r1", reason: "First." },
          { date: MONDAY, meal: "dinner", recipeId: "r2", reason: "Second, dropped." },
          { date: TUESDAY, meal: "dinner", recipeId: "r2", reason: "Third." },
        ],
      })
    );

    const lines = await runLab(input, ["lite"], () => run);

    expect(lines[0]).toBe("");
    expect(lines[1]).toBe("## lite");
    expect(lines[2]!.split(/\s{2,}/)).toEqual(["Day", "Meal", "Recipe", "Reason"]);
    expect(lines.filter((line) => line.includes("Beef ragu") || line.includes("Laksa"))).toHaveLength(2); // one row per slot, not three
    expect(lines[5]).toBe("dropped 1, unfilled 0, 0.0s");
  });

  test("a model that fails is reported and does not stop the ones after it", async () => {
    const boom: AiRunner = async () => {
      throw new AiError("timeout", "The model took too long to answer.");
    };
    const ok = fakeRunner(JSON.stringify({ entries: [] }));

    const lines = await runLab(input, ["slow", "lite"], (model) => (model === "slow" ? boom : ok));

    expect(lines[1]).toBe("## slow  0.0s  FAILED: The model took too long to answer.");
    expect(lines.some((line) => line === "## lite")).toBe(true);
  });
});
