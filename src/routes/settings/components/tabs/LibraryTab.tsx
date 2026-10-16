import { ToggleGroup } from "@sixthshift/design-system/toggle-group";
import { useState } from "react";
import type { RecipeSummary } from "../../../../domain/recipe";
import type { Aisle, TagUsage, Unit } from "../../../../domain/reference";
import type { FoodRow } from "../../route";
import { AislesTab } from "./AislesTab";
import { FoodsTab } from "./FoodsTab";
import { TagsTab } from "./TagsTab";
import { UnitsTab } from "./UnitsTab";

const sections = [
  { value: "foods", label: "Foods" },
  { value: "units", label: "Units" },
  { value: "aisles", label: "Aisles" },
  { value: "tags", label: "Tags" },
] as const;

type Section = (typeof sections)[number]["value"];

function isSection(value: string): value is Section {
  return sections.some((section) => section.value === value);
}

export function LibraryTab({
  foods,
  foodUsage,
  units,
  aisles,
  tags,
  recipes,
}: {
  foods: readonly FoodRow[];
  foodUsage: Readonly<Record<string, number>>;
  units: readonly Unit[];
  aisles: readonly Aisle[];
  tags: readonly TagUsage[];
  recipes: readonly RecipeSummary[];
}) {
  const [section, setSection] = useState<Section>("foods");

  return (
    <div className="flex flex-col gap-4">
      <ToggleGroup
        type="single"
        variant="outline"
        appearance="segmented"
        size="sm"
        aria-label="Library section"
        options={sections}
        value={section}
        onValueChange={(value) => isSection(value) && setSection(value)}
      />
      {section === "foods" && <FoodsTab foods={foods} usage={foodUsage} aisles={aisles} units={units} recipes={recipes} />}
      {section === "units" && <UnitsTab units={units} />}
      {section === "aisles" && <AislesTab aisles={aisles} />}
      {section === "tags" && <TagsTab tags={tags} />}
    </div>
  );
}
