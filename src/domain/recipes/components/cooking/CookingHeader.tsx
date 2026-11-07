import { Badge } from "@sixthshift/design-system/badge";
import { Button } from "@sixthshift/design-system/button";
import { cn } from "@sixthshift/design-system/utils";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { Recipe } from "../../recipe";
import { ScaleControl } from "../recipe/ScaleControl";

/** ✕: back to the page as it is read, the session kept for later. */
export function LeaveCooking({ slug }: { slug: string }) {
  return (
    <Button asChild variant="ghost" intent="neutral" iconOnly aria-label="Stop cooking for now" className="shrink-0">
      <Link to="/recipes/$slug" params={{ slug }} search={(prev: Record<string, unknown>) => ({ ...prev, cooking: undefined })}>
        <span aria-hidden="true" className="text-xl leading-none">
          ×
        </span>
      </Link>
    </Button>
  );
}

/** Finish: the review, where tonight's changes are kept or left. */
export function FinishCooking({ slug, className }: { slug: string; className?: string }) {
  return (
    <Button asChild variant="solid" intent="brand" className={className}>
      <Link to="/recipes/$slug/review" params={{ slug }} data-testid="finish-cooking">
        Finish
      </Link>
    </Button>
  );
}

/**
 * The one line that stands in for the nav and the left page while the recipe
 * is cooked from (decisions.md row 214): ✕, the name, Cooking, the servings,
 * and on a desktop Finish. A phone holds Finish under the thumb instead.
 */
export function CookingHeader({ recipe, end, className }: { recipe: Recipe; end?: ReactNode; className?: string }) {
  return (
    <header
      className={cn(
        "sticky top-0 z-app-bar flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border-normal bg-bg-normal px-4 py-2 desktop:h-14 desktop:flex-nowrap desktop:px-5 desktop:py-0",
        className
      )}
      data-testid="cooking-header"
      data-print="hide"
    >
      <LeaveCooking slug={recipe.slug} />
      <h1 className="min-w-0 flex-1 truncate font-display text-lg font-semibold text-fg-strong desktop:flex-none desktop:text-xl">{recipe.name}</h1>
      <Badge variant="soft" intent="brand" className="shrink-0 uppercase tracking-wide">
        Cooking
      </Badge>
      <div className="flex w-full items-center gap-3 desktop:w-auto desktop:pl-2">
        <ScaleControl servings={recipe.recipeServings} />
      </div>
      {end !== undefined && <div className="ml-auto flex items-center gap-2">{end}</div>}
    </header>
  );
}
