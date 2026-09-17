import { type TabItem, Tabs } from "@sixthshift/design-system/tabs";
import type { RecipeSummary } from "../../../../domain/recipe";
import type { Aisle, Tag, Unit } from "../../../../domain/reference";
import type { FoodRow } from "../../route";
import { AislesTab } from "./AislesTab";
import { FoodsTab } from "./FoodsTab";
import { TagsTab } from "./TagsTab";
import { UnitsTab } from "./UnitsTab";

export function LibraryTab({
  foods,
  units,
  aisles,
  tags,
  recipes,
}: {
  foods: readonly FoodRow[];
  units: readonly Unit[];
  aisles: readonly Aisle[];
  tags: readonly Tag[];
  recipes: readonly RecipeSummary[];
}) {
  const items: TabItem[] = [
    { value: "foods", label: "Foods", content: <FoodsTab foods={foods} aisles={aisles} units={units} recipes={recipes} /> },
    { value: "units", label: "Units", content: <UnitsTab units={units} /> },
    { value: "aisles", label: "Aisles", content: <AislesTab aisles={aisles} /> },
    { value: "tags", label: "Tags", content: <TagsTab tags={tags} /> },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Tabs items={items} defaultValue="foods">
        <Tabs.List />
        <Tabs.Panels />
      </Tabs>
    </div>
  );
}
