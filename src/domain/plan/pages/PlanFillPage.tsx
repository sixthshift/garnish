import { Button } from "@sixthshift/design-system/button";
import { Muted } from "@sixthshift/design-system/muted";
import { toast } from "@sixthshift/design-system/overlay";
import { Steps } from "@sixthshift/design-system/steps";
import { getRouteApi, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { addPlanWeekToShopping } from "../../../api/rpc/plan";
import { applyPlanProposal, proposePlanWeek } from "../../../api/rpc/planner";
import { Page, PageHeader } from "../../../components/Page";
import { addedMessage } from "../../../lib/shopping";
import { toastError } from "../../../lib/toast";
import { browserStorage } from "../../../lib/useLocalStorage";
import {
  fillNights,
  fromProposal,
  missedRecipes,
  type OtherMeal,
  openDays,
  sessionEntries,
  swapPool,
  weekendShelf,
  weeknightPool,
} from "../components/fill/fill";
import { OtherMeals } from "../components/fill/OtherMeals";
import { PlannerBar, type PlannerStatus } from "../components/fill/PlannerBar";
import {
  readOtherMeals,
  readServings,
  readVegetarianNights,
  toggleMeal,
  writeOtherMeals,
  writeServings,
  writeVegetarianNights,
} from "../components/fill/plannerPrefs";
import { ReadyStep } from "../components/fill/ReadyStep";
import { VarietyBar } from "../components/fill/VarietyBar";
import { WeekendStep } from "../components/fill/WeekendStep";
import { WeeknightsStep } from "../components/fill/WeeknightsStep";
import { type Meal, slotPool, weekLabel } from "../plan";

const route = getRouteApi("/plan/fill");

const STEPS = [{ label: "Weeknights" }, { label: "Weekend" }, { label: "Ready" }] as const;

/**
 * Planning a week, the one way to fill one (decisions.md rows 192 and 194):
 * the open weeknights first, then the weekend, then the lot written to the
 * plan and the week added to the shopping list. Days that already hold
 * something are left as they are.
 *
 * The first pass is the model's when one is configured: it reads the planner
 * guide, the library with each recipe's kind, and what was eaten lately, and
 * proposes every open dinner (and breakfast or lunch, when asked) with a
 * reason. Without one, or when it fails, the weeknight recipes fill the weeknights in
 * its own order and the weekend waits to be chosen. Either way the same
 * screens follow: Swap, Night off, the weekend's choice.
 */
export function PlanFillPage() {
  const { today, monday, days, previousDays, recipes, plannerAvailable } = route.useLoaderData();
  const router = useRouter();

  const byId = useMemo(() => new Map(recipes.map((recipe) => [recipe.id, recipe])), [recipes]);
  const open = useMemo(() => openDays(monday, days, today), [monday, days, today]);
  // What did not happen comes back as a weeknight dinner, so only what can be one (a missed sauce stays missed).
  const carried = useMemo(() => slotPool(missedRecipes(previousDays, byId, today), "dinner"), [previousDays, byId, today]);
  const planned = useMemo(
    () => new Set([...previousDays, ...days].flatMap((day) => day.entries.flatMap((entry) => (entry.recipe ? [entry.recipe.id] : [])))),
    [previousDays, days]
  );
  // The first offer comes from the weeknight recipes alone; Swap falls back to every weeknight-able recipe when it is empty.
  const pool = useMemo(() => weeknightPool(recipes, planned), [recipes, planned]);
  const swaps = useMemo(() => swapPool(recipes, planned), [recipes, planned]);
  const shelf = useMemo(() => weekendShelf(recipes), [recipes]);

  const [step, setStep] = useState(0);
  const [vegetarianNights, setVegetarianNights] = useState(() => readVegetarianNights(browserStorage()));
  const [nights, setNights] = useState(() => fillNights(open.weeknights.length, carried, pool, vegetarianNights));
  const [weekend, setWeekend] = useState<(string | null)[]>(() => open.weekend.map(() => null));
  const [others, setOthers] = useState<OtherMeal[]>([]);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [otherMeals, setOtherMeals] = useState<Meal[]>(() => readOtherMeals(browserStorage()));
  const [servings, setServings] = useState(() => readServings(browserStorage()));
  const [addToList, setAddToList] = useState(true);
  const [busy, setBusy] = useState(false);
  const openDates = [...open.weeknights, ...open.weekend];
  const [planner, setPlanner] = useState<PlannerStatus>(plannerAvailable && openDates.length > 0 ? { state: "asking" } : { state: "off" });

  // The latest ask wins: an answer that arrives after a newer ask is dropped.
  const asked = useRef(0);
  const ask = async (meals: readonly Meal[], vegetarian = vegetarianNights) => {
    const run = ++asked.current;
    setPlanner({ state: "asking" });
    try {
      const week = await proposePlanWeek({ data: { monday, dates: openDates, meals: ["dinner", ...meals], vegetarianNights: vegetarian } });
      if (run !== asked.current) return;
      const first = fromProposal(week, open, [...carried, ...pool]);
      setNights(first.nights);
      setWeekend(first.weekend);
      setOthers(first.others);
      setReasons(first.reasons);
      setPlanner({ state: "done" });
    } catch (error) {
      if (run !== asked.current) return;
      setPlanner({ state: "failed", message: error instanceof Error ? error.message : String(error) });
    }
  };

  // The first pass, once, as the page opens. The ref holds it to once: in
  // development React mounts an effect twice, and each run is a model call.
  const started = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: asked once on open; Ask again is the way to ask again
  useEffect(() => {
    if (started.current || planner.state !== "asking") return;
    started.current = true;
    void ask(otherMeals);
  }, []);

  const entries = sessionEntries(open, nights, weekend, others);

  const save = async () => {
    setBusy(true);
    try {
      if (entries.length > 0) await applyPlanProposal({ data: { entries, servings } });
      if (addToList) {
        const { added } = await addPlanWeekToShopping({ data: { monday } });
        toast({ intent: "success", title: addedMessage(added), action: "View list", onAction: () => void router.navigate({ to: "/shopping" }) });
      }
      await router.invalidate();
      await router.navigate({ to: "/plan", search: { week: monday } });
    } catch (error) {
      toastError("Couldn't plan the week", error);
      setBusy(false);
    }
  };

  return (
    <Page width="focus">
      <PageHeader
        title="Plan the week"
        actions={
          <Button asChild variant="ghost" intent="neutral" size="sm">
            <Link to="/plan" search={{ week: monday }}>
              Cancel
            </Link>
          </Button>
        }
      />
      <Muted as="p" className="-mt-4">
        {weekLabel(monday)}
      </Muted>
      <Steps steps={STEPS} current={step} onStepClick={setStep} aria-label="Planning steps" />

      {step === 0 && (
        <>
          {planner.state !== "off" && (
            <PlannerBar
              status={planner}
              meals={otherMeals}
              onToggleMeal={(meal) => {
                const next = toggleMeal(otherMeals, meal);
                setOtherMeals(next);
                writeOtherMeals(browserStorage(), next);
              }}
              onAsk={() => void ask(otherMeals)}
            />
          )}
          <VarietyBar
            vegetarianNights={vegetarianNights}
            disabled={planner.state === "asking"}
            onChange={(next) => {
              setVegetarianNights(next);
              writeVegetarianNights(browserStorage(), next);
              // The planner is asked again with it; the weeknights' own week is filled again by it.
              if (planner.state === "off" || planner.state === "failed") setNights(fillNights(open.weeknights.length, carried, pool, next));
              else void ask(otherMeals, next);
            }}
          />
          <WeeknightsStep
            vegetarianNights={vegetarianNights}
            dates={open.weeknights}
            nights={nights}
            byId={byId}
            pool={swaps}
            carried={carried}
            today={today}
            reasons={reasons}
            source={planner.state === "done" ? "planner" : "weeknight"}
            weeknightsEmpty={pool.length === 0}
            choosing={planner.state === "asking"}
            onChange={setNights}
          />
          {planner.state !== "asking" && <OtherMeals others={others} byId={byId} reasons={reasons} onChange={setOthers} />}
        </>
      )}
      {step === 1 && <WeekendStep dates={open.weekend} chosen={weekend} shelf={shelf} byId={byId} reasons={reasons} onChange={setWeekend} />}
      {step === 2 && (
        <ReadyStep
          monday={monday}
          days={days}
          entries={entries}
          byId={byId}
          servings={servings}
          onServingsChange={(next) => {
            setServings(next);
            writeServings(browserStorage(), next);
          }}
          addToList={addToList}
          onAddToListChange={setAddToList}
        />
      )}

      <div className="flex items-center justify-between gap-2">
        {step > 0 ? (
          <Button type="button" variant="outline" intent="neutral" onClick={() => setStep(step - 1)} disabled={busy}>
            Back
          </Button>
        ) : (
          <span />
        )}
        {step < 2 ? (
          <Button type="button" intent="brand" onClick={() => setStep(step + 1)} disabled={planner.state === "asking"}>
            Next
          </Button>
        ) : (
          <Button type="button" intent="brand" onClick={() => void save()} disabled={busy || (entries.length === 0 && !addToList)}>
            {entries.length === 0 ? "Done" : `Add ${entries.length} to the plan`}
          </Button>
        )}
      </div>
    </Page>
  );
}
