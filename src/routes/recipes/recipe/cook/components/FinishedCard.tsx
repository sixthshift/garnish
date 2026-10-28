import { Button } from "@sixthshift/design-system/button";
import { Card } from "@sixthshift/design-system/card";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { AddToShoppingButton } from "../../../../../components/shopping/AddToShoppingButton";
import type { Recipe } from "../../../../../domain/recipe";
import { MadeThisButton } from "../../components/MadeThisButton";
import { ChangesReview } from "./ChangesReview";
import type { CookChange } from "./cookChanges";

/**
 * The deck's last "card": logged the cook is done, with a shortcut to log it
 * (the "Made this" sheet, reused as-is) and a way out. When this session was opened
 * from a sub-recipe link (`from`), and that parent still resolves
 * (`parentName`), a "Back to <parent>" button offers the way back into its
 * own cook mode. A stale `from` with no `parentName` shows nothing extra.
 *
 * When the cook changed amounts or steps on the way, the card asks about each
 * first (`ChangesReview`); what was just for this time becomes the Made this
 * comment's opening words.
 */
export function FinishedCard({
  recipe,
  stored,
  servings,
  from,
  parentName,
  changes = [],
  onChangesDone,
}: {
  recipe: Recipe;
  /** The recipe as stored, unscaled and unchanged: what kept changes are written into. */
  stored?: Recipe;
  servings: number | undefined;
  from: string | undefined;
  parentName: string | null;
  changes?: readonly CookChange[];
  onChangesDone?: () => void;
}) {
  const [note, setNote] = useState("");
  if (changes.length > 0 && stored !== undefined) {
    return (
      <Card title={<span className="text-xl">Finished</span>} data-card="finished">
        <div className="flex flex-col gap-4 py-4">
          <ChangesReview
            stored={stored}
            changes={changes}
            onSaved={(once) => {
              setNote(once);
              onChangesDone?.();
            }}
          />
        </div>
      </Card>
    );
  }
  return (
    <Card title={<span className="text-xl">Finished</span>} data-card="finished">
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <p className="text-2xl font-semibold text-fg-strong">Nice work, that's everything.</p>
        {/* One column of full-width 48px buttons on a phone, a row from `sm`. */}
        <div className="flex w-full max-w-sm flex-col gap-3 sm:w-auto sm:max-w-none sm:flex-row sm:flex-wrap sm:justify-center">
          <MadeThisButton recipe={recipe} size="xl" defaultMessage={note} />
          {/* The same button the recipe page carries, on the scaled
              document the deck was built from: what you just cooked is what
              you need to replace. */}
          <AddToShoppingButton recipe={recipe} size="xl" />
          {from !== undefined && parentName !== null && (
            <Button asChild variant="outline" intent="neutral" size="xl">
              <Link to="/recipes/$slug/cook" params={{ slug: from }} data-testid="back-to-parent">
                Back to {parentName}
              </Link>
            </Button>
          )}
          <Button asChild variant="outline" intent="neutral" size="xl">
            <Link to="/recipes/$slug" params={{ slug: recipe.slug }} search={{ servings }}>
              Exit
            </Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}
