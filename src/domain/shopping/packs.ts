// What to take off the shelf for a line (decisions.md row 184): the line keeps
// the amount the recipes need, and this rounds it up to whole packs of the
// sizes its food is sold in, for the aisle view's "400 g butter → 2 × 250 g".

import { formatAmount } from "../ingredient";
import { convert, type Food, type FoodPack, type Unit } from "../reference";

/** One size a food is sold in, its unit resolved: `quantity` of `unit`, or of the food itself when `unit` is null. */
export interface PackSize {
  quantity: number;
  unit: Unit | null;
}

/** How many of one size to take. */
export interface PackCount extends PackSize {
  count: number;
}

/** The packs to take, largest size first, and how much they leave over, in the line's own unit. */
export interface PackPlan {
  packs: PackCount[];
  over: number;
}

/** What a line needs: its amount, in its unit, of its food. */
export type PackNeed = { quantity: number | null; unit: Unit | null; food: Food | null };

/** More packs than this of the smallest size and the search keeps to the sizes that need fewer. */
const MAX_COUNT = 60;

/** `size` in the need's unit: the same unit (or both "each") as it is, another through the food's conversions, else null. */
function inNeedUnit(size: PackSize, need: PackNeed, food: Food): number | null {
  if ((size.unit?.id ?? null) === (need.unit?.id ?? null)) return size.quantity;
  if (size.unit === null || need.unit === null) return null;
  return convert(size.quantity, size.unit, food, need.unit);
}

/**
 * The packs that cover what a line needs with the least left over, and among
 * those the fewest packs: 450 ml from 300 ml and 600 ml is one 600, 850 ml is
 * a 600 and a 300. A size the line's unit cannot reach (a 140 g tin against
 * "1 tbsp" with no conversion) is not offered, and with none left there is no
 * plan: null, as for a line with no food or no amount. Pure.
 */
export function packsFor(need: PackNeed, sizes: readonly PackSize[]): PackPlan | null {
  const food = need.food;
  const wanted = need.quantity;
  if (food === null || wanted === null || !(wanted > 0)) return null;

  let usable = sizes
    .map((size) => ({ size, amount: inNeedUnit(size, need, food) }))
    .filter((entry): entry is { size: PackSize; amount: number } => entry.amount !== null && entry.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  if (usable.length === 0) return null;
  // A size that would take scores of packs is kept only if nothing larger is on offer.
  const sensible = usable.filter((entry) => wanted / entry.amount <= MAX_COUNT);
  usable = sensible.length > 0 ? sensible : usable.slice(0, 1);

  const epsilon = wanted * 1e-9;
  let best: { counts: number[]; over: number; total: number } | null = null;
  const counts = usable.map(() => 0);

  const consider = (covered: number) => {
    const over = covered - wanted;
    const total = counts.reduce((sum, count) => sum + count, 0);
    if (best === null || over < best.over - epsilon || (Math.abs(over - best.over) <= epsilon && total < best.total)) {
      best = { counts: [...counts], over, total };
    }
  };

  // Every count of each size in turn, the last size topping up whatever is still short.
  const search = (index: number, covered: number) => {
    const { amount } = usable[index]!;
    const short = Math.max(0, wanted - covered);
    const most = Math.ceil(short / amount - 1e-9);
    if (index === usable.length - 1) {
      counts[index] = most;
      consider(covered + most * amount);
      counts[index] = 0;
      return;
    }
    for (let count = most; count >= 0; count -= 1) {
      counts[index] = count;
      search(index + 1, covered + count * amount);
    }
    counts[index] = 0;
  };
  search(0, 0);

  const chosen = best as { counts: number[]; over: number } | null;
  if (chosen === null) return null;
  const packs = usable.flatMap((entry, i) => (chosen.counts[i]! > 0 ? [{ ...entry.size, count: chosen.counts[i]! }] : []));
  return { packs, over: Math.max(0, chosen.over) };
}

/**
 * The packs as the row says them: "2 × 250 g", "1 × 600 ml + 1 × 300 ml". A
 * size of one unit is counted in that unit ("2 cans") and a size of one of
 * the food in plain numbers ("1"). Pure.
 */
export function packsLabel(plan: PackPlan): string {
  return plan.packs
    .map((pack) => {
      if (pack.quantity === 1) return pack.unit === null ? String(pack.count) : formatAmount(pack.count, pack.unit);
      return `${pack.count} × ${formatAmount(pack.quantity, pack.unit)}`;
    })
    .join(" + ");
}

/** What the packs leave over, in the line's own unit: "100 g over". Empty when they fit exactly. Pure. */
export function overLabel(plan: PackPlan, unit: Unit | null): string {
  const over = Math.round(plan.over * 100) / 100;
  return over > 0 ? `${formatAmount(over, unit)} over` : "";
}

/** Every food's sizes with their units resolved, by food id: what the list reads per line. A size in an unknown unit is dropped. Pure. */
export function sizesByFood(packs: readonly FoodPack[], units: readonly Unit[]): Map<string, PackSize[]> {
  const unitsById = new Map(units.map((u) => [u.id, u]));
  const byFood = new Map<string, PackSize[]>();
  for (const pack of packs) {
    const unit = pack.unitId === null ? null : (unitsById.get(pack.unitId) ?? undefined);
    if (unit === undefined) continue;
    byFood.set(pack.foodId, [...(byFood.get(pack.foodId) ?? []), { quantity: pack.quantity, unit }]);
  }
  return byFood;
}
