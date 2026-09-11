// One recipe. `?servings=N` asks the server for the document scaled to N; the
// scale control only ever navigates, so the loader is the one read path and the
// page always shows what `getRecipe` returned.
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
import { IngredientRow } from "../../../components/IngredientRow";
import { RecipeHeader } from "../../../components/RecipeHeader";
import { StepList } from "../../../components/StepList";
import { mergeIngredients } from "../../../domain/merge";
import type { Component, Ingredient, Recipe } from "../../../domain/recipe";
import { useIngredientMode } from "../../../lib/prefs";
import { getRecipe } from "../../../server/recipes";

export const RecipeViewSearch = z.object({
  servings: z.number().positive().finite().optional(),
});

export const Route = createFileRoute("/recipes/$slug/")({
  validateSearch: RecipeViewSearch,
  loaderDeps: ({ search: { servings } }) => ({ servings }),
  loader: async ({ params, deps }): Promise<Recipe> => getRecipe({ data: { slug: params.slug, servings: deps.servings } }),
  component: RecipePage,
});

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
  const recipe = Route.useLoaderData();
  const navigate = Route.useNavigate();
  const { servings: requested } = Route.useSearch();
  // A servings search param means the loader scaled the document away from
  // the recipe's own servings; the ingredient amounts get a "scaled" class.
  const scaled = requested !== undefined;
  const [ingredientMode] = useIngredientMode();
  const summary = ingredientMode === "summary";
  const hasIngredients = recipe.components.some((component) => component.ingredients.length > 0);
  // Shared by the scale chip and each ingredient row's "Scale to...": both
  // just need a new servings value turned into a navigation.
  const goToServings = (value: number) => void navigate({ search: (prev) => ({ ...prev, servings: value }), replace: true });

  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <RecipeHeader
        recipe={recipe}
        actions={
          <>
            <Button asChild variant="solid" intent="brand" size="sm">
              {/* The primary action stays a button; everything else is in the menu. Carries the current scale into cook mode. */}
              <Link to="/recipes/$slug/cook" params={{ slug: recipe.slug }} search={{ servings: requested }}>
                Cook
              </Link>
            </Button>
            <RecipeActions recipe={recipe} servings={requested} />
          </>
        }
      />
      <ScaleControl servings={recipe.recipeServings} />

      {hasIngredients && (
        <div className="flex justify-end">
          <IngredientModeToggle />
        </div>
      )}

      {summary && hasIngredients && (
        <IngredientList
          ingredients={mergeIngredients(recipe)}
          recipeId={recipe.id}
          scaled={scaled}
          currentServings={recipe.recipeServings}
          onScaleTo={goToServings}
        />
      )}

      {recipe.components.map((component) => (
        <ComponentSection
          key={component.id}
          component={component}
          recipeId={recipe.id}
          scaled={scaled}
          hideIngredients={summary}
          currentServings={recipe.recipeServings}
          onScaleTo={goToServings}
        />
      ))}

      {recipe.steps.length > 0 && (
        <section className="flex flex-col gap-3" aria-label="Method">
          {recipe.components.length > 1 && <SectionTitle as="h2">To finish</SectionTitle>}
          <StepList recipeId={recipe.id} steps={recipe.steps} />
        </section>
      )}

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
    </article>
  );
}

/**
 * Current servings as a chip, with minus and plus either side. Each press
 * navigates with a new `servings` search param, so the loader refetches the
 * scaled document. Hidden when the recipe has no servings recorded: there is
 * nothing to scale by.
 *
 * Tapping the chip opens a `popover` with a number input for typing an exact
 * servings count directly, rather than stepping one at a time. Reset (outside
 * the popover, so it stays visible without opening it) clears a requested
 * scale back to the recipe's own servings.
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
          <Popover.Body className="flex flex-col gap-2 p-3" aria-label="Set servings">
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
 * One component: its heading, ingredients, then steps. An unnamed component
 * (the single section of a flat recipe) has no heading, as in Mealie. A
 * component with one of the two lists empty hides that list (a flat recipe
 * keeps its steps at recipe level, so "No steps" under every ingredient list
 * would be noise); one with both empty says so instead of rendering nothing.
 *
 * `hideIngredients` is set in Summary mode: this component's own ingredients
 * are already shown in the one merged list above (`mergeIngredients`), so
 * they are skipped here. A component whose only content is ingredients then
 * has nothing left to show and renders nothing at all — not the "empty"
 * fallback, which stays for a component that is genuinely blank.
 */
function ComponentSection({
  component,
  recipeId,
  scaled,
  hideIngredients = false,
  currentServings,
  onScaleTo,
}: {
  component: Component;
  recipeId: string;
  scaled: boolean;
  hideIngredients?: boolean;
  currentServings: number;
  onScaleTo: (servings: number) => void;
}) {
  const name = component.name.trim();
  const hasIngredients = component.ingredients.length > 0;
  const hasSteps = component.steps.length > 0;
  if (hideIngredients && hasIngredients && !hasSteps) return null;

  const showIngredients = !hideIngredients && hasIngredients;

  return (
    <section className="flex flex-col gap-3" aria-label={name === "" ? undefined : name}>
      {name !== "" && <SectionTitle as="h2">{name}</SectionTitle>}
      <EmptyBoundary
        isEmpty={!showIngredients && !hasSteps}
        fallback={
          <Muted as="p" className="text-sm" data-empty="component">
            No ingredients or steps yet
          </Muted>
        }
      >
        {showIngredients && (
          <IngredientList ingredients={component.ingredients} recipeId={recipeId} scaled={scaled} currentServings={currentServings} onScaleTo={onScaleTo} />
        )}
        {hasSteps && <StepList recipeId={recipeId} steps={component.steps} />}
      </EmptyBoundary>
    </section>
  );
}

function IngredientList({
  ingredients,
  recipeId,
  scaled,
  currentServings,
  onScaleTo,
}: {
  ingredients: Ingredient[];
  recipeId: string;
  scaled: boolean;
  currentServings: number;
  onScaleTo: (servings: number) => void;
}) {
  return (
    <ul className="flex flex-col gap-2" aria-label="Ingredients">
      {ingredients.map((ingredient) => (
        <IngredientRow
          key={ingredient.id}
          recipeId={recipeId}
          ingredient={ingredient}
          scaled={scaled}
          currentServings={currentServings}
          onScaleTo={onScaleTo}
        />
      ))}
    </ul>
  );
}
