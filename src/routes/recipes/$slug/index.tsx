// One recipe. `?servings=N` asks the server for the document scaled to N; the
// scale control only ever navigates, so the loader is the one read path and the
// page always shows what `getRecipe` returned.
import { Button } from "@sixthshift/design-system/button";
import { Card } from "@sixthshift/design-system/card";
import { Heading } from "@sixthshift/design-system/heading";
import { Muted } from "@sixthshift/design-system/muted";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import { TagChip } from "@sixthshift/design-system/tag-chip";
import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { Rating } from "../../../components/ui/Rating";
import { formatDuration, formatIngredient, formatYield, totalMinutes } from "../../../domain/format";
import type { Component, Ingredient, Recipe, Step } from "../../../domain/recipe";
import { recipeImageUrl } from "../../../lib/images";
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
  const total = totalMinutes(recipe.prepTime, recipe.performTime);
  const times: Array<[string, string]> = (
    [
      ["Prep", formatDuration(recipe.prepTime)],
      ["Cook", formatDuration(recipe.performTime)],
      ["Total", formatDuration(total)],
    ] as Array<[string, string]>
  ).filter(([, value]) => value !== "");
  const yieldText = formatYield(recipe.recipeYieldQuantity, recipe.yieldUnit, recipe.recipeYield);
  const src = recipeImageUrl(recipe.image);

  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-4">
        {src ? (
          <img src={src} alt="" className="aspect-video w-full rounded-xl object-cover" />
        ) : (
          <ImagePlaceholder />
        )}
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <Heading as="h1">{recipe.name}</Heading>
            <Button asChild variant="outline" intent="neutral" size="sm">
              <Link to="/recipes/$slug/edit" params={{ slug: recipe.slug }}>
                Edit
              </Link>
            </Button>
          </div>
          {recipe.rating !== null && <Rating value={recipe.rating} />}
          {recipe.description.trim() !== "" && <p className="text-fg-normal">{recipe.description}</p>}
          {recipe.tags.length > 0 && (
            <ul className="flex flex-wrap gap-1" aria-label="Tags">
              {recipe.tags.map((tag) => (
                <li key={tag.id}>
                  <Link to="/" search={{ tag: tag.slug }} className="rounded-full focus-visible:outline-2 focus-visible:outline-border-brand">
                    <TagChip tag={tag.name} size="md" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {(times.length > 0 || yieldText !== "") && (
            <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
              {times.map(([label, value]) => (
                <div key={label} className="flex gap-1.5">
                  <dt className="text-fg-subtle">{label}</dt>
                  <dd className="font-medium text-fg-strong">{value}</dd>
                </div>
              ))}
              {yieldText !== "" && (
                <div className="flex gap-1.5">
                  <dt className="text-fg-subtle">Makes</dt>
                  <dd className="font-medium text-fg-strong">{yieldText}</dd>
                </div>
              )}
            </dl>
          )}
        </div>
        <ScaleControl servings={recipe.recipeServings} />
      </header>

      {recipe.components.map((component) => (
        <ComponentSection key={component.id} component={component} />
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
 * (the single section of a flat recipe) has no heading, as in Mealie.
 */
function ComponentSection({ component }: { component: Component }) {
  const name = component.name.trim();
  return (
    <section className="flex flex-col gap-3" aria-label={name === "" ? undefined : name}>
      {name !== "" && <SectionTitle as="h2">{name}</SectionTitle>}
      {component.ingredients.length > 0 && <IngredientList ingredients={component.ingredients} />}
      {component.steps.length > 0 && <StepList steps={component.steps} />}
    </section>
  );
}

function IngredientList({ ingredients }: { ingredients: Ingredient[] }) {
  return (
    <ul className="flex flex-col gap-1.5" aria-label="Ingredients">
      {ingredients.map((ingredient) => (
        <li key={ingredient.id} className="flex items-baseline gap-2" data-fixed={ingredient.fixed ? "true" : undefined}>
          <span>{formatIngredient(ingredient)}</span>
          {ingredient.fixed && (
            // Cooklang's `=`: the amount stays put however many you feed.
            <Muted as="span" className="text-xs" title="Fixed amount, does not scale with servings">
              fixed
            </Muted>
          )}
        </li>
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

function ImagePlaceholder() {
  return (
    <div
      data-placeholder="image"
      aria-hidden="true"
      className="flex aspect-video w-full items-center justify-center rounded-xl bg-bg-subtle text-fg-subtle"
    >
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <circle cx="8.5" cy="10" r="1.5" />
        <path d="m21 16-4.5-4.5L9 19" />
      </svg>
    </div>
  );
}
