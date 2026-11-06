import { SectionTitle } from "@sixthshift/design-system/section-title";
import { cn } from "@sixthshift/design-system/utils";
import type { ReactNode } from "react";

/**
 * One tile of a desktop's Home: a card whose size is its share of the grid
 * (`span`, columns and rows of HomeBento's 118px tracks), so the grid can pack
 * them densely and reflow them as the width changes. Without a `title` the
 * tile's children draw its heading, under the same `id`.
 */
export function Tile({ id, title, action, className, children }: { id: string; title?: string; action?: ReactNode; className: string; children: ReactNode }) {
  return (
    <section
      aria-labelledby={id}
      className={cn("relative flex min-w-0 flex-col gap-3 overflow-hidden rounded-2xl border border-border-subtle bg-bg-normal p-4", className)}
    >
      {title !== undefined && (
        <div className="flex items-baseline justify-between gap-3">
          <SectionTitle as="h2" id={id}>
            {title}
          </SectionTitle>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** Where a recipe has no picture: a fill that still reads as a card on the tile's own background. */
export const PLACEHOLDER = "bg-bg-subtle-pressed";

/** A recipe's picture filling what holds it, or a quiet placeholder of the same size when it has none. */
export function Photo({ src, className }: { src: string | null; className?: string }) {
  if (src === null) return <div data-placeholder="image" aria-hidden="true" className={cn(PLACEHOLDER, className)} />;
  return <img src={src} alt="" loading="lazy" className={cn("object-cover", className)} />;
}

/** The quiet link at a tile's head: brand text, no fill (rule 5 keeps the fill for the one primary action). */
export const tileLinkClass = "text-sm font-medium text-fg-brand hover:text-fg-brand-hovered";
