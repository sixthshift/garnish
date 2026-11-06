import { Button } from "@sixthshift/design-system/button";
import { Muted } from "@sixthshift/design-system/muted";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import { cn } from "@sixthshift/design-system/utils";
import type { ReactNode } from "react";
import { WakeLockIcon } from "../../../../../components/ui/icons";
import { formatIngredient } from "../../../ingredient";
import { type CookCard, cardAnnouncement, nextPreview, type partPills } from "../../../recipe";
import { IngredientRow } from "../../recipe/IngredientRow";
import { linkedIngredients } from "../../recipe/StepCard";
import { TimerStrip } from "../../recipe/TimerStrip";

export type CookFilmstripProps = {
  recipeId: string;
  slug: string;
  name: string;
  cards: CookCard[];
  /** Where the deck is, Finished (one past the last card) included. */
  index: number;
  /** Positions in the deck, Finished included (`totalWithFinish`). */
  total: number;
  pills: ReturnType<typeof partPills>;
  /** The card at `index` as the deck draws it, or Finished, or the empty deck's line. */
  current: ReactNode;
  /** Exit, which the page builds with the recipe's own address. */
  exit: ReactNode;
  /** What sits at the header's end: the changes made this cook, Serves. */
  tools: ReactNode;
  screenOn: boolean;
  goTo: (index: number) => void;
};

/**
 * Cook mode on a desktop (decisions.md row 207): the deck as a filmstrip. The
 * current card large in the middle with the cards before and after it dimmed
 * either side, so where you have been and what comes next are in sight across
 * the bench; this step's ingredients and what is coming up down the left; the
 * timers and big Back and Next along the foot; the deck's progress as a
 * segment per card across the top. The phone keeps its one card at a time.
 */
export function CookFilmstrip({ recipeId, slug, name, cards, index, total, pills, current, exit, tools, screenOn, goTo }: CookFilmstripProps) {
  const card: CookCard | undefined = cards[index];
  const finished = cards.length > 0 && index === cards.length;
  const forStep = card?.kind === "step" ? linkedIngredients(card.step, card.ingredients) : [];
  // The two cards after this one, by their labels, Finished included.
  const comingUp = [index + 1, index + 2].filter((at) => at <= cards.length).map((at) => upNext(cards, at));

  return (
    <div className="grid h-dvh grid-rows-[auto_minmax(0,1fr)_auto] bg-bg-subtle text-fg-normal" data-toasts="top" data-cook-layout="filmstrip">
      <header className="flex items-center gap-4 border-b border-border-normal bg-bg-normal px-6 py-3">
        {exit}
        <div className="flex min-w-0 flex-col">
          <h1 className="truncate text-xl font-semibold text-fg-strong" data-cook-title>
            {name}
          </h1>
          <span className="text-sm text-fg-subtle" data-position>
            {finished ? "Finished" : card === undefined ? "" : position(card)}
          </span>
        </div>
        {pills.length > 1 && (
          <nav className="flex shrink-0 gap-1.5" aria-label="Parts">
            {pills.map((pill) => {
              const on = card !== undefined && card.part === pill.name;
              return (
                <Button
                  key={pill.name}
                  variant={on ? "solid" : "outline"}
                  intent="neutral"
                  size="sm"
                  className="rounded-full px-3"
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
        <Segments index={index} total={total} />
        <div className="flex shrink-0 items-center gap-3">{tools}</div>
      </header>

      <div className="grid min-h-0 grid-cols-[16rem_minmax(0,1fr)] desktop:xl:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col gap-6 overflow-y-auto border-r border-border-normal bg-bg-normal px-6 py-5" aria-label="This step">
          {!finished && (
            <section className="flex flex-col gap-2" aria-labelledby="cook-for-step">
              <SectionTitle as="h2" id="cook-for-step">
                For this step
              </SectionTitle>
              {forStep.length > 0 ? (
                <ul className="flex flex-col gap-1 text-lg" data-testid="filmstrip-ingredients">
                  {forStep.map((ingredient) => (
                    <IngredientRow key={ingredient.id} recipeId={recipeId} ingredient={ingredient} cookFrom={slug} size="cook" />
                  ))}
                </ul>
              ) : (
                <Muted as="p">{card?.kind === "ingredients" ? "Everything to get out is on the card." : "Nothing new for this step."}</Muted>
              )}
            </section>
          )}
          {comingUp.length > 0 && (
            <section className="flex flex-col gap-2" aria-labelledby="cook-coming-up">
              <SectionTitle as="h2" id="cook-coming-up">
                Coming up
              </SectionTitle>
              <ol className="flex flex-col gap-1.5 text-fg-subtle" data-testid="coming-up">
                {comingUp.map((line, at) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: two lines in a fixed order; two steps can read the same.
                  <li key={at}>{line}</li>
                ))}
              </ol>
            </section>
          )}
        </aside>

        <main className="isolate flex min-h-0 items-center justify-center gap-6 overflow-hidden px-8 py-6" data-testid="filmstrip">
          <SideCard cards={cards} at={index - 1} direction="previous" goTo={goTo} />
          <div className="flex max-h-full min-w-0 flex-[0_1_56rem] flex-col overflow-y-auto" data-testid="filmstrip-current">
            {current}
          </div>
          <SideCard cards={cards} at={index + 1} direction="next" goTo={goTo} />
        </main>
      </div>

      <footer className="flex items-center gap-4 border-t border-border-normal bg-bg-normal px-6 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          {/* Timers started on any card, across the foot; the current card's own count down on it. */}
          <TimerStrip
            recipeId={recipeId}
            size="cook"
            hideStep={card?.kind === "step" ? card.step.id : undefined}
            className="min-w-0 flex-1 flex-row flex-wrap"
          />
          {screenOn && (
            <span className="flex shrink-0 items-center gap-1 text-xs text-fg-subtle" data-wake-lock>
              <WakeLockIcon />
              Screen stays on
            </span>
          )}
        </div>
        <Muted as="span" className="text-sm">
          <kbd>←</kbd> <kbd>→</kbd> or <kbd>Space</kbd>
        </Muted>
        <Button variant="outline" intent="neutral" size="xl" className="px-8" disabled={index <= 0} onClick={() => goTo(index - 1)}>
          Back
        </Button>
        <Button variant="solid" intent="brand" size="xl" className="px-8" disabled={index >= total - 1} onClick={() => goTo(index + 1)}>
          {index === cards.length - 1 ? "Finish" : "Next"}
        </Button>
      </footer>
    </div>
  );
}

/** A segment per position, Finished included: done ones filled, the current one strong. */
function Segments({ index, total }: { index: number; total: number }) {
  if (total === 0) return <div className="flex-1" />;
  return (
    <div
      role="progressbar"
      aria-label="Cook progress"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={index + 1}
      className="ml-auto flex max-w-[40rem] flex-1 gap-1"
      data-testid="cook-segments"
    >
      {Array.from({ length: total }, (_, at) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: a segment is its position.
          key={at}
          className={cn("h-1.5 flex-1 rounded-full", at < index ? "bg-fg-subtle" : at === index ? "bg-fg-strong" : "bg-border-normal")}
        />
      ))}
    </div>
  );
}

/** A card as "Coming up" names it: a step's label where it has one, else the phone's "Next:" line for it. Pure. */
function upNext(cards: CookCard[], at: number): string {
  const card = cards[at];
  const title = card?.kind === "step" ? card.step.title.trim() : "";
  return title !== "" ? title : nextPreview(cards, at - 1);
}

/** Where a card sits: "Pastry · Step 2 of 3", "Ingredients for Pastry". Pure. */
function position(card: CookCard): string {
  return card.kind === "step" && card.part !== "" ? `${card.part} · ${cardAnnouncement(card)}` : cardAnnouncement(card);
}

/** What a neighbouring card is called: its position, or "Finished" past the last. Pure. */
function sideKicker(card: CookCard | undefined): string {
  return card === undefined ? "Finished" : position(card);
}

/**
 * The card before or after the current one, smaller and dimmed beside it; a
 * click goes to it. Past the last card it is Finished; before the first,
 * nothing, though its room is kept so the current card stays in the middle.
 */
function SideCard({ cards, at, direction, goTo }: { cards: CookCard[]; at: number; direction: "previous" | "next"; goTo: (index: number) => void }) {
  if (at < 0 || at > cards.length || cards.length === 0) return <div className="flex-[0_0_18%] desktop:xl:flex-[0_0_22%]" aria-hidden="true" />;
  const card = cards[at];
  const kicker = sideKicker(card);
  const title = card?.kind === "step" ? card.step.title.trim() : "";
  return (
    <button
      type="button"
      className="flex max-h-[70%] flex-[0_0_18%] cursor-pointer flex-col gap-2 self-center overflow-hidden rounded-2xl border border-border-normal bg-bg-normal p-6 text-left text-base leading-relaxed text-fg-subtle opacity-60 transition-opacity hover:opacity-90 desktop:xl:flex-[0_0_22%]"
      aria-label={`${direction === "previous" ? "Previous" : "Next"}: ${kicker}`}
      data-side={direction}
      onClick={(event) => {
        // The keyboard's Space is "next" on this screen; a focused side card would take it as its own click.
        event.currentTarget.blur();
        goTo(at);
      }}
    >
      <span className="text-xs font-medium tracking-wide text-fg-subtle uppercase">{kicker}</span>
      {card === undefined ? (
        <span className="font-semibold text-fg-normal">Made this, and what changed</span>
      ) : card.kind === "ingredients" ? (
        <ul className="flex flex-col gap-1">
          {card.ingredients.slice(0, 8).map((ingredient) => (
            <li key={ingredient.id} className="truncate">
              {formatIngredient(ingredient)}
            </li>
          ))}
        </ul>
      ) : (
        <>
          {title !== "" && <span className="font-semibold text-fg-normal">{title}</span>}
          <span className={cn("whitespace-pre-line", title === "" ? "line-clamp-4 desktop:xl:line-clamp-[8]" : "hidden desktop:xl:line-clamp-[8]")}>
            {card.step.text.replace(/\*\*|__/g, "")}
          </span>
        </>
      )}
    </button>
  );
}
