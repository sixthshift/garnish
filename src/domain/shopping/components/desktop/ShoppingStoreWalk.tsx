import { Badge } from "@sixthshift/design-system/badge";
import { Button } from "@sixthshift/design-system/button";
import { Heading } from "@sixthshift/design-system/heading";
import { Muted } from "@sixthshift/design-system/muted";
import { ProgressBar } from "@sixthshift/design-system/progress-bar";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import { cn } from "@sixthshift/design-system/utils";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Page } from "../../../../components/Page";
import { recipeImageUrl } from "../../../../lib/images";
import { followMedia, mediaMatches, prefersReducedMotion } from "../../../../lib/layout";
import { pendingLabel } from "../../../../lib/outbox";
import { dayParts } from "../../../plan/plan";
import { groupByAisle, mealKeysOf, mealsOf, type ShoppingItem, type ShoppingListMeal, shoppingMeals, sizesByFood } from "../../shopping";
import { AddItemForm } from "../AddItemForm";
import { ClearTickedDialog } from "../ClearTickedDialog";
import type { ShoppingListViewProps } from "../ShoppingListView";
import { ShoppingRow } from "../ShoppingRow";

/** From about this wide the trolley is a column of its own; under it, a chip that opens it above the aisles. */
const TROLLEY_COLUMN_MEDIA = "(min-width: 85rem)";

/**
 * An aisle this long or shorter stays in one column. A longer one may run on
 * into the next: kept whole, it sets the height every column balances to, and
 * the walk ends in three columns with the width beside them empty.
 */
const WHOLE_AISLE = 8;

/** How long a ticked line takes to slide out of its aisle before it is sent to the trolley. */
const LEAVE_MS = 250;

const followTrolley = followMedia(TROLLEY_COLUMN_MEDIA);
const trolleyColumnNow = () => mediaMatches(TROLLEY_COLUMN_MEDIA);

/**
 * A desktop's shopping list as a walk round the shop (decisions.md row 207):
 * the aisles in the household's shop order flowing into newspaper columns
 * across the width, a trolley beside them that ticked lines slide into, and
 * on the right the meals the list is for, a key that lights up a meal's lines
 * across the aisles on hover and keeps them lit on a click. The key does the
 * job a phone's meal chips do (which dish wants what), lighting rather than
 * narrowing, since here the whole walk is in view.
 */
export function ShoppingStoreWalk({
  items,
  packs = [],
  units = [],
  onAdd,
  onTick,
  onRemove,
  onClearTicked,
  busy = false,
  pending = 0,
  offline = false,
}: ShoppingListViewProps) {
  const sizes = sizesByFood(packs, units);
  const [confirming, setConfirming] = useState(false);
  const trolleyColumn = useSyncExternalStore(followTrolley, trolleyColumnNow, () => true);
  const [trolleyOpen, setTrolleyOpen] = useState(false);

  // The meals key: a hover lights a meal's lines, a click pins it (and a second click lets it go).
  const [hovered, setHovered] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);

  // A tick slides the line out of its aisle first, then sends it; the line stays out of sight until
  // the list comes back with it ticked, and drops in to the trolley from the left.
  const { leaving, arrived, tick } = useTrolleyMove(items, busy, onTick);

  const ticked = items.filter((item) => item.ticked);
  const aisles = groupByAisle(items).filter((group) => !group.ticked);
  const meals = shoppingMeals(items);
  // A pinned or hovered meal whose lines have all gone (cleared, removed) is no longer in the key, so it
  // lights nothing rather than dimming every line with nothing left to press to let it go.
  const live = (key: string | null) => (key !== null && meals.some((meal) => meal.key === key) ? key : null);
  const active = live(pinned) ?? live(hovered);

  const tone = (item: ShoppingItem): "lit" | "dim" | null => (active === null ? null : mealKeysOf(item).includes(active) ? "lit" : "dim");

  const row = (item: ShoppingItem, onPanel: boolean) => {
    const lit = tone(item);
    return (
      <ShoppingRow
        key={item.id}
        item={item}
        meals={mealsOf(item)}
        sizes={item.food === null ? undefined : (sizes.get(item.food.id) ?? [])}
        onTick={tick}
        onRemove={onRemove}
        busy={busy}
        surface={cn(
          "px-1.5",
          lit === "lit" ? "bg-bg-brand-subtle shadow-[inset_3px_0_0_var(--color-border-brand)]" : onPanel ? "bg-bg-normal" : "bg-bg-subtle"
        )}
        className={cn(
          "break-inside-avoid rounded-md transition-[opacity,translate] duration-250 motion-reduce:transition-none",
          lit === "dim" && "opacity-30",
          leaving.has(item.id) && !item.ticked && "translate-x-8 opacity-0",
          onPanel && arrived.has(item.id) && "starting:-translate-x-6 starting:opacity-0"
        )}
      />
    );
  };

  const trolley = (
    <aside
      aria-label="In the trolley"
      className={cn("flex flex-col gap-2 rounded-xl border border-border-subtle bg-bg-normal p-3", trolleyColumn && "sticky top-[calc(var(--top-bar)+1.5rem)]")}
      data-testid="shopping-trolley"
    >
      <div className="flex items-center justify-between gap-3 px-1.5">
        <SectionTitle as="h2">In the trolley</SectionTitle>
        <Muted as="span">{ticked.length}</Muted>
      </div>
      {ticked.length === 0 ? (
        <Muted as="p" className="px-1.5 pb-1 text-sm">
          Tick a line and it lands here.
        </Muted>
      ) : (
        <ul className="flex flex-col">{ticked.map((item) => row(item, true))}</ul>
      )}
    </aside>
  );

  return (
    <Page width="full">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3" data-page-header="">
        <Heading as="h1">Shopping</Heading>
        {items.length > 0 && (
          <div className="flex min-w-60 max-w-xl flex-1 flex-col gap-1.5" data-testid="shopping-progress">
            <p className="flex items-baseline gap-1.5">
              <span className="font-semibold">
                {ticked.length} of {items.length}
              </span>
              <Muted as="span">in the trolley</Muted>
            </p>
            <ProgressBar completed={ticked.length} total={items.length} showFraction={false} label="In the trolley" />
          </div>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {pending > 0 && (
            <Badge intent="warning" data-testid="shopping-pending">
              {pendingLabel(pending)}
            </Badge>
          )}
          {ticked.length > 0 && (
            <Button type="button" variant="outline" intent="neutral" size="sm" disabled={busy || offline} onClick={() => setConfirming(true)}>
              Clear the trolley
            </Button>
          )}
        </div>
      </div>

      {/* A typed line is free text, so it always goes to Other: there is no aisle to guess while typing. */}
      <div className="max-w-3xl">
        <AddItemForm onAdd={onAdd} busy={busy} />
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col gap-1 py-8 text-center" data-testid="shopping-empty">
          <p className="font-medium">Nothing on the list.</p>
          <Muted as="p">Type a line above, or add a recipe's ingredients from its page.</Muted>
        </div>
      ) : (
        <div
          className={cn(
            "grid items-start gap-6",
            trolleyColumn
              ? meals.length > 0
                ? "grid-cols-[minmax(0,1fr)_16rem_18rem]"
                : "grid-cols-[minmax(0,1fr)_16rem]"
              : meals.length > 0
                ? "grid-cols-[minmax(0,1fr)_18rem]"
                : "grid-cols-1"
          )}
          data-testid="shopping-walk"
          data-lit={active ?? undefined}
        >
          <div className="flex min-w-0 flex-col gap-4">
            {!trolleyColumn && ticked.length > 0 && (
              <>
                <Button
                  type="button"
                  variant={trolleyOpen ? "solid" : "outline"}
                  intent="neutral"
                  size="sm"
                  className="self-start"
                  aria-expanded={trolleyOpen}
                  onClick={() => setTrolleyOpen((open) => !open)}
                >
                  {ticked.length} in the trolley
                </Button>
                {trolleyOpen && <div className="max-w-md">{trolley}</div>}
              </>
            )}
            {aisles.length === 0 ? (
              <p className="py-8 text-center font-medium" data-testid="shopping-done">
                Everything is in the trolley.
              </p>
            ) : (
              <div className="columns-[250px] gap-x-6" data-testid="shopping-groups" data-view="aisles">
                {aisles.map((group) => (
                  <section
                    key={group.key}
                    className={cn("mb-6", group.items.length <= WHOLE_AISLE && "break-inside-avoid")}
                    aria-label={group.name}
                    data-testid="shopping-group"
                  >
                    <div className="mb-1 flex break-after-avoid items-baseline justify-between gap-3 px-1.5">
                      <SectionTitle as="h2">{group.name}</SectionTitle>
                      <Muted as="span">{group.items.length}</Muted>
                    </div>
                    {/* Block, not flex, so a long aisle can run on into the next column. */}
                    <ul>{group.items.map((item) => row(item, false))}</ul>
                  </section>
                ))}
              </div>
            )}
          </div>
          {trolleyColumn && trolley}
          {meals.length > 0 && (
            <MealsKey
              meals={meals}
              pinned={pinned}
              onHover={setHovered}
              onPin={(key) => {
                setPinned((current) => (current === key ? null : key));
                setHovered(null);
              }}
            />
          )}
        </div>
      )}
      {confirming && (
        <ClearTickedDialog
          count={ticked.length}
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            onClearTicked();
          }}
        />
      )}
    </Page>
  );
}

/**
 * The meals the list is for, each with its photo, its day and how many of its
 * lines are still to buy. Pointing at one (or tabbing to it) lights its lines;
 * pressing it keeps them lit until it is pressed again.
 */
function MealsKey({
  meals,
  pinned,
  onHover,
  onPin,
}: {
  meals: readonly ShoppingListMeal[];
  pinned: string | null;
  onHover: (key: string | null) => void;
  onPin: (key: string) => void;
}) {
  return (
    <aside aria-label="Meals" className="sticky top-[calc(var(--top-bar)+1.5rem)] flex flex-col gap-1" data-testid="shopping-meals-key">
      <SectionTitle as="h2" className="px-2 pb-1">
        Meals
      </SectionTitle>
      <ul className="flex flex-col gap-1" onMouseLeave={() => onHover(null)}>
        {meals.map((meal) => {
          const day = meal.date === null ? null : dayParts(meal.date).weekday;
          const image = recipeImageUrl(meal.image);
          const on = pinned === meal.key;
          return (
            <li key={meal.key}>
              <button
                type="button"
                aria-pressed={on}
                aria-label={`${meal.name}${day === null ? "" : `, ${day}`}: ${meal.left} to buy`}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border p-1.5 text-left transition-colors hover:border-border-brand hover:bg-bg-normal",
                  on ? "border-border-brand bg-bg-normal" : "border-transparent"
                )}
                onMouseEnter={() => onHover(meal.key)}
                onFocus={() => onHover(meal.key)}
                onBlur={() => onHover(null)}
                onClick={() => onPin(meal.key)}
              >
                {image === null ? (
                  <span aria-hidden="true" className="size-10 shrink-0 rounded-md border border-border-subtle bg-bg-normal" />
                ) : (
                  <img src={image} alt="" loading="lazy" className="size-10 shrink-0 rounded-md object-cover" />
                )}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium leading-snug">{meal.name}</span>
                  {day !== null && <span className="text-fg-subtle text-sm">{day}</span>}
                </span>
                <span className="shrink-0 text-fg-subtle text-sm tabular-nums">{meal.left === 0 ? "✓" : meal.left}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <Muted as="p" className="px-2 pt-2 text-sm">
        Point at a meal to light up its lines; click to keep them lit.
      </Muted>
    </aside>
  );
}

/**
 * A tick that moves: the line slides out of its aisle (`leaving`), then the
 * tick is sent, and the line drops in to the trolley (`arrived`) once the
 * list comes back with it ticked. An untick goes straight back. Reduced
 * motion skips the slide.
 */
function useTrolleyMove(items: readonly ShoppingItem[], busy: boolean, onTick: (id: string, ticked: boolean) => void) {
  const [leaving, setLeaving] = useState<ReadonlySet<string>>(() => new Set());
  const [arrived, setArrived] = useState<ReadonlySet<string>>(() => new Set());
  // Sent and not yet seen ticked: once nothing is in flight, the list as it stands is the answer.
  const sent = useRef(new Set<string>());
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const ticks = new Map(items.map((item) => [item.id, item.ticked]));
    // Settled: ticked (or gone), or sent and nothing in flight any more.
    const settled = (id: string) => ticks.get(id) !== false || (!busy && sent.current.has(id));
    const done = new Set([...sent.current].filter(settled));
    setLeaving((current) => {
      const next = new Set([...current].filter((id) => ticks.get(id) === false && !done.has(id)));
      return next.size === current.size ? current : next;
    });
    for (const id of done) sent.current.delete(id);
  }, [items, busy]);

  useEffect(() => {
    const pendingTimers = timers.current;
    return () => {
      for (const timer of pendingTimers) clearTimeout(timer);
    };
  }, []);

  const tick = (id: string, ticked: boolean) => {
    if (!ticked || prefersReducedMotion()) {
      if (ticked) setArrived((current) => new Set(current).add(id));
      onTick(id, ticked);
      return;
    }
    setLeaving((current) => new Set(current).add(id));
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      sent.current.add(id);
      setArrived((current) => new Set(current).add(id));
      onTick(id, true);
    }, LEAVE_MS);
    timers.current.add(timer);
  };

  return { leaving, arrived, tick };
}
