import { type Range, useWindowVirtualizer } from "@tanstack/react-virtual";
import { type ReactNode, useLayoutEffect, useRef, useState } from "react";

/** A row's height before it is measured: one line of text in a table row. */
const ROW_ESTIMATE = 41;

/**
 * A table's rows as a virtual list over the page's own scroll (decisions.md
 * row 176): only the rows near the screen are drawn, each measured as it lands
 * (a wrapped name makes a taller row), with spacer rows standing in for the
 * rest. Put `body` on the `<tbody>`, `measureElement` on each drawn `<tr>`
 * with its `data-index`, `spacer(gapAbove(at))` before each, and
 * `spacer(gapEnd)` after the last. DataTable's and the desktop's foods grid.
 */
export function useWindowTableRows({
  count,
  keyAt,
  columnCount,
  rangeExtractor,
}: {
  count: number;
  /** A stable key for the row at `index`, so a re-sort keeps each row's measured height. */
  keyAt: (index: number) => string | number;
  /** How many cells a spacer row spans. */
  columnCount: number;
  /** Rows to draw beyond the visible range (a focused row kept drawn while scrolled away). */
  rangeExtractor?: (range: Range) => number[];
}) {
  const body = useRef<HTMLTableSectionElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  useLayoutEffect(() => {
    const measure = () => setScrollMargin((body.current?.getBoundingClientRect().top ?? 0) + window.scrollY);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  const virtualizer = useWindowVirtualizer({
    count,
    estimateSize: () => ROW_ESTIMATE,
    // A drawn row is never 0px tall; one that measures so has no layout yet (a DOM without one, in a test), and
    // counting it as 0 would slide the range past it.
    measureElement: (element) => element.getBoundingClientRect().height || ROW_ESTIMATE,
    overscan: 10,
    scrollMargin,
    initialRect: { width: 0, height: 800 },
    getItemKey: keyAt,
    ...(rangeExtractor === undefined ? {} : { rangeExtractor }),
  });
  const rows = virtualizer.getVirtualItems();
  return {
    body,
    rows,
    measureElement: virtualizer.measureElement,
    /** The undrawn rows between the drawn row at `at` and the one before it (or the table's top). */
    gapAbove: (at: number) => rows[at]!.start - scrollMargin - (at === 0 ? 0 : (rows[at - 1]?.end ?? 0) - scrollMargin),
    /** The undrawn rows after the last drawn one. */
    gapEnd: virtualizer.getTotalSize() - ((rows.at(-1)?.end ?? scrollMargin) - scrollMargin),
    spacer: (height: number, key: string): ReactNode =>
      height > 0 && (
        <tr key={key} data-spacer>
          <td colSpan={Math.max(columnCount, 1)} className="p-0" style={{ height }} aria-hidden="true" />
        </tr>
      ),
  };
}
