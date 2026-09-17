import { Badge } from "@sixthshift/design-system/badge";
import { Button } from "@sixthshift/design-system/button";
import { Card } from "@sixthshift/design-system/card";
import { Message } from "@sixthshift/design-system/message";
import { Muted } from "@sixthshift/design-system/muted";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import { filterUnits, type IngredientReview } from "../../../../domain/draft";
import type { ImportedRecipe } from "../../../../domain/import";
import type { FoodRow, Unit } from "../../../../domain/reference";
import { IngredientReviewRow } from "../../components/IngredientReviewRow";
import { changedLines, type DuplicateBy, duplicateMessage, importSummary, ingredientCount, rejectionMessage, stepCount, yieldLabel } from "./importSummary";

export type ImportReviewProps = {
  imported: ImportedRecipe;
  rows: readonly IngredientReview[];
  units: readonly Unit[];
  searchFoods: (q: string) => Promise<FoodRow[]>;
  busy?: boolean;
  error?: string | null;
  /** A recipe already here with the same source or the same name. */
  duplicate?: { name: string; slug: string } | null;
  /** Which of the two the duplicate was found by; the address, by default. */
  duplicateBy?: DuplicateBy;
  /** Whether a model is configured; without one a `schema` page says its sections were not sorted. */
  aiAvailable?: boolean;
  /** Whether the model's read of this page is still running; the rows are the rules result meanwhile. */
  reading?: boolean;
  /** Why the model's read did not happen, shown beside the rules result with a retry. */
  readError?: string | null;
  /** Run the read again after a failure. */
  onRetryRead?: () => void;
  /** Take the rejected answer anyway. */
  onUseRejected?: () => void;
  onRowsChange: (rows: IngredientReview[]) => void;
  onBack: () => void;
  onCreate: () => void;
};

/** The third stage: what the page gave up, before any of it is written. */
export function ImportReview(props: ImportReviewProps) {
  const { imported, rows, units, searchFoods, busy, error, duplicate, duplicateBy = "url", onRowsChange, onBack, onCreate } = props;
  const { aiAvailable = false, reading = false, readError = null, onRetryRead, onUseRejected } = props;
  const { recipe, from } = imported;
  const label = yieldLabel(recipe);
  // Whether the parts on the screen are the model's doing. An `ai` result that
  // carries a check was sorted against an anchor; an `ai` result without one is
  // a paste, which is a reading rather than a sorting. A `schema` result with
  // no model configured is the one case worth admitting to: its lines are all
  // on the main body because nothing was there to put them anywhere else.
  const sorted = from === "ai" ? (imported.check === undefined ? null : true) : from === "schema" && !aiAvailable ? false : null;
  const rejected = imported.rejected !== undefined && imported.check !== undefined ? imported.check : null;

  return (
    <div className="flex flex-col gap-6" data-source-stage="review" data-import-from={from}>
      {from === "stub" ? (
        <Message intent="warning" title="No recipe data on that page" data-testid="stub-notice">
          {importSummary(from, 0, 0)}
        </Message>
      ) : (
        <Muted as="p" className="text-sm">
          {importSummary(from, ingredientCount(recipe), stepCount(recipe), sorted)}
        </Muted>
      )}

      {reading && (
        <Muted as="p" className="text-sm" data-testid="sorting-notice">
          Sorting into parts…
        </Muted>
      )}

      {readError !== null && (
        <Message intent="warning" title="The model could not read this page" data-testid="read-error">
          <div className="flex flex-col items-start gap-2">
            <span>{`${readError} The page's own reading is below and can be saved as it is.`}</span>
            {onRetryRead !== undefined && (
              <Button type="button" variant="ghost" intent="neutral" disabled={busy || reading} onClick={onRetryRead}>
                Try again
              </Button>
            )}
          </div>
        </Message>
      )}

      {rejected !== null && (
        <Message intent="warning" title="The model changed more than the parts" data-testid="rejected-notice">
          <div className="flex flex-col items-start gap-2">
            <span>{rejectionMessage(rejected)}</span>
            <ul className="flex list-disc flex-col gap-0.5 pl-5 text-sm">
              {changedLines(rejected).map((line, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: a one-shot report of what the model changed; the rows have no ids and are never reordered.
                <li key={`${index}-${line.label}`} data-changed-line={line.label}>
                  {`${line.label}: “${line.text}”`}
                </li>
              ))}
            </ul>
            {onUseRejected !== undefined && (
              <Button type="button" variant="ghost" intent="neutral" disabled={busy} onClick={onUseRejected}>
                Use the model's version anyway
              </Button>
            )}
          </div>
        </Message>
      )}

      {duplicate != null && (
        <Message intent="warning" title="You already have this one" data-testid="duplicate-notice">
          {duplicateMessage(duplicate.name, duplicateBy)}
        </Message>
      )}

      <Card title={recipe.name === "" ? "Untitled" : recipe.name}>
        <div className="flex flex-col gap-2">
          {recipe.description !== "" && <p className="text-sm text-fg-subtle">{recipe.description}</p>}
          <div className="flex flex-wrap items-center gap-1.5">
            {label !== "" && (
              <Badge variant="soft" intent="neutral">
                {label}
              </Badge>
            )}
            {recipe.prepMinutes !== null && <Badge variant="soft" intent="neutral">{`Prep ${recipe.prepMinutes} min`}</Badge>}
            {recipe.cookMinutes !== null && <Badge variant="soft" intent="neutral">{`Cook ${recipe.cookMinutes} min`}</Badge>}
            {recipe.image !== null && (
              <Badge variant="outline" intent="neutral">
                Image
              </Badge>
            )}
            {recipe.tags.map((tag) => (
              <Badge key={tag} variant="outline" intent="brand">
                {tag}
              </Badge>
            ))}
          </div>
          <Muted as="p" className="text-xs" data-source-url="">
            {imported.url}
          </Muted>
        </div>
      </Card>

      {rows.length > 0 && (
        <section className="flex flex-col gap-3" aria-label="Ingredients to review">
          <SectionTitle as="h2">Ingredients</SectionTitle>
          <ul className="flex flex-col gap-3">
            {rows.map((row, index) => (
              <li key={row.key} className="rounded-lg border border-border-normal p-3">
                <IngredientReviewRow
                  row={row}
                  label={`Line ${index + 1}`}
                  disabled={busy}
                  unitMatches={(text) => filterUnits(units, text)}
                  searchFoods={searchFoods}
                  onChange={(next) => onRowsChange(rows.map((current, i) => (i === index ? next : current)))}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {stepCount(recipe) > 0 && (
        <section className="flex flex-col gap-3" aria-label="Steps to review">
          <SectionTitle as="h2">Steps</SectionTitle>
          {recipe.parts
            .filter((part) => part.steps.length > 0)
            .map((part, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: a scraped draft has no ids yet; this preview is read-only and never reordered.
              <div key={`${index}-${part.name}`} className="flex flex-col gap-1" data-import-part={part.name}>
                {part.name !== "" && <span className="text-sm font-medium">{part.name}</span>}
                <ol className="flex list-decimal flex-col gap-1 pl-6">
                  {part.steps.map((step, si) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: a scraped draft's steps are plain strings in order; this preview is read-only.
                    <li key={`${si}-${step.slice(0, 24)}`} className="text-sm">
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
        </section>
      )}

      {error != null && (
        <p className="text-sm text-fg-danger" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="solid" intent="brand" disabled={busy} onClick={onCreate}>
          {busy ? "Working…" : "Create"}
        </Button>
        <Button type="button" variant="ghost" intent="neutral" disabled={busy} onClick={onBack}>
          Back
        </Button>
      </div>
    </div>
  );
}
