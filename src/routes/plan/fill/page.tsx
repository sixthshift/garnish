import { Button } from "@sixthshift/design-system/button";
import { Muted } from "@sixthshift/design-system/muted";
import { toast } from "@sixthshift/design-system/overlay";
import { Steps } from "@sixthshift/design-system/steps";
import { Link, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Page, PageHeader } from "../../../components/shell/Page";
import { weekLabel } from "../../../domain/plan";
import { addedMessage } from "../../../lib/shopping";
import { toastError } from "../../../lib/toast";
import { addPlanEntry, addPlanWeekToShopping } from "../../../server/fns/plan";
import { fillNights, missedRecipes, openDays, rotationPool, weekendShelf } from "./components/fill";
import { ReadyStep } from "./components/ReadyStep";
import { WeekendStep } from "./components/WeekendStep";
import { WeeknightsStep } from "./components/WeeknightsStep";
import { Route } from "./route";

const STEPS = [{ label: "Weeknights" }, { label: "Weekend" }, { label: "Ready" }] as const;

/**
 * Planning a week at the weekend, without a model: the open weeknights filled
 * from the rotation (what did not happen last week first, then the longest
 * since made), each swappable or a night off; then a weekend recipe chosen
 * for each open weekend day; then the lot written to the plan as dinners, and
 * the week added to the shopping list. Days that already hold something are
 * left as they are (decisions.md row 192).
 */
export function PlanFillPage() {
  const { today, monday, days, previousDays, recipes } = Route.useLoaderData();
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
  const [addToList, setAddToList] = useState(true);
  const [busy, setBusy] = useState(false);

  const chosen = [...open.weeknights.map((date, i) => ({ date, id: nights[i] ?? null })), ...open.weekend.map((date, i) => ({ date, id: weekend[i] ?? null }))];
  const toWrite = chosen.flatMap(({ date, id }) => {
    const recipe = id === null ? undefined : byId.get(id);
    return recipe ? [{ date, recipe }] : [];
  });

  const save = async () => {
    setBusy(true);
    try {
      for (const { date, recipe } of toWrite) await addPlanEntry({ data: { date, recipeId: recipe.id, text: recipe.name, meal: "dinner" } });
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

      {step === 0 && <WeeknightsStep dates={open.weeknights} nights={nights} byId={byId} pool={pool} carried={carried} today={today} onChange={setNights} />}
      {step === 1 && <WeekendStep dates={open.weekend} chosen={weekend} shelf={shelf} onChange={setWeekend} />}
      {step === 2 && <ReadyStep monday={monday} days={days} chosen={chosen} byId={byId} addToList={addToList} onAddToListChange={setAddToList} />}

      <div className="flex items-center justify-between gap-2">
        {step > 0 ? (
          <Button type="button" variant="outline" intent="neutral" onClick={() => setStep(step - 1)} disabled={busy}>
            Back
          </Button>
        ) : (
          <span />
        )}
        {step < 2 ? (
          <Button type="button" intent="brand" onClick={() => setStep(step + 1)}>
            Next
          </Button>
        ) : (
          <Button type="button" intent="brand" onClick={() => void save()} disabled={busy || (toWrite.length === 0 && !addToList)}>
            {toWrite.length === 0 ? "Done" : `Add ${toWrite.length} to the plan`}
          </Button>
        )}
      </div>
    </Page>
  );
}
