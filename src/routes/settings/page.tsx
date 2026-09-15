import { Heading } from "@sixthshift/design-system/heading";
import { type TabItem, Tabs } from "@sixthshift/design-system/tabs";
import { AislesTab } from "./components/AislesTab";
import { Appearance } from "./components/Appearance";
import { ExportTab } from "./components/ExportTab";
import { FoodsTab } from "./components/FoodsTab";
import { StyleTab } from "./components/StyleTab";
import { TagsTab } from "./components/TagsTab";
import { UnitsTab } from "./components/UnitsTab";
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
