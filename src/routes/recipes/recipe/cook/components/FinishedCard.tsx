import { Button } from "@sixthshift/design-system/button";
import { Card } from "@sixthshift/design-system/card";
import { Link } from "@tanstack/react-router";
import { AddToShoppingButton } from "../../../../../components/shopping/AddToShoppingButton";
import type { Recipe } from "../../../../../domain/recipe";
import { MadeThisButton } from "../../components/MadeThisButton";

/**
 * The deck's last "card": logged the cook is done, with a shortcut to log it
 * (the "Made this" sheet, reused as-is) and a way out. When this session was opened
 * from a sub-recipe link (`from`), and that parent still resolves
 * (`parentName`), a "Back to <parent>" button offers the way back into its
 * own cook mode. A stale `from` with no `parentName` shows nothing extra.
 */
export function FinishedCard({
  recipe,
  servings,
  from,
  parentName,
}: {
  recipe: Recipe;
  servings: number | undefined;
  from: string | undefined;
  parentName: string | null;
}) {
  return (
    <Card title={<span className="text-xl">Finished</span>} data-card="finished">
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <p className="text-2xl font-semibold text-fg-strong">Nice work, that's everything.</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <MadeThisButton recipe={recipe} />
          {/* The same button the recipe page carries, on the scaled
              document the deck was built from: what you just cooked is what
              you need to replace. */}
          <AddToShoppingButton recipe={recipe} />
          {from !== undefined && parentName !== null && (
            <Button asChild variant="outline" intent="neutral" size="sm">
              <Link to="/recipes/$slug/cook" params={{ slug: from }} data-testid="back-to-parent">
                Back to {parentName}
              </Link>
            </Button>
          )}
          <Button asChild variant="outline" intent="neutral" size="sm">
            <Link to="/recipes/$slug" params={{ slug: recipe.slug }} search={{ servings }}>
              Exit
            </Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}
