// One recipe. The loader is still the one read path: it fetches the stored
// document once, and `?servings=N` is a pure view over it — the page runs
// `scaledForServings` itself (M25.1, decisions.md row 62), so plus and minus
// repaint without a request while the URL still carries the scale and a
// refresh lands on it. The scale control only ever navigates.
//
// Layout (M24.1): the header spans the page; from `md` the body is a grid with
// the ingredients in a sticky aside (a third) and the method beside it (two
// thirds). Below `md` the two stack, ingredients first. Notes sit between the
// header and the grid (M24.4, decisions.md row 61): they are the household's
// amendments, read before you start.
import { Button } from "@sixthshift/design-system/button";
import { Card } from "@sixthshift/design-system/card";
import { EmptyBoundary } from "@sixthshift/design-system/empty-boundary";
import { Input } from "@sixthshift/design-system/input";
import { Muted } from "@sixthshift/design-system/muted";
import { Popover } from "@sixthshift/design-system/popover";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import { createFileRoute, Link } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { z } from "zod";
import { RecipeActions } from "../../../components/RecipeActions";
import { IngredientModeToggle } from "../../../components/IngredientModeToggle";
import { IngredientList, PartIngredients } from "../../../components/IngredientList";
import { RecipeHeader, RecipeMetaFooter } from "../../../components/RecipeHeader";
import { QuickEditProvider } from "../../../components/QuickEdit";
import { StepList } from "../../../components/StepList";
import { TimerStrip } from "../../../components/TimerStrip";
import { mergeIngredients } from "../../../domain/merge";
import { scaledForServings } from "../../../domain/scale";
import { MadeThisButton, TimelineList } from "../../../components/Timeline";
import type { Part, Recipe, TimelineEvent } from "../../../domain/recipe";
import { useIngredientMode } from "../../../lib/prefs";
import { clearTicksNow, useAnyTicked } from "../../../lib/ticks";
import { useMutate } from "../../../lib/mutate";
import { notifyError } from "../../../lib/notify";
import { getRecipe, setRating } from "../../../server/recipes";
import { listTimeline } from "../../../server/timeline";

export const RecipeViewSearch = z.object({
  servings: z.number().positive().finite().optional(),
});

/** What the page reads: the stored document and its logged cooks. Scaling is applied in the component. */
export type RecipeViewData = { recipe: Recipe; timeline: TimelineEvent[] };

export const Route = createFileRoute("/recipes/$slug/")({
  validateSearch: RecipeViewSearch,
  loader: async ({ params }): Promise<RecipeViewData> => {
    const recipe = await getRecipe({ data: { slug: params.slug } });
    return { recipe, timeline: await listTimeline({ data: { recipeId: recipe.id } }) };
  },
  component: RecipePage,
});

/** A pencil, drawn the way RecipeHeader.tsx draws its own icons. */
function EditIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19 3 20l1-4Z" />
    </svg>
  );
}

/**
 * The servings the scale control moves to: whole steps of one, never below 1.
 * A fractional current value (2.5) first snaps to the whole number on the side
 * it is heading (down -> 2, up -> 3). Pure.
 */
export function nextServings(current: number, direction: -1 | 1): number {
  const snapped = direction < 0 ? Math.ceil(current) - 1 : Math.floor(current) + 1;
  return Math.max(1, snapped);
}

function RecipePage() {
  const { recipe: stored, timeline } = Route.useLoaderData();
  const { servings: requested } = Route.useSearch();
  // The stored document, scaled here rather than on the server, so a tap on
  // plus or minus is a re-render and not a round trip. Everything below reads
  // `recipe`, never `stored`.
  const recipe = scaledForServings(stored, requested);
  // Scaled away from the recipe's own servings: the ingredient amounts get a
  // "scaled" class. Identity, so a recipe with no servings recorded (nothing
  // to scale by, as on the server) does not claim to be scaled.
  const scaled = recipe !== stored;
  const [ingredientMode] = useIngredientMode();
  const summary = ingredientMode === "summary";
  const hasIngredients = recipe.parts.some((part) => part.ingredients.length > 0);
  const mutate = useMutate();
  // The ingredients heading's "Clear" link (M25.6): only worth showing once
  // there is something ticked to clear.
  const anyTicked = useAnyTicked(recipe.id);

  // The header's stars write straight through (M25.3): 0 clears the rating,
  // and the loader re-reads it, so there is nothing optimistic to unwind.
  const rate = async (rating: number) => {
    try {
      await mutate(() => setRating({ data: { id: recipe.id, rating } }));
    } catch (error) {
      notifyError("Couldn't update rating", error);
    }
  };

  // Quick edit (M27.5) hangs off the stored document, not `recipe`: a row's
  // sheet writes back what was stored, whatever scale the page is showing.
  return (
    <QuickEditProvider recipe={stored}>
      <article className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-6">
        <RecipeHeader
          recipe={recipe}
          madeCount={timeline.length}
          onRate={(rating) => void rate(rating)}
          actions={
            <>
              {/* Edit and Cook are both in the open (M25.5) rather than behind
                  the menu; each carries the currently requested scale so it
                  round-trips through the edit page and into cook mode. */}
              <Button asChild variant="outline" intent="neutral" size="sm" iconOnly aria-label="Edit">
                <Link to="/recipes/$slug/edit" params={{ slug: recipe.slug }} search={{ servings: requested }}>
                  <EditIcon />
                </Link>
              </Button>
              <Button asChild variant="solid" intent="brand" size="sm">
                <Link to="/recipes/$slug/cook" params={{ slug: recipe.slug }} search={{ servings: requested }}>
                  Cook
                </Link>
              </Button>
              <RecipeActions recipe={recipe} />
            </>
          }
        />

        {/* Notes before the ingredients (M24.4): they are the household's
            amendments, read before you start, so they sit directly under the
            header rather than after the steps. */}
        {recipe.notes.length > 0 && (
          <section className="flex flex-col gap-3" aria-label="Notes">
            <SectionTitle as="h2">Notes</SectionTitle>
            {recipe.notes.map((note) => (
              <Card key={note.id} title={note.title.trim() !== "" ? note.title : undefined}>
                <p className="whitespace-pre-line">{note.text}</p>
              </Card>
            ))}
          </section>
        )}

        {/* Two columns from `md` (M24.1): the ingredients stick beside the
            method rather than scrolling away above it. A third for the list, two
            thirds for the steps; the aside scrolls itself when it is taller than
            the viewport. Below `md` the two stack, ingredients first. */}
        <div className="flex flex-col gap-6 md:grid md:grid-cols-3 md:items-start md:gap-8" data-testid="recipe-columns">
          <aside
            data-testid="ingredients-column"
            data-print="keep"
            className="flex flex-col gap-6 md:sticky md:top-6 md:max-h-[calc(100dvh-3rem)] md:overflow-y-auto"
          >
            {/* M24.2: the aside's own heading, as Mealie's ingredient list
                header has both the title and the servings stepper together.
                The loose row that used to sit between the page header and the
                grid is gone; the scale control lives here instead. */}
            <div className="flex flex-wrap items-center justify-between gap-3" data-testid="ingredients-heading">
              <SectionTitle as="h2">Ingredients</SectionTitle>
              <div className="flex flex-wrap items-center gap-3">
                <ScaleControl servings={recipe.recipeServings} />
                {anyTicked && (
                  <Button variant="link" intent="neutral" size="sm" data-print="hide" onClick={() => clearTicksNow(recipe.id)}>
                    Clear
                  </Button>
                )}
              </div>
            </div>

            {/* Structured vs. one merged list only means something once there is
                more than one part to merge; a flat recipe has nothing to
                toggle. */}
            {recipe.parts.length > 1 && (
              <div className="flex justify-end">
                <IngredientModeToggle />
              </div>
            )}

            {summary && hasIngredients && (
              <IngredientList ingredients={mergeIngredients(recipe)} recipeId={recipe.id} scaled={scaled} />
            )}

            {!summary &&
              recipe.parts.map((part) => <PartIngredients key={part.id} part={part} recipeId={recipe.id} scaled={scaled} />)}
          </aside>

          <div className="flex max-w-prose flex-col gap-6 md:col-span-2" data-testid="method-column">
            {recipe.parts.map((part) => (
              <PartSteps key={part.id} part={part} recipeId={recipe.id} />
            ))}
          </div>
        </div>

        {/* Any timers started from a step, fixed above the phone tab bar. */}
        <TimerStrip recipeId={recipe.id} fixed />

        {/* M30.2 will move this beside the last step; for now it keeps the
            spot TimelineList's own heading used to hold (M25.6). */}
        <MadeThisButton recipe={recipe} />

        <TimelineList events={timeline} />

        <RecipeMetaFooter recipe={recipe} />
      </article>
    </QuickEditProvider>
  );
}

/**
 * Current servings as a chip, with minus and plus either side. Each press
 * navigates with a new `servings` search param, so the loader refetches the
 * scaled document. Hidden when the recipe has no servings recorded: there is
 * nothing to scale by.
 *
 * Tapping the chip opens a `popover` with a single form in it: a number input
 * for typing an exact servings count directly, rather than stepping one at a
 * time. (M25.2 added a second form here to scale to an amount of a chosen
 * ingredient you had on hand; M29.4 removed it — one way to set servings is
 * enough.) Reset (outside the popover, so it stays visible without opening
 * it) clears a requested scale back to the recipe's own servings.
 */
function ScaleControl({ servings }: { servings: number }) {
  const navigate = Route.useNavigate();
  const { servings: requested } = Route.useSearch();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => String(Number(servings.toFixed(2))));
  if (servings <= 0) return <Muted as="p">Servings not set</Muted>;

  const go = (value: number | undefined) => void navigate({ search: (prev) => ({ ...prev, servings: value }), replace: true });
  const label = `Serves ${Number(servings.toFixed(2))}`;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = Number(draft);
    if (Number.isFinite(value) && value > 0) go(value);
    setOpen(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-3" role="group" aria-label="Scale servings">
      <div className="flex items-center gap-2">
        <Button variant="outline" intent="neutral" size="sm" iconOnly aria-label="Fewer servings" disabled={servings <= 1} onClick={() => go(nextServings(servings, -1))}>
          −
        </Button>
        <Popover
          open={open}
          onOpenChange={(next) => {
            if (next) setDraft(String(Number(servings.toFixed(2))));
            setOpen(next);
          }}
        >
          <Popover.Trigger asChild>
            <button
              type="button"
              data-testid="servings-chip"
              aria-live="polite"
              className="min-w-20 rounded-full border border-border-subtle bg-bg-subtle px-3 py-1 text-center font-medium text-fg-strong"
            >
              {label}
            </button>
          </Popover.Trigger>
          <Popover.Body className="flex flex-col gap-3 p-3" aria-label="Set servings">
            <form className="flex items-center gap-2" onSubmit={submit}>
              <label htmlFor="servings-target" className="text-sm text-fg-subtle">
                Servings
              </label>
              <Input
                id="servings-target"
                type="number"
                inputMode="decimal"
                min={1}
                step="any"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                aria-label="Servings"
                className="w-20"
              />
              <Button type="submit" variant="solid" intent="brand" size="sm">
                Set
              </Button>
            </form>
          </Popover.Body>
        </Popover>
        <Button variant="outline" intent="neutral" size="sm" iconOnly aria-label="More servings" onClick={() => go(nextServings(servings, 1))}>
          +
        </Button>
      </div>
      {requested !== undefined && (
        <Button variant="link" intent="neutral" size="sm" onClick={() => go(undefined)}>
          Reset
        </Button>
      )}
    </div>
  );
}

/**
 * One part's steps in the main column, under the part's name (repeated from
 * the aside so the method reads on its own). A part with ingredients but no
 * steps has nothing to show here — its list is in the aside — so it renders
 * nothing; a part that is genuinely blank says so, as before.
 */
function PartSteps({ part, recipeId }: { part: Part; recipeId: string }) {
  const name = part.name.trim();
  const hasSteps = part.steps.length > 0;
  if (!hasSteps && part.ingredients.length > 0) return null;

  return (
    <section className="flex flex-col gap-3" aria-label={name === "" ? undefined : name}>
      {name !== "" && <SectionTitle as="h2">{name}</SectionTitle>}
      <EmptyBoundary
        isEmpty={!hasSteps}
        fallback={
          <Muted as="p" className="text-sm" data-empty="part">
            No ingredients or steps yet
          </Muted>
        }
      >
        <StepList recipeId={recipeId} steps={part.steps} ingredients={part.ingredients} partId={part.id} />
      </EmptyBoundary>
    </section>
  );
}
