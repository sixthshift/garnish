// Cook mode: the recipe as a deck of cards, one on screen at a time in large
// type. `?step=N` is the card index and `?servings=N` scales the document, both
// through the URL so the loader is still the one read path (as on the view
// page) and a refresh lands on the same card. The shell hides its nav here
// (`staticData.fullscreen`), leaving the header and footer of this page as the
// only chrome.
import { Button } from "@sixthshift/design-system/button";
import { Card } from "@sixthshift/design-system/card";
import { Muted } from "@sixthshift/design-system/muted";
import { ProgressBar } from "@sixthshift/design-system/progress-bar";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { z } from "zod";
import { NumberStepper } from "../../../components/ui/NumberStepper";
import { buildCookCards, clampStep, type CookCard } from "../../../domain/cook";
import { formatIngredient } from "../../../domain/format";
import type { Recipe } from "../../../domain/recipe";
import { getRecipe } from "../../../server/recipes";

export const CookSearch = z.object({
  servings: z.number().positive().finite().optional(),
  /**
   * Card index; absent means 0. Optional rather than `.default(0)` so the URL
   * without it is already canonical (a default would make the router rewrite
   * `/cook` to `/cook?step=0`). Out-of-range values are clamped at render time.
   */
  step: z.number().int().nonnegative().optional(),
});

export const Route = createFileRoute("/recipes/$slug/cook")({
  validateSearch: CookSearch,
  staticData: { fullscreen: true },
  loaderDeps: ({ search: { servings } }) => ({ servings }),
  loader: async ({ params, deps }): Promise<Recipe> => getRecipe({ data: { slug: params.slug, servings: deps.servings } }),
  component: CookPage,
});

/** The card index an arrow key moves to, or null when the key is not one of ours. Pure. */
export function stepForKey(key: string, index: number, count: number): number | null {
  if (key === "ArrowLeft") return index > 0 ? index - 1 : null;
  if (key === "ArrowRight") return index < count - 1 ? index + 1 : null;
  return null;
}

/** "3 of 12", with the component name when the card has one. Pure. */
export function positionLabel(index: number, count: number, component: string): string {
  const position = `${index + 1} of ${count}`;
  return component === "" ? position : `${position} · ${component}`;
}

function CookPage() {
  const recipe = Route.useLoaderData();
  const { step, servings: requested } = Route.useSearch();
  const navigate = Route.useNavigate();

  const cards = buildCookCards(recipe);
  const index = clampStep(step ?? 0, cards.length);
  const card: CookCard | undefined = cards[index];

  const goTo = (next: number) => void navigate({ search: (prev) => ({ ...prev, step: next }) });
  const scaleTo = (value: number) => void navigate({ search: (prev) => ({ ...prev, servings: value }), replace: true });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // Typing in the servings field must not flip cards.
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, select")) return;
      const next = stepForKey(event.key, index, cards.length);
      if (next === null) return;
      event.preventDefault();
      goTo(next);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="flex min-h-dvh flex-col bg-bg-normal text-fg-normal">
      <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-border-normal bg-bg-normal px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Button asChild variant="outline" intent="neutral" size="sm">
            <Link to="/recipes/$slug" params={{ slug: recipe.slug }} search={{ servings: requested }}>
              Exit
            </Link>
          </Button>
          <span className="truncate font-semibold text-fg-strong">{recipe.name}</span>
        </div>
        {recipe.recipeServings > 0 && (
          <NumberStepper label="Serves" value={Number(recipe.recipeServings.toFixed(2))} min={1} onChange={scaleTo} className="flex-row items-center gap-2" />
        )}
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-4 p-4">
        {card === undefined ? (
          <Muted as="p" className="text-center text-xl">
            Nothing to cook yet: this recipe has no ingredients or steps.
          </Muted>
        ) : (
          <CookCardView card={card} />
        )}
      </main>

      <footer className="sticky bottom-0 z-10 flex flex-col gap-3 border-t border-border-normal bg-bg-normal px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <ProgressBar completed={index + 1} total={cards.length} showFraction={false} label="Cook progress" />
        <div className="flex items-center justify-between gap-3">
          <Button variant="outline" intent="neutral" size="lg" disabled={index <= 0} onClick={() => goTo(index - 1)}>
            Prev
          </Button>
          <span className="min-w-0 flex-1 truncate text-center text-sm text-fg-subtle" aria-live="polite" data-position>
            {cards.length === 0 ? "0 of 0" : positionLabel(index, cards.length, card?.component ?? "")}
          </span>
          <Button variant="solid" intent="brand" size="lg" disabled={index >= cards.length - 1} onClick={() => goTo(index + 1)}>
            Next
          </Button>
        </div>
      </footer>
    </div>
  );
}

/** One card in large type: the component's ingredient list, or a single step. */
function CookCardView({ card }: { card: CookCard }) {
  const heading = card.component === "" ? undefined : card.component;
  if (card.kind === "ingredients") {
    return (
      <Card title={heading && <span className="text-xl">{heading}</span>} data-card="ingredients">
        <p className="mb-3 text-sm font-medium uppercase tracking-wide text-fg-subtle">Ingredients</p>
        <ul className="flex flex-col gap-3 text-2xl leading-snug" aria-label="Ingredients">
          {card.ingredients.map((ingredient) => (
            <li key={ingredient.id} className="flex flex-wrap items-baseline gap-x-3" data-fixed={ingredient.fixed ? "true" : undefined}>
              <span>{formatIngredient(ingredient)}</span>
              {ingredient.fixed && (
                <Muted as="span" className="text-sm" title="Fixed amount, does not scale with servings">
                  fixed
                </Muted>
              )}
            </li>
          ))}
        </ul>
      </Card>
    );
  }
  return (
    <Card title={heading && <span className="text-xl">{heading}</span>} data-card="step">
      <p className="mb-3 text-sm font-medium uppercase tracking-wide text-fg-subtle">
        Step {card.number} of {card.total}
      </p>
      <p className="whitespace-pre-line text-3xl leading-snug">{card.step.text}</p>
    </Card>
  );
}
