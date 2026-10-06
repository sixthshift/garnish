// The parser against real recipe lines (test/fixtures/ingredients/benchmark.ts),
// read with the vocabulary a new database starts with. A ratchet: a line
// labelled right must stay right, and a line marked `known` must stay wrong
// until the fix that mends it takes the mark off, so every change to the
// parser shows in this file as lines moving from one side to the other.
import { describe, expect, test } from "vitest";
import { correctedStarterFoods } from "../../../src/db/seed/foodPlurals";
import { DEFAULT_UNITS } from "../../../src/db/seed/units";
import { parseIngredient } from "../../../src/domain/ingredient";
import { BENCHMARK, type BenchmarkLine } from "../../fixtures/ingredients/benchmark";

const units = DEFAULT_UNITS.map((unit) => ({ name: unit.name, pluralName: unit.pluralName ?? null, abbreviation: unit.abbreviation ?? "" }));
const foods = correctedStarterFoods().map((food) => ({ name: food.name, pluralName: food.plural ?? null, aliases: [...(food.aliases ?? [])] }));

/** The three labelled slots as the parser reads them, in the fixture's terms. */
function read(entry: BenchmarkLine) {
  const parsed = parseIngredient(entry.line, { units, foods });
  const quantity = parsed.quantity === null ? null : Math.round(parsed.quantity * 1000) / 1000;
  return { quantity, unit: parsed.unit?.name ?? null, food: parsed.food?.name ?? null };
}

const want = (entry: BenchmarkLine) => ({
  quantity: entry.quantity === null ? null : Math.round(entry.quantity * 1000) / 1000,
  unit: entry.unit,
  food: entry.food,
});

describe("lines the parser reads right", () => {
  test.each(BENCHMARK.filter((entry) => entry.known === undefined).map((entry) => [entry.line, entry] as const))("%s", (_line, entry) => {
    expect(read(entry)).toEqual(want(entry));
  });
});

describe("lines it still reads wrong", () => {
  test.each(BENCHMARK.filter((entry) => entry.known !== undefined).map((entry) => [entry.line, entry] as const))("%s", (_line, entry) => {
    expect(read(entry), `now reads right: take the known mark off "${entry.line}"`).not.toEqual(want(entry));
  });
});
