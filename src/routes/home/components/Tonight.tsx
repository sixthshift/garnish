import { Button } from "@sixthshift/design-system/button";
import { Card } from "@sixthshift/design-system/card";
import { Muted } from "@sixthshift/design-system/muted";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import { Link } from "@tanstack/react-router";
import { formatDuration } from "../../../domain/ingredient";
import { entryLabel, mealLabel, type PlanEntry, servingsLabel } from "../../../domain/plan";
import { recipeImageUrl } from "../../../lib/images";

/**
 * Tonight's meal and the way into it: the picture, the name, how long it
 * takes, and Start cooking straight into cook mode at the entry's servings.
 * Opened from here the recipe is something to do, not something to read, so
 * cooking is the first button and the page the second.
 *
 * `primary` false gives Start cooking the solid neutral fill, when the page's
 * one brand action is planning next week instead.
 */
export function Tonight({ entry, totalTime, primary }: { entry: PlanEntry | null; totalTime: number | null; primary: boolean }) {
  if (entry === null) {
    return (
      <section aria-labelledby="tonight" className="flex flex-col gap-2">
        <SectionTitle as="h2" id="tonight">
          Tonight
        </SectionTitle>
        <Card className="flex flex-col items-start gap-3">
          <Muted as="p">Nothing planned for tonight.</Muted>
          <Button asChild variant="outline" intent="neutral">
            <Link to="/plan">Open the plan</Link>
          </Button>
        </Card>
      </section>
    );
  }
  const image = recipeImageUrl(entry.recipe?.image);
  const meta = [mealLabel(entry.meal), totalTime !== null ? formatDuration(totalTime) : null, servingsLabel(entry.servings) || null]
    .filter(Boolean)
    .join(" · ");
  return (
    <section aria-labelledby="tonight">
      <Card className="flex flex-col overflow-hidden p-0">
        {image !== null && <img src={image} alt="" className="aspect-[2/1] w-full object-cover md:aspect-[5/2]" />}
        <div className="flex flex-col gap-4 p-4 md:p-5">
          <div className="flex flex-col gap-1">
            <SectionTitle as="h2" id="tonight">
              Tonight
            </SectionTitle>
            <p className="font-display text-2xl font-semibold leading-tight text-fg-strong">{entryLabel(entry)}</p>
            {meta !== "" && <Muted as="p">{meta}</Muted>}
          </div>
          {entry.recipe !== null && (
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="solid" intent={primary ? "brand" : "neutral"}>
                <Link to="/recipes/$slug/cook" params={{ slug: entry.recipe.slug }} search={entry.servings === null ? {} : { servings: entry.servings }}>
                  Start cooking
                </Link>
              </Button>
              <Button asChild variant="outline" intent="neutral">
                <Link to="/recipes/$slug" params={{ slug: entry.recipe.slug }}>
                  Open the recipe
                </Link>
              </Button>
            </div>
          )}
        </div>
      </Card>
    </section>
  );
}
