import { Heading } from "@sixthshift/design-system/heading";
import { Muted } from "@sixthshift/design-system/muted";
import { Page } from "../../../../components/Page";
import { nightsPlanned } from "../../../plan/plan";
import { type HomeData, homeToday, longestSinceMade, toTry } from "../../home";
import { HaventMadeTile, RecentlyAddedTile, ToTryTile } from "./RecipeTiles";
import { ShoppingTile } from "./ShoppingTile";
import { TonightTile } from "./TonightTile";
import { WeekRibbon } from "./WeekRibbon";
import { NextWeekTile, PlanNextWeekTile } from "./WeekTiles";

/** How many of each list a tile holds: what fits its rows, not a second library. */
const A_WHILE_LIMIT = 4;
const TO_TRY_LIMIT = 12;
const RECENT_LIMIT = 3;

/**
 * Home on a desktop (decisions.md row 207): the day as tiles that reflow with
 * the width, from three columns at 1024 to eight at 2560. Each tile asks for
 * its columns and rows of 118px, and the grid packs them densely, so a tile
 * left out (nothing to try, next week already being planned) leaves no hole.
 * The week runs across the top; Tonight is the largest tile.
 */
export function HomeBento({ today, monday, days, nextDays, toBuy, items, recipes }: HomeData) {
  const { title, tonight, recipe, planNow, next } = homeToday({ today, monday, days, nextDays, recipes });
  const planned = nightsPlanned(days);
  const summary = [title.date, `${planned} of 7 nights planned`, toBuy === null ? null : toBuy === 1 ? "1 thing to buy" : `${toBuy} things to buy`].filter(
    Boolean
  );

  return (
    <Page width="full">
      <header className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <Heading as="h1">{title.weekday}</Heading>
        <Muted as="p">{summary.join(" · ")}</Muted>
      </header>
      <div className="grid grid-flow-dense auto-rows-[118px] grid-cols-[repeat(auto-fill,minmax(290px,1fr))] gap-4">
        <WeekRibbon days={days} today={today} />
        <TonightTile entry={tonight} totalTime={recipe?.totalTime ?? null} primary={!planNow} />
        <ShoppingTile items={items} />
        {planNow ? <PlanNextWeekTile monday={next} /> : <NextWeekTile monday={next} days={nextDays} />}
        <HaventMadeTile recipes={longestSinceMade(recipes, today, A_WHILE_LIMIT)} today={today} />
        <ToTryTile recipes={toTry(recipes, TO_TRY_LIMIT)} />
        <RecentlyAddedTile recipes={recipes.slice(0, RECENT_LIMIT)} />
      </div>
    </Page>
  );
}
