import { Muted } from "@sixthshift/design-system/muted";
import type { Recipe } from "../../../../domain/recipe";
import { formatDateStamp } from "../../../../lib/dates";
import { isLinkable, sourceLabel } from "../../../../lib/urls";

/**
 * Source, added and updated: the page's own footer, at the foot of the page
 * under the timeline rather than under the header. Renders nothing
 * when the recipe has none of the three.
 */
export function RecipeMetaFooter({ recipe }: { recipe: Recipe }) {
  const source = sourceLabel(recipe.sourceUrl);
  const created = formatDateStamp(recipe.createdAt);
  const updated = formatDateStamp(recipe.updatedAt);
  const restyled = recipe.restyledAt;
  const restyledOn = formatDateStamp(restyled);
  if (source === "" && created === "" && updated === "" && restyled === null) return null;

  return (
    <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border-subtle pt-3 text-xs text-fg-subtle" data-testid="recipe-meta">
      {source !== "" &&
        (isLinkable(recipe.sourceUrl) ? (
          <a
            href={recipe.sourceUrl ?? undefined}
            target="_blank"
            rel="noreferrer noopener"
            data-testid="source-url"
            className="underline underline-offset-2 hover:text-fg-normal"
          >
            Source: {source}
          </a>
        ) : (
          <span data-testid="source-url">Source: {source}</span>
        ))}
      {/* Quiet, beside the source, because it is a fact about the words on the
          page: the steps are the household's voice rather than the author's. The original is kept, so this is a note, not a warning. */}
      {restyled !== null && (
        <Muted as="span" className="text-xs" data-testid="restyled">
          {restyledOn === "" ? "Restyled" : `Restyled ${restyledOn}`}
        </Muted>
      )}
      {created !== "" && <span data-testid="created">Added {created}</span>}
      {updated !== "" && <span data-testid="updated">Updated {updated}</span>}
    </footer>
  );
}
