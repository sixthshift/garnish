import { Button } from "@sixthshift/design-system/button";
import { Heading } from "@sixthshift/design-system/heading";
import { cn } from "@sixthshift/design-system/utils";
import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Page } from "../../../../../components/Page";
import { addDays, dayName, nextMonday, type PlanDay, todayIso, weekLabel } from "../../../plan";
import { AddWeekToShoppingButton } from "../AddWeekToShoppingButton";
import type { PlanWeekViewProps } from "../PlanWeekView";
import { useRecipeMinutes, useShelfRecipes } from "../shelf";
import { WeekArrow } from "../WeekArrow";
import { PhoneDay, phoneDayId } from "./PhoneDay";
import { PlanAddSheet } from "./PlanAddSheet";

/** Smooth unless the reader asked for less motion. */
function scrollBehaviour(): ScrollBehavior {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

/** Bring a day's section up under the sticky header (its `scroll-margin-top` leaves the header's room). */
function scrollToDay(date: string, behavior: ScrollBehavior) {
  document.getElementById(phoneDayId(date))?.scrollIntoView({ block: "start", behavior });
}

/**
 * A phone's plan (decisions.md row 208, the Phone half of
 * `docs/mockups/desktop.html`): one scrolling page of days, the chosen week
 * and then the next (the loader's `nextDays`), under a header that sticks:
 * the title, the week's arrows and its span, and the week's seven days as
 * buttons that bring a day up, with a dot on a day that has something on it
 * and today filled. The page opens at today, when today is in the week shown.
 *
 * Each entry is a card that swipes: right pushes it to the next day, left
 * takes it off; its menu does both too, and moves it anywhere or up and down
 * its day (the drag handles a phone's rows had are gone, since a sideways
 * finger is now the swipe's). A day's "+ Add" opens the add sheet, which
 * stays open for the next. When next week still has empty nights, a pill
 * floats over the foot of the page to fill them.
 */
export function PlanPhone({
  monday,
  days,
  nextDays = [],
  today = todayIso(),
  onAddText,
  onAddRecipe,
  onMove,
  onRemove,
  searchRecipes,
  shelfRecipes,
  busy = false,
}: PlanWeekViewProps) {
  const [adding, setAdding] = useState<string | null>(null);
  const recipes = useShelfRecipes(shelfRecipes);
  const minutes = useRecipeMinutes(recipes);
  const allDays = useMemo(() => [...days, ...nextDays], [days, nextDays]);
  const following = nextMonday(monday);
  const emptyNights = nextDays.filter((day) => day.entries.length === 0).length;
  const thisWeek = days.some((day) => day.date === today);
  const addingDay = allDays.find((day) => day.date === adding);

  // Open at today. Only from the top of the page: a page the router has
  // scrolled back to where it was left (Back from a recipe) stays there. A
  // frame late, so the router's own scroll for a new address has happened.
  useEffect(() => {
    if (!thisWeek) return;
    const frame = requestAnimationFrame(() => {
      if (window.scrollY === 0) scrollToDay(today, "auto");
    });
    return () => cancelAnimationFrame(frame);
  }, [thisWeek, today]);

  const day = (one: PlanDay) => (
    <PhoneDay key={one.date} day={one} allDays={allDays} today={today} busy={busy} minutes={minutes} onAdd={setAdding} onMove={onMove} onRemove={onRemove} />
  );

  return (
    <Page width="focus" className="gap-5 pt-0" data-testid="plan-phone">
      <div
        className="sticky top-0 z-10 -mx-4 flex flex-col gap-3 border-border-subtle border-b bg-bg-subtle px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3"
        data-testid="plan-head"
      >
        <div className="flex items-center gap-1" data-page-header="">
          <Heading as="h1" className="min-w-0 flex-1">
            Plan
          </Heading>
          <WeekArrow monday={addDays(monday, -7)} label="Previous week" glyph="‹" />
          <p className="px-1 text-center font-medium text-sm" data-testid="plan-week-label">
            {weekLabel(monday)}
          </p>
          <WeekArrow monday={addDays(monday, 7)} label="Next week" glyph="›" />
        </div>
        <nav aria-label="Days of the week">
          <ul className="grid grid-cols-7 gap-1.5">
            {days.map((one) => {
              const marked = one.date === today;
              const planned = one.entries.length > 0;
              return (
                <li key={one.date}>
                  <button
                    type="button"
                    data-testid="plan-day-button"
                    aria-label={`${dayName(one.date)}${planned ? ", planned" : ""}`}
                    aria-current={marked ? "date" : undefined}
                    onClick={() => scrollToDay(one.date, scrollBehaviour())}
                    className={cn(
                      "flex w-full flex-col items-center gap-px rounded-xl border pt-1.5 pb-2",
                      marked ? "border-transparent bg-bg-brand text-fg-on-brand" : "border-border-subtle bg-bg-normal text-fg-normal"
                    )}
                  >
                    <span aria-hidden="true" className={cn("font-semibold text-[11px]", !marked && "text-fg-subtle")}>
                      {dayName(one.date).charAt(0)}
                    </span>
                    <span aria-hidden="true" className="font-semibold text-base leading-tight">
                      {Number(one.date.slice(8))}
                    </span>
                    {/* The dot is the brand on a plain button and the button's own text colour on today's filled one. */}
                    <span
                      aria-hidden="true"
                      data-testid={planned ? "plan-day-dot" : undefined}
                      className={cn("size-1.5 rounded-full", planned ? (marked ? "bg-current" : "bg-bg-brand") : "bg-transparent")}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      <p className="-mb-2 text-fg-subtle text-xs">Swipe an entry right to push it a day, left to remove it.</p>

      <ol className="flex flex-col gap-5" data-testid="plan-week" aria-label={`Week of ${weekLabel(monday)}`}>
        {days.map((one) => (
          <li key={one.date}>{day(one)}</li>
        ))}
      </ol>

      <div className="flex flex-wrap gap-2" data-testid="plan-week-actions">
        {/* The week's empty nights, filled from the rotation and the weekend recipes (decisions.md row 192). Gone once the week is over. */}
        {addDays(monday, 6) >= today && (
          <Button asChild variant="outline" intent="neutral" size="sm">
            <Link to="/plan/fill" search={{ week: monday }}>
              Plan the week
            </Link>
          </Button>
        )}
        <AddWeekToShoppingButton monday={monday} />
      </div>

      {nextDays.length > 0 && (
        <section aria-labelledby="plan-next-week" className="flex flex-col gap-5">
          <h2 id="plan-next-week" className="font-semibold text-fg-normal text-lg">
            Next week · {weekLabel(following)}
          </h2>
          <ol className="flex flex-col gap-5" data-testid="plan-next-week" aria-label={`Next week, ${weekLabel(following)}`}>
            {nextDays.map((one) => (
              <li key={one.date}>{day(one)}</li>
            ))}
          </ol>
        </section>
      )}

      {/* Only while that week is still to come: a week long gone is not one to fill (as Plan the week). */}
      {emptyNights > 0 && addDays(following, 6) >= today && (
        // Over the foot of the page as it scrolls, clear of the tab bar; it comes to rest after the last day.
        <div
          className="pointer-events-none sticky bottom-[calc(var(--app-bar)+var(--app-bar-rise,0px)+0.75rem)] z-10 flex justify-center"
          data-testid="plan-fill-next"
        >
          <Button asChild variant="solid" intent="brand" className="pointer-events-auto rounded-full px-5 shadow-lg">
            <Link to="/plan/fill" search={{ week: following }}>
              <span aria-hidden="true">✦</span> Fill next week’s {emptyNights === 1 ? "empty night" : `${emptyNights} empty nights`}
            </Link>
          </Button>
        </div>
      )}

      {adding !== null && (
        <PlanAddSheet
          date={adding}
          busy={busy}
          planned={addingDay?.entries ?? []}
          recipes={recipes}
          onClose={() => setAdding(null)}
          searchRecipes={searchRecipes}
          onAddText={onAddText}
          onAddRecipe={onAddRecipe}
        />
      )}
    </Page>
  );
}
