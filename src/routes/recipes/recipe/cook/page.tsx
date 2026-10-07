import { Button } from "@sixthshift/design-system/button";
import { EmptyBoundary } from "@sixthshift/design-system/empty-boundary";
import { Muted } from "@sixthshift/design-system/muted";
import { Popover } from "@sixthshift/design-system/popover";
import { ProgressBar } from "@sixthshift/design-system/progress-bar";
import { cn } from "@sixthshift/design-system/utils";
import { Link } from "@tanstack/react-router";
import { type PointerEvent as ReactPointerEvent, useEffect, useRef } from "react";
import { SubRecipesProvider } from "../../../../components/recipe/SubRecipes";
import { WakeLockIcon } from "../../../../components/ui/icons";
import { NumberStepper } from "../../../../components/ui/NumberStepper";
import {
  buildCookCards,
  type CookCard,
  cardAnnouncement,
  clampStep,
  isFinishedIndex,
  nextPreview,
  partPills,
  scaledForServings,
  stepForKey,
  totalWithFinish,
} from "../../../../domain/recipe";
import { swipeIntent } from "../../../../lib/swipe";
import { useWakeLock } from "../../../../lib/useWakeLock";
import { TimerStrip } from "../components/TimerStrip";
import { CookCardView } from "./components/CookCardView";
import { FinishedCard } from "./components/FinishedCard";
import { Route } from "./route";

/**
 * The deck's one column. The header and footer span the screen for their rule
 * and fill, but their controls sit in this, so on a desktop they line up with
 * the card rather than the window's edges (critique #15b). From `lg` it widens
 * with the step's type, keeping about the same measure.
 */
const COLUMN = "mx-auto w-full max-w-3xl px-4 lg:max-w-5xl";

/**
 * "Serves 4" as one button that opens the stepper: the stepper itself is
 * three 48px targets and would take the name's room in the header, and
 * rescaling mid-cook is rare.
 */
function ServesControl({ servings, onChange }: { servings: number; onChange: (value: number) => void }) {
  const value = Number(servings.toFixed(2));
  return (
    <Popover placement="bottom-end">
      <Popover.Trigger asChild>
        <Button variant="outline" intent="neutral" size="xl" className="shrink-0 px-4" data-serves>
          Serves {value}
        </Button>
      </Popover.Trigger>
      <Popover.Body className="p-3" aria-label="Set servings">
        <NumberStepper label="Serves" value={value} min={1} onChange={onChange} size="xl" className="flex-row items-center gap-3" />
      </Popover.Body>
    </Popover>
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
      {/* `data-toasts="top"`: the footer is the deck's controls, so a toast (a timer done) goes to the top (lib/toast.ts). */}
      <div className="flex min-h-dvh flex-col bg-bg-normal text-fg-normal" data-toasts="top">
        <header className="sticky top-0 z-content-sticky border-b border-border-normal bg-bg-normal py-3">
          <div className={cn(COLUMN, "flex flex-col gap-2")}>
            {/* Exit, the name and Serves share the first row; the name gets the
              room left and wraps to a second line before it truncates. */}
            <div className="flex items-center gap-3">
              <Button asChild variant="outline" intent="neutral" size="xl" className="shrink-0 px-4">
                <Link to="/recipes/$slug" params={{ slug: recipe.slug }} search={{ servings: requested }}>
                  Exit
                </Link>
              </Button>
              <h1 className="line-clamp-2 min-w-0 flex-1 font-semibold leading-tight text-fg-strong lg:text-lg" data-cook-title>
                {recipe.name}
              </h1>
              {recipe.recipeServings > 0 && <ServesControl servings={recipe.recipeServings} onChange={scaleTo} />}
            </div>
            {pills.length > 1 && (
              <nav className="-mx-1 flex w-full gap-2 overflow-x-auto px-1" aria-label="Parts">
                {pills.map((pill) => {
                  const current = card !== undefined && card.part === pill.name;
                  return (
                    <Button
                      key={pill.name}
                      // The current part is a neutral fill: brand is Next's alone (rule 5).
                      variant={current ? "solid" : "outline"}
                      intent="neutral"
                      size="xl"
                      className="shrink-0 rounded-full px-5"
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
          </div>
        </header>

        {/* Politely spoken on every card change; the visible position line below is silent so it is not said twice. */}
        <p className="sr-only" aria-live="polite" data-announce>
          {finished ? "Finished" : card === undefined ? "Nothing to cook" : cardAnnouncement(card)}
        </p>

        <main
          // Anchored to the top, under the header, so the step reads high on a
          // phone. `isolate`: the tick boxes lift over their rows' overlays
          // (COOK_TICK's z-10), and that lift stays inside the deck rather
          // than tying with the sticky header and painting over it (critique #15b).
          className={cn(COLUMN, "isolate flex flex-1 flex-col gap-4 py-4 lg:pt-8")}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (swipe.current = null)}
        >
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
                  partName={pills.length > 1 ? undefined : card.part}
                />
              )}
            </EmptyBoundary>
          )}
        </main>

        <footer className="sticky bottom-0 z-content-sticky border-t border-border-normal bg-bg-normal pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className={cn(COLUMN, "flex flex-col gap-3")}>
            {/* Timers started from any card, above the progress bar: they outlive
              the card they were started on, so they follow you through the deck.
              The current card's own are left out: its timer buttons count down already. */}
            <TimerStrip recipeId={recipe.id} size="cook" hideStep={card?.kind === "step" ? card.step.id : undefined} />
            <ProgressBar
              completed={index + 1}
              total={total}
              showFraction={false}
              label="Cook progress"
              // A quiet track and a strong fill: what is done is the signal, not
              // what is left. Neutral, since brand is Next's alone.
              intent="neutral"
              className="[--progress-bar-fill-bg:var(--fg-normal)] [--progress-bar-track-bg:var(--border-normal)]"
            />
            <div className="flex items-center justify-between gap-3">
              <Button variant="outline" intent="neutral" size="xl" className="px-6" disabled={index <= 0} onClick={() => goTo(index - 1)}>
                Prev
              </Button>
              <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5 text-center">
                {/* The deck's one counter, within the part; the bar shows the whole. */}
                {card?.kind === "step" && (
                  <span className="truncate text-sm text-fg-normal" data-position>
                    {cardAnnouncement(card)}
                  </span>
                )}
                {screenOn && (
                  <span className="flex items-center gap-1 text-xs text-fg-subtle" data-wake-lock>
                    <WakeLockIcon />
                    Screen stays on
                  </span>
                )}
              </div>
              <Button variant="solid" intent="brand" size="xl" className="px-6" disabled={index >= total - 1} onClick={() => goTo(index + 1)}>
                Next
              </Button>
            </div>
          </div>
        </footer>
      </div>
    </SubRecipesProvider>
  );
}
