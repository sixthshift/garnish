import { cn } from "@sixthshift/design-system/utils";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { RecipeLink } from "../../../../components/recipe/RecipeLink";
import { recipeImageUrl } from "../../../../lib/images";
import { dayName, dayParts, entryLabel, type PlanDay } from "../../../plan/plan";
import { shortDay, tonightEntry } from "../../home";
import { Photo, PLACEHOLDER } from "../Photo";
import { HomeSectionHead } from "./HomeSectionHead";

/** One day's card: a thumb's width, tall enough for a photo and three lines of name. */
const CARD = "relative flex h-37 w-27 shrink-0 snap-start flex-col overflow-hidden rounded-xl";
/** A day with nothing on it, or only a note: dashed, so it reads as a gap rather than a dish. */
const DASHED = "items-center justify-center gap-0.5 border-[1.5px] border-dashed border-border-normal px-2 text-center text-fg-subtle";

/**
 * This week on a phone, as a strip of day cards to flick through sideways,
 * snapping card by card: each day's meal (the one Home calls the evening's,
 * as Tonight does) with its photo, a note in italics, or, on a day still to
 * come, a dashed "+" that opens the add sheet for that day (`onPlan`). Today
 * is outlined and the strip opens scrolled to it; days gone by step back. A
 * recipe opens its page.
 */
export function WeekStrip({ days, today, onPlan }: { days: readonly PlanDay[]; today: string; onPlan: (date: string) => void }) {
  const strip = useRef<HTMLUListElement>(null);

  // Open at today, so a Sunday does not land on Monday's card; once, not on
  // every reload, so a flick back to Monday stays where it was put.
  useEffect(() => {
    const list = strip.current;
    const card = list?.querySelector<HTMLElement>('[aria-current="date"]');
    if (!list || !card) return;
    list.scrollLeft = card.offsetLeft - Number.parseFloat(getComputedStyle(list).paddingLeft || "0");
  }, []);

  return (
    <section aria-labelledby="this-week" className="flex flex-col gap-2.5">
      <HomeSectionHead
        id="this-week"
        title="This week"
        action={
          <Link to="/plan" aria-label="Open the plan" className="py-1 text-sm font-semibold text-fg-brand hover:text-fg-brand-hovered">
            Plan <span aria-hidden="true">→</span>
          </Link>
        }
      />
      <ul
        ref={strip}
        className="relative -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-2.5 overflow-x-auto px-4 pt-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {days.map((day) => {
          const isToday = day.date === today;
          const past = day.date < today;
          const entry = tonightEntry(day);
          const more = day.entries.length - 1;
          const card = cn(CARD, past && "opacity-70 saturate-[.6]");
          const when = <span className="text-[11px] font-semibold uppercase tracking-wider opacity-90">{isToday ? "Today" : shortDay(day.date)}</span>;
          const extra = more > 0 && <span className="text-xs opacity-80">and {more} more</span>;

          let inner: React.ReactNode;
          if (entry === null) {
            inner = past ? (
              <div className={cn(card, DASHED)}>
                {when}
                <span aria-hidden="true">—</span>
              </div>
            ) : (
              <button type="button" aria-label={`Plan ${dayName(day.date)}`} onClick={() => onPlan(day.date)} className={cn(card, DASHED)}>
                <span aria-hidden="true" className="text-[11px] font-semibold uppercase tracking-wider">
                  {isToday ? "Today" : dayParts(day.date).weekday}
                </span>
                <span aria-hidden="true" className="text-2xl leading-none text-fg-brand">
                  +
                </span>
              </button>
            );
          } else if (entry.recipe === null) {
            inner = (
              <div className={cn(card, DASHED, "text-fg-normal")}>
                {when}
                <span className="line-clamp-3 text-sm italic leading-snug">{entry.text}</span>
                {extra}
              </div>
            );
          } else {
            const image = recipeImageUrl(entry.recipe.image);
            inner = (
              <RecipeLink
                slug={entry.recipe.slug}
                choices={entry.choices}
                servings={entry.servings ?? undefined}
                className={cn(card, "justify-end", image === null ? `${PLACEHOLDER} text-fg-normal` : "text-white")}
              >
                {image !== null && (
                  <>
                    <Photo src={image} className="absolute inset-0 size-full" />
                    <span aria-hidden="true" className="absolute inset-0 bg-linear-to-b from-transparent from-30% to-[rgb(20_12_8/.78)]" />
                  </>
                )}
                <span className="relative flex min-w-0 flex-col p-2.5">
                  {when}
                  <span className="line-clamp-3 text-[13px] font-medium leading-tight">{entryLabel(entry)}</span>
                  {extra}
                </span>
              </RecipeLink>
            );
          }
          return (
            <li key={day.date} aria-current={isToday ? "date" : undefined} className="relative shrink-0">
              {inner}
              {/* Today's outline drawn over the card, since an inset outline would sit under the photo. */}
              {isToday && <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-xl border-3 border-border-brand" />}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
