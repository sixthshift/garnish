import { Button } from "@sixthshift/design-system/button";
import { Muted } from "@sixthshift/design-system/muted";
import { toast } from "@sixthshift/design-system/overlay";
import { Steps } from "@sixthshift/design-system/steps";
import { Link, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Page, PageHeader } from "../../../components/shell/Page";
import { type Meal, weekLabel } from "../../../domain/plan";
import { addedMessage } from "../../../lib/shopping";
import { toastError } from "../../../lib/toast";
import { browserStorage } from "../../../lib/useLocalStorage";
import { addPlanWeekToShopping } from "../../../server/fns/plan";
import { applyPlanProposal, proposePlanWeek } from "../../../server/fns/planner";
import { fillNights, fromProposal, missedRecipes, type OtherMeal, openDays, rotationPool, sessionEntries, weekendShelf } from "./components/fill";
import { OtherMeals } from "./components/OtherMeals";
import { PlannerBar, type PlannerStatus } from "./components/PlannerBar";
import { readOtherMeals, readServings, toggleMeal, writeOtherMeals, writeServings } from "./components/plannerPrefs";
import { ReadyStep } from "./components/ReadyStep";
import { WeekendStep } from "./components/WeekendStep";
import { WeeknightsStep } from "./components/WeeknightsStep";
import { Route } from "./route";

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
 * reason. Without one, or when it fails, the rotation fills the weeknights in
 * its own order and the weekend waits to be chosen. Either way the same
 * screens follow: Swap, Night off, the weekend's choice.
 */
export function PlanFillPage() {
  const { today, monday, days, previousDays, recipes, plannerAvailable } = Route.useLoaderData();
  const router = useRouter();

  const byId = useMemo(() => new Map(recipes.map((recipe) => [recipe.id, recipe])), [recipes]);
  const open = useMemo(() => openDays(monday, days, today), [monday, days, today]);
  const carried = useMemo(() => missedRecipes(previousDays, byId, today), [previousDays, byId, today]);
  const pool = useMemo(() => {
    const planned = [...previousDays, ...days].flatMap((day) => day.entries.flatMap((entry) => (entry.recipe ? [entry.recipe.id] : [])));
    return rotationPool(recipes, new Set(planned));
  }, [recipes, previousDays, days]);
  const shelf = useMemo(() => weekendShelf(recipes), [recipes]);

  const [step, setStep] = useState(0);
  const [nights, setNights] = useState(() => fillNights(open.weeknights.length, carried, pool));
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
  const ask = async (meals: readonly Meal[]) => {
    const run = ++asked.current;
    setPlanner({ state: "asking" });
    try {
      const week = await proposePlanWeek({ data: { monday, dates: openDates, meals: ["dinner", ...meals] } });
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

  // The first pass, once, as the page opens.
  // biome-ignore lint/correctness/useExhaustiveDependencies: asked once on open; Ask again is the way to ask again
  useEffect(() => {
    if (planner.state === "asking") void ask(otherMeals);
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
          {planner.state !== "asking" && (
            <>
              <WeeknightsStep
                dates={open.weeknights}
                nights={nights}
                byId={byId}
                pool={pool}
                carried={carried}
                today={today}
                reasons={reasons}
                onChange={setNights}
              />
              <OtherMeals others={others} byId={byId} reasons={reasons} onChange={setOthers} />
            </>
          )}
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
