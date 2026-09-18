import { type TabItem, Tabs } from "@sixthshift/design-system/tabs";
import { Page, PageHeader } from "../../components/shell/Page";
import { Appearance } from "./components/Appearance";
import { ExportTab } from "./components/tabs/ExportTab";
import { LibraryTab } from "./components/tabs/LibraryTab";
import { StyleTab } from "./components/tabs/StyleTab";
import { Route } from "./route";

export function SettingsPage() {
  const { aisles, units, foods, tags, recipes, styleRules } = Route.useLoaderData();

  const items: TabItem[] = [
    { value: "library", label: "Library", content: <LibraryTab foods={foods} aisles={aisles} units={units} tags={tags} recipes={recipes} /> },
    { value: "style", label: "Style", badge: styleRules.filter((rule) => rule.enabled).length, content: <StyleTab rules={styleRules} /> },
    { value: "export", label: "Import and export", content: <ExportTab /> },
    { value: "appearance", label: "Appearance", content: <Appearance /> },
  ];

  return (
    <Page>
      <PageHeader title="Settings" />
      <Tabs items={items} defaultValue="library">
        <Tabs.List className="max-w-full flex-wrap" />
        <Tabs.Panels />
      </Tabs>
    </Page>
  );
}
