import { cn } from "@sixthshift/design-system/utils";
import { Fragment } from "react";
import { recipeImageUrl } from "../../../lib/images";
import { type CommandOption, highlight } from "./commands";

/**
 * The command bar's options under their group names (decisions.md rows 207
 * and 208), a desktop's palette's and a phone's + sheet's. The box above
 * keeps focus and the keyboard; an option is chosen by pointer or by the
 * box's Enter. `itemClassName` sizes a row: a phone's are a finger's height;
 * `wrap` lets a label take two lines where the width is short of it, so
 * "Put … on Thursday" keeps its day.
 */
export function CommandList({
  id,
  options,
  active,
  query,
  today,
  onHover,
  onChoose,
  className,
  itemClassName,
  wrap = false,
}: {
  id: string;
  options: readonly CommandOption[];
  active: number;
  query: string;
  today: string;
  onHover: (index: number) => void;
  onChoose: (option: CommandOption) => void;
  className?: string;
  itemClassName?: string;
  wrap?: boolean;
}) {
  return (
    <div id={id} role="listbox" aria-label="Results" className={className}>
      {options.length === 0 && <p className="px-3 py-4 text-sm text-fg-subtle">Nothing matches.</p>}
      {options.map((option, index) => (
        <Fragment key={`${option.kind}-${option.label}`}>
          {option.group !== options[index - 1]?.group && (
            <div role="presentation" className="px-2.5 pt-2 pb-1 text-xs font-semibold uppercase tracking-wider text-fg-subtle">
              {option.group}
            </div>
          )}
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: focus stays in the box above, which owns the keyboard; an option never receives a key event. */}
          <div
            id={`${id}-${index}`}
            role="option"
            tabIndex={-1}
            aria-selected={index === active}
            // Moved over, not entered: a row that appears under a resting
            // pointer must not take the highlight (as SearchResultList).
            onMouseMove={() => index !== active && onHover(index)}
            onClick={() => onChoose(option)}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm",
              itemClassName,
              index === active && "bg-bg-brand-subtle ring-1 ring-border-brand-subtle ring-inset"
            )}
          >
            <OptionIcon option={option} />
            <span className={cn("min-w-0 flex-1", wrap ? "line-clamp-2" : "truncate")}>
              {highlight(option.label, query, today).map((part, at) =>
                part.match ? (
                  // biome-ignore lint/suspicious/noArrayIndexKey: the parts of one label, in order, never reordered.
                  <mark key={at} className="rounded-sm bg-bg-warning-subtle text-inherit">
                    {part.text}
                  </mark>
                ) : (
                  // biome-ignore lint/suspicious/noArrayIndexKey: as above.
                  <Fragment key={at}>{part.text}</Fragment>
                )
              )}
            </span>
            {"hint" in option && option.hint !== undefined && <span className="shrink-0 text-xs text-fg-subtle">{option.hint}</span>}
          </div>
        </Fragment>
      ))}
    </div>
  );
}

/** A recipe's picture, or a mark for what the option does. */
function OptionIcon({ option }: { option: CommandOption }) {
  const box = "grid size-9 shrink-0 place-items-center rounded-md";
  if (option.kind === "open" || option.kind === "plan") {
    const src = recipeImageUrl(option.recipe.image);
    return src === null ? (
      <span aria-hidden="true" className={cn(box, "bg-bg-subtle")} />
    ) : (
      <img src={src} alt="" loading="lazy" className={cn(box, "object-cover")} />
    );
  }
  return (
    <span aria-hidden="true" className={cn(box, "bg-bg-subtle text-base text-fg-subtle")}>
      {option.kind === "shop" ? "+" : "→"}
    </span>
  );
}
