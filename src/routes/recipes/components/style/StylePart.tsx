import { Button } from "@sixthshift/design-system/button";
import { Card } from "@sixthshift/design-system/card";
import { Message } from "@sixthshift/design-system/message";
import { Muted } from "@sixthshift/design-system/muted";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import { cn } from "@sixthshift/design-system/utils";
import type { OriginalPart, RestyledPart, RestyledStep } from "../../../../domain/style";
import { StyleStep } from "./StyleStep";
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
import type { StyleView } from "./useStyleSpace";

export type StylePartProps = {
  /** The part's position in the recipe. */
  p: number;
  original: readonly OriginalPart[];
  /** The number of the part's first step in the recipe. */
  firstStep: number;
  answer: StyleAnswer | null;
  choices: StyleChoices | null;
  /** What Save would write for this part. */
  assembled: RestyledPart | null;
  view: StyleView;
  running: boolean;
  comparing: ReadonlySet<string>;
  editing: string | null;
  onStep: (s: number, choice: Choice) => void;
  onPart: (choice: Choice) => void;
  onCompare: (key: string) => void;
  onEdit: (key: string | null) => void;
  onDraft: (key: string, text: string) => void;
};

const author = (step: OriginalPart["steps"][number]): RestyledStep => ({ title: step.title ?? "", text: step.text, summary: step.summary ?? "" });

/** One part of the recipe in the Style space: its ingredients beside its steps, as the recipe page lays them out. */
export function StylePart(props: StylePartProps) {
  const { p, original, firstStep, answer, choices, assembled, view, running, comparing, editing } = props;
  const part = original[p]!;
  const rewrite = answer?.parts[p];
  const check = answer?.check.parts[p];
  const styled = view === "styled";
  const aligned = rewrite !== undefined && isAligned(part, rewrite);
  const findings = rewrite && check ? partFindings(part, check, aligned) : null;
  const dropped = check ? stepDroppedWords(part, check) : null;
  const choosable = rewrite !== undefined && choices !== null && rewrite.steps.length > 0;
  const wholeChoice = choices?.parts[p] ?? "original";
  const notes = styled && assembled ? assembled.notes : part.ingredients.map((row) => row.note ?? "");
  const changedNotes = rewrite ? rewrite.notes.filter((note, i) => note.trim() !== (part.ingredients[i]?.note ?? "").trim()).length : 0;
  const heading = partHeading(part.name);

  // A part chosen whole shows whichever side is taken, with its own steps.
  const wholeSteps: readonly RestyledStep[] = !aligned && styled && assembled ? assembled.steps : part.steps.map(author);
  const showsWholeRewrite = !aligned && styled && wholeChoice === "rewrite" && rewrite !== undefined;

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
      <Card size="sm" className="grid overflow-hidden p-0 md:grid-cols-[16rem_minmax(0,1fr)]">
        <ul className="flex flex-col gap-2.5 border-b border-border-subtle px-4 py-4 md:border-r md:border-b-0" aria-label={`${heading} ingredients`}>
          {part.ingredients.length === 0 && <li className="text-sm text-fg-subtle">No ingredients</li>}
          {part.ingredients.map((row, i) => {
            const note = notes[i] ?? "";
            const rewritten = styled && note.trim() !== (row.note ?? "").trim();
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional here; the restyle answers notes by position and never reorders them.
              <li key={i} className="text-sm leading-snug">
                <span>{row.line}</span>
                {note.trim() !== "" && (
                  <span className={cn("-ml-1 mt-0.5 block w-fit rounded px-1 text-sm", rewritten ? "bg-bg-brand-subtle text-fg-brand" : "text-fg-subtle")}>
                    {note}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        <ol className="flex flex-col" aria-label={`${heading} steps`}>
          {part.steps.length === 0 && <li className="px-4 py-4 text-sm text-fg-subtle">No steps</li>}
          {aligned && choices && rewrite
            ? part.steps.map((step, s) => {
                const key = stepKey(p, s);
                const rewritten = rewrite.steps[s]!;
                const same = sameStep(step, rewritten);
                const taking = takesRewrite(choices, original, answer!, p, s);
                const shownRewrite = styled && taking && !same;
                const shown = shownRewrite ? assembled!.steps[s]! : author(step);
                const status = !styled
                  ? "Original"
                  : same
                    ? "Unchanged"
                    : taking
                      ? choices.edits[key] !== undefined
                        ? "Rewritten · edited"
                        : "Rewritten"
                      : "Original kept";
                return (
                  <StyleStep
                    key={key}
                    n={firstStep + s}
                    shown={shown}
                    other={
                      same
                        ? undefined
                        : shownRewrite
                          ? { heading: "The author’s original", step: author(step) }
                          : { heading: "The rewrite", step: assembled && taking ? assembled.steps[s]! : rewritten }
                    }
                    status={status}
                    rewriteShown={shownRewrite}
                    choice={same || !styled ? null : taking ? "rewrite" : "original"}
                    findings={styled ? (findings?.steps[s] ?? []) : []}
                    droppedWords={dropped?.[s] ?? []}
                    comparing={comparing.has(key)}
                    editing={editing === key}
                    draft={choices.edits[key] ?? rewritten.text}
                    onKeep={() => props.onStep(s, "rewrite")}
                    onOriginal={() => props.onStep(s, "original")}
                    onCompare={() => props.onCompare(key)}
                    onEdit={() => props.onEdit(key)}
                    onDraft={(text) => props.onDraft(key, text)}
                    onDoneEditing={() => props.onEdit(null)}
                  />
                );
              })
            : wholeSteps.map((step, s) => (
                <StyleStep
                  // biome-ignore lint/suspicious/noArrayIndexKey: a step here is a position in whichever side is shown, and the list is only ever replaced.
                  key={s}
                  n={firstStep + s}
                  shown={step}
                  status={running ? "Restyling…" : !answer ? "" : showsWholeRewrite ? "Rewritten" : styled && choosable ? "Original kept" : "Original"}
                  rewriteShown={showsWholeRewrite}
                  choice={null}
                  findings={[]}
                  droppedWords={[]}
                  comparing={false}
                  editing={false}
                  draft=""
                  pending={running}
                  onKeep={() => {}}
                  onOriginal={() => {}}
                  onCompare={() => {}}
                  onEdit={() => {}}
                  onDraft={() => {}}
                  onDoneEditing={() => {}}
                />
              ))}
        </ol>
      </Card>
    </section>
  );
}
