import { Button } from "@sixthshift/design-system/button";
import { Muted } from "@sixthshift/design-system/muted";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { getRecipe, subRecipesOf } from "../../../../api/rpc/recipes";
import { SubRecipesProvider } from "../../../../components/recipe/SubRecipes";
import { recipeImageUrl } from "../../../../lib/images";
import { formatDuration, totalMinutes } from "../../ingredient";
import { type Recipe, type SubRecipe, scaledForServings, withChoices } from "../../recipe";
import { PartIngredients } from "../recipe/IngredientList";
import { PartSteps } from "../recipe/PartSteps";
import { StepLinksProvider } from "../recipe/StepLinks";

export type RecipeInsetProps = {
  slug: string;
  choices?: Record<string, string>;
  servings?: number;
  /** Focus the title once the recipe has drawn, so a keyboard and a screen reader are where it opened. */
  focusOnOpen?: boolean;
};

type Loaded = { state: "loading" } | { state: "failed" } | { state: "ready"; recipe: Recipe; subRecipes: SubRecipe[] };

/**
 * A recipe to look at beside the page it was opened from, in a desktop's side
 * panel (decisions.md row 206): its picture, name and time, then its
 * ingredients and method, live, so a tick or a timer is the recipe page's own.
 * The plan's choices and servings are applied as the page would. Open the
 * recipe goes to its page, and Cook to cook mode.
 */
export function RecipeInset({ slug, choices, servings, focusOnOpen = false }: RecipeInsetProps) {
  const [loaded, setLoaded] = useState<Loaded>({ state: "loading" });
  const title = useRef<HTMLHeadingElement>(null);
  const ready = loaded.state === "ready";
  useEffect(() => {
    if (ready && focusOnOpen) title.current?.focus({ preventScroll: true });
  }, [ready, focusOnOpen]);

  useEffect(() => {
    let current = true;
    setLoaded({ state: "loading" });
    getRecipe({ data: { slug } })
      .then(async (recipe) => {
        const subRecipes = await subRecipesOf({ data: { id: recipe.id } }).catch(() => []);
        if (current) setLoaded({ state: "ready", recipe, subRecipes });
      })
      .catch(() => {
        if (current) setLoaded({ state: "failed" });
      });
    return () => {
      current = false;
    };
  }, [slug]);

  if (loaded.state === "loading") {
    return (
      <Muted as="p" role="status" className="p-6">
        Opening the recipe…
      </Muted>
    );
  }
  if (loaded.state === "failed") {
    return (
      <div className="flex flex-col items-start gap-3 p-6" role="alert">
        <p>Couldn't open this recipe.</p>
        <Button asChild variant="outline" intent="neutral" size="sm">
          <Link to="/recipes/$slug" params={{ slug }}>
            Try its page
          </Link>
        </Button>
      </div>
    );
  }

  const chosen = withChoices(loaded.recipe, choices ?? {});
  const recipe = scaledForServings(chosen, servings);
  const scaled = recipe !== chosen;
  const image = recipeImageUrl(recipe.image);
  const time = formatDuration(totalMinutes(recipe.prepTime, recipe.performTime));
  const serves = recipe.recipeServings > 0 ? `Serves ${recipe.recipeServings}` : "";
  const meta = [time, serves].filter((part) => part !== "").join(" · ");
  const search = { ...(choices && Object.keys(choices).length > 0 && { choices }), ...(servings !== undefined && { servings }) };

  return (
    <SubRecipesProvider subRecipes={loaded.subRecipes}>
      <article className="flex flex-col gap-6 p-6" data-testid="recipe-inset">
        {image !== null && <img src={image} alt="" className="aspect-[16/9] w-full rounded-lg object-cover" />}
        <header className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h2 ref={title} tabIndex={-1} className="font-display text-2xl font-semibold leading-tight text-fg-strong outline-none">
              {recipe.name}
            </h2>
            {meta !== "" && <Muted as="p">{meta}</Muted>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="solid" intent="brand" size="sm">
              <Link to="/recipes/$slug/cook" params={{ slug }} search={search}>
                Cook
              </Link>
            </Button>
            <Button asChild variant="outline" intent="neutral" size="sm">
              <Link to="/recipes/$slug" params={{ slug }} search={search}>
                Open the recipe
              </Link>
            </Button>
          </div>
        </header>

        {/* The panel's own width decides, not the screen's: wide enough for
            both (a wide screen's panel, row 207), the list sits beside the
            method rather than above it. */}
        <div className="@container">
          <StepLinksProvider recipe={recipe}>
            <div className="flex flex-col gap-6 @min-[36rem]:grid @min-[36rem]:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] @min-[36rem]:items-start">
              {recipe.parts.some((part) => part.ingredients.length > 0) && (
                <section className="flex flex-col gap-4" aria-label="Ingredients" data-testid="inset-ingredients">
                  <SectionTitle as="h3">Ingredients</SectionTitle>
                  {recipe.parts.map((part) => (
                    <PartIngredients key={part.id} part={part} recipeId={recipe.id} scaled={scaled} />
                  ))}
                </section>
              )}

              <section className="flex flex-col gap-4" aria-label="Method" data-testid="inset-method">
                <SectionTitle as="h3">Method</SectionTitle>
                {recipe.parts.map((part) => (
                  <PartSteps key={part.id} part={part} recipeId={recipe.id} />
                ))}
              </section>
            </div>
          </StepLinksProvider>
        </div>
      </article>
    </SubRecipesProvider>
  );
}
