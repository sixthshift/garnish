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
import { TagChip } from "@sixthshift/design-system/tag-chip";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FoodEditSheet, type FoodPatch } from "../components/FoodEditSheet";
import { FoodMergeDialog } from "../components/FoodMergeDialog";
import { TagMergeDialog } from "../components/TagMergeDialog";
import { ThemeToggle } from "../components/ThemeToggle";
import { UnitEditSheet, type UnitPatch } from "../components/UnitEditSheet";
import { UnitMergeDialog } from "../components/UnitMergeDialog";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { DataTable, type DataTableColumn } from "../components/ui/DataTable";
import { EditSheet, type SavedValues } from "../components/ui/EditSheet";
import { ReorderList } from "../components/ui/ReorderList";
import { UsageConfirmDialog } from "../components/ui/UsageConfirmDialog";
import type { Aisle, RecipeSummary, Tag, Unit } from "../domain/recipe";
import { useMutate } from "../lib/mutate";
import { notify, notifyError } from "../lib/notify";
import { deleteAisle, findOrCreateAisle, listAisles, reorderAisles, updateAisle } from "../server/aisles";
import { deleteFood, listFoods, mergeFood, updateFood, usingFood } from "../server/foods";
import { listRecipes } from "../server/recipes";
import { deleteTag, listTags, mergeTag, updateTag, usingTag } from "../server/tags";
import { deleteUnit, listUnits, mergeUnit, updateUnit, usingUnit } from "../server/units";

/** The repository's food row: a flat `aisleId`, not the recipe document's nested aisle. */
export type FoodRow = Awaited<ReturnType<typeof listFoods>>[number];

export type SettingsData = { aisles: Aisle[]; units: Unit[]; foods: FoodRow[]; tags: Tag[]; recipes: RecipeSummary[] };

export const Route = createFileRoute("/settings")({
  loader: async (): Promise<SettingsData> => {
    const [aisles, units, foods, tags, recipes] = await Promise.all([
      listAisles({ data: {} }),
      listUnits({ data: {} }),
      listFoods({ data: {} }),
      listTags({ data: {} }),
      // For the food sheet's "Made by a recipe" (M32.3).
      listRecipes({ data: { sort: "name", dir: "asc" } }),
    ]);
    return { aisles, units, foods, tags, recipes };
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

/** One letter's tags for the Tags tab's A–Z grouped list. */
export type TagGroup = { letter: string; tags: Tag[] };

/**
 * Tags grouped by the first letter of their name (upper-cased), each group's
 * tags sorted by name; a name starting with anything but A–Z falls in "#".
 * Groups come back A–Z with "#" last, as Mealie's tag page does. Pure.
 */
export function groupTagsAZ(tags: readonly Tag[]): TagGroup[] {
  const groups = new Map<string, Tag[]>();
  for (const tag of tags) {
    const first = tag.name.trim().charAt(0).toUpperCase();
    const letter = first >= "A" && first <= "Z" ? first : "#";
    const bucket = groups.get(letter);
    if (bucket) bucket.push(tag);
    else groups.set(letter, [tag]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === "#" ? 1 : b === "#" ? -1 : a.localeCompare(b)))
    .map(([letter, group]) => ({ letter, tags: group.slice().sort((a, b) => a.name.localeCompare(b.name, "en-AU", { sensitivity: "base" })) }));
}

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

function FoodsTab({
  foods,
  aisles,
  units,
  recipes,
}: {
  foods: readonly FoodRow[];
  aisles: readonly Aisle[];
  units: readonly Unit[];
  recipes: readonly RecipeSummary[];
}) {
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
          units={units}
          recipes={recipes}
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

/** Field spec shared by the Aisles and Tags tabs' rename sheet: name only. */
const NAME_FIELDS = [{ name: "name", label: "Name", kind: "text", required: true }] as const;

export function AislesTab({ aisles }: { aisles: readonly Aisle[] }) {
  const mutate = useMutate();
  const [order, setOrder] = useState<Aisle[]>(() => aisles.slice());
  useEffect(() => setOrder(aisles.slice()), [aisles]);
  const [editing, setEditing] = useState<Aisle | null>(null);
  const [deleting, setDeleting] = useState<Aisle | null>(null);
  const [busy, setBusy] = useState(false);

  const persistOrder = async (next: Aisle[]) => {
    const previous = order;
    setOrder(next);
    try {
      await mutate(() => reorderAisles({ data: { ids: next.map((aisle) => aisle.id) } }));
    } catch (error) {
      setOrder(previous);
      notifyError("Could not reorder aisles", error);
    }
  };

  const saveEdit = async (values: SavedValues) => {
    if (!editing) return;
    setBusy(true);
    try {
      const name = values.name as string;
      await mutate(() => updateAisle({ data: { id: editing.id, name } }));
      notify({ intent: "success", title: `${name} saved` });
      setEditing(null);
    } catch (error) {
      notifyError("Could not save aisle", error);
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await mutate(() => deleteAisle({ data: { id: deleting.id } }));
      notify({ intent: "success", title: `${deleting.name} deleted` });
      setDeleting(null);
    } catch (error) {
      notifyError("Could not delete", error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4" data-aisle-list>
      {order.length === 0 ? (
        <Muted as="p">No aisles yet.</Muted>
      ) : (
        <ReorderList
          items={order}
          keyOf={(aisle) => aisle.id}
          itemName="aisle"
          onReorder={(next) => void persistOrder(next)}
          renderItem={(aisle) => (
            <div className="flex items-center justify-between gap-2 rounded-md border border-border-normal px-3 py-2">
              <span>{aisle.name}</span>
              <div className="flex shrink-0 gap-1">
                <Button type="button" variant="ghost" intent="neutral" size="sm" onClick={() => setEditing(aisle)}>
                  Rename
                </Button>
                <Button type="button" variant="ghost" intent="danger" size="sm" onClick={() => setDeleting(aisle)}>
                  Delete
                </Button>
              </div>
            </div>
          )}
        />
      )}
      {editing && (
        <EditSheet
          open
          title={`Rename ${editing.name}`}
          fields={NAME_FIELDS}
          item={editing}
          busy={busy}
          onCancel={() => !busy && setEditing(null)}
          onSave={(values) => void saveEdit(values)}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title={`Delete ${deleting.name}?`}
          aria-label={`Delete ${deleting.name}`}
          confirmLabel="Delete"
          busy={busy}
          busyLabel="Deleting…"
          onCancel={() => !busy && setDeleting(null)}
          onConfirm={() => void confirmDelete()}
        >
          Foods in this aisle keep their place on the shopping list with no aisle.
        </ConfirmDialog>
      )}
    </div>
  );
}

/** Effect line for the Tags delete confirm: tags only ever link a recipe, nothing else references them. */
const TAG_DELETE_EFFECT = "they will lose this tag.";

export function TagsTab({ tags }: { tags: readonly Tag[] }) {
  const mutate = useMutate();
  const [editing, setEditing] = useState<Tag | null>(null);
  const [deleting, setDeleting] = useState<Tag | null>(null);
  const [deleteUsage, setDeleteUsage] = useState<RecipeSummary[]>([]);
  const [merging, setMerging] = useState<Tag | null>(null);
  const [busy, setBusy] = useState(false);

  const groups = groupTagsAZ(tags);

  const askDelete = async (tag: Tag) => {
    setDeleteUsage(await usingTag({ data: { id: tag.id } }));
    setDeleting(tag);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await mutate(() => deleteTag({ data: { id: deleting.id } }));
      notify({ intent: "success", title: `${deleting.name} deleted` });
      setDeleting(null);
    } catch (error) {
      notifyError("Could not delete", error);
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async (values: SavedValues) => {
    if (!editing) return;
    setBusy(true);
    try {
      const name = values.name as string;
      await mutate(() => updateTag({ data: { id: editing.id, name } }));
      notify({ intent: "success", title: `${name} saved` });
      setEditing(null);
    } catch (error) {
      notifyError("Could not save tag", error);
    } finally {
      setBusy(false);
    }
  };

  const confirmMerge = async (targetId: string) => {
    if (!merging) return;
    setBusy(true);
    try {
      await mutate(() => mergeTag({ data: { sourceId: merging.id, targetId } }));
      notify({ intent: "success", title: `${merging.name} merged` });
      setMerging(null);
    } catch (error) {
      notifyError("Could not merge tag", error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6" data-tag-list>
      {tags.length === 0 ? (
        <Muted as="p">No tags yet.</Muted>
      ) : (
        groups.map((group) => (
          <section key={group.letter} aria-label={`Tags starting with ${group.letter}`}>
            <SectionTitle as="h2">{group.letter}</SectionTitle>
            <ul className="flex flex-col gap-1 pt-2">
              {group.tags.map((tag) => (
                <li key={tag.id} className="flex items-center justify-between gap-2 py-1">
                  <Link to="/" search={{ tag: tag.slug }} className="rounded-full focus-visible:outline-2 focus-visible:outline-border-brand">
                    <TagChip tag={tag.name} size="md" />
                  </Link>
                  <div className="flex shrink-0 gap-1">
                    <Button type="button" variant="ghost" intent="neutral" size="sm" onClick={() => setEditing(tag)}>
                      Rename
                    </Button>
                    <Button type="button" variant="ghost" intent="neutral" size="sm" onClick={() => setMerging(tag)}>
                      Merge
                    </Button>
                    <Button type="button" variant="ghost" intent="danger" size="sm" onClick={() => void askDelete(tag)}>
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
      {editing && (
        <EditSheet
          open
          title={`Rename ${editing.name}`}
          fields={NAME_FIELDS}
          item={editing}
          busy={busy}
          onCancel={() => !busy && setEditing(null)}
          onSave={(values) => void saveEdit(values)}
        />
      )}
      {deleting && (
        <UsageConfirmDialog
          name={deleting.name}
          itemName="tag"
          effect={TAG_DELETE_EFFECT}
          recipes={deleteUsage}
          busy={busy}
          onCancel={() => !busy && setDeleting(null)}
          onConfirm={() => void confirmDelete()}
        />
      )}
      {merging && (
        <TagMergeDialog
          source={merging}
          targets={tags.filter((tag) => tag.id !== merging.id)}
          busy={busy}
          onCancel={() => !busy && setMerging(null)}
          onConfirm={(targetId) => void confirmMerge(targetId)}
        />
      )}
    </div>
  );
}

function SettingsPage() {
  const { aisles, units, foods, tags, recipes } = Route.useLoaderData();

  const items: TabItem[] = [
    { value: "foods", label: "Foods", badge: foods.length, content: <FoodsTab foods={foods} aisles={aisles} units={units} recipes={recipes} /> },
    { value: "units", label: "Units", badge: units.length, content: <UnitsTab units={units} /> },
    { value: "aisles", label: "Aisles", badge: aisles.length, content: <AislesTab aisles={aisles} /> },
    { value: "tags", label: "Tags", badge: tags.length, content: <TagsTab tags={tags} /> },
    { value: "export", label: "Import and export", content: <ExportTab /> },
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

/**
 * The Export tab (M34.1): one link at the whole database, and the caveat that
 * matters — the file names its images by URL and does not carry their bytes,
 * so it restores text, not photographs. The database is still the master
 * (decisions.md row 72); this is a copy taken for reading elsewhere.
 */
export function ExportTab() {
  return (
    <section className="flex flex-col gap-2" aria-label="Export">
      <SectionTitle as="h2">Export</SectionTitle>
      <Muted as="p" className="text-sm">
        Every recipe as JSON, with the foods, units, aisles and tags they use. Images are referenced by their URLs, not included in the file.
      </Muted>
      <div>
        <Button asChild variant="outline" intent="neutral">
          <a href="/api/export.json" download data-testid="export-download">
            Download JSON
          </a>
        </Button>
      </div>
      <Muted as="p" className="text-sm">
        One recipe on its own is at <code>/api/recipes/&lt;slug&gt;.json</code>.
      </Muted>
      <AiImportNote />
    </section>
  );
}

/**
 * What the AI rung needs to exist (M34.5, decisions.md row 74). The paste
 * option on the new-recipe screen appears only when the `claude` binary is on
 * the server's path, and in the container it will not be until a token is
 * injected (decision 12) — so the one place that can explain a missing option
 * says so here, beside the other import and export plumbing.
 */
export function AiImportNote() {
  return (
    <div className="flex flex-col gap-2" data-testid="ai-import-note">
      <SectionTitle as="h3">Importing with Claude</SectionTitle>
      <Muted as="p" className="text-sm">
        A new recipe can be read out of pasted text by <code>claude -p</code>, which runs on the server on your Claude subscription.
        The option only appears when the <code>claude</code> command is installed there. In the container, run{" "}
        <code>claude setup-token</code> on a machine you are logged in on and give the container that token; without it, the other
        import paths still work and this one stays hidden.
      </Muted>
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
