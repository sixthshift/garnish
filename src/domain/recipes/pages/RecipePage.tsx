import { Button } from "@sixthshift/design-system/button";
import { Card } from "@sixthshift/design-system/card";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import { getRouteApi, Link } from "@tanstack/react-router";
import { useRef } from "react";
import { setRating } from "../../../api/rpc/recipes";
import { Page } from "../../../components/Page";
import { SubRecipesProvider } from "../../../components/recipe/SubRecipes";
import { AddToShoppingButton } from "../../../components/shopping/AddToShoppingButton";
import { PencilIcon } from "../../../components/ui/icons";
import { useMutate } from "../../../lib/mutate";
import { useIngredientMode } from "../../../lib/prefs";
import { toastError } from "../../../lib/toast";
import { useLayout } from "../../../lib/useLayout";
import { clearTicksNow, useAnyTicked } from "../../../lib/useTicks";
import { RecipeSpread } from "../components/desktop/RecipeSpread";
import { IngredientList, PartIngredients } from "../components/recipe/IngredientList";
import { IngredientModeToggle } from "../components/recipe/IngredientModeToggle";
import { MadeThisButton } from "../components/recipe/MadeThisButton";
import { PartSteps } from "../components/recipe/PartSteps";
import { IngredientsToolbar, QuickEditProvider } from "../components/recipe/QuickEditContext";
import { RecipeActions } from "../components/recipe/RecipeActions";
import { RecipeHeader } from "../components/recipe/RecipeHeader";
import { RecipeMetaFooter } from "../components/recipe/RecipeMetaFooter";
import { ScaleControl } from "../components/recipe/ScaleControl";
import { TimelineList } from "../components/recipe/Timeline";
import { TimerStrip } from "../components/recipe/TimerStrip";
import { mergeIngredients, scaledForServings, withChoices } from "../recipe";

const route = getRouteApi("/recipes/$slug/");

/**
 * A recipe's page. On a phone the header, the ingredients and the method, one
 * after another; on a desktop the same pieces laid out as a cookbook spread
 * (RecipeSpread, decisions.md row 207). Only the arrangement differs.
 */
export function RecipePage() {
  const { recipe: stored, timeline, subRecipes, aiAvailable } = route.useLoaderData();
  const { servings: requested, choices } = route.useSearch();
  // The stored document, made with the options a plan entry chose (decisions.md
  // row 198) and scaled here rather than on the server, so a tap on plus or
  // minus is a re-render and not a round trip. Everything below reads
  // `recipe`, never `stored`.
  const chosen = withChoices(stored, choices ?? {});
  const recipe = scaledForServings(chosen, requested);
  // Scaled away from the recipe's own servings: the ingredient amounts get a
  // "scaled" class. Identity, so a recipe with no servings recorded (nothing
  // to scale by, as on the server) does not claim to be scaled.
  const scaled = recipe !== chosen;
  const [ingredientMode] = useIngredientMode();
  const summary = ingredientMode === "summary";
  const hasIngredients = recipe.parts.some((part) => part.ingredients.length > 0);
  const mutate = useMutate();
  // The ingredients heading's "Clear" link: only worth showing once
  // there is something ticked to clear.
  const anyTicked = useAnyTicked(recipe.id);
  const ingredientsHeading = useRef<HTMLElement>(null);
  const desktop = useLayout() === "desktop";

  // The header's stars write straight through: 0 clears the rating,
  // and the loader re-reads it, so there is nothing optimistic to unwind.
  const rate = async (rating: number) => {
    try {
      await mutate(() => setRating({ data: { id: recipe.id, rating } }));
    } catch (error) {
      toastError("Couldn't update rating", error);
    }
  };

  const header = (
    <RecipeHeader
      recipe={recipe}
      madeCount={timeline.length}
      onRate={(rating) => void rate(rating)}
      // The spread draws the photo itself, filling the top of its left page.
      showImage={!desktop}
      actions={
        <>
          {/* Edit and Cook are both in the open rather than behind
              the menu; each carries the currently requested scale so it
              round-trips through the edit page and into cook mode. */}
          <Button asChild variant="outline" intent="neutral" size="sm" iconOnly aria-label="Edit">
            <Link to="/recipes/$slug/edit" params={{ slug: recipe.slug }} search={{ servings: requested }}>
              <PencilIcon />
            </Link>
          </Button>
          <Button asChild variant="solid" intent="brand" size="sm">
            <Link to="/recipes/$slug/cook" params={{ slug: recipe.slug }} search={{ servings: requested, choices }}>
              Cook
            </Link>
          </Button>
          {/* Takes the scaled document, so what the sheet offers is what the page is showing. */}
          <AddToShoppingButton recipe={recipe} />
          <RecipeActions recipe={recipe} aiAvailable={aiAvailable} />
        </>
      }
    />
  );

  const lists = (
    <>
      {summary && <IngredientList ingredients={mergeIngredients(recipe)} recipeId={recipe.id} scaled={scaled} />}
      {!summary && recipe.parts.map((part) => <PartIngredients key={part.id} part={part} recipeId={recipe.id} scaled={scaled} />)}
    </>
  );

  const ingredients = (
    <>
      {/* The column's own heading, as Mealie's ingredient list header has both the title and the servings stepper together. */}
      <div className="flex flex-wrap items-center justify-between gap-3" data-testid="ingredients-heading">
        {/* Focusable from code only: where Done fixing hands focus as it goes. */}
        <SectionTitle as="h2" ref={ingredientsHeading} tabIndex={-1} className="outline-none">
          Ingredients
        </SectionTitle>
        <div className="flex flex-wrap items-center gap-3">
          <ScaleControl servings={recipe.recipeServings} />
          {anyTicked && (
            <Button inline intent="neutral" size="sm" data-print="hide" onClick={() => clearTicksNow(recipe.id)}>
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Structured vs. one merged list only means something once there is
          more than one part to merge; a flat recipe has nothing to
          toggle. */}
      <IngredientsToolbar toggle={recipe.parts.length > 1 && <IngredientModeToggle />} returnFocus={ingredientsHeading} />

      {/* A card on a phone lifts the list off the page; a desktop's column is a page of the spread already. */}
      {hasIngredients && desktop && <div className="flex flex-col gap-6">{lists}</div>}
      {hasIngredients && !desktop && (
        <Card size="lg" className="flex flex-col gap-6">
          {lists}
        </Card>
      )}
    </>
  );

  const steps = recipe.parts.map((part) => <PartSteps key={part.id} part={part} recipeId={recipe.id} />);

  // Notes after the method: a cook opens the page for what to get out and
  // what to do, and "Make ahead" or "Why it works" is read once that is in
  // hand. Mealie's order.
  const notes = recipe.notes.length > 0 && (
    <section className="flex flex-col gap-3" aria-label="Notes" data-testid="recipe-notes">
      <SectionTitle as="h2">Notes</SectionTitle>
      {recipe.notes.map((note) => (
        <Card key={note.id} title={note.title.trim() !== "" ? note.title : undefined}>
          <p className="whitespace-pre-line">{note.text}</p>
        </Card>
      ))}
    </section>
  );

  // Under the last step card, not above the History
  // disclosure — the button belongs to the method, not the log.
  const madeThis = (
    <div className="flex justify-end" data-testid="made-this-row" data-print="hide">
      <MadeThisButton recipe={recipe} />
    </div>
  );

  // Quick edit hangs off the stored document, not `recipe`: a row's
  // sheet writes back what was stored, whatever scale the page is showing.
  return (
    <QuickEditProvider recipe={stored}>
      <SubRecipesProvider subRecipes={subRecipes}>
        {desktop ? (
          <>
            <RecipeSpread
              recipe={recipe}
              header={header}
              ingredients={ingredients}
              method={
                <>
                  {steps}
                  {madeThis}
                </>
              }
              notes={notes}
              history={
                <>
                  <TimelineList events={timeline} defaultOpen />
                  <RecipeMetaFooter recipe={recipe} />
                </>
              }
            />
            <TimerStrip recipeId={recipe.id} fixed />
          </>
        ) : (
          <Page as="article">
            {header}

            {/* The ingredients, then the method (critique #13). */}
            <div className="flex flex-col gap-6" data-testid="recipe-columns">
              <aside data-testid="ingredients-column" data-print="keep" className="flex flex-col gap-4">
                {ingredients}
              </aside>

              <div className="flex flex-col gap-6" data-testid="method-column">
                {steps}
                {notes}
                {madeThis}
              </div>
            </div>

            {/* Any timers started from a step, fixed above the phone tab bar. */}
            <TimerStrip recipeId={recipe.id} fixed />

            <TimelineList events={timeline} />

            <RecipeMetaFooter recipe={recipe} />
          </Page>
        )}
      </SubRecipesProvider>
    </QuickEditProvider>
  );
}
