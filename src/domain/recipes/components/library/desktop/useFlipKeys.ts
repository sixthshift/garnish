import { useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect } from "react";
import { busyElsewhere, focusTakesEnter } from "../../../../../lib/ui/keys";

/** Which way a key flips: → and j to the next recipe, ← and k to the one before. Pure. */
export function flipStep(key: string): 1 | -1 | 0 {
  if (key === "ArrowRight" || key === "j") return 1;
  if (key === "ArrowLeft" || key === "k") return -1;
  return 0;
}

/** The slug `step` away from `current` in `slugs`, held at either end; the first when `current` is not among them. Pure. */
export function flipTo(slugs: readonly string[], current: string, step: 1 | -1): string | undefined {
  const at = slugs.indexOf(current);
  if (at < 0) return slugs[0];
  return slugs[Math.min(slugs.length - 1, Math.max(0, at + step))];
}

/** Roving-focus controls that move their own focus with the arrows: a toggle group, a menu, a list box. */
const ARROWS_TAKEN = '[role="group"], [role="radiogroup"], [role="toolbar"], [role="tablist"], [role="menu"], [role="listbox"], [role="slider"]';

/**
 * While the side panel holds a recipe from the library (decisions.md row 207),
 * the keys flip through the recipes the wall is showing, in its order: → or j
 * the next, ← or k the one before, and Enter opens the open one's page. Each
 * flip replaces the address rather than adding to it, so Back still closes the
 * panel rather than stepping back through every recipe looked at. Esc is the
 * panel's own (RecipePanel). Keys typed into a field, pressed with a dialog
 * open, or taken by the focused control are left alone.
 */
export function useFlipKeys(slugs: readonly string[]): void {
  const open = useSearch({ strict: false, select: (search) => (search as { panel?: { slug: string } }).panel?.slug });
  const navigate = useNavigate();

  useEffect(() => {
    if (open === undefined) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || busyElsewhere(event.target)) return;
      const step = flipStep(event.key);
      if (step !== 0) {
        if (event.target instanceof Element && event.target.closest(ARROWS_TAKEN) !== null) return;
        const next = flipTo(slugs, open, step);
        if (next === undefined || next === open) return;
        event.preventDefault();
        void navigate({
          to: ".",
          search: (prev: Record<string, unknown>) => ({ ...prev, panel: { slug: next } }),
          replace: true,
          resetScroll: false,
        });
        // The card follows the flip into view, as far as it must and no further.
        document.querySelector(`[data-wall-slug="${next}"]`)?.scrollIntoView?.({ block: "nearest" });
        return;
      }
      if (event.key === "Enter" && !focusTakesEnter(event.target)) {
        event.preventDefault();
        void navigate({ to: "/recipes/$slug", params: { slug: open }, search: {} });
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, slugs, navigate]);
}
