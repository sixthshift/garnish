import { Button } from "@sixthshift/design-system/button";
import { Card } from "@sixthshift/design-system/card";
import { Muted } from "@sixthshift/design-system/muted";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import { Textarea } from "@sixthshift/design-system/textarea";
import { useState } from "react";
import { formatIngredient } from "../../../../../domain/ingredient";
import type { CookCard, Ingredient, Step } from "../../../../../domain/recipe";
import { linkedIngredients, StepCard } from "../../components/StepCard";
import { AmountForm } from "./AmountForm";
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
 * "Change this step" under a step card: the step's words in a field, to say
 * how it was actually done. Saved as a change the finish card asks about
 * (decisions.md row 193); the card shows the new words at once.
 */
function StepChange({ step, changed, onSave }: { step: Step; changed: boolean; onSave: (text: string) => void }) {
  const [text, setText] = useState<string | null>(null);
  if (text === null) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="ghost" intent="neutral" size="xl" className="self-start" onClick={() => setText(step.text)}>
          Change this step
        </Button>
        {changed && <Muted as="span">Changed this time</Muted>}
      </div>
    );
  }
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (text.trim() !== "") onSave(text.trim());
        setText(null);
      }}
    >
      <label htmlFor={`change-${step.id}`} className="font-medium">
        How you did it
      </label>
      <Textarea id={`change-${step.id}`} value={text} onChange={(event) => setText(event.target.value)} rows={4} className="text-xl" />
      <Muted as="p">At the end you choose whether this goes into the recipe.</Muted>
      <div className="flex gap-3">
        <Button type="submit" variant="solid" intent="neutral" size="xl">
          Save
        </Button>
        <Button type="button" variant="ghost" intent="neutral" size="xl" onClick={() => setText(null)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/**
 * "Change an amount" under a step card whose ingredients ride on the step:
 * the step's rows that have an amount, each opening the same field the
 * ingredients card's pencil does.
 */
function StepAmounts({
  rows,
  changedIds,
  onChangeAmount,
}: {
  rows: readonly Ingredient[];
  changedIds?: ReadonlySet<string>;
  onChangeAmount: (ingredient: Ingredient, typed: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  if (rows.length === 0) return null;
  if (!open) {
    return (
      <Button type="button" variant="ghost" intent="neutral" size="xl" className="self-start" onClick={() => setOpen(true)}>
        Change an amount
      </Button>
    );
  }
  return (
    <ul className="flex flex-col gap-1" aria-label="Amounts for this step">
      {rows.map((ingredient) => (
        <li key={ingredient.id} className="flex min-h-12 flex-wrap items-center gap-3">
          {editing === ingredient.id ? (
            <AmountForm ingredient={ingredient} onSave={(typed) => onChangeAmount(ingredient, typed)} onClose={() => setEditing(null)} />
          ) : (
            <>
              <span className="min-w-0 flex-1 text-xl">{formatIngredient(ingredient)}</span>
              {changedIds?.has(ingredient.id) && <Muted as="span">changed</Muted>}
              <Button type="button" variant="outline" intent="neutral" size="xl" onClick={() => setEditing(ingredient.id)}>
                <span className="sr-only">Change the amount of {formatIngredient(ingredient)}</span>
                <span aria-hidden="true">Change</span>
              </Button>
            </>
          )}
        </li>
      ))}
      <li>
        <Button type="button" variant="ghost" intent="neutral" size="xl" onClick={() => setOpen(false)}>
          Done
        </Button>
      </li>
    </ul>
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
  changedIds,
  onChangeAmount,
  onChangeStep,
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
  /** Ingredient and step ids changed this cook, marked as such. */
  changedIds?: ReadonlySet<string>;
  /** The cook typed a new amount for an ingredient row. Without it the rows have no pencil. */
  onChangeAmount?: (ingredient: Ingredient, typed: number) => void;
  /** The cook rewrote a step. Without it a step card has no "Change this step". */
  onChangeStep?: (step: Step, position: number, text: string) => void;
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
              <CookIngredientItem
                key={ingredient.id}
                recipeId={recipeId}
                ingredient={ingredient}
                changed={changedIds?.has(ingredient.id)}
                onChangeAmount={onChangeAmount && ((typed) => onChangeAmount(ingredient, typed))}
              />
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
      {onChangeAmount && (
        <StepAmounts
          key={`amounts-${card.step.id}`}
          rows={linkedIngredients(card.step, card.ingredients).filter((ingredient) => ingredient.quantity !== null)}
          changedIds={changedIds}
          onChangeAmount={onChangeAmount}
        />
      )}
      {onChangeStep && (
        <StepChange
          key={card.step.id}
          step={card.step}
          changed={changedIds?.has(card.step.id) ?? false}
          onSave={(text) => onChangeStep(card.step, card.number, text)}
        />
      )}
      <NextPreview preview={preview} onNext={onNext} />
    </div>
  );
}
