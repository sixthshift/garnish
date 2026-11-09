import { Button } from "@sixthshift/design-system/button";
import { Card } from "@sixthshift/design-system/card";
import { Message } from "@sixthshift/design-system/message";
import { Muted } from "@sixthshift/design-system/muted";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import { Textarea } from "@sixthshift/design-system/textarea";
import { cn } from "@sixthshift/design-system/utils";
import { type CSSProperties, useId, useState } from "react";
import type { OriginalPart, RestyledPart, RestyledStep } from "../../style";
import { StepWords } from "./StyleStep";
import { allRows, asWritten, type Choice, partFindings, partHeading, type StyleAnswer, type StyleChoices, stepKey, wholeRecipe } from "./styleSession";

export type StyleRebuiltProps = {
  original: readonly OriginalPart[];
  answer: StyleAnswer;
  choices: StyleChoices;
  editing: string | null;
  onChoose: (choice: Choice) => void;
  onEdit: (key: string | null) => void;
  onDraft: (key: string, text: string) => void;
};

/**
 * The chosen side of Keep / Original: the toggles' selected fill, as
 * `StyleStep` takes it. Never brand: Save is the page's one primary action
 * (design-language rule 5).
 */
const CHOSEN = "[--button-bg-hovered:var(--intent-tint-bg-pressed)] [--button-bg:var(--intent-tint-bg-pressed)] [--button-fg:var(--intent-tint-fg-pressed)]";

/** One step of a recipe shown whole: its number, its words, and on the rewrite an Edit that retypes its text. */
function WholeStep(props: {
  n: number;
  step: RestyledStep;
  quiet: boolean;
  editable: boolean;
  editing: boolean;
  onEdit: () => void;
  onDraft: (text: string) => void;
  onDone: () => void;
}) {
  const { n, step, quiet, editable, editing } = props;
  const fieldId = useId();
  return (
    <li
      className="style-step-land grid grid-cols-[2.75rem_minmax(0,1fr)] border-b border-border-subtle py-3 last:border-b-0 desktop:py-4"
      style={{ "--i": n } as CSSProperties}
      data-testid="style-whole-step"
    >
      <span className="pl-4 font-display text-lg font-semibold text-fg-subtle" aria-hidden="true">
        {n}
      </span>
      <div className="flex min-w-0 flex-col gap-2 pr-4">
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
          <StepWords step={step} className={cn(quiet && "text-fg-subtle")} />
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

/**
 * A recipe laid out as `parts`: each part's heading, its ingredient lines with
 * their notes, and its steps numbered through the recipe. The rewrite's steps
 * can be retyped; the author's are only read.
 */
function Recipe(props: {
  label: string;
  parts: readonly RestyledPart[];
  rows: readonly OriginalPart["ingredients"][number][];
  quiet: boolean;
  editable: boolean;
  editing: string | null;
  onEdit: (key: string | null) => void;
  onDraft: (key: string, text: string) => void;
}) {
  const { label, parts, rows, quiet, editable, editing } = props;
  let n = 0;
  return (
    <div className="flex flex-col gap-4">
      {parts.map((part, p) => {
        // A part with nothing in it, the main body once every line sits under a heading, is not shown.
        if (part.rows.length === 0 && part.steps.length === 0) return null;
        const heading = partHeading(part.name);
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: the parts, in order; the list is only ever replaced.
          <section key={p} className="flex flex-col gap-2" aria-label={`${label}: ${heading}`} data-testid="style-whole-part">
            <SectionTitle as="h2" className={cn(quiet && "text-fg-subtle")}>
              {heading}
            </SectionTitle>
            <Card size="sm" className="grid overflow-hidden p-0 desktop:grid-cols-[15rem_minmax(0,1fr)]">
              <ul
                className="flex flex-col gap-2.5 border-b border-border-subtle px-4 py-4 desktop:border-r desktop:border-b-0"
                aria-label={`${heading} ingredients`}
              >
                {part.rows.length === 0 && <li className="text-sm text-fg-subtle">No ingredients</li>}
                {part.rows.map((row, i) => {
                  const note = (part.notes[i] ?? "").trim();
                  return (
                    <li key={row} className={cn("text-sm leading-snug", quiet && "text-fg-subtle")}>
                      <span>{rows[row]?.line ?? rows[row]?.originalText ?? ""}</span>
                      {note !== "" && <span className="mt-0.5 block text-sm text-fg-subtle">{note}</span>}
                    </li>
                  );
                })}
              </ul>
              {part.steps.length === 0 ? (
                <p className="px-4 py-4 text-sm text-fg-subtle">No steps</p>
              ) : (
                <ol className="flex flex-col" aria-label={`${heading} steps`}>
                  {part.steps.map((step, s) => {
                    n += 1;
                    const key = stepKey(p, s);
                    return (
                      <WholeStep
                        key={key}
                        n={n}
                        step={step}
                        quiet={quiet}
                        editable={editable}
                        editing={editable && editing === key}
                        onEdit={() => props.onEdit(key)}
                        onDraft={(text) => props.onDraft(key, text)}
                        onDone={() => props.onEdit(null)}
                      />
                    );
                  })}
                </ol>
              )}
            </Card>
          </section>
        );
      })}
    </div>
  );
}

/**
 * The Style space when the rewrite laid the recipe out afresh — new parts, or
 * lines moved between them — so no step pairs with one of the author's
 * (decisions.md row 226): the side being taken as the recipe will read, Keep
 * or Original for the whole of it, and the other side one press away. What
 * the check found is said once, above it.
 */
export function StyleRebuilt({ original, answer, choices, editing, onChoose, onEdit, onDraft }: StyleRebuiltProps) {
  const [showOther, setShowOther] = useState(false);
  const rows = allRows(original);
  const author = asWritten(original);
  const rewrite = answer.parts.map((part, p) => ({
    ...part,
    steps: part.steps.map((step, s) => ({ ...step, text: choices.edits[stepKey(p, s)] ?? step.text })),
  }));
  const taking = choices.recipe === "rewrite";
  const findings = partFindings(wholeRecipe(original), answer.check.parts[0]!, false).part;
  const recipe = (side: "rewrite" | "original", quiet: boolean) => (
    <Recipe
      label={side === "rewrite" ? "The rewrite" : "As written"}
      parts={side === "rewrite" ? rewrite : author}
      rows={rows}
      quiet={quiet}
      editable={side === "rewrite" && !quiet}
      editing={editing}
      onEdit={onEdit}
      onDraft={onDraft}
    />
  );
  return (
    <div className="flex flex-col gap-4" data-testid="style-rebuilt" data-choice={choices.recipe}>
      <div className="flex flex-col gap-2">
        <Muted as="p" className="text-sm">
          The rewrite lays the recipe out in new parts, so it is kept or put back whole.
        </Muted>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            intent="neutral"
            className={cn(taking && CHOSEN)}
            aria-pressed={taking}
            onClick={() => onChoose("rewrite")}
          >
            Keep the rewrite
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            intent="neutral"
            className={cn(!taking && CHOSEN)}
            aria-pressed={!taking}
            onClick={() => onChoose("original")}
          >
            Use the original
          </Button>
          <Button type="button" size="sm" variant="ghost" intent="neutral" aria-expanded={showOther} onClick={() => setShowOther(!showOther)}>
            {showOther ? "Hide" : taking ? "Show original" : "Show the rewrite"}
          </Button>
        </div>
      </div>
      {findings.map((finding) => (
        <Message key={`${finding.kind}:${finding.item}`} intent="warning" size="sm" data-testid="style-part-finding">
          {finding.message} {taking ? "You kept the rewrite anyway." : "The recipe keeps the original until you keep the rewrite."}
        </Message>
      ))}
      {recipe(taking ? "rewrite" : "original", false)}
      {showOther && (
        <div className="flex flex-col gap-2 border-l-2 border-border-normal pl-3" data-testid="style-rebuilt-other">
          <span className="text-xs font-medium text-fg-subtle">{taking ? "Original" : "Rewrite"}</span>
          {recipe(taking ? "original" : "rewrite", true)}
        </div>
      )}
    </div>
  );
}
