import { Button } from "@sixthshift/design-system/button";
import { Card } from "@sixthshift/design-system/card";
import { Muted } from "@sixthshift/design-system/muted";
import { useEffect, useState } from "react";
import { ConfirmDialog } from "../../../../components/ui/ConfirmDialog";
import { EditSheet } from "../../../../components/ui/EditSheet";
import { ReorderList } from "../../../../components/ui/ReorderList";
import type { Aisle } from "../../../../domain/reference";
import { useMutate } from "../../../../lib/mutate";
import { notify, notifyError } from "../../../../lib/notify";
import type { SavedValues } from "../../../../lib/ui/editSheet";
import { deleteAisle, reorderAisles, updateAisle } from "../../../../server/fns/aisles";
import { NAME_FIELDS } from "../columns";

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
        <Card size="sm">
          <ReorderList
            items={order}
            keyOf={(aisle) => aisle.id}
            itemName="aisle"
            onReorder={(next) => void persistOrder(next)}
            renderItem={(aisle) => (
              <div className="flex items-center justify-between gap-2 rounded-md px-3 py-2 hover:bg-bg-subtle">
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
        </Card>
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
