import { Heading } from "@sixthshift/design-system/heading";
import { Muted } from "@sixthshift/design-system/muted";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Page } from "../../../../components/Page";
import { PlanAddSheet } from "../../../plan/components/week/mobile/PlanAddSheet";
import { isWeekend, type Meal, nextMonday, type PlanEntry } from "../../../plan/plan";
import type { RecipeSummary } from "../../../recipes/recipe";
import { entryCount, type HomeData, longestSinceMade, todayTitle, tonightEntry, toTry } from "../../home";
import { HaventMade } from "./HaventMade";
import { NextWeekLine, PlanNextWeekCard } from "./NextWeekCard";
import { ShoppingCard } from "./ShoppingCard";
import { TonightHero } from "./TonightHero";
import { ToTryStories } from "./ToTryStories";
import { WeekStrip } from "./WeekStrip";

/** How many of each list Home holds: a glance, not a second library. */
const TO_TRY_LIMIT = 12;
const A_WHILE_LIMIT = 3;

/** What goes on a day from the add sheet: a recipe or a line of text. */
export type PlanChoice = { recipe: RecipeSummary } | { text: string };

/** What a phone's Home does to the plan, wired to the server by the page and faked by a test. */
export type PhoneHomeActions = {
  busy: boolean;
  searchRecipes?: (query: string) => Promise<RecipeSummary[]>;
  /** Put a recipe or a line on a day: an empty day's "+", or Plan tonight. */
  onAdd: (date: string, choice: PlanChoice, meal: Meal | null) => void;
  /** Put a recipe or a line in `entry`'s place on its day: Swap. */
  onSwap: (entry: PlanEntry, choice: PlanChoice, meal: Meal | null) => void;
};

/** Which day the add sheet is open for, and the entry it swaps out when it was opened by Swap. */
type Adding = { date: string; swapping: PlanEntry | null };

/**
 * Home on a phone (decisions.md row 208): tonight's dish filling the screen,
 * the week as a strip to flick, the shopping list a tap from Start, the call
 * to plan next week when it is due, To try as circles, and the regulars not
 * made in a while. Settings is the gear at the top, not a tab.
 *
 * An empty day's "+", Plan tonight and Swap open the plan's own add sheet for
 * that day, so a meal is planned from Home the way it is from Plan.
 */
export function PhoneHome({ today, monday, days, nextDays, items, recipes, busy, searchRecipes, onAdd, onSwap }: HomeData & PhoneHomeActions) {
  const [adding, setAdding] = useState<Adding | null>(null);
  const title = todayTitle(today);
  const tonight = tonightEntry(days.find((day) => day.date === today));
  const recipe = tonight?.recipe ? recipes.find((r) => r.id === tonight.recipe?.id) : undefined;
  const planNow = isWeekend(today) && entryCount(nextDays) === 0;
  const next = nextMonday(monday);

  const choose = (date: string, choice: PlanChoice, meal: Meal | null) => {
    const swapping = adding?.swapping ?? null;
    // A swap keeps the meal it replaces unless another is chosen in the sheet.
    // The plan's sheet stays open for the next add (row 208), but a swap is one choice: the entry it replaces is gone after it.
    if (swapping !== null) {
      onSwap(swapping, choice, meal ?? swapping.meal);
      setAdding(null);
    } else onAdd(date, choice, meal);
  };

  return (
    <Page width="focus" className="gap-5">
      <header className="flex items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <Muted as="p" className="text-sm">
            {title.date}
          </Muted>
          <Heading as="h1">{title.weekday}</Heading>
        </div>
        <Link
          to="/settings"
          aria-label="Settings"
          className="grid size-11 shrink-0 place-items-center rounded-full border border-border-subtle bg-bg-normal text-fg-normal hover:bg-bg-normal-hovered"
        >
          <GearIcon />
        </Link>
      </header>

      <TonightHero
        entry={tonight}
        totalTime={recipe?.totalTime ?? null}
        primary={!planNow}
        onSwap={(entry) => setAdding({ date: today, swapping: entry })}
        onPlan={() => setAdding({ date: today, swapping: null })}
      />
      <WeekStrip days={days} today={today} onPlan={(date) => setAdding({ date, swapping: null })} />
      <ShoppingCard items={items} />
      {planNow ? <PlanNextWeekCard monday={next} /> : <NextWeekLine monday={next} count={entryCount(nextDays)} />}
      <ToTryStories recipes={toTry(recipes, TO_TRY_LIMIT)} />
      <HaventMade recipes={longestSinceMade(recipes, today, A_WHILE_LIMIT)} today={today} />

      {adding !== null && (
        <PlanAddSheet
          date={adding.date}
          busy={busy}
          planned={[...days, ...nextDays].find((day) => day.date === adding.date)?.entries ?? []}
          recipes={recipes}
          onClose={() => setAdding(null)}
          searchRecipes={searchRecipes}
          onAddText={(date, text, meal) => choose(date, { text }, meal)}
          onAddRecipe={(date, chosen, meal) => choose(date, { recipe: chosen }, meal)}
        />
      )}
    </Page>
  );
}

/** A cog: Settings, which on a phone lives here rather than in the tab bar (decisions.md row 208). */
function GearIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}
