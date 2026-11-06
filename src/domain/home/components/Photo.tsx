import { cn } from "@sixthshift/design-system/utils";

/** Where a recipe has no picture: a fill that still reads as a card on Home's own background, a phone's or a desktop's. */
export const PLACEHOLDER = "bg-bg-subtle-pressed";

/** A recipe's picture filling what holds it, or a quiet placeholder of the same size when it has none. */
export function Photo({ src, className }: { src: string | null; className?: string }) {
  if (src === null) return <div data-placeholder="image" aria-hidden="true" className={cn(PLACEHOLDER, className)} />;
  return <img src={src} alt="" loading="lazy" className={cn("object-cover", className)} />;
}
