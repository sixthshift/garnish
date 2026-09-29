import { Badge } from "@sixthshift/design-system/badge";
import { Button } from "@sixthshift/design-system/button";
import { Card } from "@sixthshift/design-system/card";
import { Message } from "@sixthshift/design-system/message";
import { Muted } from "@sixthshift/design-system/muted";
import type { IngredientReview } from "../../../../domain/draft";
import type { ImportedRecipe } from "../../../../domain/import";
import type { FoodRow, Unit } from "../../../../domain/reference";
import { IngredientReviewList, ReviewSteps } from "./IngredientReviewList";
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

      <Card size="md" className="flex flex-row gap-4">
        {recipe.image !== null && (
          <img
            src={recipe.image}
            alt=""
            className="aspect-square w-20 shrink-0 self-start rounded-md object-cover sm:aspect-[4/3] sm:w-44"
            data-testid="review-image"
          />
        )}
        <div className="flex min-w-0 flex-col gap-2">
          <h2 className="font-display text-xl font-semibold leading-tight">{recipe.name === "" ? "Untitled" : recipe.name}</h2>
          {recipe.description !== "" && <p className="text-sm text-fg-subtle">{recipe.description}</p>}
          <div className="flex flex-wrap items-center gap-1.5">
            {label !== "" && (
              <Badge variant="soft" intent="neutral">
                {label}
              </Badge>
            )}
            {recipe.prepMinutes !== null && <Badge variant="soft" intent="neutral">{`Prep ${recipe.prepMinutes} min`}</Badge>}
            {recipe.cookMinutes !== null && <Badge variant="soft" intent="neutral">{`Cook ${recipe.cookMinutes} min`}</Badge>}
            {recipe.tags.map((tag) => (
              <Badge key={tag} variant="outline" intent="brand">
                {tag}
              </Badge>
            ))}
          </div>
          {imported.url !== "" && (
            <Muted as="p" className="truncate text-xs" data-source-url="">
              {imported.url}
            </Muted>
          )}
        </div>
      </Card>

      {/* Side by side from `lg`, as the recipe page lays a recipe out; one column below it. */}
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        {rows.length > 0 && <IngredientReviewList rows={rows} units={units} searchFoods={searchFoods} busy={busy} onRowsChange={onRowsChange} />}
        {stepCount(recipe) > 0 && (
          <div className="lg:sticky lg:top-6">
            <ReviewSteps parts={recipe.parts} styledNext={aiAvailable} />
          </div>
        )}
      </div>

      <div
        className="sticky bottom-20 z-10 -mx-4 flex flex-col gap-2 border-t border-border-normal bg-bg-normal px-4 py-3 md:bottom-0 md:mx-0 md:rounded-t-lg"
        data-testid="review-footer"
      >
        {error != null && (
          <p className="text-sm text-fg-danger" role="alert">
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="ghost" intent="neutral" disabled={busy} onClick={onBack}>
            Back
          </Button>
          <Muted as="span" className="grow text-right text-sm">
            {aiAvailable ? "Next, the house style." : "Next, the full recipe to check before it is saved."}
          </Muted>
          <Button type="button" variant="solid" intent="brand" disabled={busy} onClick={onCreate}>
            {busy ? "Working…" : aiAvailable ? "Continue" : "Create"}
          </Button>
        </div>
      </div>
    </div>
  );
}
