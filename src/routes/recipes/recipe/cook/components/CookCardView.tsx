import { Card } from "@sixthshift/design-system/card";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import type { CookCard } from "../../../../../domain/recipe";
import { StepCard } from "../../components/StepCard";
import { CookIngredientItem } from "./CookIngredientItem";

/** Under every card: a dimmed, tappable preview of the card that follows. */
function NextPreview({ preview, onNext }: { preview: string; onNext: () => void }) {
  return (
    <button
      type="button"
      data-testid="next-preview"
      onClick={onNext}
      className="block min-h-12 w-full py-2 text-left text-base text-fg-subtle hover:text-fg-normal lg:text-lg"
    >
      Next: {preview}
    </button>
  );
}

/**
 * One card in large type: the part's ingredient list, or a single step. The
 * card is the screen's one surface (design-language rule 1): the part's name
 * is the header's current tab, and the count is the footer's, so neither is
 * repeated on it. `partName` is set only where there is no tab bar to name it.
 */
export function CookCardView({
  card,
  recipeId,
  preview,
  onNext,
  cookFrom,
  partName,
}: {
  card: CookCard;
  recipeId: string;
  /** The next card's preview line, or "Finished" past the last one (`nextPreview`). */
  preview: string;
  onNext: () => void;
  /** This recipe's slug, forwarded to a step card's linked rows for the sub-recipe cook link. */
  cookFrom: string;
  /** The part's name, shown above the card when no tab bar carries it. */
  partName?: string;
}) {
  const heading = partName !== undefined && partName !== "" && (
    <SectionTitle as="h2" data-part-name>
      {partName}
    </SectionTitle>
  );
  if (card.kind === "ingredients") {
    return (
      <div className="flex flex-col gap-2" data-card="ingredients">
        {heading}
        <Card>
          <SectionTitle as="h3" className="mb-1">
            Ingredients
          </SectionTitle>
          <ul className="flex flex-col text-2xl leading-snug lg:text-3xl" aria-label="Ingredients">
            {card.ingredients.map((ingredient) => (
              <CookIngredientItem key={ingredient.id} recipeId={recipeId} ingredient={ingredient} />
            ))}
          </ul>
        </Card>
        <NextPreview preview={preview} onNext={onNext} />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2" data-card="step">
      {heading}
      {/* Same card the recipe page deals, in the cook deck's bigger type: its
          own linked ingredients and timers come with it. */}
      <ul>
        <StepCard recipeId={recipeId} step={card.step} position={card.number} ingredients={card.ingredients} size="cook" cookFrom={cookFrom} />
      </ul>
      <NextPreview preview={preview} onNext={onNext} />
    </div>
  );
}
