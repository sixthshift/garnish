import { Button } from "@sixthshift/design-system/button";
import { Muted } from "@sixthshift/design-system/muted";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import { cn } from "@sixthshift/design-system/utils";
import { Link } from "@tanstack/react-router";
import { RecipeLink } from "../../../../components/recipe/RecipeLink";
import { recipeImageUrl } from "../../../../lib/images";
import { entryLabel, mealLabel, type PlanEntry, servingsLabel } from "../../../plan/plan";
import { formatDuration } from "../../../recipes/ingredient";
import { cookSearch } from "../../home";
import { Photo } from "../Photo";

const SPAN = "col-span-2 row-span-4";

/**
 * Tonight on a desktop: the biggest tile, the photo edge to edge under a
 * gradient, the name in display type, and Cook and Open the recipe. Over a
 * photo the buttons are white and glass, which reads on any picture (Cook's
 * ink fixed at teal-700 in either theme, as on the phone's TonightHero); without
 * one the tile is a plain card and the buttons are the app's own, Cook the
 * brand fill unless planning next week has it (`primary`, rule 5).
 */
export function TonightTile({ entry, totalTime, primary }: { entry: PlanEntry | null; totalTime: number | null; primary: boolean }) {
  if (entry === null) {
    return (
      <section aria-labelledby="tonight" className={cn(SPAN, "flex flex-col justify-center gap-3 rounded-2xl border border-border-subtle bg-bg-normal p-7")}>
        <SectionTitle as="h2" id="tonight">
          Tonight
        </SectionTitle>
        <Muted as="p">Nothing planned for tonight.</Muted>
        <Button asChild variant="outline" intent="neutral" className="self-start">
          <Link to="/plan">Open the plan</Link>
        </Button>
      </section>
    );
  }

  const image = recipeImageUrl(entry.recipe?.image);
  const onPhoto = image !== null;
  const meta = [mealLabel(entry.meal), totalTime !== null ? formatDuration(totalTime) : null, servingsLabel(entry.servings) || null]
    .filter(Boolean)
    .join(" · ");
  const recipe = entry.recipe;
  const glass = "inline-flex min-h-10 items-center rounded-lg border px-4 text-sm font-medium backdrop-blur-sm transition-colors";

  return (
    <section
      aria-labelledby="tonight"
      className={cn(
        SPAN,
        "relative flex flex-col justify-end overflow-hidden rounded-2xl",
        onPhoto ? "text-white" : "border border-border-subtle bg-bg-normal"
      )}
    >
      {onPhoto && (
        <>
          <Photo src={image} className="absolute inset-0 size-full" />
          <span aria-hidden="true" className="absolute inset-0 bg-linear-to-b from-transparent from-35% to-[rgb(20_12_8/.82)]" />
        </>
      )}
      <div className="relative flex flex-col gap-2.5 px-7 py-6">
        <h2 id="tonight" className={cn("text-xs font-semibold uppercase tracking-wider", onPhoto ? "text-white/80" : "text-fg-subtle")}>
          Tonight
        </h2>
        <p className={cn("max-w-[18ch] font-display text-4xl font-semibold leading-[1.05]", !onPhoto && "text-fg-strong")}>{entryLabel(entry)}</p>
        {meta !== "" && <p className={onPhoto ? "text-white/85" : "text-fg-subtle"}>{meta}</p>}
        {recipe !== null && (
          <div className="mt-1.5 flex flex-wrap gap-2">
            {onPhoto ? (
              <>
                <Link
                  to="/recipes/$slug"
                  params={{ slug: recipe.slug }}
                  search={{ ...cookSearch(entry), cooking: true }}
                  className={cn(glass, "border-white bg-white text-[var(--color-teal-700)] hover:bg-white/90")}
                >
                  Cook
                </Link>
                <RecipeLink
                  slug={recipe.slug}
                  choices={entry.choices}
                  servings={entry.servings ?? undefined}
                  className={cn(glass, "border-white/35 bg-white/15 text-white hover:bg-white/25")}
                >
                  Open the recipe
                </RecipeLink>
              </>
            ) : (
              <>
                <Button asChild variant="solid" intent={primary ? "brand" : "neutral"}>
                  <Link to="/recipes/$slug" params={{ slug: recipe.slug }} search={{ ...cookSearch(entry), cooking: true }}>
                    Cook
                  </Link>
                </Button>
                <Button asChild variant="outline" intent="neutral">
                  <RecipeLink slug={recipe.slug} choices={entry.choices} servings={entry.servings ?? undefined}>
                    Open the recipe
                  </RecipeLink>
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
