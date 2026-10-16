import { Button } from "@sixthshift/design-system/button";
import { Muted } from "@sixthshift/design-system/muted";
import { toast } from "@sixthshift/design-system/overlay";
import { Toggle } from "@sixthshift/design-system/toggle";
import { useState } from "react";
import { DataTable } from "../../../../components/ui/DataTable";
import { UsageConfirmDialog } from "../../../../components/ui/UsageConfirmDialog";
import type { RecipeSummary } from "../../../../domain/recipe";
import type { Aisle, Unit } from "../../../../domain/reference";
import { useMutate } from "../../../../lib/mutate";
import { toastError } from "../../../../lib/toast";
import type { DataTableColumn } from "../../../../lib/ui/dataTable";
import { findOrCreateAisle } from "../../../../server/fns/aisles";
import { createFood, deleteFood, mergeFood, updateFood, usingFood } from "../../../../server/fns/foods";
import type { FoodRow } from "../../route";
import { FoodEditSheet, type FoodPatch } from "../FoodEditSheet";
import { FoodMergeDialog } from "../FoodMergeDialog";
import { dedupeSummaries, foodsLabel } from "../settingsLabels";

/** A food not saved yet: what Add food opens the sheet on. The empty id is how a save knows to create. */
const NEW_FOOD: FoodRow = { id: "", name: "", pluralName: null, aliases: [], aisleId: null, recipeId: null, skipShopping: false, conversions: [] };

export function FoodsTab({
  foods,
  usage,
  aisles,
  units,
  recipes,
}: {
  foods: readonly FoodRow[];
  /** Recipes per food id; a food no recipe uses is absent. */
  usage: Readonly<Record<string, number>>;
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
  const [onHandOnly, setOnHandOnly] = useState(false);

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
      const { id, ...fields } = patch;
      await mutate(() => (id === "" ? createFood({ data: fields }) : updateFood({ data: patch })));
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
        items={onHandOnly ? foods.filter((food) => food.skipShopping) : foods}
        columns={foodColumns(aisles, usage)}
        keyOf={(food) => food.id}
        itemName="food"
        onOpen={setEditing}
        rowActions={[
          { label: "Merge", onSelect: (food) => setMerging(food) },
          { label: "Delete", intent: "danger", onSelect: (food) => void askDelete([food]) },
        ]}
        onDelete={(selected) => void askDelete(selected)}
        actions={
          <>
            <Toggle type="button" variant="outline" intent="neutral" size="sm" pressed={onHandOnly} onPressedChange={setOnHandOnly}>
              On hand
            </Toggle>
            <Button type="button" variant="outline" intent="neutral" size="sm" onClick={() => setEditing(NEW_FOOD)}>
              Add food
            </Button>
          </>
        }
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
          count={deleting.length}
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
export function foodColumns(aisles: readonly Aisle[], usage: Readonly<Record<string, number>> = {}): DataTableColumn<FoodRow>[] {
  const aisleName = (id: string | null) => aisles.find((aisle) => aisle.id === id)?.name ?? null;
  return [
    {
      key: "name",
      header: "Name",
      value: (food) => food.name,
      // A food answers to every name a recipe line might give it, so "evoo" finds extra virgin olive oil.
      search: (food) => [food.name, food.pluralName ?? "", ...food.aliases].join(" "),
      render: (food) => <FoodName food={food} />,
      wrap: "anywhere",
    },
    { key: "aisle", header: "Aisle", value: (food) => aisleName(food.aisleId), className: "md:whitespace-nowrap" },
    { key: "recipes", header: "Recipes", value: (food) => usage[food.id] ?? 0, searchable: false, className: "w-px text-right" },
  ];
}

/**
 * The name cell: the name, and beneath it "on hand" for a staple and the aliases, so a search's match
 * shows. One small line rather than a badge beside the name, which a phone's narrow column wraps.
 */
function FoodName({ food }: { food: FoodRow }) {
  const aliases = food.aliases.join(", ");
  return (
    <span className="flex flex-col gap-0.5">
      {food.name}
      {(food.skipShopping || aliases !== "") && (
        <Muted as="span" className="line-clamp-1 text-xs">
          {food.skipShopping && <span className="font-medium text-fg-brand">on hand</span>}
          {food.skipShopping && aliases !== "" && " · "}
          {aliases}
        </Muted>
      )}
    </span>
  );
}
