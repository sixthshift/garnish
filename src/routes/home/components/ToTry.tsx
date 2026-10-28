import { Link } from "@tanstack/react-router";
import type { RecipeSummary } from "../../../domain/recipe";
import { GlanceHeader } from "./GlanceHeader";

/**
 * Recipes kept but never cooked: an import or a share waits here until
 * someone makes it, rather than sinking into the library. Nothing to show,
 * nothing drawn.
 */
export function ToTry({ recipes }: { recipes: readonly RecipeSummary[] }) {
  if (recipes.length === 0) return null;
  return (
    <section aria-labelledby="to-try" className="flex flex-col gap-2">
      <GlanceHeader id="to-try" title="To try" />
      <ul className="flex flex-wrap gap-2">
        {recipes.map((recipe) => (
          <li key={recipe.id}>
            <Link
              to="/recipes/$slug"
              params={{ slug: recipe.slug }}
              className="inline-flex min-h-11 items-center rounded-full border border-border-normal bg-bg-normal px-4 text-sm font-medium hover:bg-bg-normal-hovered"
            >
              {recipe.name}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
