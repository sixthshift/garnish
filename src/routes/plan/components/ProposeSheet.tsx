import { toast } from "@sixthshift/design-system/overlay";
import { Sheet } from "@sixthshift/design-system/sheet";
import { useState } from "react";
import type { Meal } from "../../../domain/plan";
import { messageFrom } from "../../../lib/errors";
import { useMutate } from "../../../lib/mutate";
import type { StorageLike } from "../../../lib/useLocalStorage";
import type { ProposedWeek } from "../../../server/ai/planner";
import { applyPlanProposal, proposePlanWeek } from "../../../server/fns/planner";
import { ProposeSheetContent } from "./ProposeSheetContent";
import {
  addedMealsMessage,
  applyPayload,
  initialTicked,
  proposalDays,
  readProposalDays,
  readProposalMeals,
  rememberedDays,
  tickedDates,
  toggleProposalDay,
  toggleProposalMeal,
  writeProposalDays,
  writeProposalMeals,
} from "./proposalSheet";

export type ProposeSheetProps = {
  open: boolean;
  /** The week being shown. The sheet is keyed by it, so walking the weeks starts a fresh one. */
  monday: string;
  onClose: () => void;
  /** Injected in tests, so neither the clock nor the browser's storage is a dependency. */
  today?: string;
  storage?: StorageLike;
};

/** `window.localStorage`, or undefined on the server and where it is unavailable. */
function browserStorage(): StorageLike | undefined {
  return typeof window === "undefined" ? undefined : window.localStorage;
}

/**
 * The sheet itself: the day and meal choices — both per-run and both
 * remembered on the device (decisions.md row 102) — the one call that
 * proposes, and the one that writes. Nothing is written until Add, and Add
 * goes through `useMutate` so the week behind the sheet redraws before it
 * closes. A failure of either call stays on screen with Try again beside it,
 * as the restyle's does.
 */
export function ProposeSheet({ open, monday, onClose, today, storage }: ProposeSheetProps) {
  const mutate = useMutate();
  const store = storage ?? browserStorage();
  const [days, setDays] = useState(() => proposalDays(monday, readProposalDays(store), today));
  const [meals, setMeals] = useState<Meal[]>(() => readProposalMeals(store));
  const [week, setWeek] = useState<ProposedWeek | null>(null);
  const [ticked, setTicked] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleDay = (index: number) => {
    const next = toggleProposalDay(days, index);
    setDays(next);
    writeProposalDays(store, rememberedDays(next));
  };

  const toggleMeal = (meal: Meal) => {
    const next = toggleProposalMeal(meals, meal);
    setMeals(next);
    writeProposalMeals(store, next);
  };

  const toggleRow = (key: string) =>
    setTicked((previous) => {
      const next = new Set(previous);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  const close = () => {
    setWeek(null);
    setTicked(new Set());
    setError(null);
    setBusy(false);
    onClose();
  };

  const propose = async () => {
    setBusy(true);
    setError(null);
    try {
      const answer = await proposePlanWeek({ data: { monday, dates: tickedDates(days), meals } });
      setWeek(answer);
      setTicked(initialTicked(answer));
    } catch (cause) {
      setError(messageFrom(cause));
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    if (week === null) return;
    const entries = applyPayload(week, ticked);
    setBusy(true);
    setError(null);
    try {
      await mutate(() => applyPlanProposal({ data: { entries } }));
      toast({ intent: "success", title: addedMealsMessage(entries.length) });
      close();
    } catch (cause) {
      setError(messageFrom(cause));
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(next) => !next && close()} size="md" closable aria-label="Propose a week">
      <ProposeSheetContent
        days={days}
        onToggleDay={toggleDay}
        meals={meals}
        onToggleMeal={toggleMeal}
        week={week}
        ticked={ticked}
        onToggleRow={toggleRow}
        busy={busy}
        error={error}
        onPropose={() => void propose()}
        onAdd={() => void add()}
        onCancel={close}
      />
    </Sheet>
  );
}
