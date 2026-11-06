import { cn } from "@sixthshift/design-system/utils";
import { type KeyboardEvent, type ReactNode, useId, useRef } from "react";

export type RecipeTab = {
  value: string;
  label: ReactNode;
  content: ReactNode;
  /** The panel's element: the ingredients are an `aside`, which the print stylesheet keeps by its `data-print`. */
  as?: "div" | "aside";
  /** Kept on the panel, so the tests and the print stylesheet find each column as they did. */
  testId?: string;
};

/**
 * A phone's recipe as two tabs, Ingredients and Method (decisions.md row 208),
 * the switch held at the top of the screen as the page scrolls under it.
 * Every panel is drawn and the others hidden, rather than only the chosen one
 * as the design system's Tabs do: a printout takes the whole recipe, both
 * tabs, one after the other. Switching while scrolled into a long method
 * brings the top of the other tab under the switch, not the foot of it.
 */
export function RecipeTabs({ tabs, value, onValueChange }: { tabs: readonly RecipeTab[]; value: string; onValueChange: (value: string) => void }) {
  const base = useId();
  const top = useRef<HTMLDivElement>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  const choose = (next: string) => {
    if (next === value) return;
    onValueChange(next);
    // Only when the switch is stuck, the page scrolled past where it starts.
    const where = top.current?.getBoundingClientRect().top;
    if (where !== undefined && where < 0) window.scrollBy({ top: where });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = tabs.findIndex((tab) => tab.value === value);
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (step === 0 || index === -1) return;
    event.preventDefault();
    const next = (index + step + tabs.length) % tabs.length;
    choose(tabs[next]!.value);
    buttons.current[next]?.focus();
  };

  return (
    <>
      <div ref={top} aria-hidden="true" />
      <div
        role="tablist"
        aria-label="Recipe"
        onKeyDown={onKeyDown}
        data-print="hide"
        className="sticky top-2 z-content-sticky flex gap-0.5 rounded-xl bg-bg-subtle-pressed p-0.5 shadow-md"
      >
        {tabs.map((tab, index) => {
          const selected = tab.value === value;
          return (
            <button
              key={tab.value}
              ref={(node) => {
                buttons.current[index] = node;
              }}
              type="button"
              role="tab"
              id={`${base}-tab-${tab.value}`}
              aria-selected={selected}
              aria-controls={`${base}-panel-${tab.value}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => choose(tab.value)}
              className={cn(
                "min-h-11 flex-1 cursor-pointer rounded-[0.625rem] px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-border-brand",
                selected ? "bg-bg-normal text-fg-strong shadow-sm" : "text-fg-subtle hover:text-fg-normal"
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => {
        const Panel = tab.as ?? "div";
        return (
          <Panel
            key={tab.value}
            role="tabpanel"
            id={`${base}-panel-${tab.value}`}
            aria-labelledby={`${base}-tab-${tab.value}`}
            data-testid={tab.testId}
            data-print={tab.as === "aside" ? "keep" : undefined}
            // `hidden` the class, not the attribute: preflight's [hidden] is !important in a layer, which a printout could not undo.
            className={cn("flex-col gap-4", tab.value === value ? "flex" : "hidden print:flex")}
          >
            {tab.content}
          </Panel>
        );
      })}
    </>
  );
}
