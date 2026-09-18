import { toast } from "@sixthshift/design-system/overlay";
import { useState } from "react";
import { DataTable } from "../../../../components/ui/DataTable";
import { UsageConfirmDialog } from "../../../../components/ui/UsageConfirmDialog";
import type { RecipeSummary } from "../../../../domain/recipe";
import type { Unit } from "../../../../domain/reference";
import { useMutate } from "../../../../lib/mutate";
import { toastError } from "../../../../lib/toast";
import type { DataTableColumn } from "../../../../lib/ui/dataTable";
import { deleteUnit, mergeUnit, updateUnit, usingUnit } from "../../../../server/fns/units";
import { mergeColumn } from "../columns";
import { dedupeSummaries, unitsLabel } from "../settingsLabels";
import { UnitEditSheet, type UnitPatch } from "../UnitEditSheet";
import { UnitMergeDialog } from "../UnitMergeDialog";

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
      toast({ intent: "success", title: `${unitsLabel(deleting)} deleted` });
      setDeleting(null);
    } catch (error) {
      toastError("Could not delete", error);
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async (patch: UnitPatch) => {
    setBusy(true);
    try {
      await mutate(() => updateUnit({ data: patch }));
      toast({ intent: "success", title: `${patch.name} saved` });
      setEditing(null);
    } catch (error) {
      toastError("Could not save unit", error);
    } finally {
      setBusy(false);
    }
  };

  const confirmMerge = async (targetId: string) => {
    if (!merging) return;
    setBusy(true);
    try {
      await mutate(() => mergeUnit({ data: { sourceId: merging.id, targetId } }));
      toast({ intent: "success", title: `${merging.name} merged` });
      setMerging(null);
    } catch (error) {
      toastError("Could not merge unit", error);
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

export const unitColumns: DataTableColumn<Unit>[] = [
  { key: "name", header: "Name", value: (unit) => unit.name },
  { key: "pluralName", header: "Plural", value: (unit) => unit.pluralName, secondary: true },
  { key: "abbreviation", header: "Abbreviation", value: (unit) => unit.abbreviation },
  { key: "useAbbreviation", header: "Use abbreviation", value: (unit) => unit.useAbbreviation, secondary: true },
  { key: "fraction", header: "Fractions", value: (unit) => unit.fraction, secondary: true },
];
