// Settings is the reference data a household edits — foods, units, aisles and
// tags — plus Appearance, the light / dark / system choice. Each of those is a
// tab over the same local DataTable primitive: search, sortable columns, and
// (from M15.2 on) an editor sheet and a delete that lists the recipes it
// touches. Appearance needs no loader and no table.
import { Button } from "@sixthshift/design-system/button";
import { Heading } from "@sixthshift/design-system/heading";
import { Muted } from "@sixthshift/design-system/muted";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import { Tabs, type TabItem } from "@sixthshift/design-system/tabs";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { FoodEditSheet, type FoodPatch } from "../components/FoodEditSheet";
import { FoodMergeDialog } from "../components/FoodMergeDialog";
import { ThemeToggle } from "../components/ThemeToggle";
import { UnitEditSheet, type UnitPatch } from "../components/UnitEditSheet";
import { UnitMergeDialog } from "../components/UnitMergeDialog";
import { DataTable, type DataTableColumn } from "../components/ui/DataTable";
import { UsageConfirmDialog } from "../components/ui/UsageConfirmDialog";
import type { Aisle, RecipeSummary, Tag, Unit } from "../domain/recipe";
import { useMutate } from "../lib/mutate";
import { notify, notifyError } from "../lib/notify";
import { findOrCreateAisle, listAisles } from "../server/aisles";
import { deleteFood, listFoods, mergeFood, updateFood, usingFood } from "../server/foods";
import { listTags } from "../server/tags";
import { deleteUnit, listUnits, mergeUnit, updateUnit, usingUnit } from "../server/units";

/** The repository's food row: a flat `aisleId`, not the recipe document's nested aisle. */
export type FoodRow = Awaited<ReturnType<typeof listFoods>>[number];

export type SettingsData = { aisles: Aisle[]; units: Unit[]; foods: FoodRow[]; tags: Tag[] };

export const Route = createFileRoute("/settings")({
  loader: async (): Promise<SettingsData> => {
    const [aisles, units, foods, tags] = await Promise.all([
      listAisles({ data: {} }),
      listUnits({ data: {} }),
      listFoods({ data: {} }),
      listTags({ data: {} }),
    ]);
    return { aisles, units, foods, tags };
  },
  component: SettingsPage,
});

/**
 * Columns per reference kind. Exported so the tab tasks and the tests share
 * one definition. Foods take the aisle list because a food row carries only
 * the aisle's id.
 */
export function foodColumns(aisles: readonly Aisle[]): DataTableColumn<FoodRow>[] {
  const aisleName = (id: string | null) => aisles.find((aisle) => aisle.id === id)?.name ?? null;
  return [
    { key: "name", header: "Name", value: (food) => food.name },
    { key: "pluralName", header: "Plural", value: (food) => food.pluralName },
    { key: "aisle", header: "Aisle", value: (food) => aisleName(food.aisleId) },
    { key: "skipShopping", header: "Skip shopping", value: (food) => food.skipShopping },
    { key: "aliases", header: "Aliases", value: (food) => food.aliases.length },
  ];
}

/** Every recipe from any of the lists, once, in first-seen order. Pure. */
export function dedupeSummaries(lists: readonly RecipeSummary[][]): RecipeSummary[] {
  const seen = new Map<string, RecipeSummary>();
  for (const list of lists) for (const recipe of list) if (!seen.has(recipe.id)) seen.set(recipe.id, recipe);
  return [...seen.values()];
}

/** The name shown for a delete or merge confirm: the row's name, or a count for several. Pure. */
export function foodsLabel(foods: readonly FoodRow[]): string {
  return foods.length === 1 ? foods[0]!.name : `${foods.length} foods`;
}

/** The name shown for a delete or merge confirm: the row's name, or a count for several. Pure. */
export function unitsLabel(units: readonly Unit[]): string {
  return units.length === 1 ? units[0]!.name : `${units.length} units`;
}

export const unitColumns: DataTableColumn<Unit>[] = [
  { key: "name", header: "Name", value: (unit) => unit.name },
  { key: "pluralName", header: "Plural", value: (unit) => unit.pluralName },
  { key: "abbreviation", header: "Abbreviation", value: (unit) => unit.abbreviation },
  { key: "useAbbreviation", header: "Use abbreviation", value: (unit) => unit.useAbbreviation },
  { key: "fraction", header: "Fractions", value: (unit) => unit.fraction },
];

export const aisleColumns: DataTableColumn<Aisle>[] = [
  { key: "name", header: "Name", value: (aisle) => aisle.name },
  { key: "position", header: "Order", value: (aisle) => aisle.position },
];

export const tagColumns: DataTableColumn<Tag>[] = [
  { key: "name", header: "Name", value: (tag) => tag.name },
  { key: "slug", header: "Slug", value: (tag) => tag.slug },
];

/** A Merge trigger per row, appended to a reference table's columns. Shared by Foods and Units. */
function mergeColumn<T>(onMerge: (item: T) => void): DataTableColumn<T> {
  return {
    key: "mergeAction",
    header: <span className="sr-only">Merge</span>,
    value: () => null,
    sortable: false,
    searchable: false,
    render: (item) => (
      <Button type="button" variant="ghost" intent="neutral" size="sm" onClick={() => onMerge(item)}>
        Merge
      </Button>
    ),
  };
}

/** Effect line for the Foods delete confirm, Mealie's own wording for the food side of the FK. */
const FOOD_DELETE_EFFECT = "they will keep the ingredient without a food.";

function FoodsTab({ foods, aisles }: { foods: readonly FoodRow[]; aisles: readonly Aisle[] }) {
  const mutate = useMutate();
  const [editing, setEditing] = useState<FoodRow | null>(null);
  const [deleting, setDeleting] = useState<FoodRow[] | null>(null);
  const [deleteUsage, setDeleteUsage] = useState<RecipeSummary[]>([]);
  const [merging, setMerging] = useState<FoodRow | null>(null);
  const [busy, setBusy] = useState(false);

  const columns = [...foodColumns(aisles), mergeColumn<FoodRow>((food) => setMerging(food))];

  const askDelete = async (items: FoodRow[]) => {
    if (items.length === 0) return;
    const lists = await Promise.all(items.map((food) => usingFood({ data: { id: food.id } })));
    setDeleteUsage(dedupeSummaries(lists));
    setDeleting(items);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await mutate(() => Promise.all(deleting.map((food) => deleteFood({ data: { id: food.id } }))));
      notify({ intent: "success", title: `${foodsLabel(deleting)} deleted` });
      setDeleting(null);
    } catch (error) {
      notifyError("Could not delete", error);
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async (patch: FoodPatch) => {
    setBusy(true);
    try {
      await mutate(() => updateFood({ data: patch }));
      notify({ intent: "success", title: `${patch.name} saved` });
      setEditing(null);
    } catch (error) {
      notifyError("Could not save food", error);
    } finally {
      setBusy(false);
    }
  };

  const createAisle = (name: string) => mutate(() => findOrCreateAisle({ data: { name } }));

  const confirmMerge = async (targetId: string) => {
    if (!merging) return;
    setBusy(true);
    try {
      await mutate(() => mergeFood({ data: { sourceId: merging.id, targetId } }));
      notify({ intent: "success", title: `${merging.name} merged` });
      setMerging(null);
    } catch (error) {
      notifyError("Could not merge food", error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <DataTable
        items={foods}
        columns={columns}
        keyOf={(food) => food.id}
        itemName="food"
        onEdit={(food) => setEditing(food)}
        onDelete={(selected) => void askDelete(selected)}
      />
      {editing && (
        <FoodEditSheet
          open
          food={editing}
          aisles={aisles}
          busy={busy}
          onCancel={() => !busy && setEditing(null)}
          onSave={(patch) => void saveEdit(patch)}
          onCreateAisle={createAisle}
        />
      )}
      {deleting && (
        <UsageConfirmDialog
          name={foodsLabel(deleting)}
          itemName="food"
          effect={FOOD_DELETE_EFFECT}
          recipes={deleteUsage}
          busy={busy}
          onCancel={() => !busy && setDeleting(null)}
          onConfirm={() => void confirmDelete()}
        />
      )}
      {merging && (
        <FoodMergeDialog
          source={merging}
          targets={foods.filter((food) => food.id !== merging.id)}
          busy={busy}
          onCancel={() => !busy && setMerging(null)}
          onConfirm={(targetId) => void confirmMerge(targetId)}
        />
      )}
    </>
  );
}

/** Effect line for the Units delete confirm: units are referenced by an ingredient row or a recipe's yield. */
const UNIT_DELETE_EFFECT = "they will keep the ingredient or yield without a unit.";

function UnitsTab({ units }: { units: readonly Unit[] }) {
  const mutate = useMutate();
  const [editing, setEditing] = useState<Unit | null>(null);
  const [deleting, setDeleting] = useState<Unit[] | null>(null);
  const [deleteUsage, setDeleteUsage] = useState<RecipeSummary[]>([]);
  const [merging, setMerging] = useState<Unit | null>(null);
  const [busy, setBusy] = useState(false);

  const columns = [...unitColumns, mergeColumn<Unit>((unit) => setMerging(unit))];

  const askDelete = async (items: Unit[]) => {
    if (items.length === 0) return;
    const lists = await Promise.all(items.map((unit) => usingUnit({ data: { id: unit.id } })));
    setDeleteUsage(dedupeSummaries(lists));
    setDeleting(items);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await mutate(() => Promise.all(deleting.map((unit) => deleteUnit({ data: { id: unit.id } }))));
      notify({ intent: "success", title: `${unitsLabel(deleting)} deleted` });
      setDeleting(null);
    } catch (error) {
      notifyError("Could not delete", error);
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async (patch: UnitPatch) => {
    setBusy(true);
    try {
      await mutate(() => updateUnit({ data: patch }));
      notify({ intent: "success", title: `${patch.name} saved` });
      setEditing(null);
    } catch (error) {
      notifyError("Could not save unit", error);
    } finally {
      setBusy(false);
    }
  };

  const confirmMerge = async (targetId: string) => {
    if (!merging) return;
    setBusy(true);
    try {
      await mutate(() => mergeUnit({ data: { sourceId: merging.id, targetId } }));
      notify({ intent: "success", title: `${merging.name} merged` });
      setMerging(null);
    } catch (error) {
      notifyError("Could not merge unit", error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <DataTable
        items={units}
        columns={columns}
        keyOf={(unit) => unit.id}
        itemName="unit"
        onEdit={(unit) => setEditing(unit)}
        onDelete={(selected) => void askDelete(selected)}
      />
      {editing && (
        <UnitEditSheet open unit={editing} busy={busy} onCancel={() => !busy && setEditing(null)} onSave={(patch) => void saveEdit(patch)} />
      )}
      {deleting && (
        <UsageConfirmDialog
          name={unitsLabel(deleting)}
          itemName="unit"
          effect={UNIT_DELETE_EFFECT}
          recipes={deleteUsage}
          busy={busy}
          onCancel={() => !busy && setDeleting(null)}
          onConfirm={() => void confirmDelete()}
        />
      )}
      {merging && (
        <UnitMergeDialog
          source={merging}
          targets={units.filter((unit) => unit.id !== merging.id)}
          busy={busy}
          onCancel={() => !busy && setMerging(null)}
          onConfirm={(targetId) => void confirmMerge(targetId)}
        />
      )}
    </>
  );
}

function SettingsPage() {
  const { aisles, units, foods, tags } = Route.useLoaderData();

  const items: TabItem[] = [
    { value: "foods", label: "Foods", badge: foods.length, content: <FoodsTab foods={foods} aisles={aisles} /> },
    { value: "units", label: "Units", badge: units.length, content: <UnitsTab units={units} /> },
    {
      value: "aisles",
      label: "Aisles",
      badge: aisles.length,
      content: <DataTable items={aisles} columns={aisleColumns} keyOf={(aisle) => aisle.id} itemName="aisle" />,
    },
    { value: "tags", label: "Tags", badge: tags.length, content: <DataTable items={tags} columns={tagColumns} keyOf={(tag) => tag.id} itemName="tag" /> },
    { value: "appearance", label: "Appearance", content: <Appearance /> },
  ];

  return (
    <div className="flex flex-col gap-4 p-6">
      <Heading as="h1">Settings</Heading>
      <Tabs items={items} defaultValue="foods">
        <Tabs.List />
        <Tabs.Panels />
      </Tabs>
    </div>
  );
}

function Appearance() {
  return (
    <section className="flex flex-col gap-2" aria-label="Appearance">
      <SectionTitle as="h2">Theme</SectionTitle>
      <Muted as="p" className="text-sm">
        System follows the device's light or dark setting.
      </Muted>
      <div>
        <ThemeToggle />
      </div>
    </section>
  );
}
