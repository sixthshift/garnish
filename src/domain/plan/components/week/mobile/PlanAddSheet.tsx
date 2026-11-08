import { Button } from "@sixthshift/design-system/button";
import { Caption } from "@sixthshift/design-system/caption";
import { Modal, ModalBody, ModalHeader } from "@sixthshift/design-system/modal";
import { Tabs } from "@sixthshift/design-system/tabs";
import { cn } from "@sixthshift/design-system/utils";
import { useState } from "react";
import { recipeImageUrl } from "../../../../../lib/images";
import type { RecipeSummary } from "../../../../recipes/recipe";
import { dayName, type Meal, type PlanEntry } from "../../../plan";
import { PlanAddForm } from "../PlanAddForm";
import type { PlanWeekViewProps } from "../PlanWeekView";
import { openingTab, type ShelfTab } from "../shelf";
import { shelfTabItems } from "../shelfTabItems";

/**
 * A phone's "+ Add" opened (decisions.md row 208; a desktop's shelf sits
 * beside the board instead, row 207): a tall sheet titled with the day, the
 * add form (the meal chips, and the box that searches recipes or takes a
 * plain note), then the recipes as photos in two columns under the shelf's
 * four tabs, Weeknight, Weekend, To try and All. A tap on a photo adds it and
 * ticks it where it sits. The sheet stays open for the next add, a recipe or
 * a note alike, and Done closes it: planning a day is often two or three
 * things at once. While a search is typed its results stand in for the tabs.
 *
 * `Modal` rather than `Sheet`, as the recipe filters are (decisions.md rows
 * 44 and 45): on a phone it rises from the bottom, and it traps focus and
 * hands it back to the "+ Add" that opened it. The box does not take focus as
 * it opens: on a phone the keyboard would cover the photos, which are what
 * the sheet is for.
 */
export function PlanAddSheet({
  date,
  busy,
  planned,
  recipes,
  onClose,
  searchRecipes,
  onAddText,
  onAddRecipe,
}: {
  date: string;
  busy: boolean;
  /** What the day already has: a recipe on it is ticked. */
  planned: readonly PlanEntry[];
  /** Every recipe for the tabs, null while they load; left out, the sheet is its form alone. */
  recipes: readonly RecipeSummary[] | null | undefined;
  onClose: () => void;
} & Pick<PlanWeekViewProps, "searchRecipes" | "onAddText" | "onAddRecipe">) {
  const day = dayName(date);
  const [chosen, setTab] = useState<ShelfTab | null>(null);
  const tab = chosen ?? openingTab(recipes);
  const [searching, setSearching] = useState(false);
  const [meal, setMeal] = useState<Meal | null>(null);
  // Ticked at the tap, before the plan's reload brings the entry back: the tick is the add's answer.
  const [added, setAdded] = useState<ReadonlySet<string>>(new Set());
  const onDay = new Set(planned.flatMap((entry) => (entry.recipe === null ? [] : [entry.recipe.id])));
  const isAdded = (recipe: RecipeSummary) => added.has(recipe.id) || onDay.has(recipe.id);

  const add = (recipe: RecipeSummary, withMeal: Meal | null) => {
    setAdded((was) => new Set(was).add(recipe.id));
    onAddRecipe(date, recipe, withMeal);
  };

  const items = shelfTabItems(recipes, (shelf, label) => (
    <ul className="grid grid-cols-2 gap-3 pt-1 pb-2" aria-label={`${label} recipes`}>
      {shelf.map((recipe) => (
        <AddTile key={recipe.id} recipe={recipe} day={day} busy={busy} added={isAdded(recipe)} onAdd={() => add(recipe, meal)} />
      ))}
    </ul>
  ));

  return (
    // A fixed height on a phone rather than the content's, so the box sits
    // high and stays put while the photos below it scroll, and the sheet does
    // not jump as a search's results come and go. Its own height, not the
    // viewport's, is what counts on iOS: the keyboard covers the page there
    // rather than shrinking it, so dvh does not move when it opens.
    <Modal size="md" align="top" aria-label={`Adding to ${day}`} className="max-sm:h-[92dvh]" onOpenChange={(open) => !open && onClose()}>
      <ModalHeader className="flex-row items-center gap-3 space-y-0 pb-3">
        <div className="min-w-0 flex-1">
          <Caption className="font-semibold text-fg-brand uppercase tracking-wider">Adding to</Caption>
          <p className="truncate font-semibold text-fg-normal text-xl">{day}</p>
        </div>
        <Button type="button" variant="solid" intent="brand" onClick={onClose}>
          Done
        </Button>
      </ModalHeader>
      {/* Clear of the home indicator, as the filters sheet's footer is. */}
      <ModalBody className="flex flex-col gap-3 pt-0 max-sm:pb-[max(1.5rem,env(safe-area-inset-bottom))]" data-testid="plan-add-sheet">
        <PlanAddForm
          date={date}
          busy={busy}
          autoFocus={false}
          searchRecipes={searchRecipes}
          onAddText={onAddText}
          onAddRecipe={(_date, recipe, withMeal) => add(recipe, withMeal)}
          onQueryChange={(query) => setSearching(query.trim() !== "")}
          onMealChange={setMeal}
        />
        {!searching && recipes !== undefined && (
          <Tabs items={items} value={tab} onValueChange={(value) => setTab(value as ShelfTab)}>
            <Tabs.List className="sticky top-0 z-10 bg-bg-normal" />
            <Tabs.Panels />
          </Tabs>
        )}
      </ModalBody>
    </Modal>
  );
}

/** One recipe in the sheet: its photo and name, a tap to add it to the day, and a tick once it is on it. */
function AddTile({ recipe, day, busy, added, onAdd }: { recipe: RecipeSummary; day: string; busy: boolean; added: boolean; onAdd: () => void }) {
  const image = recipeImageUrl(recipe.image);
  return (
    <li>
      <button
        type="button"
        // Once on the day it does nothing more: a second of the same is rare, and the search still adds one.
        disabled={busy || added}
        aria-label={added ? `${recipe.name}, added to ${day}` : `Add ${recipe.name} to ${day}`}
        data-testid="plan-add-tile"
        data-added={added ? "true" : undefined}
        onClick={onAdd}
        className="group relative flex w-full flex-col gap-1.5 text-left font-medium text-[13.5px] leading-snug disabled:cursor-default"
      >
        {image === null ? (
          <span
            aria-hidden="true"
            className={cn(
              "flex aspect-square w-full items-center justify-center rounded-2xl bg-bg-subtle text-3xl text-fg-subtle",
              added && "ring-[3px] ring-border-brand ring-inset"
            )}
          >
            {recipe.name.charAt(0)}
          </span>
        ) : (
          <img
            src={image}
            alt=""
            loading="lazy"
            className={cn(
              "aspect-square w-full rounded-2xl object-cover transition-transform group-active:scale-95 motion-reduce:transition-none",
              added && "opacity-85 outline-[3px] outline-border-brand -outline-offset-[3px] outline-solid"
            )}
          />
        )}
        <span className={cn("line-clamp-2", busy && !added && "opacity-60")}>{recipe.name}</span>
        {added && (
          <span aria-hidden="true" className="absolute top-2 right-2 grid size-7 place-items-center rounded-full bg-bg-brand font-bold text-fg-on-brand">
            ✓
          </span>
        )}
      </button>
    </li>
  );
}
