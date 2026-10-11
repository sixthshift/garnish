import { Button } from "@sixthshift/design-system/button";
import { Card } from "@sixthshift/design-system/card";
import { Message } from "@sixthshift/design-system/message";
import { Muted } from "@sixthshift/design-system/muted";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import { Spinner } from "@sixthshift/design-system/spinner";
import { cn } from "@sixthshift/design-system/utils";
import type { OriginalPart, RestyledPart, RestyledStep } from "../../../../domain/style";
import { STEP_COLUMNS, StepWords, StyleStep } from "./StyleStep";
import {
  type Choice,
  isAligned,
  partFindings,
  partHeading,
  type StyleAnswer,
  type StyleChoices,
  sameStep,
  stepDroppedWords,
  stepKey,
  takesRewrite,
} from "./styleSession";

export type StylePartProps = {
  /** The part's position in the recipe. */
  p: number;
  original: readonly OriginalPart[];
  /** The number of the part's first step in the recipe, counting the author's steps. */
  firstStep: number;
  /** The same, counting the rewrite's: different only after a part whose rewrite merged or split steps. */
  firstRewriteStep: number;
  answer: StyleAnswer | null;
  choices: StyleChoices | null;
  /** What Save would write for this part. */
  assembled: RestyledPart | null;
  running: boolean;
  /** Whether the run failed, so the rewrite column says there is none rather than waiting for it. */
  failed: boolean;
  editing: string | null;
  onStep: (s: number, choice: Choice) => void;
  onPart: (choice: Choice) => void;
  onEdit: (key: string | null) => void;
  onDraft: (key: string, text: string) => void;
};

const author = (step: OriginalPart["steps"][number]): RestyledStep => ({ title: step.title ?? "", text: step.text, summary: step.summary ?? "" });

/** A column's head on a phone, where the two sides stack, and over each column from md. */
function ColumnHead({ label, taken }: { label: string; taken: boolean }) {
  return (
    <div className="flex items-baseline gap-2 px-4 pt-3 text-xs font-medium text-fg-subtle">
      <span>{label}</span>
      {taken && <span className="text-fg-normal">· Taken</span>}
    </div>
  );
}

/** A step in a part chosen whole: numbered words, nothing to press. */
function PlainStep({ n, step, quiet }: { n: number; step: RestyledStep; quiet: boolean }) {
  return (
    <li className="grid grid-cols-[2.75rem_minmax(0,1fr)] border-b border-border-subtle py-3 last:border-b-0 md:py-4" data-testid="style-plain-step">
      <span className="pl-4 font-display text-lg font-semibold text-fg-subtle" aria-hidden="true">
        {n}
      </span>
      <StepWords step={step} className={cn("pr-4", quiet && "text-fg-subtle")} />
    </li>
  );
}

/**
 * One part of the recipe in the Style space: its ingredients, the author's
 * steps and the rewrite, side by side, so the two are read together rather
 * than flipped between. From lg the ingredients are the first of three
 * columns; from md they sit above the two step columns; on a phone each step
 * shows the author's words and then the rewrite.
 */
export function StylePart(props: StylePartProps) {
  const { p, original, firstStep, firstRewriteStep, answer, choices, assembled, running, failed, editing } = props;
  const part = original[p]!;
  const rewrite = answer?.parts[p];
  const check = answer?.check.parts[p];
  const aligned = rewrite !== undefined && isAligned(part, rewrite);
  const findings = rewrite && check ? partFindings(part, check, aligned, rewrite) : null;
  const dropped = check ? stepDroppedWords(part, check) : null;
  const choosable = rewrite !== undefined && choices !== null && rewrite.steps.length > 0;
  const wholeChoice = choices?.parts[p] ?? "original";
  const changedNotes = rewrite ? rewrite.notes.filter((note, i) => note.trim() !== (part.ingredients[i]?.note ?? "").trim()).length : 0;
  const heading = partHeading(part.name);

  const meta = [
    `${part.ingredients.length} ${part.ingredients.length === 1 ? "ingredient" : "ingredients"}`,
    `${part.steps.length} ${part.steps.length === 1 ? "step" : "steps"}`,
    changedNotes > 0 ? `${changedNotes} ${changedNotes === 1 ? "note" : "notes"} rewritten` : "",
  ].filter(Boolean);

  return (
    <section className="flex flex-col gap-2" aria-label={heading} data-testid="style-part">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <SectionTitle as="h2">{heading}</SectionTitle>
        <Muted as="span" className="grow text-sm">
          {meta.join(" · ")}
        </Muted>
        {choosable && (
          <div className="flex gap-1">
            <Button type="button" size="sm" variant="ghost" intent="neutral" onClick={() => props.onPart("rewrite")}>
              Keep all
            </Button>
            <Button type="button" size="sm" variant="ghost" intent="neutral" onClick={() => props.onPart("original")}>
              Use all original
            </Button>
          </div>
        )}
      </div>
      {findings?.part.map((finding) => (
        <Message key={`${finding.kind}:${finding.item}`} intent="warning" size="sm" data-testid="style-part-finding">
          {finding.message} {wholeChoice === "rewrite" ? "You kept the rewrite anyway." : "This part keeps the original until you keep the rewrite."}
        </Message>
      ))}
      {choosable && !aligned && (
        <Muted as="p" className="text-sm">
          The rewrite has {rewrite.steps.length} {rewrite.steps.length === 1 ? "step" : "steps"} where the author has {part.steps.length}, so this part is kept
          or put back whole.
        </Muted>
      )}
      <Card size="sm" className="grid overflow-hidden p-0 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <ul className="flex flex-col gap-2.5 border-b border-border-subtle px-4 py-4 lg:border-r lg:border-b-0" aria-label={`${heading} ingredients`}>
          {part.ingredients.length === 0 && <li className="text-sm text-fg-subtle">No ingredients</li>}
          {part.ingredients.map((row, i) => {
            const authorNote = (row.note ?? "").trim();
            const note = (assembled?.notes[i] ?? authorNote).trim();
            const rewritten = note !== authorNote;
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional here; the restyle answers notes by position and never reorders them.
              <li key={i} className="text-sm leading-snug">
                <span>{row.line}</span>
                {note !== "" && (
                  <span className={cn("-ml-1 mt-0.5 block w-fit rounded px-1 text-sm", rewritten ? "bg-bg-brand-subtle text-fg-brand" : "text-fg-subtle")}>
                    {note}
                  </span>
                )}
                {rewritten && authorNote !== "" && (
                  <span className="mt-0.5 block text-xs text-fg-subtle" data-testid="style-author-note">
                    Was: {authorNote}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        {part.steps.length === 0 ? (
          <p className="px-4 py-4 text-sm text-fg-subtle">No steps</p>
        ) : aligned && choices && rewrite ? (
          <div className="flex min-w-0 flex-col">
            <div className={cn(STEP_COLUMNS, "hidden border-b border-border-subtle pb-2 md:grid")} aria-hidden="true">
              <span />
              <ColumnHead label="Original" taken={false} />
              <ColumnHead label="Restyled" taken={false} />
            </div>
            <ol className="flex flex-col" aria-label={`${heading} steps`}>
              {part.steps.map((step, s) => {
                const key = stepKey(p, s);
                const same = sameStep(step, rewrite.steps[s]!);
                const taking = takesRewrite(choices, original, answer!, p, s);
                return (
                  <StyleStep
                    key={key}
                    n={firstStep + s}
                    original={author(step)}
                    rewrite={same ? null : { ...rewrite.steps[s]!, text: choices.edits[key] ?? rewrite.steps[s]!.text }}
                    choice={taking ? "rewrite" : "original"}
                    edited={choices.edits[key] !== undefined}
                    findings={findings?.steps[s] ?? []}
                    droppedWords={dropped?.[s] ?? []}
                    editing={editing === key}
                    draft={choices.edits[key] ?? rewrite.steps[s]!.text}
                    onKeep={() => props.onStep(s, "rewrite")}
                    onOriginal={() => props.onStep(s, "original")}
                    onEdit={() => props.onEdit(key)}
                    onDraft={(text) => props.onDraft(key, text)}
                    onDoneEditing={() => props.onEdit(null)}
                  />
                );
              })}
            </ol>
          </div>
        ) : (
          <div className="grid min-w-0 md:grid-cols-2">
            <div
              className={cn(
                "flex min-w-0 flex-col border-b border-border-subtle md:border-r md:border-b-0",
                choosable && wholeChoice === "original" && "bg-bg-subtle"
              )}
            >
              <ColumnHead label="Original" taken={choosable && wholeChoice === "original"} />
              <ol className="flex flex-col" aria-label={`${heading} steps, the author’s`}>
                {part.steps.map((step, s) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: the author's steps, in order; the list is only ever replaced.
                  <PlainStep key={s} n={firstStep + s} step={author(step)} quiet={choosable && wholeChoice !== "original"} />
                ))}
              </ol>
            </div>
            <div className={cn("flex min-w-0 flex-col", choosable && wholeChoice === "rewrite" && "bg-bg-subtle")} data-testid="style-rewrite-column">
              <ColumnHead label="Restyled" taken={choosable && wholeChoice === "rewrite"} />
              {running ? (
                <div className="flex items-center gap-2 px-4 py-4 text-sm text-fg-subtle">
                  <Spinner size="sm" />
                  Restyling…
                </div>
              ) : choosable ? (
                <ol className="flex flex-col" aria-label={`${heading} steps, the rewrite`}>
                  {rewrite.steps.map((step, s) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: the rewrite's steps, in order; the list is only ever replaced.
                    <PlainStep key={s} n={firstRewriteStep + s} step={step} quiet={wholeChoice !== "rewrite"} />
                  ))}
                </ol>
              ) : (
                <p className="px-4 py-4 text-sm text-fg-subtle">{failed || answer ? "No rewrite for this part." : ""}</p>
              )}
            </div>
          </div>
        )}
      </Card>
    </section>
  );
}
