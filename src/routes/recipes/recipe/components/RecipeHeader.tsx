import { Button } from "@sixthshift/design-system/button";
import { EmptyBoundary } from "@sixthshift/design-system/empty-boundary";
import { Heading } from "@sixthshift/design-system/heading";
import { Muted } from "@sixthshift/design-system/muted";
import { TagChip } from "@sixthshift/design-system/tag-chip";
import { Link } from "@tanstack/react-router";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { FavouriteButton } from "../../../../components/ui/FavouriteButton";
import { Rating } from "../../../../components/ui/Rating";
import { formatYield } from "../../../../domain/ingredient";
import type { Recipe } from "../../../../domain/recipe";
import { formatDateStamp } from "../../../../lib/dates";
import { recipeImageUrl } from "../../../../lib/images";
import { StatIcon } from "./StatIcon";
import { timeStats } from "./timeStats";

export type RecipeHeaderProps = {
  recipe: Recipe;
  /** Buttons for this recipe (Edit, Cook); rendered opposite the name. */
  actions?: ReactNode;
  /**
   * When given, the stars are editable and this is called with the new rating
   * (0 clears it). An unrated recipe shows no stars either way: with it, a
   * quiet "Rate" after the last made line opens the five to press.
   */
  onRate?: (rating: number) => void;
  /**
   * How many timeline events this recipe has logged. Omitted or 0 reads
   * "Never made"; otherwise the last made line adds the count ("1 time",
   * "4 times") after the date.
   */
  madeCount?: number;
};

export function RecipeHeader({ recipe, actions, onRate, madeCount }: RecipeHeaderProps) {
  const src = recipeImageUrl(recipe.image);
  const stats = timeStats(recipe);
  const yieldText = formatYield(recipe.recipeYieldQuantity, recipe.yieldUnit, recipe.recipeYield);
  const lastMade = formatDateStamp(recipe.lastMade);
  const count = madeCount ?? 0;
  // An unrated recipe keeps its stars folded behind "Rate" until asked for.
  const [rateOpen, setRateOpen] = useState(false);
  const stars = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    // "Rate" is gone once pressed, so focus moves to the first star rather than being dropped.
    if (rateOpen) stars.current?.querySelector("button")?.focus();
  }, [rateOpen]);
  const showStars = recipe.rating !== null || (onRate !== undefined && rateOpen);

  return (
    <header className="flex flex-col gap-4" data-testid="recipe-header">
      {/* Stacked below md, image beside the text from md up. No image, no
          space held for one: the name leads, and the editor adds a photo. */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-6" data-layout="split">
        {src && (
          <div className="w-full md:w-2/5 md:shrink-0">
            <img src={src} alt="" className="aspect-video w-full rounded-xl object-cover" />
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <Heading as="h1">{recipe.name}</Heading>
            {/* Controls, not content: the print stylesheet drops them. */}
            <div className="flex items-center gap-2" data-print="hide">
              <FavouriteButton id={recipe.id} favourite={recipe.favourite} />
              {actions}
            </div>
          </div>
          {showStars && (
            <span ref={stars} className="flex">
              <Rating value={recipe.rating ?? 0} onChange={onRate} className={onRate === undefined ? undefined : "-ml-0.5"} />
            </span>
          )}

          {/* One strip: prep / cook / total, the yield, and the last made
              date as text. */}
          <div className="flex flex-col gap-1" data-testid="stat-strip">
            {stats.length > 0 && (
              <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                {stats.map((stat) => (
                  <div key={stat.key} className="flex items-center gap-1.5" data-stat={stat.key}>
                    <StatIcon stat={stat.key} />
                    <dt className="text-fg-subtle">{stat.label}</dt>
                    <dd className="font-medium text-fg-strong">{stat.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {/* The yield sits on its own line under the times, as in Mealie. */}
            {yieldText !== "" && (
              <dl className="text-sm" data-testid="yield">
                <div className="flex gap-1.5">
                  <dt className="text-fg-subtle">Makes</dt>
                  <dd className="font-medium text-fg-strong">{yieldText}</dd>
                </div>
              </dl>
            )}
            <div className="flex flex-wrap items-center gap-x-3">
              <p className="text-sm text-fg-subtle" data-testid="last-made">
                {count > 0 && lastMade !== "" ? (
                  <>
                    {"Last made "}
                    <span className="font-medium text-fg-strong">{lastMade}</span>
                    {` · ${count} ${count === 1 ? "time" : "times"}`}
                  </>
                ) : (
                  "Never made"
                )}
              </p>
              {onRate !== undefined && !showStars && (
                <Button variant="link" intent="neutral" size="sm" data-print="hide" data-testid="rate" onClick={() => setRateOpen(true)}>
                  Rate
                </Button>
              )}
            </div>
          </div>

          {recipe.description.trim() !== "" && <p className="text-fg-normal">{recipe.description}</p>}
          <EmptyBoundary
            isEmpty={recipe.tags.length === 0}
            fallback={
              <Muted as="p" className="text-sm" data-empty="tags">
                No tags
              </Muted>
            }
          >
            <ul className="flex flex-wrap gap-1" aria-label="Tags">
              {recipe.tags.map((tag) => (
                <li key={tag.id}>
                  <Link to="/" search={{ tag: tag.slug }} className="rounded-full focus-visible:outline-2 focus-visible:outline-border-brand">
                    <TagChip tag={tag.name} size="md" />
                  </Link>
                </li>
              ))}
            </ul>
          </EmptyBoundary>
        </div>
      </div>
    </header>
  );
}
