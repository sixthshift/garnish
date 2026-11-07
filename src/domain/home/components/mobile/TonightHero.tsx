import { Button } from "@sixthshift/design-system/button";
import { Muted } from "@sixthshift/design-system/muted";
import { cn } from "@sixthshift/design-system/utils";
import { Link } from "@tanstack/react-router";
import { RecipeLink } from "../../../../components/recipe/RecipeLink";
import { PlayIcon } from "../../../../components/ui/icons";
import { recipeImageUrl } from "../../../../lib/images";
import { entryLabel, mealLabel, type PlanEntry, servingsLabel } from "../../../plan/plan";
import { formatDuration } from "../../../recipes/ingredient";
import { cookSearch } from "../../home";
import { Photo } from "../Photo";

/** A button over the photo: big enough for a thumb, and readable on any picture. */
const ON_PHOTO = "inline-flex min-h-12 items-center gap-2 rounded-xl border px-4.5 text-[15px] font-medium backdrop-blur-sm transition-colors";

/**
 * Tonight on a phone: the dish filling the screen, its photo edge to edge in
 * a 4:5 card under a gradient, the name in display type, then Cook, Recipe
 * and Swap under the thumb. Over a photo Cook is white and the others glass,
 * which reads on any picture, and Cook's ink is the light theme's brand
 * (teal-700) in either theme, since the photo and its gradient do not change
 * with it: dark mode's brand ink is pale, for a dark page, and vanished on
 * white; a recipe with no photo, or a note, is a plain
 * card with the app's own buttons, Cook the brand fill unless planning next
 * week has it (`primary`, rule 5).
 *
 * Swap opens the add sheet for today, and what is chosen there takes the
 * entry's place (`onSwap`). Nothing planned, the card says so and offers the
 * same sheet to plan tonight.
 */
export function TonightHero({
  entry,
  totalTime,
  primary,
  onSwap,
  onPlan,
}: {
  entry: PlanEntry | null;
  totalTime: number | null;
  primary: boolean;
  onSwap: (entry: PlanEntry) => void;
  onPlan: () => void;
}) {
  if (entry === null) {
    return (
      <section aria-labelledby="tonight" className="flex flex-col items-start gap-3 rounded-xl border-[1.5px] border-dashed border-border-normal px-5 py-6">
        <h2 id="tonight" className="font-display text-xl font-semibold text-fg-strong">
          Tonight
        </h2>
        <Muted as="p">Nothing planned for tonight.</Muted>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" intent="neutral" onClick={onPlan}>
            Plan tonight
          </Button>
          <Button asChild variant="ghost" intent="neutral">
            <Link to="/plan">Open the plan</Link>
          </Button>
        </div>
      </section>
    );
  }

  const image = recipeImageUrl(entry.recipe?.image);
  const onPhoto = image !== null;
  const meta = [mealLabel(entry.meal), totalTime !== null ? formatDuration(totalTime) : null, servingsLabel(entry.servings) || null]
    .filter(Boolean)
    .join(" · ");
  const recipe = entry.recipe;

  return (
    <section
      aria-labelledby="tonight"
      className={cn(
        "relative flex shrink-0 flex-col justify-end overflow-hidden rounded-xl",
        // 4:5 fills a phone; wider than that it would run past the screen, so from `sm` it turns landscape.
        onPhoto ? "aspect-[4/5] text-white shadow-lg sm:aspect-[3/2] sm:max-h-[60dvh]" : "border border-border-subtle bg-bg-normal"
      )}
    >
      {onPhoto && (
        <>
          <Photo src={image} className="absolute inset-0 size-full" />
          <span aria-hidden="true" className="absolute inset-0 bg-linear-to-b from-transparent from-35% to-[rgb(20_12_8/.86)]" />
        </>
      )}
      <div className="relative flex flex-col gap-1.5 p-5">
        <h2 id="tonight" className={cn("text-xs font-semibold uppercase tracking-wider", onPhoto ? "text-white/80" : "text-fg-subtle")}>
          Tonight
        </h2>
        <p className={cn("font-display text-3xl font-semibold leading-[1.08]", !onPhoto && "text-fg-strong", recipe === null && "italic")}>
          {entryLabel(entry)}
        </p>
        {meta !== "" && <p className={cn("text-sm", onPhoto ? "text-white/85" : "text-fg-subtle")}>{meta}</p>}
        <div className="mt-2 flex flex-wrap gap-2">
          {onPhoto && recipe !== null ? (
            <>
              <Link
                to="/recipes/$slug"
                params={{ slug: recipe.slug }}
                search={{ ...cookSearch(entry), cooking: true }}
                className={cn(ON_PHOTO, "border-white bg-white text-[var(--color-teal-700)] hover:bg-white/90")}
              >
                <PlayIcon />
                Cook
              </Link>
              <RecipeLink
                slug={recipe.slug}
                choices={entry.choices}
                servings={entry.servings ?? undefined}
                className={cn(ON_PHOTO, "border-white/35 bg-white/15 text-white hover:bg-white/25")}
              >
                Recipe
              </RecipeLink>
              <button type="button" onClick={() => onSwap(entry)} className={cn(ON_PHOTO, "border-white/35 bg-white/15 text-white hover:bg-white/25")}>
                Swap
              </button>
            </>
          ) : (
            <>
              {recipe !== null && (
                <>
                  <Button asChild variant="solid" intent={primary ? "brand" : "neutral"} size="lg">
                    <Link to="/recipes/$slug" params={{ slug: recipe.slug }} search={{ ...cookSearch(entry), cooking: true }}>
                      <PlayIcon />
                      Cook
                    </Link>
                  </Button>
                  <Button asChild variant="outline" intent="neutral" size="lg">
                    <RecipeLink slug={recipe.slug} choices={entry.choices} servings={entry.servings ?? undefined}>
                      Recipe
                    </RecipeLink>
                  </Button>
                </>
              )}
              <Button variant="outline" intent="neutral" size="lg" onClick={() => onSwap(entry)}>
                Swap
              </Button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
