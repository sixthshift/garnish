import { Muted } from "@sixthshift/design-system/muted";
import type { RecipeDraft } from "../../../draft";
import type { ImportCheckState } from "../ImportCheck";
import { checkedRead, useLineSource } from "./LineSource";
import { FlagDot, ReadLine } from "./ReadLine";

/**
 * What needs a look first on a phone's Check (decisions.md row 208): each line
 * the import is unsure of, tapped to see it beside the page it came from. The
 * import is unsure of a food or a unit the library lacks and of a line it read
 * no food from; once none are left it says so, and says nothing for a recipe
 * with no ingredients yet.
 */
export function LinesToCheck({ draft, check }: { draft: RecipeDraft; check: ImportCheckState }) {
  const lines = useLineSource();
  const rows = new Map(draft.parts.flatMap((part) => part.ingredients.map((row) => [row.id ?? "", row] as const)));
  const count = check.flags.length;

  if (count === 0) {
    if (rows.size === 0) return null;
    return (
      <p className="rounded-xl bg-bg-subtle px-4 py-3 text-sm font-medium text-fg-strong" data-testid="lines-checked">
        ✓ Nothing left to check
      </p>
    );
  }

  return (
    <section
      className="flex flex-col gap-2 rounded-2xl border border-[var(--color-border-warning)] bg-bg-warning-subtle px-4 py-3.5"
      aria-label="Lines to check"
      data-testid="lines-to-check"
    >
      <div className="flex flex-col">
        <h2 className="font-semibold text-fg-strong">
          {count} {count === 1 ? "line" : "lines"} to check
        </h2>
        <Muted as="p" className="text-sm">
          {lines?.hasSource ? "Tap one to see it beside the page it came from." : "Tap one to see what garnish made of it."}
        </Muted>
      </div>
      <ul className="flex flex-col gap-1.5">
        {check.flags.map((flag) => {
          const row = rows.get(flag.id);
          const read = row === undefined ? null : checkedRead(check, row);
          return (
            <li key={flag.id}>
              <button
                type="button"
                className="flex w-full items-start gap-2.5 rounded-xl bg-bg-normal/70 px-3 py-2.5 text-left text-sm"
                aria-label={`Check ${row?.originalText || "this line"}`}
                onClick={() => lines?.show(flag.id)}
                data-flag={flag.kind}
              >
                <FlagDot />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  {read === null ? <span>{row?.originalText}</span> : <ReadLine read={read} />}
                  <Muted as="span" className="text-xs">
                    {flag.reason}
                  </Muted>
                </span>
                <span aria-hidden="true" className="text-fg-subtle">
                  ›
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
