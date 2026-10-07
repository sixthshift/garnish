import type { BackupCounts } from "../../domain/backup";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** A backup's counts as one line for the CLIs: "12 recipes, 3 cooks, …". Pure. */
export function describeCounts(counts: BackupCounts): string {
  return [
    plural(counts.recipes, "recipe"),
    plural(counts.timeline, "cook"),
    plural(counts.plan, "plan entry", "plan entries"),
    plural(counts.shopping, "list line"),
    plural(counts.foods, "food"),
    plural(counts.units, "unit"),
    plural(counts.aisles, "aisle"),
    plural(counts.tags, "tag"),
    plural(counts.styleRules + counts.plannerRules, "guide statement"),
    plural(counts.images, "image"),
  ].join(", ");
}
