// The recipe page's header. Presentational: everything it shows comes from the
// recipe document, and the caller passes its own action buttons in.
//
// Layout follows Mealie's recipe page: from `md` the image sits beside the
// text, below `md` it stacks above it. Order (M24.3): image, name with the
// actions, stars, one strip holding prep / cook / total, yield and the last
// made date as text. The source/added/updated meta moves out of the header;
// `RecipeMetaFooter` below renders it as the page's own footer, at the foot
// of the page rather than under the header.
import { EmptyBoundary } from "@sixthshift/design-system/empty-boundary";
import { Heading } from "@sixthshift/design-system/heading";
import { Muted } from "@sixthshift/design-system/muted";
import { TagChip } from "@sixthshift/design-system/tag-chip";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { formatDuration, formatYield, totalMinutes } from "../domain/format";
import type { Recipe } from "../domain/recipe";
import { recipeImageUrl } from "../lib/images";
import { Rating } from "./ui/Rating";

export type RecipeHeaderProps = {
  recipe: Recipe;
  /** Buttons for this recipe (Edit, Cook); rendered opposite the name. */
  actions?: ReactNode;
};

/**
 * A timestamp as a date the way en-AU writes one: "11 Sep 2026". Empty for
 * null, blank or an unparseable value, so a missing date renders nothing
 * rather than "Invalid Date". Pure.
 */
export function formatDateStamp(value: string | null): string {
  if (value === null || value.trim() === "") return "";
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return "";
  return new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric" }).format(at);
}

/**
 * The text shown for a source URL: its host without a leading "www.", so a
 * long recipe URL stays one readable word. A value that is not a URL is shown
 * verbatim (it may be a book or a person). Empty for null or blank. Pure.
 */
export function sourceLabel(url: string | null): string {
  if (url === null || url.trim() === "") return "";
  const trimmed = url.trim();
  try {
    const host = new URL(trimmed).hostname;
    return host.startsWith("www.") ? host.slice(4) : host;
  } catch {
    return trimmed;
  }
}

/** True when a source URL is something a browser can follow. Pure. */
export function isLinkable(url: string | null): boolean {
  if (url === null || url.trim() === "") return false;
  try {
    const { protocol } = new URL(url.trim());
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

/** Prep / cook / total, dropping the ones with nothing recorded. Pure. */
export function timeStats(recipe: Pick<Recipe, "prepTime" | "performTime">): Array<{ key: StatKey; label: string; value: string }> {
  const total = totalMinutes(recipe.prepTime, recipe.performTime);
  const rows: Array<{ key: StatKey; label: string; value: string }> = [
    { key: "prep", label: "Prep", value: formatDuration(recipe.prepTime) },
    { key: "cook", label: "Cook", value: formatDuration(recipe.performTime) },
    { key: "total", label: "Total", value: formatDuration(total) },
  ];
  return rows.filter((row) => row.value !== "");
}

export type StatKey = "prep" | "cook" | "total";

const ICON_PATHS: Record<StatKey, ReactNode> = {
  // Knife: preparation.
  prep: <path d="M4 20 14.5 9.5M18 3l3 3-6.5 6.5L11 9z" />,
  // Flame: time on the heat.
  cook: <path d="M12 3s5 4 5 8a5 5 0 0 1-10 0c0-1.5.8-2.8 1.5-3.5.3 1.2 1 2 1.8 2C11.7 9.5 12 6 12 3Z" />,
  // Clock: the whole thing, end to end.
  total: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
};

function StatIcon({ stat }: { stat: StatKey }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      data-icon={stat}
      className="shrink-0 text-fg-subtle"
    >
      {ICON_PATHS[stat]}
    </svg>
  );
}

function ImagePlaceholder() {
  return (
    <div
      data-placeholder="image"
      aria-hidden="true"
      className="flex aspect-video w-full items-center justify-center rounded-xl bg-bg-subtle text-fg-subtle"
    >
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <circle cx="8.5" cy="10" r="1.5" />
        <path d="m21 16-4.5-4.5L9 19" />
      </svg>
    </div>
  );
}

export function RecipeHeader({ recipe, actions }: RecipeHeaderProps) {
  const src = recipeImageUrl(recipe.image);
  const stats = timeStats(recipe);
  const yieldText = formatYield(recipe.recipeYieldQuantity, recipe.yieldUnit, recipe.recipeYield);
  const lastMade = formatDateStamp(recipe.lastMade);

  return (
    <header className="flex flex-col gap-4" data-testid="recipe-header">
      {/* Stacked below md, image beside the text from md up. */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-6" data-layout="split">
        <div className="w-full md:w-2/5 md:shrink-0">
          {src ? <img src={src} alt="" className="aspect-video w-full rounded-xl object-cover" /> : <ImagePlaceholder />}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <Heading as="h1">{recipe.name}</Heading>
            {actions !== undefined && (
              /* Controls, not content: the print stylesheet drops them. */
              <div className="flex gap-2" data-print="hide">
                {actions}
              </div>
            )}
          </div>
          {recipe.rating !== null && <Rating value={recipe.rating} />}

          {/* One strip: prep / cook / total, the yield, and the last made
              date as text. The "Made this" button used to sit beside the
              last made line; it moved out of the header (M25.6 gives it a
              home in the timeline section). */}
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
            <p className="text-sm text-fg-subtle" data-testid="last-made">
              {lastMade === "" ? "Never made" : "Last made "}
              {lastMade !== "" && <span className="font-medium text-fg-strong">{lastMade}</span>}
            </p>
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

/**
 * Source, added and updated: the page's own footer, at the foot of the page
 * under the timeline (M24.3) rather than under the header. Renders nothing
 * when the recipe has none of the three.
 */
export function RecipeMetaFooter({ recipe }: { recipe: Recipe }) {
  const source = sourceLabel(recipe.sourceUrl);
  const created = formatDateStamp(recipe.createdAt);
  const updated = formatDateStamp(recipe.updatedAt);
  if (source === "" && created === "" && updated === "") return null;

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
      {created !== "" && <span data-testid="created">Added {created}</span>}
      {updated !== "" && <span data-testid="updated">Updated {updated}</span>}
    </footer>
  );
}
