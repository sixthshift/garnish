import { Button } from "@sixthshift/design-system/button";
import { Message } from "@sixthshift/design-system/message";
import { Textarea } from "@sixthshift/design-system/textarea";
import { cn } from "@sixthshift/design-system/utils";
import { type CSSProperties, useId } from "react";
import { useLayout } from "../../../../lib/useLayout";
import type { OriginalPart, RestyledPart, RestyledStep } from "../../style";
import { type Choice, type Finding, partHeading, stepKey } from "./styleSession";

type Row = OriginalPart["ingredients"][number];

/** Everything a step says, as the recipe page shows it: the label, the instruction, the supporting line. */
export function StepWords({ step, className }: { step: RestyledStep; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {step.title.trim() !== "" && <span className="font-semibold">{step.title}</span>}
      <span className="leading-relaxed">{step.text}</span>
      {step.summary.trim() !== "" && <span className="text-sm leading-relaxed text-fg-subtle">{step.summary}</span>}
    </div>
  );
}

/** One step: its number, its words, and on the version being saved, if it is the rewrite, an Edit that retypes its text. */
function Step(props: {
  n: number;
  step: RestyledStep;
  editable: boolean;
  editing: boolean;
  onEdit: () => void;
  onDraft: (text: string) => void;
  onDone: () => void;
}) {
  const { n, step, editable, editing } = props;
  const fieldId = useId();
  return (
    <li className="style-step-land grid grid-cols-[2rem_minmax(0,1fr)] gap-x-1 py-3" style={{ "--i": n } as CSSProperties} data-testid="style-step">
      <span className="font-display text-lg font-semibold leading-snug text-fg-subtle" aria-hidden="true">
        {n}
      </span>
      <div className="flex min-w-0 flex-col gap-2">
        {editing ? (
          <div className="flex flex-col gap-2">
            <label htmlFor={fieldId} className="text-xs text-fg-subtle">
              Step {n} text
            </label>
            <Textarea id={fieldId} value={step.text} onChange={(event) => props.onDraft(event.target.value)} autosize rows={3} className="text-base" />
            <div>
              <Button type="button" variant="outline" intent="neutral" size="sm" onClick={props.onDone}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <StepWords step={step} />
        )}
        {editable && !editing && (
          <div>
            <Button type="button" size="sm" variant="ghost" intent="neutral" aria-label={`Edit step ${n}`} onClick={props.onEdit}>
              Edit
            </Button>
          </div>
        )}
      </div>
    </li>
  );
}

export type RecipeVersionProps = {
  parts: readonly RestyledPart[];
  /** Every ingredient row of the recipe, which `parts` point into by number. */
  rows: readonly Row[];
  /** Whether its steps can be retyped: the rewrite, while it is the one being saved. */
  editable?: boolean;
  editing?: string | null;
  onEdit?: (key: string | null) => void;
  onDraft?: (key: string, text: string) => void;
};

/** A recipe as it will read: each part's heading, its ingredient lines with their notes, and its steps numbered through the recipe. */
export function RecipeVersion({ parts, rows, editable = false, editing = null, onEdit, onDraft }: RecipeVersionProps) {
  let n = 0;
  return (
    <div className="flex flex-col gap-5">
      {parts.map((part, p) => {
        // A part with nothing in it, the main body once every line sits under a heading, is not shown.
        if (part.rows.length === 0 && part.steps.length === 0) return null;
        const heading = partHeading(part.name);
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: the parts, in order; the list is only ever replaced.
          <section key={p} className="flex flex-col gap-2" aria-label={heading}>
            <h3 className="font-display font-semibold text-fg-strong">{heading}</h3>
            {part.rows.length > 0 && (
              <ul className="flex flex-col gap-1.5 rounded-lg bg-bg-subtle px-3 py-2.5" aria-label={`${heading} ingredients`}>
                {part.rows.map((row, i) => {
                  const note = (part.notes[i] ?? "").trim();
                  return (
                    <li key={row} className="text-sm leading-snug">
                      <span>{rows[row]?.line ?? rows[row]?.originalText ?? ""}</span>
                      {note !== "" && <span className="text-fg-subtle">, {note}</span>}
                    </li>
                  );
                })}
              </ul>
            )}
            {part.steps.length > 0 && (
              <ol className="flex flex-col divide-y divide-border-subtle" aria-label={`${heading} steps`}>
                {part.steps.map((step, s) => {
                  n += 1;
                  const key = stepKey(p, s);
                  return (
                    <Step
                      key={key}
                      n={n}
                      step={step}
                      editable={editable}
                      editing={editable && editing === key}
                      onEdit={() => onEdit?.(key)}
                      onDraft={(text) => onDraft?.(key, text)}
                      onDone={() => onEdit?.(null)}
                    />
                  );
                })}
              </ol>
            )}
          </section>
        );
      })}
    </div>
  );
}

const stepCount = (parts: readonly RestyledPart[]) => parts.reduce((total, part) => total + part.steps.length, 0);

/** "11 steps", "11 steps · 2 to check": what a version's heading says under its name. Pure. */
export function versionLine(steps: number, findings: number): string {
  const counted = `${steps} ${steps === 1 ? "step" : "steps"}`;
  return findings === 0 ? counted : `${counted} · ${findings} to check`;
}

/** "Checked, and rewritten again to fix 3 problems." Pure. */
export function revisedLine(problems: number): string {
  return `Checked, and rewritten again to fix ${problems} ${problems === 1 ? "problem" : "problems"}.`;
}

export type StyleCompareProps = {
  author: readonly RestyledPart[];
  rewrite: readonly RestyledPart[];
  rows: readonly Row[];
  choice: Choice;
  findings: readonly Finding[];
  /** Whether the rewrite laid the recipe out in new parts. */
  rebuilt: boolean;
  /** How many problems the checks found in the first rewrite that a revision was taken to fix. */
  revised?: number;
  editing: string | null;
  onChoose: (choice: Choice) => void;
  onEdit: (key: string | null) => void;
  onDraft: (key: string, text: string) => void;
};

/**
 * The two versions of the recipe side by side, the author's and the house
 * style's, and the one to save chosen whole by its heading (decisions.md row
 * 229). The house style's comes first on a phone, where they stack, and on the
 * right on a desktop, where the eye ends. What the check found heads the
 * house style's version; it never chooses for the household.
 */
export function StyleCompare(props: StyleCompareProps) {
  const { author, rewrite, rows, choice, findings, rebuilt, revised = 0, editing, onChoose, onEdit, onDraft } = props;
  const layout = useLayout();
  const name = useId();
  const sides: Choice[] = layout === "desktop" ? ["original", "rewrite"] : ["rewrite", "original"];
  return (
    <fieldset className="grid min-w-0 items-start gap-4 desktop:grid-cols-2" data-testid="style-compare" data-choice={choice}>
      <legend className="sr-only">The version to save</legend>
      {sides.map((side) => {
        const chosen = side === choice;
        const isRewrite = side === "rewrite";
        const parts = isRewrite ? rewrite : author;
        const label = isRewrite ? "In your house style" : "As written";
        return (
          <section
            key={side}
            aria-label={label}
            data-testid={isRewrite ? "style-rewrite" : "style-original"}
            data-chosen={chosen}
            className={cn("flex min-w-0 flex-col overflow-hidden rounded-xl border-2 bg-bg-normal", chosen ? "border-border-strong" : "border-border-subtle")}
          >
            <label
              className={cn(
                "flex w-full cursor-pointer items-center gap-3 px-4 py-3 has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-border-brand has-[input:focus-visible]:ring-inset",
                chosen ? "bg-bg-subtle-pressed" : "bg-bg-subtle hover:bg-bg-subtle-hovered"
              )}
            >
              <input type="radio" name={name} value={side} checked={chosen} onChange={() => onChoose(side)} className="sr-only" />
              <span
                aria-hidden="true"
                className={cn(
                  "grid size-5 shrink-0 place-items-center rounded-full border-2",
                  chosen ? "border-border-brand bg-bg-brand" : "border-border-normal bg-bg-normal"
                )}
              >
                {chosen && <span className="size-2 rounded-full bg-fg-on-brand" />}
              </span>
              <span className="flex min-w-0 grow flex-col">
                <span className="font-medium text-fg-strong">{label}</span>
                <span className="text-sm text-fg-subtle">{versionLine(stepCount(parts), isRewrite ? findings.length : 0)}</span>
              </span>
              <span aria-hidden="true" className={cn("shrink-0 text-sm", chosen ? "font-medium text-fg-normal" : "text-fg-subtle")}>
                {chosen ? "Saving this" : "Use this"}
              </span>
            </label>
            <div className={cn("flex flex-col gap-4 px-4 pt-4 pb-2", !chosen && "text-fg-subtle")}>
              {isRewrite && (rebuilt || revised > 0) && (
                <p className="text-sm text-fg-subtle" data-testid="style-rewrite-notes">
                  {[rebuilt ? "Laid out in new parts." : "", revised > 0 ? revisedLine(revised) : ""].filter(Boolean).join(" ")}
                </p>
              )}
              {isRewrite &&
                findings.map((finding) => (
                  <Message key={`${finding.kind}:${finding.item}`} intent="warning" size="sm" data-testid="style-finding">
                    {finding.message}
                  </Message>
                ))}
              <RecipeVersion parts={parts} rows={rows} editable={isRewrite && chosen} editing={editing} onEdit={onEdit} onDraft={onDraft} />
            </div>
          </section>
        );
      })}
    </fieldset>
  );
}
