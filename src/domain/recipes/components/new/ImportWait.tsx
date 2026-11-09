import { Button } from "@sixthshift/design-system/button";
import { Card } from "@sixthshift/design-system/card";
import { Muted } from "@sixthshift/design-system/muted";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import { cn } from "@sixthshift/design-system/utils";
import type { CSSProperties } from "react";
import { SimmerPot } from "../wait/SimmerPot";
import { useSeconds, WaitSteps } from "../wait/WaitSteps";
import type { ImportPhase, ImportPreview, ImportProgress } from "./useRecipeSource";

export type ImportWaitProps = {
  progress: ImportProgress;
  /** Whether a model is there to sort a page into parts: the page's list names that step only then. */
  aiAvailable: boolean;
  /** End the model's sort and go on without it: offered only while it runs. */
  onSkip?: () => void;
};

/** The steps a read goes through, by what it was made from, each with its name in the list and as the headline while it runs. */
function stepsFor(from: ImportProgress["from"], aiAvailable: boolean): { phase: ImportPhase; label: string }[] {
  const first = { page: "Getting the page", text: "Reading your text", file: "Reading the file" }[from];
  return [
    { phase: "get", label: first },
    ...(from === "page" && aiAvailable ? [{ phase: "sort" as const, label: "Sorting it into parts" }] : []),
    { phase: "match", label: "Matching your foods" },
  ];
}

/**
 * What an import shows while it runs, in place of its source's form: the pot
 * simmering over where the read has got to, and beside it the recipe card
 * filling in. Until the page is read the card is grey bars shimmering; then its
 * photo, name and lines land one after another, and while the model sorts them
 * a glint passes down the card. The pot and the steps are the page's own
 * chrome, the recipe the one card (design-language.md, rule 1). The steps are
 * the ones the browser sees land; the server's fetch and read are one, and too
 * quick to tell apart.
 */
export function ImportWait({ progress, aiAvailable, onSkip }: ImportWaitProps) {
  const seconds = useSeconds(progress.startedAt);
  const steps = stepsFor(progress.from, aiAvailable);
  const at = Math.max(
    0,
    steps.findIndex((step) => step.phase === progress.phase)
  );
  // The long wait: the model's sort of a page, or its whole read of a paste.
  const boil = progress.phase === "sort" || (progress.from === "text" && progress.phase === "get" && aiAvailable);

  return (
    <div className="grid gap-6 desktop:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] desktop:items-center" data-testid="import-wait">
      <div className="flex flex-col items-center gap-4 text-center">
        <SimmerPot boil={boil} className="w-36 desktop:w-52" />
        <div className="flex flex-col items-center gap-1">
          <h2 className="text-lg font-medium" role="status">
            {`${steps[at]!.label}…`}
          </h2>
          <Muted as="p" className="text-sm tabular-nums">
            {boil ? "This can take up to a minute." : "\u00a0"}
            {seconds >= 3 && <span> {seconds} s</span>}
          </Muted>
        </div>

        {/* A phone keeps to the headline, which names the step running, so the recipe filling in is in view. */}
        <WaitSteps labels={steps.map((step) => step.label)} at={at} label="Import progress" className="mobile:hidden" />

        {onSkip !== undefined && (
          <Button type="button" variant="ghost" intent="neutral" size="sm" onClick={onSkip}>
            Skip sorting into parts
          </Button>
        )}
      </div>

      <RecipeSketch found={progress.found} sorting={progress.phase === "sort"} />
    </div>
  );
}

/** How many of the found recipe's lines the card shows before "and N more". */
const SHOWN_INGREDIENTS = 6;
const SHOWN_STEPS = 3;

/** One line landing in its turn: `--i` is its place in the card's order. */
const turn = (i: number) => ({ "--i": i }) as CSSProperties;

/**
 * The recipe as the read has it, filling in: grey bars shimmering until there
 * is something to show, then the photo, the name and the lines in order.
 */
function RecipeSketch({ found, sorting }: { found: ImportPreview | null; sorting: boolean }) {
  if (found === null) {
    return (
      <Card size="lg" className="flex flex-col gap-5 mobile:p-4" aria-hidden="true" data-testid="import-sketch">
        <div className="flex items-center gap-3">
          <div className="sketch-bar size-16 shrink-0 rounded-lg" />
          <div className="flex grow flex-col gap-2">
            <div className="sketch-bar h-4 w-2/3 rounded" />
            <div className="sketch-bar h-3 w-1/2 rounded" />
          </div>
        </div>
        <div className="flex flex-col gap-2.5">
          {["w-3/4", "w-1/2", "w-2/3", "w-5/12", "w-3/5"].map((width) => (
            <div key={width} className={cn("sketch-bar h-3 rounded", width)} />
          ))}
        </div>
        <div className="flex flex-col gap-2.5">
          {["w-full", "w-11/12", "w-4/5"].map((width) => (
            <div key={width} className={cn("sketch-bar h-3 rounded", width)} />
          ))}
        </div>
      </Card>
    );
  }

  const facts = [
    found.host,
    found.ingredients > 0 && `${found.ingredients} ingredient${found.ingredients === 1 ? "" : "s"}`,
    found.steps > 0 && `${found.steps} step${found.steps === 1 ? "" : "s"}`,
  ].filter(Boolean);
  const ingredients = found.ingredientLines.slice(0, SHOWN_INGREDIENTS);
  const steps = found.stepLines.slice(0, SHOWN_STEPS);
  const moreIngredients = found.ingredientLines.length - ingredients.length;

  return (
    <Card size="lg" className="relative flex flex-col gap-5 overflow-hidden text-left mobile:p-4" data-testid="import-found">
      {sorting && <div className="sketch-glint pointer-events-none absolute inset-0" aria-hidden="true" />}
      <div className="flex items-center gap-3">
        {found.image !== null && <img src={found.image} alt="" className="sketch-photo size-16 shrink-0 rounded-lg object-cover" />}
        <div className="sketch-land flex min-w-0 flex-col" style={turn(0)}>
          <span className="font-display text-xl leading-tight">{found.name || "Untitled recipe"}</span>
          {facts.length > 0 && (
            <Muted as="span" className="truncate text-sm">
              {facts.join(" · ")}
            </Muted>
          )}
        </div>
      </div>

      {ingredients.length > 0 && (
        <section className="flex flex-col gap-2">
          <SectionTitle as="h3" className="sketch-land" style={turn(1)}>
            Ingredients
          </SectionTitle>
          <ul className="flex flex-col gap-1.5 text-sm">
            {ingredients.map((line, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: the lines are the page's, in its order, and never reorder while shown.
              <li key={index} className="sketch-land flex gap-2" style={turn(2 + index)}>
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-fg-subtle" aria-hidden="true" />
                <span className="min-w-0 truncate">{line}</span>
              </li>
            ))}
          </ul>
          {moreIngredients > 0 && (
            <Muted as="p" className="sketch-land text-sm" style={turn(2 + ingredients.length)}>
              and {moreIngredients} more
            </Muted>
          )}
        </section>
      )}

      {steps.length > 0 && (
        <section className="flex flex-col gap-2">
          <SectionTitle as="h3" className="sketch-land" style={turn(3 + ingredients.length)}>
            Method
          </SectionTitle>
          <ol className="flex flex-col gap-2 text-sm">
            {steps.map((line, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: as the ingredients, the page's own order.
              <li key={index} className="sketch-land flex gap-2" style={turn(4 + ingredients.length + index)}>
                <span className="w-4 shrink-0 font-medium text-fg-subtle tabular-nums">{index + 1}</span>
                <span className="line-clamp-2 min-w-0">{line}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </Card>
  );
}
