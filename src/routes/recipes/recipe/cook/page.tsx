// Cook mode: the recipe as a deck of cards, one on screen at a time in large
// type. `?step=N` is the card index and `?servings=N` the scale, both through
// the URL so a refresh lands on the same card at the same scale. The loader is
// still the one read path — it fetches the stored document once — and the
// scale is a pure view over it, applied here with `scaledForServings` rather
// than by the server, so the stepper repaints without a request (M25.1,
// decisions.md row 62; the view page does the same). The shell hides its nav here
// (`staticData.fullscreen`), leaving the header and footer of this page as the
// only chrome. A screen wake lock is held while the page is mounted.
//
// Three ways through the deck: the Prev/Next buttons and arrow keys, a pill per
// part that jumps to its first card, and a vertical swipe (pure
// `swipeIntent`, so the scroll-versus-swipe line is a tested function rather
// than a feel). A live region speaks the card as it changes.
//
// The page stays `max-w-3xl` (M24.7) while the view and editor routes widen:
// one card of large type at roughly 35 characters a line is the right measure
// for reading across a bench, so this is a deliberate exception, not a leftover.
//
// Cook through a sub-recipe (M32.4): the loader fetches the recipes this
// recipe's ingredient foods are made by, the same call the view loader makes
// (M32.3), so a step card's linked row can offer "Open <child> at N servings"
// into the child's own cook mode. That link carries `?from=` this recipe's
// slug; when the deck reaches Finished having been entered that way, the
// card offers "Back to <parent>". `from` is resolved to a name in the loader
// too — a stale or deleted slug just drops the way back rather than failing
// the page.
import { Button } from "@sixthshift/design-system/button";
import { Card } from "@sixthshift/design-system/card";
import { Checkbox } from "@sixthshift/design-system/checkbox";
import { EmptyBoundary } from "@sixthshift/design-system/empty-boundary";
import { Muted } from "@sixthshift/design-system/muted";
import { ProgressBar } from "@sixthshift/design-system/progress-bar";
import { Tooltip } from "@sixthshift/design-system/tooltip";
import { cn } from "@sixthshift/design-system/utils";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { z } from "zod";
import { AddToShoppingButton } from "../../../../components/shopping/AddToShoppingSheet";
import { MadeThisButton } from "../components/Timeline";
import { NumberStepper } from "../../../../components/ui/NumberStepper";
import { StepCard } from "../components/StepCard";
import { buildCookCards, cardAnnouncement, clampStep, nextPreview, partPills, isFinishedIndex, totalWithFinish, type CookCard, scaledForServings, type Ingredient, type Recipe, stepForKey, positionLabel } from "../../../../domain/recipe";
import { swipeIntent } from "../../../../lib/swipe";
import { formatIngredient } from "../../../../domain/ingredient";
import { SubRecipesProvider } from "../../../../components/recipe/SubRecipes";
import { useIngredientTick } from "../../../../lib/ticks";
import { TimerStrip } from "../components/TimerStrip";
import { useWakeLock } from "../../../../lib/useWakeLock";
import { Route } from "./route";

/** Eye: the screen is being watched, so it is being kept on. Same drawing style as RecipeHeader's stat icons. */
function WakeLockIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function CookPage() {
  const { recipe: stored, subRecipes, parentName } = Route.useLoaderData();
  const { step, servings: requested, from } = Route.useSearch();
  // Scaled on the client from the search param: the deck is rebuilt from the
  // scaled document, so the stepper is a re-render and not a round trip.
  const recipe = scaledForServings(stored, requested);
  const navigate = Route.useNavigate();
  const screenOn = useWakeLock();

  const cards = buildCookCards(recipe);
  const total = totalWithFinish(cards.length);
  const index = clampStep(step ?? 0, total);
  const finished = isFinishedIndex(index, cards.length);
  const card: CookCard | undefined = finished ? undefined : cards[index];
  const pills = partPills(cards);

  const goTo = (next: number) => void navigate({ search: (prev) => ({ ...prev, step: next }) });
  const scaleTo = (value: number) => void navigate({ search: (prev) => ({ ...prev, servings: value }), replace: true });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // Typing in the servings field must not flip cards.
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, select")) return;
      const next = stepForKey(event.key, index, total);
      if (next === null) return;
      event.preventDefault();
      goTo(next);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Vertical swipe between cards. Nothing is captured and nothing is
  // prevented: the gesture is judged only when the pointer lifts, by
  // `swipeIntent`, so a drag that was really a scroll scrolls and then reads as
  // null. Touch and pen only — a mouse has the arrow keys and the buttons, and
  // hijacking its drags would fight text selection.
  const swipe = useRef<{ pointerId: number; x: number; y: number; at: number } | null>(null);

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse") return;
    swipe.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, at: Date.now() };
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    const start = swipe.current;
    swipe.current = null;
    if (start === null || start.pointerId !== event.pointerId) return;
    const intent = swipeIntent({ dx: event.clientX - start.x, dy: event.clientY - start.y, ms: Date.now() - start.at });
    if (intent === null) return;
    const next = intent === "next" ? index + 1 : index - 1;
    if (next < 0 || next >= total) return;
    goTo(next);
  };

  return (
    <SubRecipesProvider subRecipes={subRecipes}>
      <div className="flex min-h-dvh flex-col bg-bg-normal text-fg-normal">
        <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-border-normal bg-bg-normal px-4 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Button asChild variant="outline" intent="neutral" size="sm">
              <Link to="/recipes/$slug" params={{ slug: recipe.slug }} search={{ servings: requested }}>
                Exit
              </Link>
            </Button>
            <span className="truncate font-semibold text-fg-strong">{recipe.name}</span>
            {screenOn && (
              <Tooltip>
                <Tooltip.Trigger asChild>
                  <span
                    className="shrink-0 text-fg-subtle"
                    data-wake-lock
                    aria-label="The screen stays on while you cook"
                  >
                    <WakeLockIcon />
                  </span>
                </Tooltip.Trigger>
                <Tooltip.Body>The screen stays on while you cook</Tooltip.Body>
              </Tooltip>
            )}
          </div>
          {recipe.recipeServings > 0 && (
            <NumberStepper label="Serves" value={Number(recipe.recipeServings.toFixed(2))} min={1} onChange={scaleTo} className="flex-row items-center gap-2" />
          )}
          {pills.length > 1 && (
            <nav className="-mx-1 flex w-full gap-2 overflow-x-auto px-1 pb-1" aria-label="Parts">
              {pills.map((pill) => {
                const current = card !== undefined && card.part === pill.name;
                return (
                  <Button
                    key={pill.name}
                    variant={current ? "solid" : "outline"}
                    intent={current ? "brand" : "neutral"}
                    size="sm"
                    className="shrink-0 rounded-full"
                    aria-current={current ? "true" : undefined}
                    data-pill={pill.name}
                    onClick={() => goTo(pill.index)}
                  >
                    {pill.label}
                  </Button>
                );
              })}
            </nav>
          )}
        </header>

        {/* Politely spoken on every card change; the visible position line below is silent so it is not said twice. */}
        <p className="sr-only" aria-live="polite" data-announce>
          {finished ? "Finished" : card === undefined ? "Nothing to cook" : cardAnnouncement(card)}
        </p>

        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-4 p-4" onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => (swipe.current = null)}>
          {finished ? (
            <FinishedCard recipe={recipe} servings={requested} from={from} parentName={parentName} />
          ) : (
            <EmptyBoundary
              isEmpty={card === undefined}
              fallback={
                <Muted as="p" className="text-center text-xl">
                  Nothing to cook yet: this recipe has no ingredients or steps.
                </Muted>
              }
            >
              {card !== undefined && (
                <CookCardView
                  card={card}
                  recipeId={recipe.id}
                  preview={nextPreview(cards, index)}
                  onNext={() => goTo(index + 1)}
                  cookFrom={recipe.slug}
                />
              )}
            </EmptyBoundary>
          )}
        </main>

        <footer className="sticky bottom-0 z-10 flex flex-col gap-3 border-t border-border-normal bg-bg-normal px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {/* Timers started from any card, above the progress bar: they outlive
              the card they were started on, so they follow you through the deck. */}
          <TimerStrip recipeId={recipe.id} />
          <ProgressBar completed={index + 1} total={total} showFraction={false} label="Cook progress" />
          <div className="flex items-center justify-between gap-3">
            <Button variant="outline" intent="neutral" size="lg" disabled={index <= 0} onClick={() => goTo(index - 1)}>
              Prev
            </Button>
            <span className="min-w-0 flex-1 truncate text-center text-sm text-fg-subtle" data-position>
              {finished ? "Finished" : cards.length === 0 ? "0 of 0" : positionLabel(index, cards.length, card?.part ?? "")}
            </span>
            <Button variant="solid" intent="brand" size="lg" disabled={index >= total - 1} onClick={() => goTo(index + 1)}>
              Next
            </Button>
          </div>
        </footer>
      </div>
    </SubRecipesProvider>
  );
}

/**
 * The deck's last "card": logged the cook is done, with a shortcut to log it
 * (M11.7's sheet, reused as-is) and a way out. When this session was opened
 * from a sub-recipe link (`from`), and that parent still resolves
 * (`parentName`), a "Back to <parent>" button offers the way back into its
 * own cook mode (M32.4). A stale `from` with no `parentName` shows nothing extra.
 */
function FinishedCard({
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
          {/* The same button the recipe page carries (M31.3), on the scaled
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

/** One ingredient card row: ticks off for this session, shared with the recipe view page (src/lib/ticks.ts). */
function CookIngredientItem({ recipeId, ingredient }: { recipeId: string; ingredient: Ingredient }) {
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

/** The foot of every card: a dimmed, tappable preview of the card that follows. */
function NextPreview({ preview, onNext }: { preview: string; onNext: () => void }) {
  return (
    <button type="button" data-testid="next-preview" onClick={onNext} className="mt-4 block text-left text-sm text-fg-subtle hover:text-fg-normal">
      Next: {preview}
    </button>
  );
}

/** One card in large type: the part's ingredient list, or a single step. */
function CookCardView({
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
  /** This recipe's slug, forwarded to a step card's linked rows for the sub-recipe cook link (M32.4). */
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
          own linked ingredients and timers come with it (M29.2). */}
      <ul>
        <StepCard recipeId={recipeId} step={card.step} position={card.number} ingredients={card.ingredients} size="cook" cookFrom={cookFrom} />
      </ul>
      <NextPreview preview={preview} onNext={onNext} />
    </Card>
  );
}
