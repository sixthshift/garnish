import { Button } from "@sixthshift/design-system/button";
import { EmptyBoundary } from "@sixthshift/design-system/empty-boundary";
import { Muted } from "@sixthshift/design-system/muted";
import { ProgressBar } from "@sixthshift/design-system/progress-bar";
import { Tooltip } from "@sixthshift/design-system/tooltip";
import { Link } from "@tanstack/react-router";
import { type PointerEvent as ReactPointerEvent, useEffect, useRef } from "react";
import { z } from "zod";
import { SubRecipesProvider } from "../../../../components/recipe/SubRecipes";
import { NumberStepper } from "../../../../components/ui/NumberStepper";
import {
  buildCookCards,
  type CookCard,
  cardAnnouncement,
  clampStep,
  isFinishedIndex,
  nextPreview,
  partPills,
  positionLabel,
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
import { WakeLockIcon } from "../../../../components/ui/icons";

/** Eye: the screen is being watched, so it is being kept on. Same drawing style as RecipeHeader's stat icons. */
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
                  <span className="shrink-0 text-fg-subtle" data-wake-lock aria-label="The screen stays on while you cook">
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

        <main
          className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-4 p-4"
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
                <CookCardView card={card} recipeId={recipe.id} preview={nextPreview(cards, index)} onNext={() => goTo(index + 1)} cookFrom={recipe.slug} />
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
