import { Button } from "@sixthshift/design-system/button";
import { Muted } from "@sixthshift/design-system/muted";
import { toast } from "@sixthshift/design-system/overlay";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import { TagChip } from "@sixthshift/design-system/tag-chip";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { EditSheet } from "../../../../components/ui/EditSheet";
import { UsageConfirmDialog } from "../../../../components/ui/UsageConfirmDialog";
import type { RecipeSummary } from "../../../../domain/recipe";
import type { Tag } from "../../../../domain/reference";
import { useMutate } from "../../../../lib/mutate";
import { toastError } from "../../../../lib/toast";
import type { SavedValues } from "../../../../lib/ui/editSheet";
import { deleteTag, mergeTag, updateTag, usingTag } from "../../../../server/fns/tags";
import { NAME_FIELDS } from "../columns";
import { TagMergeDialog } from "../TagMergeDialog";
import { groupTagsAZ } from "../tagGroups";

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
      toast({ intent: "success", title: `${deleting.name} deleted` });
      setDeleting(null);
    } catch (error) {
      toastError("Could not delete", error);
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
      toast({ intent: "success", title: `${name} saved` });
      setEditing(null);
    } catch (error) {
      toastError("Could not save tag", error);
    } finally {
      setBusy(false);
    }
  };

  const confirmMerge = async (targetId: string) => {
    if (!merging) return;
    setBusy(true);
    try {
      await mutate(() => mergeTag({ data: { sourceId: merging.id, targetId } }));
      toast({ intent: "success", title: `${merging.name} merged` });
      setMerging(null);
    } catch (error) {
      toastError("Could not merge tag", error);
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
