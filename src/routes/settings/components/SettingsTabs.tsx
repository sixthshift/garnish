import { Button } from "@sixthshift/design-system/button";
import { Input } from "@sixthshift/design-system/input";
import { Muted } from "@sixthshift/design-system/muted";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import { Switch } from "@sixthshift/design-system/switch";
import { TagChip } from "@sixthshift/design-system/tag-chip";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { DataTable } from "../../../components/ui/DataTable";
import { EditSheet } from "../../../components/ui/EditSheet";
import { ReorderList } from "../../../components/ui/ReorderList";
import { UsageConfirmDialog } from "../../../components/ui/UsageConfirmDialog";
import type { RecipeSummary } from "../../../domain/recipe";
import type { Aisle, Tag, Unit } from "../../../domain/reference";
import { type StyleRule, styleRuleNote } from "../../../domain/style";
import { useMutate } from "../../../lib/mutate";
import { notify, notifyError } from "../../../lib/notify";
import type { DataTableColumn } from "../../../lib/ui/dataTable";
import type { SavedValues } from "../../../lib/ui/editSheet";
import { deleteAisle, findOrCreateAisle, reorderAisles, updateAisle } from "../../../server/fns/aisles";
import { deleteFood, mergeFood, updateFood, usingFood } from "../../../server/fns/foods";
import { createStyleRule, deleteStyleRule, reorderStyleRules, updateStyleRule } from "../../../server/fns/style";
import { deleteTag, mergeTag, updateTag, usingTag } from "../../../server/fns/tags";
import { deleteUnit, mergeUnit, updateUnit, usingUnit } from "../../../server/fns/units";
import type { FoodRow } from "../route";
import { FoodEditSheet, type FoodPatch } from "./FoodEditSheet";
import { FoodMergeDialog } from "./FoodMergeDialog";
import { TagMergeDialog } from "./TagMergeDialog";
import { ThemeToggle } from "./ThemeToggle";
import { UnitEditSheet, type UnitPatch } from "./UnitEditSheet";
import { UnitMergeDialog } from "./UnitMergeDialog";

export function Appearance() {
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

/**
 * What the AI rung needs to exist (M34.5, M36.1, decisions.md rows 74 and 75).
 * The paste option on the new-recipe screen appears only when the server has a
 * model configured, which is one environment variable — so the one place that
 * can explain a missing option says so here, beside the other import and
 * export plumbing, along with the one thing worth knowing about the free tier.
 */
export function AiImportNote() {
  return (
    <div className="flex flex-col gap-2" data-testid="ai-import-note">
      <SectionTitle as="h3">Importing with a model</SectionTitle>
      <Muted as="p" className="text-sm">
        A new recipe can be read out of pasted text by a hosted model, over one OpenAI-compatible request from the server. The option only appears when{" "}
        <code>AI_API_KEY</code> is set there; <code>AI_BASE_URL</code> and <code>AI_MODEL</code> pick a provider and a model, and default to Google's Gemini
        free tier. Without a key, the other import paths still work and this one stays hidden.
      </Muted>
      <Muted as="p" className="text-sm">
        The Gemini free tier may train on what is sent to it. What is sent is the text you pasted, which for a public recipe page costs nothing; set the other
        two variables to use a paid provider or a model on the LAN instead.
      </Muted>
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
 * The Style tab (M37.2, decisions.md row 78): the house style guide, which is
 * the list of statements the restyle pass reads out to the model. Each row is
 * the statement itself — editable in place, because a household's voice is the
 * wording and a modal to change one word would be in the way — a switch for
 * whether it is on by default, and the reorder list's own move and remove
 * controls, since the order is the order the statements are numbered in.
 *
 * The switch writes straight through on toggle: there is nothing else on the
 * row to save with it, and a Save button for one boolean would be a step with
 * no decision in it. The text saves on blur or Enter, and an empty box is
 * treated as "no change" rather than an error, so a cleared field is undone by
 * clicking away.
 *
 * One statement carries a caveat (`styleRuleNote`), printed under it; a row the
 * household has reworded has none, which is correct — the note is about the
 * seeded sentence.
 */
export function StyleTab({ rules }: { rules: readonly StyleRule[] }) {
  const mutate = useMutate();
  const [order, setOrder] = useState<StyleRule[]>(() => rules.slice());
  useEffect(() => setOrder(rules.slice()), [rules]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const persistOrder = async (next: StyleRule[]) => {
    const previous = order;
    setOrder(next);
    try {
      await mutate(() => reorderStyleRules({ data: { ids: next.map((rule) => rule.id) } }));
    } catch (error) {
      setOrder(previous);
      notifyError("Could not reorder the style guide", error);
    }
  };

  const toggle = async (rule: StyleRule, enabled: boolean) => {
    try {
      await mutate(() => updateStyleRule({ data: { id: rule.id, enabled } }));
    } catch (error) {
      notifyError("Could not change the statement", error);
    }
  };

  const saveText = async (rule: StyleRule, text: string) => {
    const next = text.trim();
    if (next === "" || next === rule.text) return;
    try {
      await mutate(() => updateStyleRule({ data: { id: rule.id, text: next } }));
      notify({ intent: "success", title: "Statement saved" });
    } catch (error) {
      notifyError("Could not save the statement", error);
    }
  };

  const remove = async (rule: StyleRule) => {
    try {
      await mutate(() => deleteStyleRule({ data: { id: rule.id } }));
      notify({ intent: "success", title: "Statement deleted" });
    } catch (error) {
      notifyError("Could not delete the statement", error);
    }
  };

  const add = async () => {
    const text = draft.trim();
    if (text === "") return;
    setBusy(true);
    try {
      await mutate(() => createStyleRule({ data: { text } }));
      setDraft("");
    } catch (error) {
      notifyError("Could not add the statement", error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="flex flex-col gap-4" aria-label="House style" data-style-list>
      <SectionTitle as="h2">House style</SectionTitle>
      <Muted as="p" className="text-sm">
        Statements read to the model when a recipe's steps are restyled, in this order. The switch is the default for a run; every statement can still be ticked
        on or off for one recipe. Temperatures, times and quantities are never changed, whatever the guide says.
      </Muted>
      {order.length === 0 ? (
        <Muted as="p">No statements yet.</Muted>
      ) : (
        <ReorderList
          items={order}
          keyOf={(rule) => rule.id}
          itemName="statement"
          onReorder={(next) => void persistOrder(next)}
          onRemove={(rule) => void remove(rule)}
          renderItem={(rule) => {
            const note = styleRuleNote(rule.text);
            return (
              <div className="flex flex-col gap-1 rounded-md border border-border-normal px-3 py-2">
                <div className="flex items-center gap-3">
                  <Switch checked={rule.enabled} aria-label={`Use "${rule.text}" by default`} onCheckedChange={(enabled) => void toggle(rule, enabled)} />
                  <Input
                    defaultValue={rule.text}
                    aria-label={`Statement: ${rule.text}`}
                    className="min-w-0 flex-1"
                    onBlur={(event) => void saveText(rule, event.currentTarget.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") event.currentTarget.blur();
                    }}
                  />
                </div>
                {note !== null && (
                  <Muted as="p" className="text-sm">
                    {note}
                  </Muted>
                )}
              </div>
            );
          }}
        />
      )}
      <div className="flex items-center gap-2">
        <Input
          value={draft}
          aria-label="New statement"
          placeholder="Add a statement"
          className="min-w-0 flex-1"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void add();
          }}
        />
        <Button type="button" variant="outline" intent="neutral" disabled={busy || draft.trim() === ""} onClick={() => void add()}>
          Add
        </Button>
      </div>
    </section>
  );
}

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

/** Effect line for the Tags delete confirm: tags only ever link a recipe, nothing else references them. */
const TAG_DELETE_EFFECT = "they will lose this tag.";

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

export function UnitsTab({ units }: { units: readonly Unit[] }) {
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
      {editing && <UnitEditSheet open unit={editing} busy={busy} onCancel={() => !busy && setEditing(null)} onSave={(patch) => void saveEdit(patch)} />}
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

/** Effect line for the Units delete confirm: units are referenced by an ingredient row or a recipe's yield. */
const UNIT_DELETE_EFFECT = "they will keep the ingredient or yield without a unit.";

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

export function FoodsTab({
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

/** Effect line for the Foods delete confirm, Mealie's own wording for the food side of the FK. */
const FOOD_DELETE_EFFECT = "they will keep the ingredient without a food.";

export const unitColumns: DataTableColumn<Unit>[] = [
  { key: "name", header: "Name", value: (unit) => unit.name },
  { key: "pluralName", header: "Plural", value: (unit) => unit.pluralName },
  { key: "abbreviation", header: "Abbreviation", value: (unit) => unit.abbreviation },
  { key: "useAbbreviation", header: "Use abbreviation", value: (unit) => unit.useAbbreviation },
  { key: "fraction", header: "Fractions", value: (unit) => unit.fraction },
];

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

/** One letter's tags for the Tags tab's A–Z grouped list. */
export type TagGroup = { letter: string; tags: Tag[] };

/** The name shown for a delete or merge confirm: the row's name, or a count for several. Pure. */
export function unitsLabel(units: readonly Unit[]): string {
  return units.length === 1 ? units[0]!.name : `${units.length} units`;
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
