import { Checkbox } from "@sixthshift/design-system/checkbox";
import { Muted } from "@sixthshift/design-system/muted";
import { cn } from "@sixthshift/design-system/utils";
import { formatIngredient } from "../../../../../domain/ingredient";
import type { Ingredient } from "../../../../../domain/recipe";
import { useIngredientTick } from "../../../../../lib/useTicks";

/** One ingredient card row: ticks off for this session, shared with the recipe view page (src/lib/ticks.ts). */
export function CookIngredientItem({ recipeId, ingredient }: { recipeId: string; ingredient: Ingredient }) {
  const [done, toggle] = useIngredientTick(recipeId, ingredient.id);
  return (
    <li
      className="flex flex-wrap items-baseline gap-x-3"
      data-testid="cook-ingredient"
      data-ticked={done ? "true" : undefined}
      data-fixed={ingredient.fixed ? "true" : undefined}
    >
      <Checkbox checked={done} onCheckedChange={toggle} className="mt-1.5 self-start" aria-label={`Tick off ${formatIngredient(ingredient) || "ingredient"}`} />
      <button type="button" onClick={toggle} className={cn("flex flex-1 flex-wrap items-baseline gap-x-3 text-left", done && "text-fg-subtle")}>
        <span className={cn(done && "line-through")}>{formatIngredient(ingredient)}</span>
      </button>
      {ingredient.fixed && (
        <Muted as="span" className="text-sm" title="Fixed amount, does not scale with servings">
          fixed
        </Muted>
      )}
    </li>
  );
}
