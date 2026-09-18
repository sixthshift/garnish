import { toast } from "@sixthshift/design-system/overlay";
import { useState } from "react";
import { DataTable } from "../../../../components/ui/DataTable";
import { UsageConfirmDialog } from "../../../../components/ui/UsageConfirmDialog";
import type { RecipeSummary } from "../../../../domain/recipe";
import type { Aisle, Unit } from "../../../../domain/reference";
import { useMutate } from "../../../../lib/mutate";
import { toastError } from "../../../../lib/toast";
import type { DataTableColumn } from "../../../../lib/ui/dataTable";
import { findOrCreateAisle } from "../../../../server/fns/aisles";
import { deleteFood, mergeFood, updateFood, usingFood } from "../../../../server/fns/foods";
import type { FoodRow } from "../../route";
import { mergeColumn } from "../columns";
import { FoodEditSheet, type FoodPatch } from "../FoodEditSheet";
import { FoodMergeDialog } from "../FoodMergeDialog";
import { dedupeSummaries, foodsLabel } from "../settingsLabels";

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
      toast({ intent: "success", title: `${foodsLabel(deleting)} deleted` });
      setDeleting(null);
    } catch (error) {
      toastError("Could not delete", error);
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async (patch: FoodPatch) => {
    setBusy(true);
    try {
      await mutate(() => updateFood({ data: patch }));
      toast({ intent: "success", title: `${patch.name} saved` });
      setEditing(null);
    } catch (error) {
      toastError("Could not save food", error);
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
      toast({ intent: "success", title: `${merging.name} merged` });
      setMerging(null);
    } catch (error) {
      toastError("Could not merge food", error);
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

/**
 * Columns per reference kind. Exported so the tab tasks and the tests share
 * one definition. Foods take the aisle list because a food row carries only
 * the aisle's id.
 */
export function foodColumns(aisles: readonly Aisle[]): DataTableColumn<FoodRow>[] {
  const aisleName = (id: string | null) => aisles.find((aisle) => aisle.id === id)?.name ?? null;
  return [
    { key: "name", header: "Name", value: (food) => food.name },
    { key: "pluralName", header: "Plural", value: (food) => food.pluralName, secondary: true },
    { key: "aisle", header: "Aisle", value: (food) => aisleName(food.aisleId) },
    { key: "skipShopping", header: "Skip shopping", value: (food) => food.skipShopping, secondary: true },
    { key: "aliases", header: "Aliases", value: (food) => food.aliases.length, secondary: true },
  ];
}
