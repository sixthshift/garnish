// One recipe. `?servings=N` asks the server for the document scaled to N; the
// scale control only ever navigates, so the loader is the one read path and the
// page always shows what `getRecipe` returned.
import { Button } from "@sixthshift/design-system/button";
import { Card } from "@sixthshift/design-system/card";
import { EmptyBoundary } from "@sixthshift/design-system/empty-boundary";
import { Muted } from "@sixthshift/design-system/muted";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { IngredientModeToggle } from "../../../components/IngredientModeToggle";
import { IngredientRow } from "../../../components/IngredientRow";
import { RecipeHeader } from "../../../components/RecipeHeader";
import { mergeIngredients } from "../../../domain/merge";
import type { Component, Ingredient, Recipe, Step } from "../../../domain/recipe";
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
  const { servings: requested } = Route.useSearch();
  // A servings search param means the loader scaled the document away from
  // the recipe's own servings; the ingredient amounts get a "scaled" class.
  const scaled = requested !== undefined;
  const [ingredientMode] = useIngredientMode();
  const summary = ingredientMode === "summary";
  const hasIngredients = recipe.components.some((component) => component.ingredients.length > 0);

  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <RecipeHeader
        recipe={recipe}
        actions={
          <>
            <Button asChild variant="outline" intent="neutral" size="sm">
              <Link to="/recipes/$slug/edit" params={{ slug: recipe.slug }}>
                Edit
              </Link>
            </Button>
            <Button asChild variant="solid" intent="brand" size="sm">
              {/* Carries the current scale into cook mode. */}
              <Link to="/recipes/$slug/cook" params={{ slug: recipe.slug }} search={{ servings: requested }}>
                Cook
              </Link>
            </Button>
          </>
        }
      />
      <ScaleControl servings={recipe.recipeServings} />

      {hasIngredients && (
        <div className="flex justify-end">
          <IngredientModeToggle />
        </div>
      )}

      {summary && hasIngredients && <IngredientList ingredients={mergeIngredients(recipe)} recipeId={recipe.id} scaled={scaled} />}

      {recipe.components.map((component) => (
        <ComponentSection key={component.id} component={component} recipeId={recipe.id} scaled={scaled} hideIngredients={summary} />
      ))}

      {recipe.steps.length > 0 && (
        <section className="flex flex-col gap-3" aria-label="Method">
          {recipe.components.length > 1 && <SectionTitle as="h2">To finish</SectionTitle>}
          <StepList steps={recipe.steps} />
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
 * Current servings with minus and plus. Each press navigates with a new
 * `servings` search param, so the loader refetches the scaled document. Hidden
 * when the recipe has no servings recorded: there is nothing to scale by.
 */
function ScaleControl({ servings }: { servings: number }) {
  const navigate = Route.useNavigate();
  const { servings: requested } = Route.useSearch();
  if (servings <= 0) return <Muted as="p">Servings not set</Muted>;

  const go = (value: number | undefined) => void navigate({ search: (prev) => ({ ...prev, servings: value }), replace: true });
  const label = `Serves ${Number(servings.toFixed(2))}`;

  return (
    <div className="flex flex-wrap items-center gap-3" role="group" aria-label="Scale servings">
      <div className="flex items-center gap-2">
        <Button variant="outline" intent="neutral" size="sm" iconOnly aria-label="Fewer servings" disabled={servings <= 1} onClick={() => go(nextServings(servings, -1))}>
          −
        </Button>
        <span className="min-w-20 text-center font-medium text-fg-strong" aria-live="polite">
          {label}
        </span>
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
}: {
  component: Component;
  recipeId: string;
  scaled: boolean;
  hideIngredients?: boolean;
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
        {showIngredients && <IngredientList ingredients={component.ingredients} recipeId={recipeId} scaled={scaled} />}
        {hasSteps && <StepList steps={component.steps} />}
      </EmptyBoundary>
    </section>
  );
}

function IngredientList({ ingredients, recipeId, scaled }: { ingredients: Ingredient[]; recipeId: string; scaled: boolean }) {
  return (
    <ul className="flex flex-col gap-2" aria-label="Ingredients">
      {ingredients.map((ingredient) => (
        <IngredientRow key={ingredient.id} recipeId={recipeId} ingredient={ingredient} scaled={scaled} />
      ))}
    </ul>
  );
}

function StepList({ steps }: { steps: Step[] }) {
  return (
    <ol className="flex flex-col gap-3" aria-label="Steps">
      {steps.map((step, index) => (
        <li key={step.id} className="flex gap-3">
          <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-bg-brand-subtle text-xs font-semibold text-fg-brand" aria-hidden="true">
            {index + 1}
          </span>
          <p className="whitespace-pre-line">
            <span className="sr-only">{`Step ${index + 1}. `}</span>
            {step.text}
          </p>
        </li>
      ))}
    </ol>
  );
}
