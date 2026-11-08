import { Badge } from "@sixthshift/design-system/badge";
import { Button } from "@sixthshift/design-system/button";
import { Heading } from "@sixthshift/design-system/heading";
import { Input } from "@sixthshift/design-system/input";
import { Muted } from "@sixthshift/design-system/muted";
import { toast } from "@sixthshift/design-system/overlay";
import { Toggle } from "@sixthshift/design-system/toggle";
import { cn } from "@sixthshift/design-system/utils";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { type PointerEvent, useLayoutEffect, useMemo, useRef, useState } from "react";
import { PlusIcon } from "../../../../../components/ui/icons";
import { Menu } from "../../../../../components/ui/Menu";
import { SwipeRow } from "../../../../../components/ui/SwipeRow";
import type { RecipeSummary } from "../../../../../domain/recipes/recipe";
import type { Aisle, FoodPack, FoodRow, Unit } from "../../../../../domain/recipes/reference";
import { useMutate } from "../../../../../lib/mutate";
import { NEW_FOOD, useFoodActions } from "../food/useFoodActions";
import { usePendingFoods } from "../food/usePendingFoods";
import { FoodSheet, type FoodSheetPatch } from "./FoodSheet";

/** The scrubber's letters, and `#` for a name that starts with anything else. */
export const LETTERS = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ", "#"] as const;

/** One line of the list: a letter's header or a food. */
export type FoodListItem = { kind: "letter"; letter: string } | { kind: "food"; letter: string; food: FoodRow };

/** The letter a name is filed under: its first letter without an accent, or `#`. Pure. */
export function letterOf(name: string): string {
  const first = name.trim().normalize("NFD").charAt(0).toUpperCase();
  return first >= "A" && first <= "Z" ? first : "#";
}

/** Whether `food` answers to `query` by its name, its plural or another name it goes by. Pure. */
export function foodMatches(food: FoodRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q === "") return true;
  return [food.name, food.pluralName ?? "", ...food.aliases].some((name) => name.toLowerCase().includes(q));
}

/** The foods filed by letter, A to Z then `#`, each letter's header before its foods. Pure. */
export function foodListItems(foods: readonly FoodRow[]): FoodListItem[] {
  const filed = foods
    .map((food) => ({ food, letter: letterOf(food.name) }))
    .sort(
      (a, b) =>
        LETTERS.indexOf(a.letter as (typeof LETTERS)[number]) - LETTERS.indexOf(b.letter as (typeof LETTERS)[number]) ||
        a.food.name.localeCompare(b.food.name, "en-AU", { sensitivity: "base" })
    );
  const items: FoodListItem[] = [];
  for (const { food, letter } of filed) {
    if (items.at(-1)?.letter !== letter) items.push({ kind: "letter", letter });
    items.push({ kind: "food", letter, food });
  }
  return items;
}

const LETTER_HEIGHT = 34;
const FOOD_HEIGHT = 64;

export type FoodsListProps = {
  foods: readonly FoodRow[];
  usage: Readonly<Record<string, number>>;
  packs?: readonly FoodPack[];
  aisles: readonly Aisle[];
  units: readonly Unit[];
  recipes: readonly RecipeSummary[];
};

/**
 * Settings › Foods on a phone (decisions.md row 208, the mockup's `mFoods`):
 * the search held at the top, the foods filed by letter under headers that
 * stay put while their letter is on screen, and an alphabet down the right
 * edge that jumps to a letter at a tap or as a thumb slides down it. A row
 * dragged left deletes (through the same confirm as its ⋯ menu's Delete); a
 * tap opens the food in a sheet. Hundreds of foods, so only those near the
 * screen are drawn (decisions.md row 176); the letter held at the top is
 * drawn once, over the list, for the row it is on, since a drawn row is
 * placed by the virtual list and cannot stick by itself.
 */
export function FoodsList({ foods, usage, packs = [], aisles, units, recipes }: FoodsListProps) {
  const _mutate = useMutate();
  const [query, setQuery] = useState("");
  const [onHandOnly, setOnHandOnly] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const actions = useFoodActions({ foods, packs, aisles, units, recipes });
  // A tap's change shows at once, before the reload brings it back saved.
  const { shown: withPending, save: saveFood } = usePendingFoods(foods);
  const shown = useMemo(() => withPending.filter((food) => !onHandOnly || food.skipShopping), [withPending, onHandOnly]);
  const items = useMemo(() => foodListItems(shown.filter((food) => foodMatches(food, query))), [shown, query]);
  const firstOf = useMemo(() => {
    const at = new Map<string, number>();
    items.forEach((item, index) => {
      if (item.kind === "letter") at.set(item.letter, index);
    });
    return at;
  }, [items]);
  const open = openId === null ? null : (shown.find((food) => food.id === openId) ?? null);
  const aisleName = (id: string | null) => aisles.find((aisle) => aisle.id === id)?.name ?? null;

  // The list scrolls with the page; it starts below the header, and a jump lands below the held search.
  const list = useRef<HTMLUListElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  const [barHeight, setBarHeight] = useState(0);
  useLayoutEffect(() => {
    const measure = () => {
      setScrollMargin((list.current?.getBoundingClientRect().top ?? 0) + window.scrollY);
      setBarHeight(bar.current?.offsetHeight ?? 0);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  const virtualizer = useWindowVirtualizer({
    count: items.length,
    estimateSize: (index) => (items[index]?.kind === "letter" ? LETTER_HEIGHT : FOOD_HEIGHT),
    // A drawn row is never 0px tall; one that measures so has no layout yet (a test's DOM).
    measureElement: (element) => element.getBoundingClientRect().height || (element.getAttribute("data-kind") === "letter" ? LETTER_HEIGHT : FOOD_HEIGHT),
    overscan: 10,
    scrollMargin,
    scrollPaddingStart: barHeight,
    initialRect: { width: 0, height: 800 },
    getItemKey: (index) => {
      const item = items[index];
      return item === undefined ? index : item.kind === "letter" ? `letter-${item.letter}` : item.food.id;
    },
  });
  const drawn = virtualizer.getVirtualItems();

  // The letter of the first row under the held search, shown over the list
  // once its own header has gone up under the search.
  const top = (typeof window === "undefined" ? 0 : window.scrollY) + barHeight;
  const under = drawn.find((row) => row.end > top);
  const held = under !== undefined && under.start < top - 1 ? items[under.index]?.letter : undefined;

  const jump = (letter: string) => {
    const index = firstOf.get(letter);
    if (index !== undefined) virtualizer.scrollToIndex(index, { align: "start" });
  };

  const save = (food: FoodRow, patch: FoodSheetPatch) =>
    saveFood(food, patch, () => {
      if (patch.aisleId !== undefined) toast({ intent: "success", title: `${food.name}: ${aisleName(patch.aisleId) ?? "no aisle"}` });
    });

  return (
    <div className="flex flex-col" data-testid="foods-list">
      <div className="flex items-center gap-2 pb-2">
        <Heading as="h1" className="flex-1">
          Foods
        </Heading>
        <Toggle type="button" variant="outline" intent="neutral" size="sm" pressed={onHandOnly} onPressedChange={setOnHandOnly}>
          On hand
        </Toggle>
        <Button
          type="button"
          variant="outline"
          intent="neutral"
          size="lg"
          iconOnly
          className="rounded-full"
          aria-label="Add food"
          onClick={() => actions.edit(NEW_FOOD)}
        >
          <PlusIcon />
        </Button>
      </div>

      <div ref={bar} className="sticky top-0 z-content-sticky -mx-4 bg-bg-subtle px-4 pt-1.5 pb-2">
        <Input aria-label="Search foods" placeholder="Search foods and their other names" value={query} onChange={(event) => setQuery(event.target.value)} />
        {held !== undefined && (
          <div aria-hidden="true" className="absolute inset-x-0 top-full bg-bg-subtle px-5 pt-2 pb-1 text-sm font-bold text-fg-brand" data-held-letter>
            {held}
          </div>
        )}
      </div>

      <Muted as="p" className="py-1 text-xs" data-table-count>
        {shown.length === items.filter((item) => item.kind === "food").length
          ? `${shown.length} foods`
          : `${items.filter((item) => item.kind === "food").length} of ${shown.length} foods`}
      </Muted>

      {items.length === 0 ? (
        <Muted as="p" className="py-6 text-center">
          {query.trim() === "" ? "No foods yet." : `No food goes by “${query.trim()}”.`}
        </Muted>
      ) : (
        <ul ref={list} className="relative mr-4" style={{ height: virtualizer.getTotalSize() }} aria-label="Foods">
          {drawn.map((row) => {
            const item = items[row.index];
            if (item === undefined) return null;
            return (
              <li
                key={row.key}
                ref={virtualizer.measureElement}
                data-index={row.index}
                data-kind={item.kind}
                className="absolute inset-x-0 top-0"
                style={{ transform: `translateY(${row.start - scrollMargin}px)` }}
              >
                {item.kind === "letter" ? (
                  <h2 className="px-1 pt-3 pb-1 text-sm font-bold text-fg-brand" data-letter={item.letter}>
                    {item.letter}
                  </h2>
                ) : (
                  <FoodLine
                    food={item.food}
                    aisle={aisleName(item.food.aisleId)}
                    onOpen={() => setOpenId(item.food.id)}
                    onMerge={() => actions.merge(item.food)}
                    onDelete={() => actions.askDelete([item.food])}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Scrubber present={new Set(firstOf.keys())} onLetter={jump} />

      {open !== null && (
        <FoodSheet
          food={open}
          aisles={aisles}
          usage={usage[open.id] ?? 0}
          onPatch={(patch) => void save(open, patch)}
          onClose={() => setOpenId(null)}
          onEditAll={() => {
            setOpenId(null);
            actions.edit(open);
          }}
          onMerge={() => {
            setOpenId(null);
            actions.merge(open);
          }}
          onDelete={() => {
            setOpenId(null);
            actions.askDelete([open]);
          }}
        />
      )}
      {actions.dialogs}
    </div>
  );
}

/**
 * One food: its name, the other names it goes by and its aisle, opening the
 * sheet at a tap. Dragged left it deletes, a shortcut for the ⋯ menu's
 * Delete, which asks first either way (decisions.md row 208).
 */
function FoodLine({
  food,
  aisle,
  onOpen,
  onMerge,
  onDelete,
}: {
  food: FoodRow;
  aisle: string | null;
  onOpen: () => void;
  onMerge: () => void;
  onDelete: () => void;
}) {
  const aliases = food.aliases.join(", ");
  return (
    <SwipeRow left={{ label: "Delete", tone: "stop", onSwipe: onDelete }} className="border-b border-border-subtle">
      <div className="flex items-center gap-1 bg-bg-subtle">
        <button type="button" onClick={onOpen} className="flex min-h-16 min-w-0 flex-1 items-center gap-2.5 py-2 pl-1 text-left">
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-medium text-fg-strong">{food.name}</span>
            <span className="truncate text-sm text-fg-subtle">
              {food.skipShopping && <span className="font-medium text-fg-brand">on hand{aliases !== "" && " · "}</span>}
              {aliases !== "" ? aliases : !food.skipShopping && "—"}
            </span>
          </span>
          {aisle !== null && (
            <Badge variant="outline" intent="neutral" className="shrink-0">
              {aisle}
            </Badge>
          )}
        </button>
        <Menu label={`Actions for ${food.name}`} iconOnly className="shrink-0">
          <Menu.Item onSelect={onMerge}>Merge into…</Menu.Item>
          <Menu.Item onSelect={onDelete}>Delete</Menu.Item>
        </Menu>
      </div>
    </SwipeRow>
  );
}

/**
 * The alphabet down the right edge: a tap on a letter jumps to it, and a
 * thumb pressed on the strip and slid down it jumps as it passes each one, as
 * a phone's contacts do. A letter with no foods is greyed and passed over.
 */
function Scrubber({ present, onLetter }: { present: ReadonlySet<string>; onLetter: (letter: string) => void }) {
  const strip = useRef<HTMLDivElement>(null);
  const last = useRef<string | null>(null);
  const letters = LETTERS.filter((letter) => letter !== "#" || present.has("#"));

  const at = (event: PointerEvent<HTMLElement>) => {
    const box = strip.current?.getBoundingClientRect();
    if (!box || box.height === 0) return;
    const letter = letters[Math.min(letters.length - 1, Math.max(0, Math.floor(((event.clientY - box.top) / box.height) * letters.length)))];
    if (letter === undefined || letter === last.current || !present.has(letter)) return;
    last.current = letter;
    onLetter(letter);
  };

  return (
    <nav
      aria-label="Jump to a letter"
      className="fixed top-1/2 right-0.5 z-content-sticky -translate-y-1/2"
      onPointerDown={(event) => {
        if (event.pointerType === "mouse") return;
        last.current = null;
        event.currentTarget.setPointerCapture?.(event.pointerId);
        at(event);
      }}
      onPointerMove={(event) => event.buttons !== 0 && event.pointerType !== "mouse" && at(event)}
      onPointerUp={() => (last.current = null)}
    >
      <div ref={strip} className="flex touch-none flex-col items-center select-none">
        {letters.map((letter) => {
          const has = present.has(letter);
          return (
            <button
              key={letter}
              type="button"
              disabled={!has}
              aria-label={`Jump to ${letter}`}
              className={cn("px-1.5 text-[10px] leading-[1.35] font-bold", has ? "text-fg-brand" : "text-fg-subtle opacity-40")}
              onClick={() => onLetter(letter)}
            >
              {letter}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
