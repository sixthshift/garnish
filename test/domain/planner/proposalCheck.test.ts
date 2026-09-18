// The proposal's guard (M39.3): a bad line is dropped with a reason the sheet
// can print and the rest of the week survives, which is the difference from the
// import's check. An open slot nobody filled is reported rather than failed.
import { describe, expect, test } from "vitest";
import { checkProposal, type ProposalAnswerEntry, type ProposalSlot } from "../../../src/domain/planner";

const SLOTS: ProposalSlot[] = [
  { date: "2026-09-21", meal: "dinner", taken: null },
  { date: "2026-09-22", meal: "dinner", taken: null },
  { date: "2026-09-23", meal: "dinner", taken: "Roast chicken" },
];

const LIBRARY = ["r1", "r2"];

function entry(over: Partial<ProposalAnswerEntry>): ProposalAnswerEntry {
  return { date: "2026-09-21", meal: "dinner", recipeId: "r1", reason: "Because.", ...over };
}

function check(answer: ProposalAnswerEntry[]) {
  return checkProposal(answer, { slots: SLOTS, libraryIds: LIBRARY });
}

test("a clean answer is kept whole, with each entry's slot as the slot it was given", () => {
  const result = check([entry({}), entry({ date: "2026-09-22", recipeId: "r2", reason: "Variety." })]);
  expect(result.entries).toEqual([
    { date: "2026-09-21", meal: "dinner", recipeId: "r1", reason: "Because." },
    { date: "2026-09-22", meal: "dinner", recipeId: "r2", reason: "Variety." },
  ]);
  expect(result.dropped).toEqual([]);
  expect(result.unfilled).toEqual([]);
});

describe("a line the check refuses", () => {
  const cases: { name: string; answer: ProposalAnswerEntry[]; kind: string; reason: RegExp; kept: number; bad?: number }[] = [
    {
      name: "a recipe id the library does not have",
      answer: [entry({ recipeId: "nope" }), entry({ date: "2026-09-22", recipeId: "r2" })],
      kind: "unknown-recipe",
      reason: /not in the library/,
      kept: 1,
    },
    {
      name: "a slot the week has already taken",
      answer: [entry({ date: "2026-09-23" }), entry({ date: "2026-09-22", recipeId: "r2" })],
      kind: "not-open",
      reason: /already taken by Roast chicken/,
      kept: 1,
    },
    {
      name: "a day or a meal that was never a slot",
      answer: [entry({ date: "2026-09-29" }), entry({ meal: "supper" })],
      kind: "not-open",
      reason: /was not an open slot/,
      kept: 0,
    },
    {
      name: "a second answer for one slot, the first winning",
      answer: [entry({}), entry({ recipeId: "r2", reason: "Second thoughts." })],
      kind: "duplicate",
      reason: /proposed twice/,
      kept: 1,
      bad: 1,
    },
  ];

  for (const row of cases) {
    test(row.name, () => {
      const result = check(row.answer);
      expect(result.entries).toHaveLength(row.kept);
      expect(result.dropped[0]?.kind).toBe(row.kind);
      expect(result.dropped[0]?.reason).toMatch(row.reason);
      // Nothing is failed outright: a proposal with one bad line is still a proposal.
      expect(result.dropped[0]?.entry).toEqual(row.answer[row.bad ?? 0]);
    });
  }

  test("the first answer is the one kept when a slot is answered twice", () => {
    const result = check([entry({}), entry({ recipeId: "r2" })]);
    expect(result.entries[0]?.recipeId).toBe("r1");
  });
});

test("an open slot the model left empty is reported as unfilled, in the order the slots were given", () => {
  const result = check([entry({ date: "2026-09-22", recipeId: "r2" })]);
  expect(result.unfilled).toEqual([{ date: "2026-09-21", meal: "dinner" }]);
  expect(check([]).unfilled).toEqual([
    { date: "2026-09-21", meal: "dinner" },
    { date: "2026-09-22", meal: "dinner" },
  ]);
});

test("a taken slot is never unfilled: it is not open in the first place", () => {
  expect(check([]).unfilled.some((slot) => slot.date === "2026-09-23")).toBe(false);
});
