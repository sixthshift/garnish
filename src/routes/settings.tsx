// Settings is the reference data a household edits — foods, units, aisles and
// tags — plus Appearance, the light / dark / system choice. Each of those is a
// tab over the same local DataTable primitive: search, sortable columns, and
// (from M15.2 on) an editor sheet and a delete that lists the recipes it
// touches. Appearance needs no loader and no table.
import { Heading } from "@sixthshift/design-system/heading";
import { Muted } from "@sixthshift/design-system/muted";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import { Tabs, type TabItem } from "@sixthshift/design-system/tabs";
import { createFileRoute } from "@tanstack/react-router";
import { ThemeToggle } from "../components/ThemeToggle";
import { DataTable, type DataTableColumn } from "../components/ui/DataTable";
import type { Aisle, Tag, Unit } from "../domain/recipe";
import { listAisles } from "../server/aisles";
import { listFoods } from "../server/foods";
import { listTags } from "../server/tags";
import { listUnits } from "../server/units";

/** The repository's food row: a flat `aisleId`, not the recipe document's nested aisle. */
export type FoodRow = Awaited<ReturnType<typeof listFoods>>[number];

export type SettingsData = { aisles: Aisle[]; units: Unit[]; foods: FoodRow[]; tags: Tag[] };

export const Route = createFileRoute("/settings")({
  loader: async (): Promise<SettingsData> => {
    const [aisles, units, foods, tags] = await Promise.all([
      listAisles({ data: {} }),
      listUnits({ data: {} }),
      listFoods({ data: {} }),
      listTags({ data: {} }),
    ]);
    return { aisles, units, foods, tags };
  },
  component: SettingsPage,
});

/**
 * Columns per reference kind. Exported so the tab tasks and the tests share
 * one definition. Foods take the aisle list because a food row carries only
 * the aisle's id.
 */
export function foodColumns(aisles: readonly Aisle[]): DataTableColumn<FoodRow>[] {
  const aisleName = (id: string | null) => aisles.find((aisle) => aisle.id === id)?.name ?? null;
  return [
    { key: "name", header: "Name", value: (food) => food.name },
    { key: "pluralName", header: "Plural", value: (food) => food.pluralName },
    { key: "aisle", header: "Aisle", value: (food) => aisleName(food.aisleId) },
    { key: "skipShopping", header: "Skip shopping", value: (food) => food.skipShopping },
    { key: "aliases", header: "Aliases", value: (food) => food.aliases.length },
  ];
}

export const unitColumns: DataTableColumn<Unit>[] = [
  { key: "name", header: "Name", value: (unit) => unit.name },
  { key: "pluralName", header: "Plural", value: (unit) => unit.pluralName },
  { key: "abbreviation", header: "Abbreviation", value: (unit) => unit.abbreviation },
  { key: "useAbbreviation", header: "Use abbreviation", value: (unit) => unit.useAbbreviation },
  { key: "fraction", header: "Fractions", value: (unit) => unit.fraction },
];

export const aisleColumns: DataTableColumn<Aisle>[] = [
  { key: "name", header: "Name", value: (aisle) => aisle.name },
  { key: "position", header: "Order", value: (aisle) => aisle.position },
];

export const tagColumns: DataTableColumn<Tag>[] = [
  { key: "name", header: "Name", value: (tag) => tag.name },
  { key: "slug", header: "Slug", value: (tag) => tag.slug },
];

function SettingsPage() {
  const { aisles, units, foods, tags } = Route.useLoaderData();

  const items: TabItem[] = [
    { value: "foods", label: "Foods", badge: foods.length, content: <DataTable items={foods} columns={foodColumns(aisles)} keyOf={(food) => food.id} itemName="food" /> },
    { value: "units", label: "Units", badge: units.length, content: <DataTable items={units} columns={unitColumns} keyOf={(unit) => unit.id} itemName="unit" /> },
    {
      value: "aisles",
      label: "Aisles",
      badge: aisles.length,
      content: <DataTable items={aisles} columns={aisleColumns} keyOf={(aisle) => aisle.id} itemName="aisle" />,
    },
    { value: "tags", label: "Tags", badge: tags.length, content: <DataTable items={tags} columns={tagColumns} keyOf={(tag) => tag.id} itemName="tag" /> },
    { value: "appearance", label: "Appearance", content: <Appearance /> },
  ];

  return (
    <div className="flex flex-col gap-4 p-6">
      <Heading as="h1">Settings</Heading>
      <Tabs items={items} defaultValue="foods">
        <Tabs.List />
        <Tabs.Panels />
      </Tabs>
    </div>
  );
}

function Appearance() {
  return (
    <section className="flex flex-col gap-2" aria-label="Appearance">
      <SectionTitle as="h2">Theme</SectionTitle>
      <Muted as="p" className="text-sm">
        System follows the device's light or dark setting.
      </Muted>
      <div>
        <ThemeToggle />
      </div>
    </section>
  );
}
