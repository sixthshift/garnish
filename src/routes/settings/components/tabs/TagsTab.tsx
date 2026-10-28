import { toast } from "@sixthshift/design-system/overlay";
import { TagChip } from "@sixthshift/design-system/tag-chip";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { ConfirmDialog } from "../../../../components/ui/ConfirmDialog";
import { DataTable } from "../../../../components/ui/DataTable";
import { EditSheet } from "../../../../components/ui/EditSheet";
import { UsageConfirmDialog } from "../../../../components/ui/UsageConfirmDialog";
import type { RecipeSummary } from "../../../../domain/recipe";
import { type TagUsage, tagKey } from "../../../../domain/reference";
import { useMutate } from "../../../../lib/mutate";
import { toastError } from "../../../../lib/toast";
import type { DataTableColumn } from "../../../../lib/ui/dataTable";
import type { SavedValues } from "../../../../lib/ui/editSheet";
import { deleteTag, mergeTag, updateTag, usingTag } from "../../../../server/fns/tags";
import { NAME_FIELDS } from "../columns";
import { dedupeSummaries } from "../settingsLabels";
import { TagMergeDialog } from "../TagMergeDialog";

/**
 * Settings › Library › Tags (decisions.md row 174): the reference table the
 * other tabs use, so the tags can be searched, sorted by how many recipes
 * carry them, and the ones nobody uses selected and deleted together. A rename
 * onto a name another tag already has offers to merge into it.
 */
export function TagsTab({ tags }: { tags: readonly TagUsage[] }) {
  const mutate = useMutate();
  const [editing, setEditing] = useState<TagUsage | null>(null);
  const [deleting, setDeleting] = useState<TagUsage[] | null>(null);
  const [deleteUsage, setDeleteUsage] = useState<RecipeSummary[]>([]);
  const [merging, setMerging] = useState<TagUsage | null>(null);
  // A rename that landed on another tag's name: the tag being renamed, and the one it would become.
  const [renameInto, setRenameInto] = useState<{ source: TagUsage; target: TagUsage } | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (work: () => Promise<unknown>, done: string, failed: string) => {
    setBusy(true);
    try {
      await mutate(work);
      toast({ intent: "success", title: done });
      return true;
    } catch (error) {
      toastError(failed, error);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const askDelete = async (items: TagUsage[]) => {
    if (items.length === 0) return;
    const lists = await Promise.all(items.map((tag) => usingTag({ data: { id: tag.id } })));
    setDeleteUsage(dedupeSummaries(lists));
    setDeleting(items);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const ok = await run(() => Promise.all(deleting.map((tag) => deleteTag({ data: { id: tag.id } }))), `${tagsLabel(deleting)} deleted`, "Could not delete");
    if (ok) setDeleting(null);
  };

  const saveEdit = async (values: SavedValues) => {
    if (!editing) return;
    const name = values.name as string;
    const clash = renameClash(tags, editing, name);
    if (clash !== null) {
      setEditing(null);
      setRenameInto({ source: editing, target: clash });
      return;
    }
    if (await run(() => updateTag({ data: { id: editing.id, name } }), `${name} saved`, "Could not save tag")) setEditing(null);
  };

  const merge = async (source: TagUsage, targetId: string) => {
    const ok = await run(() => mergeTag({ data: { sourceId: source.id, targetId } }), `${source.name} merged`, "Could not merge tag");
    if (ok) {
      setMerging(null);
      setRenameInto(null);
    }
  };

  return (
    <>
      <DataTable
        items={tags}
        columns={TAG_COLUMNS}
        keyOf={(tag) => tag.id}
        itemName="tag"
        emptyText="No tags yet."
        rowActions={[
          { label: "Rename", onSelect: (tag) => setEditing(tag) },
          { label: "Merge", onSelect: (tag) => setMerging(tag) },
        ]}
        onDelete={(selected) => void askDelete(selected)}
      />
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
      {renameInto && (
        <ConfirmDialog
          title={`Merge ${renameInto.source.name} into ${renameInto.target.name}?`}
          confirmLabel="Merge"
          busy={busy}
          busyLabel="Merging…"
          onCancel={() => !busy && setRenameInto(null)}
          onConfirm={() => void merge(renameInto.source, renameInto.target.id)}
        >
          {`There is already a tag called ${renameInto.target.name}. Merging moves ${recipesLabel(renameInto.source.recipes)} onto it and removes ${renameInto.source.name}.`}
        </ConfirmDialog>
      )}
      {deleting && (
        <UsageConfirmDialog
          name={tagsLabel(deleting)}
          itemName="tag"
          count={deleting.length}
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
          onConfirm={(targetId) => void merge(merging, targetId)}
        />
      )}
    </>
  );
}

/** The table's columns: the tag, linking to its recipes, and how many recipes carry it. */
export const TAG_COLUMNS: DataTableColumn<TagUsage>[] = [
  {
    key: "name",
    header: "Name",
    value: (tag) => tag.name,
    wrap: "anywhere",
    render: (tag) => (
      <Link to="/recipes" search={{ tag: tag.slug }} className="rounded-full focus-visible:outline-2 focus-visible:outline-border-brand">
        <TagChip tag={tag.name} size="md" />
      </Link>
    ),
  },
  { key: "recipes", header: "Recipes", value: (tag) => tag.recipes, searchable: false },
];

/**
 * The other tag a rename of `editing` to `name` would collide with, by the tag
 * key (decisions.md row 170), or null. Renaming a tag to its own name in
 * another case is a rename, not a clash. Pure.
 */
export function renameClash(tags: readonly TagUsage[], editing: TagUsage, name: string): TagUsage | null {
  const key = tagKey(name);
  return tags.find((tag) => tag.id !== editing.id && tagKey(tag.name) === key) ?? null;
}

/** "Weeknight", or "3 tags". Pure. */
function tagsLabel(tags: readonly TagUsage[]): string {
  return tags.length === 1 ? tags[0]!.name : `${tags.length} tags`;
}

/** "its recipe", "its 3 recipes", or "nothing" for a tag no recipe carries. Pure. */
function recipesLabel(count: number): string {
  return count === 0 ? "nothing" : count === 1 ? "its recipe" : `its ${count} recipes`;
}

/** Effect line for the Tags delete confirm: tags only ever link a recipe, nothing else references them. */
const TAG_DELETE_EFFECT = "they will lose this tag.";
