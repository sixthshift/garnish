import { Modal } from "@sixthshift/design-system/modal";
import { toast } from "@sixthshift/design-system/overlay";
import { cn } from "@sixthshift/design-system/utils";
import { useNavigate } from "@tanstack/react-router";
import { Fragment, useEffect, useId, useMemo, useRef, useState } from "react";
import { addPlanEntry, listPlanWeek } from "../../../../api/rpc/plan";
import { listRecipes } from "../../../../api/rpc/recipes";
import { addShoppingItems } from "../../../../api/rpc/shopping";
import { dayName, nextMonday, type PlanDay, todayIso, weekMonday } from "../../../../domain/plan/plan";
import { recipeImageUrl } from "../../../../lib/images";
import { useMutate } from "../../../../lib/mutate";
import { clampSelection, nextSearchIndex } from "../../../../lib/search";
import { toastError } from "../../../../lib/toast";
import { buildOptions, type CommandOption, type CommandRecipe, highlight, parseQuery, searchTermOf } from "./commands";
import { Kbd, SearchIcon } from "./Kbd";

/** How long typing pauses before the recipe search runs. */
const SEARCH_DEBOUNCE_MS = 150;

/** What the empty bar offers from the plan: tonight's recipes and next week's empty nights. */
type PlanGlance = { tonight: CommandRecipe[]; nextWeek: { monday: string; emptyNights: number } };

/** Read the plan once, for the empty bar. A failure leaves it out rather than failing the bar. */
async function readPlan(today: string): Promise<PlanGlance> {
  const monday = weekMonday(undefined, today);
  const next = nextMonday(monday);
  const [days, nextDays] = await Promise.all([listPlanWeek({ data: { monday } }), listPlanWeek({ data: { monday: next } })]);
  const tonight = (days as PlanDay[]).find((day) => day.date === today)?.entries.flatMap((entry) => (entry.recipe ? [entry.recipe] : [])) ?? [];
  return { tonight, nextWeek: { monday: next, emptyNights: (nextDays as PlanDay[]).filter((day) => day.entries.length === 0).length } };
}

/**
 * The command bar's palette (decisions.md row 207): one box that opens a
 * recipe, puts one on a day ("ragu tue"), adds a line to the shopping list or
 * goes to a page. What was typed becomes options in `commands.ts`; this reads
 * the recipes and the plan they need, and does what is chosen. The box keeps
 * focus and the keyboard: the arrows move the highlight, Enter does it, Esc
 * (the Modal's) closes it.
 */
export function CommandPalette({ onClose, today: fixedToday }: { onClose: () => void; today?: string }) {
  const today = fixedToday ?? todayIso();
  const navigate = useNavigate();
  const mutate = useMutate();
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const [recipes, setRecipes] = useState<CommandRecipe[]>([]);
  const [plan, setPlan] = useState<PlanGlance | null>(null);

  useEffect(() => input.current?.focus(), []);

  useEffect(() => {
    let live = true;
    readPlan(today).then(
      (glance) => live && setPlan(glance),
      () => {}
    );
    return () => {
      live = false;
    };
  }, [today]);

  // Ask for the longest term; `buildOptions` keeps what holds every term, so
  // results that arrive a keystroke late still only show what fits.
  const term = searchTermOf(parseQuery(query, today).terms);
  useEffect(() => {
    if (term === null) return;
    let live = true;
    const timer = setTimeout(() => {
      listRecipes({ data: { q: term, sort: "name", dir: "asc" } }).then(
        (found) => live && setRecipes(found),
        () => live && setRecipes([])
      );
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [term]);

  const options = useMemo(
    () => buildOptions({ query, today, recipes, tonight: plan?.tonight, nextWeek: plan?.nextWeek ?? null }),
    [query, today, recipes, plan]
  );
  const active = clampSelection(selected, options.length);

  useEffect(() => {
    document.getElementById(`${listId}-${active}`)?.scrollIntoView?.({ block: "nearest" });
  }, [listId, active]);

  const run = async (option: CommandOption | undefined) => {
    if (option === undefined) return;
    onClose();
    switch (option.kind) {
      case "open":
        await navigate({ to: "/recipes/$slug", params: { slug: option.recipe.slug } });
        return;
      case "go":
        await navigate({ to: option.target.to, search: option.target.search });
        return;
      case "plan":
        try {
          // The name travels with the id, as the plan page's own add does.
          await mutate(() => addPlanEntry({ data: { date: option.date, recipeId: option.recipe.id, text: option.recipe.name } }));
          toast({ intent: "success", title: `${option.recipe.name} is on ${dayName(option.date)}` });
        } catch (error) {
          toastError("Couldn't plan the recipe", error);
        }
        return;
      case "shop":
        try {
          await mutate(() => addShoppingItems({ data: { items: [{ text: option.text }] } }));
          toast({ intent: "success", title: `Added “${option.text}” to the shopping list` });
        } catch (error) {
          toastError("Couldn't add to the shopping list", error);
        }
        return;
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const next = nextSearchIndex(active, options.length, event.key);
    if (next !== null) {
      event.preventDefault();
      setSelected(next);
    } else if (event.key === "Enter") {
      event.preventDefault();
      void run(options[active]);
    }
  };

  return (
    <Modal align="top" aria-label="Command bar" onOpenChange={(open) => !open && onClose()} className="sm:top-[11vh] sm:w-[min(42.5rem,90vw)] shadow-2xl">
      <div className="flex items-center gap-3 border-b border-border-normal px-4 py-3.5">
        <span className="text-fg-subtle">
          <SearchIcon size={18} />
        </span>
        <input
          ref={input}
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={options.length > 0 ? `${listId}-${active}` : undefined}
          aria-label="Search, plan or add"
          placeholder="Try “ragu tue”, “milk” or “plan”"
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelected(0);
          }}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 bg-transparent text-lg outline-none placeholder:text-fg-subtle focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        <Kbd>Esc</Kbd>
      </div>
      <div id={listId} role="listbox" aria-label="Results" className="max-h-[27.5rem] overflow-y-auto p-2">
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
              id={`${listId}-${index}`}
              role="option"
              tabIndex={-1}
              aria-selected={index === active}
              // Moved over, not entered: a row that appears under a resting
              // pointer must not take the highlight (as SearchResultList).
              onMouseMove={() => index !== active && setSelected(index)}
              onClick={() => void run(option)}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm",
                index === active && "bg-bg-brand-subtle ring-1 ring-border-brand-subtle ring-inset"
              )}
            >
              <OptionIcon option={option} />
              <span className="min-w-0 flex-1 truncate">
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
      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border-normal bg-bg-subtle px-4 py-2.5 text-xs text-fg-subtle">
        <span>
          <Kbd>↑</Kbd> <Kbd>↓</Kbd> choose
        </span>
        <span>
          <Kbd>↵</Kbd> do it
        </span>
        <span>End with a day to plan it: “risotto wed”</span>
        <span>Anything else goes on the shopping list</span>
      </div>
    </Modal>
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
