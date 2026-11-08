import { Badge } from "@sixthshift/design-system/badge";
import { Button } from "@sixthshift/design-system/button";
import { Card } from "@sixthshift/design-system/card";
import { Checkbox } from "@sixthshift/design-system/checkbox";
import { Input } from "@sixthshift/design-system/input";
import { Muted } from "@sixthshift/design-system/muted";
import { SearchInput } from "@sixthshift/design-system/search-input";
import { Select } from "@sixthshift/design-system/select";
import { Toggle } from "@sixthshift/design-system/toggle";
import { cn } from "@sixthshift/design-system/utils";
import { type KeyboardEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { updateFood } from "../../../../../api/rpc/foods";
import { Menu } from "../../../../../components/ui/Menu";
import { useWindowTableRows } from "../../../../../components/ui/useWindowTableRows";
import type { RecipeSummary } from "../../../../../domain/recipes/recipe";
import type { Aisle, FoodPack, FoodRow, Unit } from "../../../../../domain/recipes/reference";
import { useMutate } from "../../../../../lib/mutate";
import { toastError } from "../../../../../lib/toast";
import { type DataTableColumn, filterItems, headerChecked, nextSort, type SortState, sortItems, toggleAll, toggleKey } from "../../../../../lib/ui/dataTable";
import { NEW_FOOD, useFoodActions } from "../food/useFoodActions";
import { aisleOptions, FoodDetails, NO_AISLE } from "./FoodDetails";
import { conversionsText, FIELD_LABEL, type GridField, packsText, parseAliasList } from "./foodGrid";

/** The fields a cell or the pane saves on their own. */
type FoodFieldPatch = Partial<Pick<FoodRow, "name" | "aliases" | "aisleId" | "skipShopping">>;

/** How long a row's click waits to see whether it is the first of a double-click. */
const DOUBLE_CLICK_MS = 250;

/** The cell being edited: which food, which field. */
type Editing = { id: string; field: GridField } | null;

/**
 * A desktop's Settings › Foods (decisions.md row 207): the foods as a
 * spreadsheet the width of the page. A cell's double-click or Enter edits the
 * name, the aliases or the aisle in place and saves on Enter or leaving it (Esc
 * puts it back); ticked rows get a bar of what can be done to them all; a click
 * on a row opens its details beside the grid. The phone keeps its table and
 * sheet (FoodsTab).
 */
export function FoodsGrid({
  foods,
  usage,
  packs = [],
  aisles,
  units,
  recipes,
}: {
  foods: readonly FoodRow[];
  usage: Readonly<Record<string, number>>;
  packs?: readonly FoodPack[];
  aisles: readonly Aisle[];
  units: readonly Unit[];
  recipes: readonly RecipeSummary[];
}) {
  const mutate = useMutate();
  const [query, setQuery] = useState("");
  const [onHandOnly, setOnHandOnly] = useState(false);
  const [sort, setSort] = useState<SortState>({ key: "name", dir: "asc" });
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  // What a save has written but the loader has not brought back yet, so a cell shows its new value at once.
  const [pending, setPending] = useState<Record<string, FoodFieldPatch>>({});
  // The cell to give focus back to once its field closes, so the keyboard stays where it was.
  const [refocus, setRefocus] = useState<string | null>(null);
  const openTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(openTimer.current), []);

  const actions = useFoodActions({
    foods,
    packs,
    aisles,
    units,
    recipes,
    onDeleted: (ids) => {
      setSelected((keys) => keys.filter((key) => !ids.includes(key)));
      setOpenId((id) => (id !== null && ids.includes(id) ? null : id));
    },
  });

  const shown = useMemo(() => foods.map((food) => (pending[food.id] ? { ...food, ...pending[food.id] } : food)), [foods, pending]);
  const columns = useMemo(() => gridColumns(aisles, usage), [aisles, usage]);
  const visible = useMemo(
    () => sortItems(filterItems(onHandOnly ? shown.filter((food) => food.skipShopping) : shown, columns, query), columns, sort),
    [shown, onHandOnly, columns, query, sort]
  );
  const visibleKeys = visible.map((food) => food.id);
  const selectedFoods = shown.filter((food) => selected.includes(food.id));
  const open = openId === null ? null : (shown.find((food) => food.id === openId) ?? null);

  const save = async (food: FoodRow, patch: FoodFieldPatch) => {
    setPending((all) => ({ ...all, [food.id]: { ...all[food.id], ...patch } }));
    try {
      await mutate(() => updateFood({ data: { id: food.id, ...patch } }));
    } catch (error) {
      toastError(`Could not save ${food.name}`, error);
    } finally {
      setPending((all) => {
        const { [food.id]: _, ...rest } = all;
        return rest;
      });
    }
  };

  const setAisleOf = async (items: FoodRow[], aisleId: string | null) => {
    try {
      await mutate(() => Promise.all(items.map((food) => updateFood({ data: { id: food.id, aisleId } }))));
    } catch (error) {
      toastError("Could not set the aisle", error);
    }
  };

  const finish = (food: FoodRow, field: GridField) => {
    setEditing(null);
    setRefocus(cellId(food.id, field));
  };

  const commit = (food: FoodRow, field: GridField, text: string) => {
    finish(food, field);
    if (field === "name") {
      const name = text.trim();
      if (name === "") toastError("Could not save", new Error("A food needs a name."));
      else if (name !== food.name) void save(food, { name });
    } else if (field === "aliases") {
      const aliases = parseAliasList(text);
      if (aliases.join("\n") !== food.aliases.join("\n")) void save(food, { aliases });
    }
  };

  useEffect(() => {
    if (refocus === null) return;
    document.querySelector<HTMLElement>(`[data-cell="${refocus}"]`)?.focus();
    setRefocus(null);
  }, [refocus]);

  // A virtual list over the page's own scroll, as every table's (decisions.md row 176).
  const columnCount = 9;
  const {
    body,
    rows: rowsDrawn,
    measureElement,
    gapAbove,
    gapEnd,
    spacer,
  } = useWindowTableRows({
    count: visible.length,
    keyAt: (index) => visibleKeys[index] ?? index,
    columnCount,
  });

  const header = (key: string, label: string, className?: string) => {
    const sorted = sort?.key === key ? sort.dir : null;
    return (
      <th scope="col" className={cn(HEAD, className)} aria-sort={sorted === null ? "none" : sorted === "asc" ? "ascending" : "descending"}>
        <button type="button" className="inline-flex cursor-pointer items-center gap-1" onClick={() => setSort(nextSort(sort, key))}>
          {label}
          {sorted !== null && <span aria-hidden="true">{sorted === "asc" ? "↑" : "↓"}</span>}
        </button>
      </th>
    );
  };

  return (
    // From xl the pane has a column of its own, held empty until a food is chosen, so opening one never
    // reflows the grid under the pointer; narrower, it floats over the grid's right edge while open.
    <div className="grid items-start gap-6 desktop:xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex min-w-0 flex-col gap-3" data-table="food">
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput className="w-72" value={query} onValueChange={setQuery} placeholder="Search foods" aria-label="Search foods" clearLabel="Clear search" />
          <Muted as="p" className="flex-1 text-sm" data-table-count>
            {visible.length === foods.length ? `${foods.length} foods` : `${visible.length} of ${foods.length} foods`}
          </Muted>
          <Toggle type="button" variant="outline" intent="neutral" size="sm" pressed={onHandOnly} onPressedChange={setOnHandOnly}>
            On hand
          </Toggle>
          <Button type="button" variant="solid" intent="brand" size="sm" onClick={() => actions.edit(NEW_FOOD)}>
            Add food
          </Button>
        </div>

        <Card size="sm" className="min-w-0 p-0">
          <table className="w-full border-separate border-spacing-0 text-left text-sm" aria-rowcount={visible.length + 1}>
            <caption className="sr-only">foods</caption>
            <thead>
              <tr aria-rowindex={1}>
                <th scope="col" className={cn(HEAD, "w-10 rounded-tl-lg pl-4")}>
                  <Checkbox
                    aria-label={`Select all ${visible.length} foods`}
                    checked={headerChecked(selected, visibleKeys)}
                    onCheckedChange={() => setSelected(toggleAll(selected, visibleKeys))}
                  />
                </th>
                {header("name", "Name")}
                {header("aliases", "Also called")}
                {header("aisle", "Aisle")}
                <th scope="col" className={cn(HEAD, WIDE)}>
                  Plural
                </th>
                <th scope="col" className={cn(HEAD, WIDE)}>
                  Sold in
                </th>
                <th scope="col" className={cn(HEAD, WIDE)}>
                  Converts
                </th>
                {header("recipes", "Recipes", "w-px text-right")}
                <th scope="col" className={cn(HEAD, "w-12 rounded-tr-lg")}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody ref={body}>
              {rowsDrawn.flatMap((row, at) => {
                const food = visible[row.index] as FoodRow;
                const editingHere = editing?.id === food.id ? editing.field : null;
                const cell = (field: GridField, display: ReactNode, text: string) => (
                  <GridCell
                    food={food}
                    field={field}
                    display={display}
                    text={text}
                    editing={editingHere === field}
                    aisles={aisles}
                    onStart={() => setEditing({ id: food.id, field })}
                    onCommit={(value) => commit(food, field, value)}
                    onPick={(aisleId) => {
                      finish(food, field);
                      if (aisleId !== food.aisleId) void save(food, { aisleId });
                    }}
                    onCancel={() => finish(food, field)}
                  />
                );
                const aisle = aisles.find((candidate) => candidate.id === food.aisleId)?.name ?? null;
                const isOpen = food.id === openId;
                const isSelected = selected.includes(food.id);
                return [
                  spacer(gapAbove(at), `gap-${food.id}`),
                  <tr
                    key={food.id}
                    ref={measureElement}
                    data-index={row.index}
                    data-row={food.id}
                    aria-rowindex={row.index + 2}
                    aria-selected={isOpen}
                    className={cn(
                      "group cursor-pointer [&>td]:border-t [&>td]:border-border-subtle",
                      isOpen || isSelected ? "bg-bg-brand-subtle" : "hover:bg-bg-subtle"
                    )}
                    // A click anywhere but the checkbox, a field being typed in and the ⋯ opens the details beside.
                    // A pointer's click waits out a double-click's second one, which edits the cell instead.
                    onClick={(event) => {
                      if ((event.target as Element).closest("[data-no-open]") !== null) return;
                      window.clearTimeout(openTimer.current);
                      if (event.detail > 1) return;
                      if (editing !== null && editing.id !== food.id) setEditing(null);
                      if (event.detail === 0) setOpenId(food.id);
                      else openTimer.current = window.setTimeout(() => setOpenId(food.id), DOUBLE_CLICK_MS);
                    }}
                  >
                    <td className="w-10 py-1.5 pl-4" data-no-open>
                      <Checkbox aria-label={`Select ${food.name}`} checked={isSelected} onCheckedChange={() => setSelected(toggleKey(selected, food.id))} />
                    </td>
                    <td className="min-w-40 py-1 font-medium wrap-anywhere">
                      {cell(
                        "name",
                        <span className="flex items-center gap-2">
                          {food.name}
                          {food.skipShopping && (
                            <Badge variant="soft" intent="brand" size="sm">
                              on hand
                            </Badge>
                          )}
                        </span>,
                        food.name
                      )}
                    </td>
                    <td className="py-1 text-fg-subtle">{cell("aliases", food.aliases.join(", ") || "—", food.aliases.join(", "))}</td>
                    <td className="py-1 whitespace-nowrap">{cell("aisle", aisle ?? <Muted as="span">—</Muted>, aisle ?? "")}</td>
                    <td className={cn("px-2 py-1.5 text-fg-subtle", WIDE)}>{food.pluralName ?? "—"}</td>
                    <td className={cn("px-2 py-1.5 text-fg-subtle", WIDE)}>
                      {packsText(
                        packs.filter((pack) => pack.foodId === food.id),
                        units
                      ) || "—"}
                    </td>
                    <td className={cn("px-2 py-1.5 text-fg-subtle", WIDE)}>{conversionsText(food.conversions, units) || "—"}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{usage[food.id] ?? 0}</td>
                    <td className="py-1 pr-3 text-right" data-no-open>
                      <Menu label={`Actions for ${food.name}`} iconOnly ghost className="inline-block">
                        <Menu.Item onSelect={() => setOpenId(food.id)}>Details</Menu.Item>
                        <Menu.Item onSelect={() => actions.edit(food)}>Edit all fields</Menu.Item>
                        <Menu.Item onSelect={() => actions.merge(food)}>Merge</Menu.Item>
                        {/* Neutral, as the pane's and the bar's Delete: the confirm it opens carries the red (rule 5). */}
                        <Menu.Item onSelect={() => actions.askDelete([food])}>Delete</Menu.Item>
                      </Menu>
                    </td>
                  </tr>,
                ];
              })}
              {spacer(gapEnd, "gap-end")}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={columnCount} className="p-4">
                    <Muted as="span">{foods.length === 0 ? "No foods yet." : `No foods match “${query.trim()}”.`}</Muted>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>

      {open === null ? (
        <Card className="sticky top-[calc(var(--top-bar)+1.5rem)] hidden desktop:xl:block" data-testid="food-details-empty">
          <Muted as="p" className="text-sm">
            Click a food to see what it is also called, its aisle and the recipes that use it.
          </Muted>
        </Card>
      ) : (
        <div className="fixed top-[calc(var(--top-bar)+1.5rem)] right-6 z-content-sticky max-h-[calc(100dvh-var(--top-bar)-3rem)] w-[380px] overflow-y-auto rounded-xl shadow-xl desktop:xl:sticky desktop:xl:right-auto desktop:xl:w-auto desktop:xl:shadow-none">
          <FoodDetails
            food={open}
            aisles={aisles}
            units={units}
            packs={packs.filter((pack) => pack.foodId === open.id)}
            recipes={recipes}
            usage={usage[open.id] ?? 0}
            onPatch={(patch) => void save(open, patch)}
            onClose={() => setOpenId(null)}
            onEdit={() => actions.edit(open)}
            onMerge={() => actions.merge(open)}
            onDelete={() => actions.askDelete([open])}
          />
        </div>
      )}

      {selectedFoods.length > 0 && (
        <BulkBar
          count={selectedFoods.length}
          aisles={aisles}
          onSetAisle={(aisleId) => void setAisleOf(selectedFoods, aisleId)}
          onDelete={() => actions.askDelete(selectedFoods)}
          onClear={() => setSelected([])}
        />
      )}

      {actions.dialogs}
    </div>
  );
}

/** The header cells: quiet, and stuck under the top bar as the page scrolls past them. */
const HEAD = "sticky top-[var(--top-bar)] z-10 border-b border-border-normal bg-bg-subtle px-2 py-2 text-xs font-medium text-fg-subtle whitespace-nowrap";

/** A column only a wide screen has room for. */
const WIDE = "hidden desktop:2xl:table-cell";

function cellId(id: string, field: GridField): string {
  return `${id}:${field}`;
}

/**
 * One editable cell. At rest a button the width of the cell: a click is the
 * row's (it opens the details), a double-click or Enter opens the field. The
 * name and the aliases edit as text, saved on Enter or on leaving the field;
 * the aisle is a Select, saved when one is picked. Esc puts it back.
 */
function GridCell({
  food,
  field,
  display,
  text,
  editing,
  aisles,
  onStart,
  onCommit,
  onPick,
  onCancel,
}: {
  food: FoodRow;
  field: GridField;
  display: ReactNode;
  text: string;
  editing: boolean;
  aisles: readonly Aisle[];
  onStart: () => void;
  onCommit: (text: string) => void;
  onPick: (aisleId: string | null) => void;
  onCancel: () => void;
}) {
  const label = `Edit ${FIELD_LABEL[field]}: ${food.name}`;
  if (editing && field === "aisle") return <AisleField food={food} aisles={aisles} label={label} onPick={onPick} onCancel={onCancel} />;
  if (editing) return <TextField initial={text} label={label} onCommit={onCommit} onCancel={onCancel} />;
  return (
    <button
      type="button"
      className="block w-full cursor-text rounded px-2 py-1 text-left hover:shadow-[inset_0_0_0_1px_var(--border-normal)]"
      aria-label={label}
      data-cell={cellId(food.id, field)}
      onDoubleClick={onStart}
      onKeyDown={(event) => {
        if (event.key !== "Enter") return;
        // Enter edits rather than clicking, which would open the details.
        event.preventDefault();
        onStart();
      }}
    >
      {display}
    </button>
  );
}

function TextField({ initial, label, onCommit, onCancel }: { initial: string; label: string; onCommit: (text: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState(initial);
  // Enter and Esc each end the edit; the blur their unmounting can fire must not end it a second time.
  const done = useRef(false);
  const end = (then: () => void) => {
    if (done.current) return;
    done.current = true;
    then();
  };
  return (
    <div data-no-open>
      <Input
        autoFocus
        aria-label={label}
        value={value}
        className="h-8"
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => end(() => onCommit(value))}
        onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
          if (event.key === "Enter") {
            event.preventDefault();
            end(() => onCommit(value));
          } else if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            end(onCancel);
          }
        }}
      />
    </div>
  );
}

function AisleField({
  food,
  aisles,
  label,
  onPick,
  onCancel,
}: {
  food: FoodRow;
  aisles: readonly Aisle[];
  label: string;
  onPick: (aisleId: string | null) => void;
  onCancel: () => void;
}) {
  const wrapper = useRef<HTMLDivElement>(null);
  useEffect(() => {
    wrapper.current?.querySelector<HTMLElement>("button, [tabindex]")?.focus();
  }, []);
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Esc that the Select did not take (its list closed) puts the cell back.
    <div
      ref={wrapper}
      data-no-open
      onKeyDown={(event) => {
        if (event.key === "Escape" && !event.defaultPrevented) {
          event.preventDefault();
          onCancel();
        }
      }}
    >
      <Select
        aria-label={label}
        options={aisleOptions(aisles)}
        value={food.aisleId ?? NO_AISLE}
        onValueChange={(value) => onPick(value === NO_AISLE ? null : value)}
      />
    </div>
  );
}

/**
 * What can be done to every ticked food at once, floating over the foot of the
 * grid while any is ticked: give them an aisle, delete them, or untick them.
 */
function BulkBar({
  count,
  aisles,
  onSetAisle,
  onDelete,
  onClear,
}: {
  count: number;
  aisles: readonly Aisle[];
  onSetAisle: (aisleId: string | null) => void;
  onDelete: () => void;
  onClear: () => void;
}) {
  // The Select is an action, not a value: once an aisle is given it is drawn afresh, empty again.
  const [round, setRound] = useState(0);
  return (
    <section
      aria-label="Selected foods"
      className="fixed bottom-6 left-1/2 z-content-sticky flex -translate-x-1/2 items-center gap-2 rounded-xl border border-border-normal bg-bg-normal py-2 pr-2 pl-4 shadow-lg"
      data-testid="bulk-bar"
    >
      <span className="text-sm font-semibold whitespace-nowrap">{count} selected</span>
      <Select
        key={round}
        aria-label="Set aisle"
        className="w-44"
        placeholder="Set aisle…"
        options={aisleOptions(aisles)}
        onValueChange={(value) => {
          onSetAisle(value === NO_AISLE ? null : value);
          setRound((n) => n + 1);
        }}
      />
      <Button type="button" variant="outline" intent="neutral" size="sm" onClick={onDelete}>
        {`Delete ${count}`}
      </Button>
      <Button type="button" variant="ghost" intent="neutral" size="sm" onClick={onClear}>
        Clear
      </Button>
    </section>
  );
}

/** What the grid sorts and searches on; the cells draw themselves. */
function gridColumns(aisles: readonly Aisle[], usage: Readonly<Record<string, number>>): DataTableColumn<FoodRow>[] {
  return [
    { key: "name", header: "Name", value: (food) => food.name, search: (food) => [food.name, food.pluralName ?? ""].join(" ") },
    { key: "aliases", header: "Also called", value: (food) => food.aliases.join(", ") },
    { key: "aisle", header: "Aisle", value: (food) => aisles.find((aisle) => aisle.id === food.aisleId)?.name ?? null },
    { key: "recipes", header: "Recipes", value: (food) => usage[food.id] ?? 0, searchable: false },
  ];
}
