import { Button } from "@sixthshift/design-system/button";
import { Heading } from "@sixthshift/design-system/heading";
import { cn } from "@sixthshift/design-system/utils";
import { Link } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { FavouriteButton } from "../../../../components/ui/FavouriteButton";
import { PencilIcon } from "../../../../components/ui/icons";
import { Rating } from "../../../../components/ui/Rating";
import { formatDateStamp } from "../../../../lib/dates";
import { recipeImageUrl } from "../../../../lib/images";
import { yieldLine } from "../../ingredient";
import type { Recipe } from "../../recipe";
import { KindToggle } from "../KindToggle";
import { timeStats } from "../recipe/timeStats";
import { RecipeFacts } from "./RecipeFacts";
import { RecipeTabs } from "./RecipeTabs";

/** A round button over the photo: frosted, so it reads over light and dark alike. */
const GLASS = "size-11 shrink-0 rounded-full border-transparent bg-bg-normal/85 backdrop-blur-sm hover:bg-bg-normal";

export type PhoneRecipeProps = {
  recipe: Recipe;
  madeCount: number;
  onRate: (rating: number) => void;
  /** The ⋯ menu (RecipeActions), given the class that draws its trigger round. */
  actions: (className: string) => ReactNode;
  /** The servings the page was asked for, carried into the editor. */
  servings: number | undefined;
  /** The Ingredients tab: the servings, the toolbar and the lists. */
  ingredients: ReactNode;
  /** The Method tab: the steps, part by part, and Made this. */
  method: ReactNode;
  /** Under both tabs: the notes, the cooks logged and the source. */
  after: ReactNode;
  /** The bar held at the foot of the screen (CookBar). */
  cookBar: ReactNode;
};

/**
 * A phone's recipe page (decisions.md row 208). The photo stays put at the
 * top while the page slides up over it, with back, the heart, Edit and the ⋯
 * menu as round buttons on it; then the tags, the name and the facts, how the
 * household cooks it and its rating; then Ingredients and Method as two tabs
 * held at the top as the page scrolls; then the notes and the history, which
 * belong to neither; and Start cooking held under the thumb. A recipe with no
 * photo holds no space for one: the buttons sit in a row above the name.
 */
export function PhoneRecipe({ recipe, madeCount, onRate, actions, servings, ingredients, method, after, cookBar }: PhoneRecipeProps) {
  const [tab, setTab] = useState("ingredients");
  const src = recipeImageUrl(recipe.image);
  const steps = recipe.parts.reduce((count, part) => count + part.steps.length, 0);
  const lastMade = formatDateStamp(recipe.lastMade);
  const hasTimes = timeStats(recipe).length > 0;
  const yielded = yieldLine(recipe.recipeYieldQuantity, recipe.yieldUnit, recipe.recipeYield);
  // An unrated recipe keeps its stars folded behind "Rate" until asked for, as a desktop's header does.
  const [rateOpen, setRateOpen] = useState(false);

  const buttons = (
    <div className="flex items-center gap-2" data-print="hide">
      <Button asChild variant="outline" intent="neutral" iconOnly className={GLASS}>
        <Link to="/recipes" aria-label="Back to recipes">
          <span aria-hidden="true" className="text-2xl leading-none">
            ‹
          </span>
        </Link>
      </Button>
      <span className="flex-1" />
      <FavouriteButton id={recipe.id} favourite={recipe.favourite} className={GLASS} />
      <Button asChild variant="outline" intent="neutral" iconOnly className={GLASS}>
        <Link to="/recipes/$slug/edit" params={{ slug: recipe.slug }} search={{ servings }} aria-label="Edit">
          <PencilIcon />
        </Link>
      </Button>
      {actions(
        "[&_[data-testid=menu-trigger]]:size-11 [&_[data-testid=menu-trigger]]:justify-center [&_[data-testid=menu-trigger]]:rounded-full [&_[data-testid=menu-trigger]]:border-transparent [&_[data-testid=menu-trigger]]:bg-bg-normal/85 [&_[data-testid=menu-trigger]]:backdrop-blur-sm"
      )}
    </div>
  );

  return (
    // One measure on a phone held sideways or an iPad upright, as the photo would otherwise run a screen wide.
    <article className="relative mx-auto w-full max-w-3xl" data-testid="phone-recipe">
      {src !== null ? (
        // Sticky, so it holds its place while the page below slides up over it.
        <div className="sticky top-0 h-[22.5rem] print:static print:h-48" data-testid="recipe-photo">
          <img src={src} alt="" className="absolute inset-0 size-full object-cover print:rounded-xl" />
          <div className="absolute inset-x-3.5 top-2 z-10">{buttons}</div>
        </div>
      ) : (
        <div className="px-3.5 pt-2">{buttons}</div>
      )}

      <div
        className={cn(
          "relative z-10 flex min-h-[32rem] flex-col gap-4 bg-bg-subtle px-4 pt-6 pb-2 print:mt-0 print:min-h-0 print:px-0 print:shadow-none",
          src !== null && "-mt-8 rounded-t-[1.75rem] shadow-[0_-10px_30px_rgb(30_20_14/0.14)]"
        )}
        data-testid="recipe-body"
      >
        <header className="flex flex-col gap-2" data-testid="recipe-header">
          {recipe.tags.length > 0 && (
            <ul className="flex flex-wrap gap-x-1.5 text-xs font-semibold uppercase tracking-wide text-fg-subtle" aria-label="Tags">
              {recipe.tags.map((tag, index) => (
                <li key={tag.id} className="flex gap-1.5">
                  {index > 0 && <span aria-hidden="true">·</span>}
                  <Link
                    to="/recipes"
                    search={{ tag: tag.slug }}
                    className="rounded-sm hover:text-fg-normal focus-visible:outline-2 focus-visible:outline-border-brand"
                  >
                    {tag.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Heading as="h1">{recipe.name}</Heading>
          {recipe.description.trim() !== "" && <p className="text-fg-normal">{recipe.description}</p>}
          {yielded.value !== "" && (
            <dl className="text-sm" data-testid="yield">
              <div className="flex gap-1.5">
                <dt className="text-fg-subtle">{yielded.label}</dt>
                <dd className="font-medium text-fg-strong">{yielded.value}</dd>
              </div>
            </dl>
          )}
        </header>

        {/* The facts strip holds the times and how often it is made; with no times to show, one line says the rest. */}
        {hasTimes && <RecipeFacts recipe={recipe} madeCount={madeCount} />}
        {(madeCount > 0 || !hasTimes) && (
          <p className={cn("text-sm text-fg-subtle", hasTimes && "-mt-2")} data-testid="last-made">
            {madeCount > 0 && lastMade !== "" ? (
              <>
                {"Last made "}
                <span className="font-medium text-fg-strong">{lastMade}</span>
                {!hasTimes && ` · ${madeCount} ${madeCount === 1 ? "time" : "times"}`}
              </>
            ) : madeCount > 0 ? (
              `Made ${madeCount} ${madeCount === 1 ? "time" : "times"}`
            ) : (
              "Never made"
            )}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <KindToggle id={recipe.id} kind={recipe.kind} />
          {recipe.rating !== null || rateOpen ? (
            <Rating value={recipe.rating ?? 0} onChange={onRate} />
          ) : (
            <Button inline intent="neutral" size="sm" data-print="hide" data-testid="rate" onClick={() => setRateOpen(true)}>
              Rate
            </Button>
          )}
        </div>

        <div className="flex flex-col gap-4" data-testid="recipe-columns">
          <RecipeTabs
            value={tab}
            onValueChange={setTab}
            tabs={[
              { value: "ingredients", label: "Ingredients", content: ingredients, as: "aside", testId: "ingredients-column" },
              { value: "method", label: steps === 1 ? "Method · 1 step" : `Method · ${steps} steps`, content: method, testId: "method-column" },
            ]}
          />
        </div>

        {after}
      </div>
      {cookBar}
    </article>
  );
}
