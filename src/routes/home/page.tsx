import { Button } from "@sixthshift/design-system/button";
import { Heading } from "@sixthshift/design-system/heading";
import { Muted } from "@sixthshift/design-system/muted";
import { Link } from "@tanstack/react-router";
import { Page } from "../../components/shell/Page";
import { NextWeek } from "./components/NextWeek";
import { ShoppingGlance } from "./components/ShoppingGlance";
import { Tonight } from "./components/Tonight";
import { ToTry } from "./components/ToTry";
import { entryCount, isWeekend, nextMonday, todayTitle, tonightEntry, toTry } from "./components/today";
import { WeekGlance } from "./components/WeekGlance";
import { Route } from "./route";

/** How many never-made recipes Home offers: a row of chips, not a second library. */
const TO_TRY_LIMIT = 6;

/**
 * The day as it stands: tonight's meal and the way into cooking it, the week
 * at a glance, what is left to buy, whether next week is planned, and what has
 * been kept but never made. The place a glance lands; choosing from the whole
 * library is Recipes, planning a week is Plan.
 *
 * One brand fill (design-language rule 5): Start cooking, except at the
 * weekend while next week is empty, when planning it is the thing to do.
 */
export function HomePage() {
  const { today, monday, days, nextDays, toBuy, recipes } = Route.useLoaderData();
  const title = todayTitle(today);
  const tonight = tonightEntry(days.find((day) => day.date === today));
  const recipe = tonight?.recipe ? recipes.find((r) => r.id === tonight.recipe?.id) : undefined;
  const planNow = isWeekend(today) && entryCount(nextDays) === 0;
  const next = nextMonday(monday);

  return (
    <Page>
      <header className="flex flex-col gap-1">
        <Heading as="h1">{title.weekday}</Heading>
        <Muted as="p">{title.date}</Muted>
      </header>

      {planNow && (
        <section
          aria-labelledby="plan-now"
          className="flex flex-wrap items-center gap-4 rounded-xl border border-border-brand-subtle bg-bg-brand-subtle p-4 md:p-5"
        >
          <div className="flex min-w-0 flex-[1_1_16rem] flex-col gap-1">
            <h2 id="plan-now" className="font-display text-xl font-semibold">
              Next week isn't planned yet
            </h2>
            <p className="text-fg-on-brand-subtle">Weeknights from the rotation, then something for the weekend.</p>
          </div>
          <Button asChild intent="brand">
            <Link to="/plan" search={{ week: next }}>
              Plan next week
            </Link>
          </Button>
        </section>
      )}

      <div className="grid gap-6 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] md:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          <Tonight entry={tonight} totalTime={recipe?.totalTime ?? null} primary={!planNow} />
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <WeekGlance days={days} today={today} />
          <ShoppingGlance toBuy={toBuy} />
          {!planNow && <NextWeek monday={next} count={entryCount(nextDays)} />}
          <ToTry recipes={toTry(recipes, TO_TRY_LIMIT)} />
        </div>
      </div>
    </Page>
  );
}
