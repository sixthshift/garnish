import { Card } from "@sixthshift/design-system/card";
import type { CookCard } from "../../../../../domain/recipe";
import { StepCard } from "../../components/StepCard";
import { CookIngredientItem } from "./CookIngredientItem";

/** The foot of every card: a dimmed, tappable preview of the card that follows. */
function NextPreview({ preview, onNext }: { preview: string; onNext: () => void }) {
  return (
    <button type="button" data-testid="next-preview" onClick={onNext} className="mt-4 block text-left text-sm text-fg-subtle hover:text-fg-normal">
      Next: {preview}
    </button>
  );
}

/** One card in large type: the part's ingredient list, or a single step. */
export function CookCardView({
  card,
  recipeId,
  preview,
  onNext,
  cookFrom,
}: {
  card: CookCard;
  recipeId: string;
  /** The next card's preview line, or "Finished" past the last one (`nextPreview`). */
  preview: string;
  onNext: () => void;
  /** This recipe's slug, forwarded to a step card's linked rows for the sub-recipe cook link. */
  cookFrom: string;
}) {
  const heading = card.part === "" ? undefined : card.part;
  if (card.kind === "ingredients") {
    return (
      <Card title={heading && <span className="text-xl">{heading}</span>} data-card="ingredients">
        <p className="mb-3 text-sm font-medium uppercase tracking-wide text-fg-subtle">Ingredients</p>
        <ul className="flex flex-col gap-3 text-2xl leading-snug" aria-label="Ingredients">
          {card.ingredients.map((ingredient) => (
            <CookIngredientItem key={ingredient.id} recipeId={recipeId} ingredient={ingredient} />
          ))}
        </ul>
        <NextPreview preview={preview} onNext={onNext} />
      </Card>
    );
  }
  return (
    <Card title={heading && <span className="text-xl">{heading}</span>} data-card="step">
      <p className="mb-3 text-sm font-medium uppercase tracking-wide text-fg-subtle">
        Step {card.number} of {card.total}
      </p>
      {/* Same card the recipe page deals, in the cook deck's bigger type: its
          own linked ingredients and timers come with it. */}
      <ul>
        <StepCard recipeId={recipeId} step={card.step} position={card.number} ingredients={card.ingredients} size="cook" cookFrom={cookFrom} />
      </ul>
      <NextPreview preview={preview} onNext={onNext} />
    </Card>
  );
}
