import { cn } from "@sixthshift/design-system/utils";
import { useSubRecipe } from "../../../../../components/recipe/SubRecipes";
import { Markdown } from "../../../../../components/ui/Markdown";
import { stepImageUrl } from "../../../../../lib/images";
import { chipTimerId } from "../../../../../lib/timers";
import { useIngredientTick } from "../../../../../lib/useTicks";
import { useTimers } from "../../../../../lib/useTimers";
import { formatIngredient } from "../../../ingredient";
import type { CookCard, Ingredient, Step } from "../../../recipe";
import { IngredientRow } from "../../recipe/IngredientRow";
import { linkedIngredients, stepDurations } from "../../recipe/StepCard";
import { TimerChip } from "../../recipe/TimerChip";
import { StepAmounts, StepChange } from "../CookCardView";
import { CookIngredientItem } from "../CookIngredientItem";

export type CookPhoneCardProps = {
  card: CookCard;
  recipeId: string;
  /** This recipe's slug: a sub-recipe row links into the child's cook mode with it as `from`. */
  cookFrom: string;
  changedIds?: ReadonlySet<string>;
  fixedIds?: ReadonlySet<string>;
  onChangeAmount?: (ingredient: Ingredient, typed: number) => void;
  onChangeStep?: (step: Step, position: number, text: string) => void;
};

/** Where a card sits: "Step 2 of 5", "Pastry · Step 2 of 3", "Ingredients for Pastry". Pure. */
export function cardPosition(card: CookCard): string {
  if (card.kind === "ingredients") return card.part === "" ? "Ingredients" : `Ingredients for ${card.part}`;
  const step = `Step ${card.number} of ${card.total}`;
  return card.part === "" ? step : `${card.part} · ${step}`;
}

/** The small kicker and the label in brand capitals, the card's head (`docs/mockups/desktop.html`, `mCook`). */
function CardHead({ position, label }: { position: string; label: string }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm text-fg-subtle" data-position>
        {position}
      </p>
      {label !== "" && (
        <h2 className="text-sm font-bold tracking-widest text-fg-brand uppercase" data-testid="step-title">
          {label}
        </h2>
      )}
    </div>
  );
}

/**
 * One ingredient the step needs, as a chip at the card's top: a tap ticks it
 * off, as the recipe page's row does (the ticks are shared, src/lib/ticks.ts).
 * A row made by a sub-recipe keeps the full row instead, for its links to the
 * child and into the child's cook mode.
 */
function NeedChip({ recipeId, ingredient, cookFrom }: { recipeId: string; ingredient: Ingredient; cookFrom: string }) {
  const [done, toggle] = useIngredientTick(recipeId, ingredient.id);
  const child = useSubRecipe(ingredient.food);
  if (child !== null) {
    return (
      <li className="basis-full">
        <ul className="text-lg">
          <IngredientRow recipeId={recipeId} ingredient={ingredient} cookFrom={cookFrom} size="cook" />
        </ul>
      </li>
    );
  }
  const line = formatIngredient(ingredient) || "ingredient";
  return (
    <li>
      <button
        type="button"
        onClick={toggle}
        aria-pressed={done}
        aria-label={`Tick off ${line}`}
        className={cn("min-h-10 rounded-full bg-bg-subtle-pressed px-3.5 py-1.5 text-left text-base text-fg-strong", done && "text-fg-subtle line-through")}
        data-testid="need-chip"
      >
        {line}
      </button>
    </li>
  );
}

/** The step's timer buttons, at the card's foot: "Start 12 minute timer", then the time left. */
function StepTimers({ recipeId, step }: { recipeId: string; step: Step }) {
  const { start, pause, resume, find } = useTimers(recipeId);
  const durations = stepDurations(step.text);
  if (durations.length === 0) return null;
  return (
    <div className="mt-auto flex flex-wrap gap-2 pt-2" data-testid="step-timers">
      {durations.map((duration) => {
        const id = chipTimerId(step.id, duration.start, duration.text);
        const timer = find(id);
        return (
          <TimerChip
            key={id}
            seconds={duration.seconds}
            upperSeconds={duration.upperSeconds}
            label={duration.text}
            timer={timer && { text: timer.text, done: timer.done, paused: !timer.done && timer.endsAt === null }}
            size="cook"
            onStart={(seconds, matched) => start({ id, label: step.text.trim() || matched, seconds })}
            onPause={() => pause(id)}
            onResume={() => resume(id)}
          />
        );
      })}
    </div>
  );
}

/**
 * A phone's cook card (decisions.md row 208, the mockup's `mCook`): one step,
 * what it needs as chips at its top, its words large, its note quieter, and
 * its timer at the foot; or a part's ingredients to get out. The page's
 * change forms (an amount, the step's words) follow, as on a desktop.
 */
export function CookPhoneCard({ card, recipeId, cookFrom, changedIds, fixedIds, onChangeAmount, onChangeStep }: CookPhoneCardProps) {
  if (card.kind === "ingredients") {
    return (
      <div className="flex flex-col gap-3" data-card="ingredients">
        <CardHead position={card.part === "" ? "Before you start" : card.part} label="Get out" />
        <ul className="flex flex-col text-2xl leading-snug" aria-label="Ingredients">
          {card.ingredients.map((ingredient) => (
            <CookIngredientItem
              key={ingredient.id}
              recipeId={recipeId}
              ingredient={ingredient}
              changed={changedIds?.has(ingredient.id)}
              onChangeAmount={onChangeAmount && !fixedIds?.has(ingredient.id) ? (typed) => onChangeAmount(ingredient, typed) : undefined}
            />
          ))}
        </ul>
      </div>
    );
  }

  const { step } = card;
  const needs = linkedIngredients(step, card.ingredients);
  const photo = stepImageUrl(step.image);
  const support = step.summary.trim();
  return (
    <div className="flex min-h-full flex-col gap-4" data-card="step" data-testid="step-card">
      <CardHead position={cardPosition(card)} label={step.title.trim()} />
      {needs.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Ingredients for this step" data-testid="step-ingredients">
          {needs.map((ingredient) => (
            <NeedChip key={ingredient.id} recipeId={recipeId} ingredient={ingredient} cookFrom={cookFrom} />
          ))}
        </ul>
      )}
      {photo !== null && <img src={photo} alt={`Step ${card.number}`} loading="lazy" className="max-h-56 w-full rounded-lg object-cover" />}
      <Markdown source={step.text} className="text-2xl leading-snug text-fg-strong" />
      {support !== "" && (
        <div className="text-base text-fg-subtle" data-testid="step-summary">
          <Markdown source={support} />
        </div>
      )}
      <StepTimers recipeId={recipeId} step={step} />
      {onChangeAmount && (
        <StepAmounts
          key={`amounts-${step.id}`}
          rows={needs.filter((ingredient) => ingredient.quantity !== null && !fixedIds?.has(ingredient.id))}
          changedIds={changedIds}
          onChangeAmount={onChangeAmount}
        />
      )}
      {onChangeStep && (
        <StepChange key={step.id} step={step} changed={changedIds?.has(step.id) ?? false} onSave={(text) => onChangeStep(step, card.number, text)} />
      )}
    </div>
  );
}
