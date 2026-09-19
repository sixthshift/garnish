import { Button } from "@sixthshift/design-system/button";
import { Checkbox } from "@sixthshift/design-system/checkbox";
import { Message } from "@sixthshift/design-system/message";
import { Muted } from "@sixthshift/design-system/muted";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import { Sheet } from "@sixthshift/design-system/sheet";
import { useState } from "react";
import { formatIngredient } from "../../../../domain/ingredient";
import type { Part, Recipe } from "../../../../domain/recipe";
import type { RestyledPart, StyleRule } from "../../../../domain/style";
import { type ApplyPart, applyPayload, missingLine, partHeading, type RestyleAnswer } from "./restylePayload";

export type RestyleSheetContentProps = {
  /** The recipe as the page holds it: the diff's "before" is its current steps. */
  recipe: Recipe;
  /** The guide, in order. Empty while it is still being read. */
  rules: readonly StyleRule[];
  /** The statements ticked for this run. */
  selected: ReadonlySet<string>;
  onToggleRule: (id: string) => void;
  /** The model's answer, or null while the sheet is still on the rules stage. */
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
                      <Checkbox checked={on} disabled={busy} className="mt-0.5" aria-label={rule.text} onCheckedChange={() => onToggleRule(rule.id)} />
                      <button type="button" disabled={busy} className="flex-1 text-left text-sm" onClick={() => onToggleRule(rule.id)}>
                        {rule.text}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {/* `restyledAt` is set and cleared together with the stored source steps, so the stamp is the signal that there is something to restore. */}
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
                    <Message intent="warning" title="Something changed" data-testid="restyle-part-warning">
                      {missingLine(check)} It starts unticked; tick it only if the rewrite is right.
                    </Message>
                  )}
                  <ol className="flex flex-col gap-3">
                    {Array.from({ length: rows }, (_, row) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: a row is a position: step n before beside step n after, and the two arrays are only ever replaced.
                      <li key={row} className="grid gap-2 md:grid-cols-2" data-testid="restyle-step">
                        <div className="text-sm text-fg-subtle" data-testid="restyle-step-before">
                          <StepSide step={part.steps[row]} />
                        </div>
                        <div className="text-sm" data-testid="restyle-step-after">
                          <StepSide step={rewrite?.steps[row]} />
                        </div>
                      </li>
                    ))}
                  </ol>
                  {/* The notes only show where one side has something to say, so an
                      unprepared ingredient list does not print a column of blanks. */}
                  {noteRows(part, rewrite).length > 0 && (
                    <ul className="flex flex-col gap-2" data-testid="restyle-notes">
                      {noteRows(part, rewrite).map((row) => (
                        <li key={row.id} className="grid gap-2 md:grid-cols-2" data-testid="restyle-note">
                          <div className="text-fg-subtle text-xs">
                            {row.line}
                            {row.before === "" ? "" : ` — ${row.before}`}
                          </div>
                          <div className="text-xs">
                            {row.line}
                            {row.after === "" ? "" : ` — ${row.after}`}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
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

/**
 * One side of a step in the diff: the label above, the instruction, then the
 * supporting line under it, each only when it has something. Rendered as plain
 * text rather than through `Markdown`, because a diff shows what will be
 * written, not what it will look like.
 */
function StepSide({ step }: { step?: { title?: string; text: string; summary?: string } }) {
  if (step === undefined) return null;
  const label = (step.title ?? "").trim();
  const support = (step.summary ?? "").trim();
  return (
    <div className="flex flex-col gap-1">
      {label !== "" && <span className="font-semibold">{label}</span>}
      <span>{step.text}</span>
      {support !== "" && <span className="italic opacity-80">{support}</span>}
    </div>
  );
}

/**
 * The ingredient rows worth showing under a part's steps: those where the
 * rewrite wrote a note, or where the row already had one. A row with nothing on
 * either side is the common case and is left out. Pure.
 */
function noteRows(part: Part, rewrite: RestyledPart | undefined): { id: string; line: string; before: string; after: string }[] {
  return part.ingredients.flatMap((row, index) => {
    const before = row.note.trim();
    const after = (rewrite?.notes[index] ?? row.note).trim();
    if (before === "" && after === "") return [];
    return [{ id: row.id, line: formatIngredient(row).trim() || row.originalText.trim(), before, after }];
  });
}
