import { Badge } from "@sixthshift/design-system/badge";
import { cn } from "@sixthshift/design-system/utils";
import { useEffect, useRef } from "react";
import type { SourceLine } from "../../../draft";

export type SourceViewProps = {
  lines: readonly SourceLine[];
  /** The row the editor is pointing at, by its id: its line lights up and is scrolled to. */
  lit: string | null;
};

/**
 * What the import read, beside Check on a desktop (decisions.md row 207): the
 * page's text, or what was pasted, a line at a time and numbered. A line a row
 * was made from reads plainly and a line nothing came from is greyed, so what
 * the read left out is there to see; pointing at a row in the editor lights
 * its line and brings it into view.
 */
export function SourceView({ lines, lit }: SourceViewProps) {
  const list = useRef<HTMLOListElement>(null);
  const used = lines.filter((line) => line.rows.length > 0).length;

  useEffect(() => {
    if (lit === null) return;
    const line = list.current?.querySelector<HTMLElement>("[data-lit]");
    // `nearest` leaves a line already in view where it is, so moving down the editor does not jolt the page beside it.
    line?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }, [lit]);

  return (
    <section className="flex flex-col gap-3" aria-label="Source" data-testid="source-view">
      <div className="flex flex-wrap items-center gap-2 text-sm text-fg-subtle">
        <span className="flex-1">Greyed lines made nothing in the recipe</span>
        <Badge variant="soft" intent="neutral" size="sm">
          {used} of {lines.length} lines used
        </Badge>
      </div>
      <ol ref={list} className="rounded-xl border border-border-normal bg-bg-normal py-3 text-sm leading-relaxed">
        {lines.map((line, index) => {
          const on = lit !== null && line.rows.includes(lit);
          return (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: the lines are fixed for the life of Check, in the page's order
              key={index}
              className={cn(
                "relative py-0.5 pr-4 pl-12 transition-colors",
                line.heading && "mt-2 font-semibold",
                line.rows.length === 0 ? "text-fg-subtle opacity-70" : "text-fg-normal",
                on && "bg-bg-warning-subtle text-fg-strong opacity-100 shadow-[inset_3px_0_0_var(--color-bg-warning)]"
              )}
              data-source-line={index + 1}
              data-used={line.rows.length > 0 ? "true" : undefined}
              data-lit={on ? "true" : undefined}
            >
              <span className="absolute top-[0.3rem] left-2 w-7 text-right text-xs font-normal tabular-nums text-fg-subtle" aria-hidden="true">
                {index + 1}
              </span>
              {line.text}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
