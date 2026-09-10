// One recipe in the list: image (or a placeholder), name and tag chips, the
// whole card linking to the recipe page. Presentational; the list owns layout.
import { Card } from "@sixthshift/design-system/card";
import { TagChip } from "@sixthshift/design-system/tag-chip";
import { Link } from "@tanstack/react-router";
import type { RecipeSummary } from "../domain/recipe";
import { recipeImageUrl } from "../lib/images";

export type RecipeCardProps = { recipe: RecipeSummary };

function ImagePlaceholder() {
  return (
    <div
      data-placeholder="image"
      aria-hidden="true"
      className="flex aspect-[4/3] w-full items-center justify-center bg-bg-subtle text-fg-subtle"
    >
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <circle cx="8.5" cy="10" r="1.5" />
        <path d="m21 16-4.5-4.5L9 19" />
      </svg>
    </div>
  );
}

export function RecipeCard({ recipe }: RecipeCardProps) {
  const src = recipeImageUrl(recipe.image);
  return (
    <Link
      to="/recipes/$slug"
      params={{ slug: recipe.slug }}
      className="group block h-full rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-brand"
    >
      <Card className="flex h-full flex-col overflow-hidden p-0 transition-colors group-hover:border-border-normal-hovered">
        {src ? (
          <img src={src} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" />
        ) : (
          <ImagePlaceholder />
        )}
        <div className="flex flex-1 flex-col gap-2 p-4">
          <span className="font-semibold text-fg-strong group-hover:underline">{recipe.name}</span>
          {recipe.tags.length > 0 && (
            <ul className="flex flex-wrap gap-1" aria-label="Tags">
              {recipe.tags.map((tag) => (
                <li key={tag.id}>
                  <TagChip tag={tag.name} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </Link>
  );
}
