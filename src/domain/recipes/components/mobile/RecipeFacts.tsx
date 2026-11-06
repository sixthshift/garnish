import type { Recipe } from "../../recipe";
import { timeStats } from "../recipe/timeStats";

/**
 * A phone's facts about a recipe as one strip of equal cells (decisions.md row
 * 208): prep, cook and total, those it has, and how many times it has been
 * made. The rating sits under it, where a press can change it.
 */
export function RecipeFacts({ recipe, madeCount }: { recipe: Pick<Recipe, "prepTime" | "performTime">; madeCount: number }) {
  const cells = [
    ...timeStats(recipe).map((stat) => ({ key: stat.key, value: stat.value, label: stat.label })),
    madeCount > 0 ? { key: "made", value: `${madeCount}×`, label: "Made" } : { key: "made", value: "–", label: "Never made" },
  ];
  return (
    <dl
      className="grid gap-1.5 rounded-xl border border-border-subtle bg-bg-normal px-1.5 py-2.5 text-center"
      style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }}
      data-testid="recipe-facts"
    >
      {cells.map((cell) => (
        // The value first and large, its name small under it; a <dl> reads the name first.
        <div key={cell.key} className="flex flex-col-reverse" data-stat={cell.key}>
          <dt className="text-xs text-fg-subtle">{cell.label}</dt>
          <dd className="font-semibold text-fg-strong tabular-nums">{cell.value}</dd>
        </div>
      ))}
    </dl>
  );
}
