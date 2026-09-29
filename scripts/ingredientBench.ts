// The ingredient benchmark as a scorecard: how many lines of each category the
// parser reads right. `bun run bench:ingredients`. The ratchet itself is
// test/domain/ingredient/benchmark.test.ts; this is the view of it.
import { STARTER_FOODS } from "../src/db/seed/foods";
import { DEFAULT_UNITS } from "../src/db/seed/units";
import { parseIngredient } from "../src/domain/ingredient";
import { BENCHMARK } from "../test/fixtures/ingredients/benchmark";

const units = DEFAULT_UNITS.map((unit) => ({ name: unit.name, pluralName: unit.pluralName ?? null, abbreviation: unit.abbreviation ?? "" }));
const foods = STARTER_FOODS.map((food) => ({ name: food.name, pluralName: food.plural ?? null, aliases: [...(food.aliases ?? [])] }));
const same = (a: number | null, b: number | null) => (a === null || b === null ? a === b : Math.abs(a - b) < 1e-3);

const rows = new Map<string, { right: number; total: number }>();
for (const entry of BENCHMARK) {
  const parsed = parseIngredient(entry.line, { units, foods });
  const right = same(parsed.quantity, entry.quantity) && (parsed.unit?.name ?? null) === entry.unit && (parsed.food?.name ?? null) === entry.food;
  const row = rows.get(entry.category) ?? { right: 0, total: 0 };
  row.total += 1;
  if (right) row.right += 1;
  rows.set(entry.category, row);
}
let right = 0;
for (const [category, row] of rows) {
  right += row.right;
  console.log(
    `${category.padEnd(8)} ${String(row.right).padStart(3)} / ${String(row.total).padEnd(3)} ${"█".repeat(row.right)}${"·".repeat(row.total - row.right)}`
  );
}
console.log(`${"all".padEnd(8)} ${String(right).padStart(3)} / ${BENCHMARK.length}  (${Math.round((100 * right) / BENCHMARK.length)}%)`);
