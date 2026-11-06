import { Button } from "@sixthshift/design-system/button";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useCallback, useEffect } from "react";
import { RecipeInset } from "../../../../domain/recipes/components/desktop/RecipeInset";
import type { RecipePanelTarget } from "../../../model/panel";

/** Whether a key press belongs to something else: a field being typed in, or a dialog over the page. Pure over the DOM. */
function busyElsewhere(target: EventTarget | null): boolean {
  if (document.querySelector('[role="dialog"]') !== null) return true;
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/**
 * A desktop's side panel (decisions.md row 206): what you are looking at,
 * beside what you are working through. The page gives it room and stays live
 * beside it. It shows what `?panel=` names (src/app/model/panel.ts), so Back
 * closes it as a link opens it; Close and Esc take it off the address. One at
 * a time: opening the next replaces it.
 */
export function RecipePanel() {
  const panel = useSearch({ strict: false, select: (search) => (search as { panel?: RecipePanelTarget }).panel });
  const navigate = useNavigate();
  const close = useCallback(
    () => void navigate({ to: ".", search: (prev: Record<string, unknown>) => ({ ...prev, panel: undefined }), resetScroll: false }),
    [navigate]
  );

  useEffect(() => {
    if (panel === undefined) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || busyElsewhere(event.target)) return;
      close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [panel, close]);

  if (panel === undefined) return null;
  return (
    <aside
      aria-label="Recipe"
      className="sticky top-(--top-bar) h-[calc(100dvh-var(--top-bar))] w-[min(30rem,40vw)] shrink-0 overflow-y-auto border-l border-border-normal bg-bg-normal"
      data-testid="side-panel"
    >
      <div className="sticky top-0 z-content-sticky flex justify-end bg-bg-normal/90 px-3 pt-3 backdrop-blur">
        <Button variant="ghost" intent="neutral" size="sm" onClick={close}>
          Close
        </Button>
      </div>
      <RecipeInset key={panel.slug} slug={panel.slug} choices={panel.choices} servings={panel.servings} focusOnOpen />
    </aside>
  );
}
