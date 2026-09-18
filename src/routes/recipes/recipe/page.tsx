import { Button } from "@sixthshift/design-system/button";
import { Card } from "@sixthshift/design-system/card";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import { Link } from "@tanstack/react-router";
import { SubRecipesProvider } from "../../../components/recipe/SubRecipes";
import { Page } from "../../../components/shell/Page";
import { AddToShoppingButton } from "../../../components/shopping/AddToShoppingButton";
import { PencilIcon } from "../../../components/ui/icons";
import { mergeIngredients, scaledForServings } from "../../../domain/recipe";
import { useMutate } from "../../../lib/mutate";
import { useIngredientMode } from "../../../lib/prefs";
import { toastError } from "../../../lib/toast";
import { clearTicksNow, useAnyTicked } from "../../../lib/useTicks";
import { setRating } from "../../../server/fns/recipes";
import { IngredientList, PartIngredients } from "./components/IngredientList";
import { IngredientModeToggle } from "./components/IngredientModeToggle";
import { MadeThisButton } from "./components/MadeThisButton";
import { PartSteps } from "./components/PartSteps";
import { QuickEditProvider } from "./components/QuickEditContext";
import { RecipeActions } from "./components/RecipeActions";
import { RecipeHeader } from "./components/RecipeHeader";
import { RecipeMetaFooter } from "./components/RecipeMetaFooter";
import { ScaleControl } from "./components/ScaleControl";
import { TimelineList } from "./components/Timeline";
import { TimerStrip } from "./components/TimerStrip";
import { Route } from "./route";

/** A pencil, drawn the way RecipeHeader.tsx draws its own icons. */
export function RecipePage() {
  const { recipe: stored, timeline, subRecipes, aiAvailable } = Route.useLoaderData();
  const { servings: requested, restyle } = Route.useSearch();
  const navigate = Route.useNavigate();
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
  // The ingredients heading's "Clear" link: only worth showing once
  // there is something ticked to clear.
  const anyTicked = useAnyTicked(recipe.id);

  // The header's stars write straight through: 0 clears the rating,
  // and the loader re-reads it, so there is nothing optimistic to unwind.
  const rate = async (rating: number) => {
    try {
      await mutate(() => setRating({ data: { id: recipe.id, rating } }));
    } catch (error) {
      toastError("Couldn't update rating", error);
    }
  };

  // Quick edit hangs off the stored document, not `recipe`: a row's
  // sheet writes back what was stored, whatever scale the page is showing.
  return (
    <QuickEditProvider recipe={stored}>
      <SubRecipesProvider subRecipes={subRecipes}>
        <Page as="article">
          <RecipeHeader
            recipe={recipe}
            madeCount={timeline.length}
            onRate={(rating) => void rate(rating)}
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
                  <Link to="/recipes/$slug/cook" params={{ slug: recipe.slug }} search={{ servings: requested }}>
                    Cook
                  </Link>
                </Button>
                {/* Takes the scaled document, so what the sheet offers is what the page is showing. */}
                <AddToShoppingButton recipe={recipe} />
                <RecipeActions
                  recipe={recipe}
                  aiAvailable={aiAvailable}
                  restyleOpen={aiAvailable && restyle === true}
                  onRestyleClose={() => void navigate({ search: (prev) => ({ ...prev, restyle: undefined }), replace: true })}
                />
              </>
            }
          />

          {/* Notes before the ingredients: they are the household's
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

          {/* Two columns from `md`: the ingredients stick beside the
              method rather than scrolling away above it. A third for the list, two
              thirds for the steps; the aside scrolls itself when it is taller than
              the viewport. Below `md` the two stack, ingredients first. */}
          <div className="flex flex-col gap-6 md:grid md:grid-cols-3 md:items-start md:gap-8" data-testid="recipe-columns">
            <aside
              data-testid="ingredients-column"
              data-print="keep"
              className="flex flex-col gap-4 md:sticky md:top-6 md:max-h-[calc(100dvh-3rem)] md:overflow-y-auto"
            >
              {/* The aside's own heading, as Mealie's ingredient list header has both the title and the servings stepper together. */}
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

              {hasIngredients && (
                <Card size="lg" className="flex flex-col gap-6">
                  {summary && <IngredientList ingredients={mergeIngredients(recipe)} recipeId={recipe.id} scaled={scaled} />}

                  {!summary && recipe.parts.map((part) => <PartIngredients key={part.id} part={part} recipeId={recipe.id} scaled={scaled} />)}
                </Card>
              )}
            </aside>

            <div className="flex max-w-prose flex-col gap-6 md:col-span-2" data-testid="method-column">
              {recipe.parts.map((part) => (
                <PartSteps key={part.id} part={part} recipeId={recipe.id} />
              ))}

              {/* Under the last step card, not above the History
                  disclosure — the button belongs to the method, not the log. */}
              <div className="flex justify-end" data-testid="made-this-row" data-print="hide">
                <MadeThisButton recipe={recipe} />
              </div>
            </div>
          </div>

          {/* Any timers started from a step, fixed above the phone tab bar. */}
          <TimerStrip recipeId={recipe.id} fixed />

          <TimelineList events={timeline} />

          <RecipeMetaFooter recipe={recipe} />
        </Page>
      </SubRecipesProvider>
    </QuickEditProvider>
  );
}
