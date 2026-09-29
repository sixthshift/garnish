import { Button } from "@sixthshift/design-system/button";
import { Card } from "@sixthshift/design-system/card";
import { Muted } from "@sixthshift/design-system/muted";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import { cn } from "@sixthshift/design-system/utils";
import { useState } from "react";
import { filterUnits, type IngredientReview } from "../../../../domain/draft";
import type { ScrapedRecipe } from "../../../../domain/import";
import type { FoodRow, Unit } from "../../../../domain/reference";
import { IngredientReviewRow } from "../../components/IngredientReviewRow";
import { createAllNew, leaveAllAsText, type RowState, reviewCounts, rowSummary } from "./reviewRowState";

export type IngredientReviewListProps = {
  rows: readonly IngredientReview[];
  units: readonly Unit[];
  searchFoods: (q: string) => Promise<FoodRow[]>;
  busy?: boolean;
  onRowsChange: (rows: IngredientReview[]) => void;
};

const STATE_STYLE: Record<RowState, string> = {
  matched: "text-fg-subtle",
  create: "bg-bg-brand-subtle text-fg-brand",
  unknown: "bg-bg-warning-subtle text-fg-warning",
  text: "text-fg-subtle",
};

/** "17 matched · 3 new foods": the counts above the list, leaving out the empty ones. Pure. */
export function countsLine(counts: Record<RowState, number>): string {
  const parts = [
    counts.matched > 0 ? `${counts.matched} matched` : "",
    counts.create > 0 ? `${counts.create} to create` : "",
    counts.unknown > 0 ? `${counts.unknown} unknown` : "",
    counts.text > 0 ? `${counts.text} as text` : "",
  ];
  return parts.filter(Boolean).join(" · ");
}

/**
 * The ingredients as one list, a line each: what the page said, read into an
 * amount, a food and a note, and what will happen to it. A row opens into the
 * full review fields only when someone wants to change it, and the decision
 * the page most often needs — the foods this library does not have yet — is
 * taken for every row at once above the list.
 */
export function IngredientReviewList({ rows, units, searchFoods, busy, onRowsChange }: IngredientReviewListProps) {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const counts = reviewCounts(rows);
  const toggle = (key: string) =>
    setOpen((previous) => {
      const next = new Set(previous);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  return (
    <section className="flex flex-col gap-2" aria-label="Ingredients to review">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <SectionTitle as="h2">Ingredients</SectionTitle>
        <Muted as="span" className="grow text-sm" data-testid="review-counts">
          {countsLine(counts)}
        </Muted>
        {counts.unknown > 0 && (
          <Button type="button" size="sm" variant="outline" intent="brand" disabled={busy} onClick={() => onRowsChange(createAllNew(rows))}>
            Create all new
          </Button>
        )}
        {counts.create > 0 && (
          <Button type="button" size="sm" variant="ghost" intent="neutral" disabled={busy} onClick={() => onRowsChange(leaveAllAsText(rows))}>
            Leave all as text
          </Button>
        )}
      </div>
      {counts.unknown > 0 && (
        <Muted as="p" className="text-sm">
          Nothing new is added to your foods unless you ask. An unknown food left alone is saved as the line the page wrote.
        </Muted>
      )}
      <Card size="sm" className="p-0">
        <ul className="flex flex-col divide-y divide-border-subtle">
          {rows.map((row, index) => {
            const summary = rowSummary(row);
            const expanded = open.has(row.key);
            return (
              <li key={row.key} className="flex flex-col gap-2 px-3 py-2.5" data-review-row={expanded ? undefined : ""} data-status={summary.state}>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                  <div className="col-start-1 row-start-1 flex min-w-0 flex-col" data-original-text="">
                    <span className="text-sm leading-snug">{row.originalText}</span>
                    {summary.state !== "text" && (
                      <Muted as="span" className="text-xs">
                        Read as {summary.amount !== "" && `${summary.amount} · `}
                        <span className="font-medium text-fg-normal">{summary.food}</span>
                        {summary.note !== "" && ` · ${summary.note}`}
                      </Muted>
                    )}
                  </div>
                  {/* One label, under the line on a phone and beside it from `sm`, so a screen reader hears it once. */}
                  <span
                    className={cn(
                      "col-start-1 row-start-2 w-fit rounded px-1.5 py-0.5 text-xs sm:col-start-2 sm:row-start-1 sm:self-start",
                      STATE_STYLE[summary.state]
                    )}
                  >
                    {summary.label}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    intent="neutral"
                    className="col-start-2 row-span-2 row-start-1 sm:col-start-3 sm:row-span-1"
                    aria-expanded={expanded}
                    aria-label={`${expanded ? "Done with" : "Change"} line ${index + 1}`}
                    disabled={busy}
                    onClick={() => toggle(row.key)}
                  >
                    {expanded ? "Done" : "Change"}
                  </Button>
                </div>
                {expanded && (
                  <div className="rounded-md bg-bg-subtle p-3">
                    <IngredientReviewRow
                      row={row}
                      label={`Line ${index + 1}`}
                      disabled={busy}
                      unitMatches={(text) => filterUnits(units, text)}
                      searchFoods={searchFoods}
                      onChange={(next) => onRowsChange(rows.map((current, i) => (i === index ? next : current)))}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </section>
  );
}

/** How many steps show before the rest are folded away. */
export const STEPS_SHOWN = 3;

/**
 * The steps as the page wrote them, read-only: the review is about what the
 * page said, and the words are the Style stage's to change. Folded after the
 * first few so the ingredients stay the review's subject.
 */
export function ReviewSteps({ parts, styledNext }: { parts: ScrapedRecipe["parts"]; styledNext: boolean }) {
  const [all, setAll] = useState(false);
  const withSteps = parts.filter((part) => part.steps.length > 0);
  const total = withSteps.reduce((sum, part) => sum + part.steps.length, 0);
  let shown = 0;
  let n = 0;

  return (
    <section className="flex flex-col gap-2" aria-label="Steps to review">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <SectionTitle as="h2">Steps</SectionTitle>
        <Muted as="span" className="grow text-sm">
          {total} {total === 1 ? "step" : "steps"}
          {styledNext ? ", as the page wrote them. The house style comes next." : ", as the page wrote them."}
        </Muted>
      </div>
      <Card size="sm" className="flex flex-col gap-3">
        {withSteps.map((part, index) => {
          if (!all && shown >= STEPS_SHOWN) return null;
          const visible = all ? part.steps : part.steps.slice(0, STEPS_SHOWN - shown);
          shown += visible.length;
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: a scraped draft has no ids yet; this preview is read-only and never reordered.
            <div key={`${index}-${part.name}`} className="flex flex-col gap-1.5" data-import-part={part.name}>
              {part.name !== "" && <span className="text-sm font-medium">{part.name}</span>}
              <ol className="flex flex-col gap-1.5">
                {visible.map((step, si) => {
                  n += 1;
                  return (
                    // biome-ignore lint/suspicious/noArrayIndexKey: a scraped draft's steps are plain strings in order; this preview is read-only.
                    <li key={`${si}-${step.slice(0, 24)}`} className="flex gap-3 text-sm leading-relaxed">
                      <span className="w-4 shrink-0 text-right font-display font-semibold text-fg-subtle">{n}</span>
                      <span>{step}</span>
                    </li>
                  );
                })}
              </ol>
            </div>
          );
        })}
        {total > STEPS_SHOWN && (
          <div>
            <Button type="button" size="sm" variant="ghost" intent="neutral" aria-expanded={all} onClick={() => setAll(!all)}>
              {all ? "Show fewer" : `Show all ${total} steps`}
            </Button>
          </div>
        )}
      </Card>
    </section>
  );
}
