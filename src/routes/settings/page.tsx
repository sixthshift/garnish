// Settings is the reference data a household edits — foods, units, aisles,
// tags and the house style guide — plus Appearance, the light / dark / system
// choice. Each of those is a
// tab over the same local DataTable primitive: search, sortable columns, and
// (from M15.2 on) an editor sheet and a delete that lists the recipes it
// touches. Appearance needs no loader and no table.
import { Heading } from "@sixthshift/design-system/heading";
import { type TabItem, Tabs } from "@sixthshift/design-system/tabs";
import { AislesTab, Appearance, ExportTab, FoodsTab, StyleTab, TagsTab, UnitsTab } from "./components/SettingsTabs";
import { Route } from "./route";

export function SettingsPage() {
  const { aisles, units, foods, tags, recipes, styleRules } = Route.useLoaderData();

  const items: TabItem[] = [
    { value: "foods", label: "Foods", badge: foods.length, content: <FoodsTab foods={foods} aisles={aisles} units={units} recipes={recipes} /> },
    { value: "units", label: "Units", badge: units.length, content: <UnitsTab units={units} /> },
    { value: "aisles", label: "Aisles", badge: aisles.length, content: <AislesTab aisles={aisles} /> },
    { value: "tags", label: "Tags", badge: tags.length, content: <TagsTab tags={tags} /> },
    { value: "style", label: "Style", badge: styleRules.filter((rule) => rule.enabled).length, content: <StyleTab rules={styleRules} /> },
    { value: "export", label: "Import and export", content: <ExportTab /> },
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
