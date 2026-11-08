import { toast } from "@sixthshift/design-system/overlay";
import { useState } from "react";
import { findOrCreateAisle } from "../../../../../api/rpc/aisles";
import { deleteFood, mergeFood, usingFood } from "../../../../../api/rpc/foods";
import { UsageConfirmDialog } from "../../../../../components/ui/UsageConfirmDialog";
import type { RecipeSummary } from "../../../../../domain/recipes/recipe";
import type { Aisle, FoodPack, FoodRow, Unit } from "../../../../../domain/recipes/reference";
import { useMutate } from "../../../../../lib/mutate";
import { toastError } from "../../../../../lib/toast";
import { MergeDialog } from "../MergeDialog";
import { dedupeSummaries, foodsLabel } from "../settingsLabels";
import { FoodEditSheet, type FoodPatch } from "./FoodEditSheet";
import { saveFood } from "./saveFood";

/** A food not saved yet: what Add food opens the sheet on. The empty id is how a save knows to create. */
export const NEW_FOOD: FoodRow = { id: "", name: "", pluralName: null, aliases: [], aisleId: null, recipeId: null, skipShopping: false, conversions: [] };

/** Effect line for the Foods delete confirm, Mealie's own wording for the food side of the FK. */
const FOOD_DELETE_EFFECT = "they will keep the ingredient without a food.";

export type FoodActionsProps = {
  foods: readonly FoodRow[];
  packs?: readonly FoodPack[];
  aisles: readonly Aisle[];
  units: readonly Unit[];
  recipes: readonly RecipeSummary[];
  /** After a delete lands, with the ids that went: the desktop grid drops them from its selection and its pane. */
  onDeleted?: (ids: string[]) => void;
};

/**
 * What a food can have done to it, wherever the list of foods is drawn (a
 * phone's table, a desktop's grid): the edit sheet, the delete confirm that
 * names the recipes it touches, and the merge. One place, so the two lists
 * cannot drift on what Delete warns about or what Merge asks.
 */
export function useFoodActions({ foods, packs = [], aisles, units, recipes, onDeleted }: FoodActionsProps) {
  const mutate = useMutate();
  const [editing, setEditing] = useState<FoodRow | null>(null);
  const [deleting, setDeleting] = useState<FoodRow[] | null>(null);
  const [deleteUsage, setDeleteUsage] = useState<RecipeSummary[]>([]);
  const [merging, setMerging] = useState<FoodRow | null>(null);
  const [busy, setBusy] = useState(false);

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
      onDeleted?.(deleting.map((food) => food.id));
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
      await mutate(() => saveFood(patch));
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
      onDeleted?.([merging.id]);
      setMerging(null);
    } catch (error) {
      toastError("Could not merge food", error);
    } finally {
      setBusy(false);
    }
  };

  const dialogs = (
    <>
      {editing && (
        <FoodEditSheet
          open
          food={editing}
          packs={packs.filter((pack) => pack.foodId === editing.id)}
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
          count={deleting.length}
          effect={FOOD_DELETE_EFFECT}
          recipes={deleteUsage}
          busy={busy}
          onCancel={() => !busy && setDeleting(null)}
          onConfirm={() => void confirmDelete()}
        />
      )}
      {merging && (
        <MergeDialog
          noun="food"
          source={merging}
          targets={foods.filter((food) => food.id !== merging.id)}
          busy={busy}
          onCancel={() => !busy && setMerging(null)}
          onConfirm={(targetId) => void confirmMerge(targetId)}
        />
      )}
    </>
  );

  return { edit: setEditing, askDelete: (items: FoodRow[]) => void askDelete(items), merge: setMerging, dialogs };
}
