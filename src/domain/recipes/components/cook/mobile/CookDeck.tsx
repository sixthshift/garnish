import { Button } from "@sixthshift/design-system/button";
import { cn } from "@sixthshift/design-system/utils";
import { type PointerEvent, type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { WakeLockIcon } from "../../../../../components/ui/icons";
import { swipeIntent } from "../../../../../lib/swipe";
import { swipeAxis } from "../../../../../lib/ui/swipeRow";
import type { CookCard, partPills } from "../../../recipe";
import { TimerStrip } from "../../recipe/TimerStrip";

/**
 * The dark theme's tokens, whatever the theme, for the frame around the card
 * (decisions.md row 208, the mockup's dark warm cook screen). Re-pointing the
 * semantic tokens on the frame, rather than painting its controls one by one,
 * lets the design system's buttons, badges and timer rows draw themselves dark
 * from the theme's own earth scale. The card, between the header and the
 * footer, sits outside it and keeps the theme's tokens: the page's paper in
 * light, so the step is the one lit thing on the screen.
 */
const DARK_FRAME = cn(
  "[--bg-normal:var(--color-earth-925)] [--bg-normal-hovered:var(--color-earth-900)] [--bg-normal-pressed:var(--color-earth-800)]",
  "[--bg-subtle:var(--color-earth-950)] [--bg-subtle-hovered:var(--color-earth-900)] [--bg-subtle-pressed:var(--color-earth-800)]",
  "[--fg-strong:var(--color-earth-50)] [--fg-normal:var(--color-earth-100)] [--fg-subtle:var(--color-earth-400)]",
  "[--border-normal:var(--color-earth-800)] [--border-subtle:var(--color-earth-900)]",
  "bg-bg-subtle text-fg-normal"
);

export type CookDeckProps = {
  name: string;
  recipeId: string;
  cards: CookCard[];
  /** Where the deck is, Finished (one past the last card) included. */
  index: number;
  /** Positions in the deck, Finished included (`totalWithFinish`). */
  total: number;
  pills: ReturnType<typeof partPills>;
  /** The card in front of the cook, drawn by the page: a step, a part's ingredients, Finished or the empty deck's line. */
  current: ReactNode;
  /** Whether `current` is drawn on the deck's own card (a step or ingredients) or brings its own (Finished). */
  onCard: boolean;
  /** The ✕ back to the recipe, which the page builds with the recipe's address. */
  exit: ReactNode;
  /** What sits at the header's end: the changes made this cook, Serves. */
  tools: ReactNode;
  screenOn: boolean;
  goTo: (index: number) => void;
};

/** How a drag in progress stands: where it began, when, and how far the card has followed it. */
type Drag = { id: number; x: number; y: number; at: number; axis: "row" | "page" | null };

/**
 * Cook mode on a phone (decisions.md row 208, the mockup's `mCook`): one step
 * a card, moved sideways. A finger drags the card left for the next and right
 * for the one before (`swipeIntent`); the big Next step at the foot and the
 * arrow keys do the same. A dark frame holds ✕, the name and a segment per
 * card across the top, and the running timers, a small Back and the big Next
 * at the foot, under the thumb.
 */
export function CookDeck({ name, recipeId, cards, index, total, pills, current, onCard, exit, tools, screenOn, goTo }: CookDeckProps) {
  const card: CookCard | undefined = cards[index];
  const drag = useRef<Drag | null>(null);
  const [offset, setOffset] = useState(0);
  const box = useRef<HTMLDivElement | null>(null);
  const previous = useRef(index);

  // The new card comes in from the side the finger sent the old one, so the
  // deck reads as moving sideways whether a swipe, a key or Next moved it.
  useLayoutEffect(() => {
    const from = previous.current;
    previous.current = index;
    const node = box.current;
    if (from === index || node === null || typeof node.animate !== "function") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const side = index > from ? 1 : -1;
    node.animate(
      [
        { transform: `translateX(${side * 40}%)`, opacity: 0.4 },
        { transform: "translateX(0)", opacity: 1 },
      ],
      {
        duration: 200,
        easing: "ease-out",
      }
    );
  }, [index]);

  // A touch or a pen drags the card; a mouse has the keys and the buttons, and
  // taking its drags would fight selecting the step's words. A drag that goes
  // up or down is the card's own scroll (`touch-action: pan-y`) and is let be.
  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse") return;
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, at: Date.now(), axis: null };
  };
  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (d === null || d.id !== event.pointerId) return;
    const dx = event.clientX - d.x;
    if (d.axis === null) {
      d.axis = swipeAxis(dx, event.clientY - d.y);
      if (d.axis === "page") drag.current = null;
      if (d.axis !== "row") return;
    }
    // Past either end the card gives a little and no more.
    const end = (dx > 0 && index === 0) || (dx < 0 && index >= total - 1);
    setOffset(end ? dx / 4 : dx);
  };
  const onPointerUp = (event: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    drag.current = null;
    setOffset(0);
    if (d === null || d.id !== event.pointerId) return;
    const intent = swipeIntent({ dx: event.clientX - d.x, dy: event.clientY - d.y, ms: Date.now() - d.at, width: event.currentTarget.clientWidth });
    if (intent === null) return;
    const next = intent === "next" ? index + 1 : index - 1;
    if (next >= 0 && next < total) goTo(next);
  };

  const last = index === cards.length - 1;

  return (
    // The frame's colour shows round the card, which keeps the theme's own tokens: paper in light, its card in dark.
    <div className="flex h-dvh flex-col overflow-hidden bg-[var(--color-earth-950)] text-fg-normal" data-toasts="top" data-cook-layout="cards">
      <header className={cn("flex flex-col gap-2 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3", DARK_FRAME)}>
        <div className="flex items-center gap-3">
          {exit}
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <h1 className="line-clamp-2 font-sans text-base leading-tight font-semibold text-fg-strong" data-cook-title>
              {name}
            </h1>
            <Segments index={index} total={total} />
          </div>
          {tools}
        </div>
        {pills.length > 1 && (
          <nav className="-mx-1 flex gap-1.5 overflow-x-auto px-1" aria-label="Parts">
            {pills.map((pill) => {
              const on = card !== undefined && card.part === pill.name;
              return (
                <Button
                  key={pill.name}
                  // The current part is a neutral fill: brand is Next's alone (rule 5).
                  variant={on ? "solid" : "outline"}
                  intent="neutral"
                  size="md"
                  className="shrink-0 rounded-full px-4"
                  aria-current={on ? "true" : undefined}
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

      <main
        // `isolate`: the tick boxes lift over their rows' overlays and stay inside the card.
        className="isolate flex min-h-0 flex-1 touch-pan-y flex-col px-3"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          drag.current = null;
          setOffset(0);
        }}
        data-testid="cook-cards"
      >
        <div
          ref={box}
          className={cn(
            "flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain",
            onCard && "rounded-[1.5rem] bg-bg-normal px-5 py-6 shadow-lg",
            offset === 0 && "transition-transform duration-200 motion-reduce:transition-none"
          )}
          style={offset === 0 ? undefined : { transform: `translateX(${offset}px)` }}
          data-testid="cook-card"
        >
          {current}
        </div>
      </main>

      <footer className={cn("flex flex-col gap-2.5 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]", DARK_FRAME)}>
        {/* Timers started on any card: they outlive the card that started them. The current card's own count down on it. */}
        <TimerStrip recipeId={recipeId} size="cook" hideStep={card?.kind === "step" ? card.step.id : undefined} />
        <div className="flex gap-2">
          <Button
            variant="outline"
            intent="neutral"
            size="xl"
            iconOnly
            className="w-14 text-2xl"
            aria-label="Back"
            disabled={index <= 0}
            onClick={() => goTo(index - 1)}
          >
            ‹
          </Button>
          <Button variant="solid" intent="brand" size="xl" className="flex-1 text-lg" disabled={index >= total - 1} onClick={() => goTo(index + 1)}>
            {last ? "Finish" : "Next step"}
            <span aria-hidden="true">→</span>
          </Button>
        </div>
        {screenOn && (
          <p className="flex items-center justify-center gap-1.5 text-xs text-fg-subtle" data-wake-lock>
            <WakeLockIcon />
            The screen stays on while you cook
          </p>
        )}
      </footer>
    </div>
  );
}

/** A segment per position, Finished included: what is done in the brand's light, the current one bright. */
function Segments({ index, total }: { index: number; total: number }) {
  if (total === 0) return null;
  return (
    <div
      role="progressbar"
      aria-label="Cook progress"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={index + 1}
      className="flex gap-[3px]"
      data-testid="cook-segments"
    >
      {Array.from({ length: total }, (_, at) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: a segment is its position.
          key={at}
          className={cn("h-1 flex-1 rounded-full", at < index ? "bg-[var(--color-teal-400)]" : at === index ? "bg-fg-strong" : "bg-bg-normal-pressed")}
        />
      ))}
    </div>
  );
}
