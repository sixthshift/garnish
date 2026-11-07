import { Button } from "@sixthshift/design-system/button";
import { Card } from "@sixthshift/design-system/card";
import { Message } from "@sixthshift/design-system/message";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import { Sheet } from "@sixthshift/design-system/sheet";
import { getRouteApi, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { startCooking } from "../../../api/rpc/cooking";
import { setRating } from "../../../api/rpc/recipes";
import { SubRecipesProvider } from "../../../components/recipe/SubRecipes";
import { AddToShoppingButton } from "../../../components/shopping/AddToShoppingButton";
import { PencilIcon } from "../../../components/ui/icons";
import { useMutate } from "../../../lib/mutate";
import { useIngredientMode } from "../../../lib/prefs";
import { toastError } from "../../../lib/toast";
import { useLayout } from "../../../lib/useLayout";
import { clearTicksNow, useAnyTicked } from "../../../lib/useTicks";
import { useWakeLock } from "../../../lib/useWakeLock";
import { CookingProvider, type CookingValue, useNowStep } from "../components/cooking/CookingContext";
import { CookingHeader, FinishCooking } from "../components/cooking/CookingHeader";
import { CookingNotes } from "../components/cooking/CookingNotes";
import { CookingSpread } from "../components/cooking/desktop/CookingSpread";
import { NoteButton, PhoneCooking } from "../components/cooking/mobile/PhoneCooking";
import { useCookingSession } from "../components/cooking/useCookingSession";
import { RecipeSpread } from "../components/desktop/RecipeSpread";
import { CookBar } from "../components/mobile/CookBar";
import { PhoneRecipe } from "../components/mobile/PhoneRecipe";
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
import { adjustmentMarks, isStale, withAdjustments } from "../cooking";
import { formatIngredient } from "../ingredient";
import { mergeIngredients, scaledForServings, withChoices } from "../recipe";

const route = getRouteApi("/recipes/$slug/");

/**
 * A recipe's page. On a phone the photo with the page sliding up over it,
 * the ingredients and the method as two tabs and Start cooking held under the
 * thumb (PhoneRecipe, decisions.md row 208); on a desktop a cookbook spread
 * (RecipeSpread, row 207). Both are built from the same pieces here.
 *
 * `?cooking` is the same page cooked from (decisions.md row 214): the bars
 * and the left page fold into one header line, the first unticked step is
 * marked Now, tonight's changes are drawn in place, and Finish goes to the
 * review. The session behind it is the loader's.
 */
export function RecipePage() {
  const { recipe: stored, timeline, subRecipes, aiAvailable, session } = route.useLoaderData();
  const search = route.useSearch();
  const cooking = search.cooking === true;
  // Resumed with no servings or choices in the address, cooking takes the ones the session began at.
  const requested = search.servings ?? (cooking ? (session?.servings ?? undefined) : undefined);
  const choices = search.choices ?? (cooking ? (session?.choices ?? undefined) : undefined);
  // The stored document with tonight's changes while cooking, made with the
  // options a plan entry chose (decisions.md row 198) and scaled here rather
  // than on the server, so a tap on plus or minus is a re-render and not a
  // round trip. Everything below reads `recipe`, never `stored`.
  const adjustments = cooking ? (session?.adjustments ?? []) : [];
  const tonight = withAdjustments(stored, adjustments);
  const chosen = withChoices(tonight, choices ?? {});
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
  // The page is what is left open at the stove, so the screen stays on while
  // it is (decisions.md row 213); silent where the browser can't.
  useWakeLock();
  useCookingSession({ recipeId: stored.id, cooking, session, servings: requested, choices });
  const nowStepId = useNowStep(recipe, cooking);
  // What a changed line read before tonight, at the page's servings and choices.
  const cookingValue = useMemo((): CookingValue | null => {
    if (!cooking) return null;
    const before = scaledForServings(withChoices(stored, choices ?? {}), requested);
    const rows = new Map(before.parts.flatMap((part) => part.ingredients.map((row) => [row.id, row] as const)));
    const marks = adjustmentMarks(adjustments);
    const was = new Map([...marks.keys()].flatMap((id) => (rows.has(id) ? [[id, formatIngredient(rows.get(id)!)] as const] : [])));
    return { nowStepId, marks, was };
  }, [cooking, stored, choices, requested, adjustments, nowStepId]);
  const [noting, setNoting] = useState(false);
  const resumable = session !== null && !isStale(session);

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
      // A desktop's header (a phone draws its own, PhoneRecipe): the spread draws the photo itself, filling the top of its left page.
      showImage={false}
      actions={
        <>
          {/* Edit and Start cooking are both in the open rather than behind
              the menu; each carries the currently requested scale so it
              round-trips through the edit page and into cooking. */}
          <Button asChild variant="outline" intent="neutral" size="sm" iconOnly aria-label="Edit">
            <Link to="/recipes/$slug/edit" params={{ slug: recipe.slug }} search={{ servings: requested }}>
              <PencilIcon />
            </Link>
          </Button>
          <Button asChild variant="solid" intent="brand" size="sm">
            <Link to="/recipes/$slug" params={{ slug: recipe.slug }} search={{ servings: requested, choices, cooking: true }} data-testid="start-cooking">
              {resumable ? "Resume cooking" : "Start cooking"}
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
        {/* On a phone the tab says it, so the heading is only for a screen reader and where focus lands. */}
        <SectionTitle as="h2" ref={ingredientsHeading} tabIndex={-1} className={desktop ? "outline-none" : "sr-only"}>
          Ingredients
        </SectionTitle>
        <div className="flex flex-wrap items-center gap-3">
          {/* Cooking, the servings sit in the header line. */}
          {!cooking && <ScaleControl servings={recipe.recipeServings} />}
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

  // A session left two days or more is not quietly resumed: the cook says
  // whether to review it or start again (decisions.md row 214).
  const stale = cooking && session !== null && isStale(session) && (
    <Message intent="warning" data-testid="stale-cooking">
      <p>This cook was started on {new Date(session.startedAt).toLocaleDateString("en-AU", { day: "numeric", month: "long" })} and never finished.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button asChild variant="outline" intent="neutral" size="sm">
          <Link to="/recipes/$slug/review" params={{ slug: recipe.slug }}>
            Review it
          </Link>
        </Button>
        <Button
          variant="outline"
          intent="neutral"
          size="sm"
          onClick={() =>
            void mutate(() => startCooking({ data: { recipeId: stored.id, servings: search.servings ?? null, choices: search.choices ?? null } })).catch(
              (error) => toastError("Could not start again", error)
            )
          }
        >
          Start again
        </Button>
      </div>
    </Message>
  );

  const notesPanel = <CookingNotes recipeId={stored.id} session={session} onNoted={() => setNoting(false)} />;

  // Quick edit hangs off the stored document, not `recipe`: a row's
  // sheet writes back what was stored, whatever scale the page is showing.
  if (cooking) {
    return (
      <QuickEditProvider recipe={stored}>
        <SubRecipesProvider subRecipes={subRecipes}>
          <CookingProvider value={cookingValue}>
            {desktop ? (
              <>
                <CookingHeader recipe={recipe} end={<FinishCooking slug={recipe.slug} />} />
                <CookingSpread
                  recipe={recipe}
                  ingredients={ingredients}
                  method={
                    <>
                      {stale}
                      {steps}
                      {notes}
                    </>
                  }
                  side={
                    <div className="flex flex-col gap-4 p-5">
                      <SectionTitle as="h2">While you cook</SectionTitle>
                      {notesPanel}
                    </div>
                  }
                />
                <TimerStrip recipeId={recipe.id} fixed className="desktop:right-[max(20rem,26%)] desktop:left-auto desktop:w-[28rem]" />
              </>
            ) : (
              <>
                <PhoneCooking
                  recipe={recipe}
                  ingredients={ingredients}
                  method={
                    <>
                      {stale}
                      {steps}
                    </>
                  }
                  after={notes}
                  ask={<NoteButton onOpen={() => setNoting(true)} />}
                />
                {/* Timers stand above Note and Finish. */}
                <TimerStrip recipeId={recipe.id} fixed className="bottom-[calc(5.25rem+env(safe-area-inset-bottom))]" />
                <Sheet open={noting} onOpenChange={setNoting} size="sm" closable aria-label="Note for the review">
                  <Sheet.Header>
                    <h2 className="text-base font-medium">Note for the review</h2>
                  </Sheet.Header>
                  <Sheet.Body>{notesPanel}</Sheet.Body>
                </Sheet>
              </>
            )}
          </CookingProvider>
        </SubRecipesProvider>
      </QuickEditProvider>
    );
  }

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
          <>
            <PhoneRecipe
              recipe={recipe}
              madeCount={timeline.length}
              onRate={(rating) => void rate(rating)}
              actions={(className) => <RecipeActions recipe={recipe} aiAvailable={aiAvailable} className={className} />}
              servings={requested}
              ingredients={ingredients}
              method={
                <>
                  {steps}
                  {madeThis}
                </>
              }
              after={
                <>
                  {notes}
                  <TimelineList events={timeline} />
                  <RecipeMetaFooter recipe={recipe} />
                </>
              }
              cookBar={<CookBar recipe={recipe} servings={requested} choices={choices} resume={resumable} />}
            />
            {/* Any timers started from a step, fixed above the Start cooking bar. */}
            <TimerStrip recipeId={recipe.id} fixed className="bottom-[calc(var(--app-bar)+var(--app-bar-rise,0px)+4.75rem)]" />
          </>
        )}
      </SubRecipesProvider>
    </QuickEditProvider>
  );
}
