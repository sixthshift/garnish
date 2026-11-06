import { Badge } from "@sixthshift/design-system/badge";
import { Button } from "@sixthshift/design-system/button";
import { EmptyBoundary } from "@sixthshift/design-system/empty-boundary";
import { Muted } from "@sixthshift/design-system/muted";
import { Popover } from "@sixthshift/design-system/popover";
import { getRouteApi, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SubRecipesProvider } from "../../../components/recipe/SubRecipes";
import { Cross } from "../../../components/ui/icons";
import { NumberStepper } from "../../../components/ui/NumberStepper";
import { useLayout } from "../../../lib/useLayout";
import { useWakeLock } from "../../../lib/useWakeLock";
import { CookCardView } from "../components/cook/CookCardView";
import { amountChange, type CookChange, readChanges, sessionStore, withChange, withChanges, withoutChange, writeChanges } from "../components/cook/cookChanges";
import { CookFilmstrip } from "../components/cook/desktop/CookFilmstrip";
import { FinishedCard } from "../components/cook/FinishedCard";
import { CookDeck } from "../components/cook/mobile/CookDeck";
import { CookPhoneCard } from "../components/cook/mobile/CookPhoneCard";
import {
  buildCookCards,
  type CookCard,
  cardAnnouncement,
  clampStep,
  type Ingredient,
  isFinishedIndex,
  partPills,
  type Step,
  scaledForServings,
  stepForKey,
  totalWithFinish,
  withChoices,
} from "../recipe";

const route = getRouteApi("/recipes/$slug/cook");

/** What Space presses when it has focus, so a desktop's Space-for-next leaves it be. */
const SPACE_TAKERS = "button, a, [role=button], [role=checkbox], [role=switch], [contenteditable=true]";

/**
 * "Serves 4" as one button that opens the stepper: the stepper itself is
 * three 48px targets and would take the name's room in the header, and
 * rescaling mid-cook is rare.
 */
function ServesControl({ servings, onChange }: { servings: number; onChange: (value: number) => void }) {
  const value = Number(servings.toFixed(2));
  return (
    <Popover placement="bottom-end">
      <Popover.Trigger asChild>
        <Button variant="outline" intent="neutral" size="xl" className="shrink-0 px-4" data-serves>
          Serves {value}
        </Button>
      </Popover.Trigger>
      <Popover.Body className="p-3" aria-label="Set servings">
        <NumberStepper label="Serves" value={value} min={1} onChange={onChange} size="xl" className="flex-row items-center gap-3" />
      </Popover.Body>
    </Popover>
  );
}

export function CookPage() {
  const { recipe: stored, subRecipes, parentName } = route.useLoaderData();
  const { step, servings: requested, from, choices } = route.useSearch();
  // What changed at the stove this cook (decisions.md row 193), held for the
  // session so a reload or a look at the recipe page does not lose it.
  const [changes, setChanges] = useState<CookChange[]>(() => readChanges(sessionStore(), stored.id));
  const keepChanges = (next: CookChange[]) => {
    setChanges(next);
    writeChanges(sessionStore(), stored.id, next);
  };
  // Scaled on the client from the search param: the deck is rebuilt from the
  // scaled document, so the stepper is a re-render and not a round trip. The
  // changes go in first, at the stored servings, and scale with the rest.
  // The options a plan entry chose go in before either (decisions.md row 198).
  const chosen = withChoices(stored, choices ?? {});
  const recipe = scaledForServings(withChanges(chosen, changes), requested);
  // A row made with a chosen option holds the option's amount: changing it
  // here and keeping it would write it onto the row's own food.
  const fixedIds = new Set(
    chosen.parts.flatMap((part) =>
      part.ingredients.filter((row, i) => row.food?.id !== stored.parts.find((p) => p.id === part.id)?.ingredients[i]?.food?.id).map((row) => row.id)
    )
  );
  const factor = stored.recipeServings > 0 ? recipe.recipeServings / stored.recipeServings : 1;
  const changedIds = new Set(changes.map((change) => (change.kind === "amount" ? change.ingredientId : change.stepId)));
  const originalStep = (id: string) => stored.parts.flatMap((part) => part.steps).find((s) => s.id === id)?.text;
  const navigate = route.useNavigate();
  const screenOn = useWakeLock();

  const cards = buildCookCards(recipe);
  const total = totalWithFinish(cards.length);
  const index = clampStep(step ?? 0, total);
  const finished = isFinishedIndex(index, cards.length);
  const card: CookCard | undefined = finished ? undefined : cards[index];
  const pills = partPills(cards);

  const goTo = (next: number) => void navigate({ search: (prev) => ({ ...prev, step: next }) });
  const scaleTo = (value: number) => void navigate({ search: (prev) => ({ ...prev, servings: value }), replace: true });

  const layout = useLayout();
  const filmstrip = layout === "desktop";

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // Typing in the servings field must not flip cards.
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, select")) return;
      // A desktop's Space goes on, as a slideshow's does (decisions.md row 207), unless it is pressing
      // something with the keyboard: a timer's Pause, a tick box.
      const space = filmstrip && event.key === " " && !(event.target instanceof HTMLElement && event.target.closest(SPACE_TAKERS));
      const next = stepForKey(space ? "ArrowRight" : event.key, index, total);
      if (next === null) return;
      event.preventDefault();
      goTo(next);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // What both layouts' cards change this cook with: an amount, a step's words.
  const changeProps = {
    changedIds,
    fixedIds,
    onChangeAmount: (ingredient: Ingredient, typed: number) => {
      const change = amountChange(ingredient, typed, factor);
      if (change) keepChanges(withChange(changes, change));
    },
    onChangeStep: (changedStep: Step, position: number, text: string) =>
      keepChanges(
        text === originalStep(changedStep.id)
          ? withoutChange(changes, `step:${changedStep.id}`)
          : withChange(changes, { kind: "step", stepId: changedStep.id, position, text })
      ),
  };

  // The card in front of the cook, which either layout draws in its own frame.
  const deck = finished ? (
    <FinishedCard
      recipe={recipe}
      stored={stored}
      servings={requested}
      from={from}
      parentName={parentName}
      changes={changes}
      onChangesDone={() => keepChanges([])}
    />
  ) : (
    <EmptyBoundary
      isEmpty={card === undefined}
      fallback={
        <Muted as="p" className="text-center text-xl">
          Nothing to cook yet: this recipe has no ingredients or steps.
        </Muted>
      }
    >
      {card !== undefined &&
        (filmstrip ? (
          <CookCardView card={card} recipeId={recipe.id} cookFrom={recipe.slug} filmstrip {...changeProps} />
        ) : (
          <CookPhoneCard card={card} recipeId={recipe.id} cookFrom={recipe.slug} {...changeProps} />
        ))}
    </EmptyBoundary>
  );

  const exit = (
    <Button asChild variant="outline" intent="neutral" size="xl" className="shrink-0 px-4">
      <Link to="/recipes/$slug" params={{ slug: recipe.slug }} search={{ servings: requested, choices }}>
        Exit
      </Link>
    </Button>
  );
  const changesBadge = changes.length > 0 && (
    <Badge variant="soft" intent="neutral" className="shrink-0" data-cook-changes>
      {changes.length === 1 ? "1 change" : `${changes.length} changes`}
    </Badge>
  );
  const serves = recipe.recipeServings > 0 && <ServesControl servings={recipe.recipeServings} onChange={scaleTo} />;
  // Politely spoken on every card change; the visible position line is silent so it is not said twice.
  const announce = (
    <p className="sr-only" aria-live="polite" data-announce>
      {finished ? "Finished" : card === undefined ? "Nothing to cook" : cardAnnouncement(card)}
    </p>
  );

  if (filmstrip) {
    return (
      <SubRecipesProvider subRecipes={subRecipes}>
        {announce}
        <CookFilmstrip
          recipeId={recipe.id}
          slug={recipe.slug}
          name={recipe.name}
          cards={cards}
          index={index}
          total={total}
          pills={pills}
          current={deck}
          exit={exit}
          tools={
            <>
              {changesBadge}
              {serves}
            </>
          }
          screenOn={screenOn}
          goTo={goTo}
        />
      </SubRecipesProvider>
    );
  }

  return (
    <SubRecipesProvider subRecipes={subRecipes}>
      {announce}
      <CookDeck
        name={recipe.name}
        recipeId={recipe.id}
        cards={cards}
        index={index}
        total={total}
        pills={pills}
        current={deck}
        onCard={card !== undefined}
        exit={
          // A round ✕ on a phone, where the header's room is the name's.
          <Button asChild variant="outline" intent="neutral" size="xl" iconOnly className="shrink-0 rounded-full">
            <Link to="/recipes/$slug" params={{ slug: recipe.slug }} search={{ servings: requested, choices }} aria-label="Exit">
              <Cross />
            </Link>
          </Button>
        }
        tools={
          <>
            {changesBadge}
            {serves}
          </>
        }
        screenOn={screenOn}
        goTo={goTo}
      />
    </SubRecipesProvider>
  );
}
