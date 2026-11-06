import { Button } from "@sixthshift/design-system/button";
import { Muted } from "@sixthshift/design-system/muted";
import { Toggle } from "@sixthshift/design-system/toggle";
import { useState } from "react";
import { DataTable } from "../../../../../components/ui/DataTable";
import type { RecipeSummary } from "../../../../../domain/recipes/recipe";
import type { Aisle, FoodPack, FoodRow, Unit } from "../../../../../domain/recipes/reference";
import type { DataTableColumn } from "../../../../../lib/ui/dataTable";
import { NEW_FOOD, useFoodActions } from "../food/useFoodActions";

export function FoodsTab({
  foods,
  usage,
  packs = [],
  aisles,
  units,
  recipes,
}: {
  foods: readonly FoodRow[];
  /** Recipes per food id; a food no recipe uses is absent. */
  usage: Readonly<Record<string, number>>;
  /** Every food's sizes; the sheet edits the open food's. */
  packs?: readonly FoodPack[];
  aisles: readonly Aisle[];
  units: readonly Unit[];
  recipes: readonly RecipeSummary[];
}) {
  const actions = useFoodActions({ foods, packs, aisles, units, recipes });
  const [onHandOnly, setOnHandOnly] = useState(false);

  return (
    <>
      <DataTable
        items={onHandOnly ? foods.filter((food) => food.skipShopping) : foods}
        columns={foodColumns(aisles, usage)}
        keyOf={(food) => food.id}
        itemName="food"
        onOpen={actions.edit}
        rowActions={[
          { label: "Merge", onSelect: (food) => actions.merge(food) },
          { label: "Delete", intent: "danger", onSelect: (food) => actions.askDelete([food]) },
        ]}
        onDelete={(selected) => actions.askDelete(selected)}
        actions={
          <>
            <Toggle type="button" variant="outline" intent="neutral" size="sm" pressed={onHandOnly} onPressedChange={setOnHandOnly}>
              On hand
            </Toggle>
            <Button type="button" variant="outline" intent="neutral" size="sm" onClick={() => actions.edit(NEW_FOOD)}>
              Add food
            </Button>
          </>
        }
      />
      {actions.dialogs}
    </>
  );
}

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
    { key: "aisle", header: "Aisle", value: (food) => aisleName(food.aisleId), className: "desktop:whitespace-nowrap" },
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
