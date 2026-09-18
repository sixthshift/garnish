import { toast } from "@sixthshift/design-system/overlay";
import { Sheet } from "@sixthshift/design-system/sheet";
import { useEffect, useState } from "react";
import type { Recipe } from "../../../../domain/recipe";
import type { StyleRule } from "../../../../domain/style";
import { messageFrom } from "../../../../lib/errors";
import { useMutate } from "../../../../lib/mutate";
import { toastError } from "../../../../lib/toast";
import { applyRestyle, restoreSteps, restyleSteps } from "../../../../server/ai/restyle";
import { listStyleRules } from "../../../../server/fns/style";
import { RestyleSheetContent } from "./RestyleSheetContent";
import { type ApplyPart, enabledRuleIds, initialTicked, type RestyleAnswer } from "./restylePayload";

export type RestyleSheetProps = {
  open: boolean;
  recipe: Recipe;
  onClose: () => void;
  /** Override the guide read and the three calls (tests). */
  loadRules?: () => Promise<StyleRule[]>;
};

/**
 * The sheet itself: the guide read once when it opens, the run, the diff, and
 * the two writes. Each write goes through `useMutate`, so the recipe page
 * re-reads and the diff's "before" is never stale.
 */
export function RestyleSheet({ open, recipe, onClose, loadRules }: RestyleSheetProps) {
  const mutate = useMutate();
  const [rules, setRules] = useState<StyleRule[]>([]);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [answer, setAnswer] = useState<RestyleAnswer | null>(null);
  const [ticked, setTicked] = useState<ReadonlySet<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The guide is read when the sheet opens rather than by the page's loader:
  // a recipe nobody restyles should not pay for it on every view.
  // biome-ignore lint/correctness/useExhaustiveDependencies: opening is the trigger; loadRules is a test seam passed inline, so depending on it would re-read the guide on every render.
  useEffect(() => {
    if (!open) return;
    let stale = false;
    setBusy(true);
    setError(null);
    (loadRules ?? (() => listStyleRules()))()
      .then((loaded) => {
        if (stale) return;
        setRules(loaded);
        setSelected(new Set(enabledRuleIds(loaded)));
        setBusy(false);
      })
      .catch((cause: unknown) => {
        if (stale) return;
        setError(messageFrom(cause));
        setBusy(false);
      });
    return () => {
      stale = true;
    };
  }, [open]);

  const close = () => {
    setAnswer(null);
    setError(null);
    setBusy(false);
    onClose();
  };

  const toggleRule = (id: string) =>
    setSelected((previous) => {
      const next = new Set(previous);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const togglePart = (index: number) =>
    setTicked((previous) => {
      const next = new Set(previous);
      if (!next.delete(index)) next.add(index);
      return next;
    });

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await restyleSteps({ data: { id: recipe.id, ruleIds: [...selected] } });
      setAnswer(result);
      setTicked(initialTicked(result.check));
    } catch (cause) {
      setError(messageFrom(cause));
    } finally {
      setBusy(false);
    }
  };

  const apply = async (parts: ApplyPart[]) => {
    setBusy(true);
    setError(null);
    try {
      await mutate(() => applyRestyle({ data: { id: recipe.id, parts } }));
      toast({ intent: "success", title: "Steps restyled" });
      close();
    } catch (cause) {
      toastError("Couldn't apply the restyle", cause);
      setError(messageFrom(cause));
      setBusy(false);
    }
  };

  const restore = async () => {
    setBusy(true);
    setError(null);
    try {
      await mutate(() => restoreSteps({ data: { id: recipe.id } }));
      toast({ intent: "success", title: "Original steps restored" });
      close();
    } catch (cause) {
      toastError("Couldn't restore the original steps", cause);
      setError(messageFrom(cause));
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(next) => !next && close()} size="md" closable aria-label="Restyle steps">
      <RestyleSheetContent
        recipe={recipe}
        rules={rules}
        selected={selected}
        onToggleRule={toggleRule}
        answer={answer}
        ticked={ticked}
        onTogglePart={togglePart}
        busy={busy}
        error={error}
        onRestyle={() => void run()}
        onApply={(parts) => void apply(parts)}
        onRestore={() => void restore()}
        onBack={() => setAnswer(null)}
        onCancel={close}
      />
    </Sheet>
  );
}
