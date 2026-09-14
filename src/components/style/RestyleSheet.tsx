// "Restyle steps" (M37.6): the sheet the household approves a rewrite in.
//
// Two stages in one sheet. The first is the style guide as checkboxes, ticked
// from each statement's `enabled` — the guide is the household's standing
// answer, and a run may borrow a statement that is normally off ("Prefer
// metric") or drop one that is normally on without going to Settings to do it.
// Restyle then calls M37.4, which writes nothing.
//
// The second stage is the diff: per part, the author's step beside the
// rewrite (above it on a phone, where there is no room for two columns), and
// the facts check from M37.3 shown where it failed — the missing numbers and
// the dropped ingredients named, because "this rewrite lost the 180°C" is the
// only thing that makes a failed check actionable. A failed part starts
// unticked, so the default action on a bad rewrite is to keep the author's
// words; every other part starts ticked.
//
// The tick is per part rather than per step. The task line asked for one per
// rewritten step, and the rewrite is what makes that impossible to mean
// anything: statements (1) and (2) of the guide exist to split and merge
// steps, so a part's rewrite may have four steps where the original had six,
// and "keep step 3's original text" has no original step 3 to keep. What a
// part does have, always, is a before and an after. So the unit of acceptance
// is the part: ticked takes the rewrite whole, unticked keeps the author's
// steps whole, and `applyPayload` sends every part either way — which is also
// what `applyRestyle` expects, since it pairs parts by position.
//
// Apply goes to M37.5, which copies the author's steps into `source_steps`
// before replacing them. "Restore original steps" is the way back, offered
// whenever the recipe carries a `restyledAt` stamp — the document does not
// carry `source_steps`, but M37.5 sets and clears the two together, so the
// stamp is the same signal.
//
// Sheet only paints after mounting on the client, so everything renders from
// `RestyleSheetContent`, a plain function of its props, which is what the
// tests exercise.
import { Button } from "@sixthshift/design-system/button";
import { Checkbox } from "@sixthshift/design-system/checkbox";
import { Message } from "@sixthshift/design-system/message";
import { Muted } from "@sixthshift/design-system/muted";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import { Sheet } from "@sixthshift/design-system/sheet";
import { useEffect, useState } from "react";
import type { Recipe } from "../../domain/recipe/recipe";
import type { PartRestyleCheck, RestyleCheck, RestyledPart } from "../../domain/style/restyleCheck";
import type { StyleRule } from "../../domain/style/style";
import { useMutate } from "../../lib/mutate";
import { messageFrom, notify, notifyError } from "../../lib/notify";
import { applyRestyle, restoreSteps, restyleSteps } from "../../server/ai/restyle";
import { listStyleRules } from "../../server/fns/style";

/** What M37.4 answered, as the sheet holds it. */
export type RestyleAnswer = { parts: RestyledPart[]; check: RestyleCheck };

/** A part as the payload names it: the recipe's own name, and the steps to write. */
export type ApplyPart = { name: string; steps: string[] };

/** The ids of the statements that start ticked: the ones the guide has on. Pure. */
export function enabledRuleIds(rules: readonly StyleRule[]): string[] {
  return rules.filter((rule) => rule.enabled).map((rule) => rule.id);
}

/**
 * Which parts start accepted: every one whose facts check passed. A part that
 * lost a number or an ingredient starts unticked, so doing nothing to it keeps
 * the author's steps. Pure.
 */
export function initialTicked(check: RestyleCheck): Set<number> {
  return new Set(check.parts.flatMap((part, index) => (part.ok ? [index] : [])));
}

/**
 * What Apply sends M37.5: every part of the recipe, in the recipe's order,
 * with a ticked part taking the rewrite's steps and an unticked one keeping
 * its own. A part with no rewrite at all (which M37.4's part matching makes
 * impossible, but the type allows) keeps its own too. Pure.
 */
export function applyPayload(
  original: readonly { name: string; steps: readonly { text: string }[] }[],
  restyled: readonly RestyledPart[],
  ticked: ReadonlySet<number>,
): ApplyPart[] {
  return original.map((part, index) => {
    const rewrite = restyled[index];
    const keep = rewrite === undefined || !ticked.has(index);
    return { name: part.name, steps: keep ? part.steps.map((step) => step.text) : [...rewrite.steps] };
  });
}

/** How a part is headed in the diff. The unnamed part is the recipe's method. Pure. */
export function partHeading(name: string): string {
  return name.trim() === "" ? "Method" : name.trim();
}

/** The one line a failed part shows: what the rewrite dropped, named. Pure. */
export function missingLine(check: PartRestyleCheck): string {
  const bits: string[] = [];
  if (check.missingFacts.length > 0) bits.push(`dropped ${check.missingFacts.join(", ")}`);
  if (check.missingFoods.length > 0) bits.push(`no longer mentions ${check.missingFoods.join(", ")}`);
  return bits.length === 0 ? "The rewrite changed a fact." : `The rewrite ${bits.join(" and ")}.`;
}

export type RestyleSheetContentProps = {
  /** The recipe as the page holds it: the diff's "before" is its current steps. */
  recipe: Recipe;
  /** The guide, in order. Empty while it is still being read. */
  rules: readonly StyleRule[];
  /** The statements ticked for this run. */
  selected: ReadonlySet<string>;
  onToggleRule: (id: string) => void;
  /** M37.4's answer, or null while the sheet is still on the rules stage. */
  answer: RestyleAnswer | null;
  /** The part indices whose rewrite is accepted. */
  ticked: ReadonlySet<number>;
  onTogglePart: (index: number) => void;
  busy?: boolean;
  error?: string | null;
  onRestyle: () => void;
  onApply: (parts: ApplyPart[]) => void;
  onRestore: () => void;
  onBack: () => void;
  onCancel: () => void;
};

export function RestyleSheetContent(props: RestyleSheetContentProps) {
  const { recipe, rules, selected, onToggleRule, answer, ticked, busy = false, error = null } = props;
  // The only state the content owns: the one-line confirm behind Restore, which
  // is a question about the button beside it rather than about the sheet.
  const [confirmingRestore, setConfirmingRestore] = useState(false);

  return (
    <>
      <Sheet.Header>
        <h2 className="text-base font-medium">Restyle steps</h2>
      </Sheet.Header>
      <Sheet.Body>
        {answer === null ? (
          <div className="flex flex-col gap-4" data-testid="restyle-rules">
            <Muted as="p" className="text-sm">
              The steps are rewritten in the house style. Ingredients, quantities and parts are never touched.
            </Muted>
            {rules.length === 0 ? (
              <Muted as="p" className="text-sm">
                No style statements yet. Add some under Settings, Style.
              </Muted>
            ) : (
              <ul className="flex flex-col gap-2">
                {rules.map((rule) => {
                  const on = selected.has(rule.id);
                  return (
                    <li key={rule.id} className="flex items-start gap-2.5" data-testid="restyle-rule" data-on={on ? "true" : "false"}>
                      <Checkbox
                        checked={on}
                        disabled={busy}
                        className="mt-0.5"
                        aria-label={rule.text}
                        onCheckedChange={() => onToggleRule(rule.id)}
                      />
                      <button type="button" disabled={busy} className="flex-1 text-left text-sm" onClick={() => onToggleRule(rule.id)}>
                        {rule.text}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {recipe.restyledAt !== null && (
              <div className="flex flex-col gap-2 border-t border-border-subtle pt-4" data-testid="restyle-restore">
                {confirmingRestore ? (
                  <>
                    <p className="text-sm">The author's steps come back and this restyle is dropped.</p>
                    <div className="flex gap-2">
                      <Button type="button" variant="solid" intent="danger" size="sm" disabled={busy} onClick={props.onRestore}>
                        {busy ? "Restoring…" : "Restore"}
                      </Button>
                      <Button type="button" variant="ghost" intent="neutral" size="sm" disabled={busy} onClick={() => setConfirmingRestore(false)}>
                        Keep the restyle
                      </Button>
                    </div>
                  </>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    intent="neutral"
                    size="sm"
                    disabled={busy}
                    data-testid="restyle-restore-button"
                    onClick={() => setConfirmingRestore(true)}
                  >
                    Restore original steps
                  </Button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-6" data-testid="restyle-diff">
            <Muted as="p" className="text-sm">
              Tick a part to take its rewrite. An unticked part keeps the steps it has.
            </Muted>
            {recipe.parts.map((part, index) => {
              const rewrite = answer.parts[index];
              const check = answer.check.parts[index];
              const on = ticked.has(index);
              const rows = Math.max(part.steps.length, rewrite?.steps.length ?? 0);
              return (
                <section
                  key={part.id}
                  className="flex flex-col gap-3"
                  data-testid="restyle-part"
                  data-part={partHeading(part.name)}
                  data-ticked={on ? "true" : "false"}
                  aria-label={partHeading(part.name)}
                >
                  <div className="flex items-start gap-2.5">
                    <Checkbox
                      checked={on}
                      disabled={busy}
                      className="mt-0.5"
                      aria-label={`Use the rewrite for ${partHeading(part.name)}`}
                      onCheckedChange={() => props.onTogglePart(index)}
                    />
                    <SectionTitle as="h3">{partHeading(part.name)}</SectionTitle>
                  </div>
                  {check !== undefined && !check.ok && (
                    <Message intent="warning" title="Facts changed" data-testid="restyle-part-warning">
                      {missingLine(check)} It starts unticked; tick it only if the rewrite is right.
                    </Message>
                  )}
                  <ol className="flex flex-col gap-3">
                    {Array.from({ length: rows }, (_, row) => (
                      <li key={row} className="grid gap-2 md:grid-cols-2" data-testid="restyle-step">
                        <div className="text-sm text-fg-subtle" data-testid="restyle-step-before">
                          {part.steps[row]?.text ?? ""}
                        </div>
                        <div className="text-sm" data-testid="restyle-step-after">
                          {rewrite?.steps[row] ?? ""}
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>
              );
            })}
          </div>
        )}
        {error !== null && (
          <p className="mt-4 text-sm text-fg-danger" role="alert">
            {error}
          </p>
        )}
      </Sheet.Body>
      <Sheet.Footer>
        {answer === null ? (
          <>
            <Button type="button" variant="ghost" intent="neutral" disabled={busy} onClick={props.onCancel}>
              Cancel
            </Button>
            <Button type="button" variant="solid" intent="brand" disabled={busy} data-testid="restyle-run" onClick={props.onRestyle}>
              {busy ? "Restyling…" : "Restyle"}
            </Button>
          </>
        ) : (
          <>
            <Button type="button" variant="ghost" intent="neutral" disabled={busy} onClick={props.onBack}>
              Back
            </Button>
            <Button
              type="button"
              variant="solid"
              intent="brand"
              disabled={busy}
              data-testid="restyle-apply"
              onClick={() => props.onApply(applyPayload(recipe.parts, answer.parts, ticked))}
            >
              {busy ? "Applying…" : "Apply"}
            </Button>
          </>
        )}
      </Sheet.Footer>
    </>
  );
}

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      notify({ intent: "success", title: "Steps restyled" });
      close();
    } catch (cause) {
      notifyError("Couldn't apply the restyle", cause);
      setError(messageFrom(cause));
      setBusy(false);
    }
  };

  const restore = async () => {
    setBusy(true);
    setError(null);
    try {
      await mutate(() => restoreSteps({ data: { id: recipe.id } }));
      notify({ intent: "success", title: "Original steps restored" });
      close();
    } catch (cause) {
      notifyError("Couldn't restore the original steps", cause);
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
