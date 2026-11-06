import { type TabItem, Tabs } from "@sixthshift/design-system/tabs";
import { getRouteApi } from "@tanstack/react-router";
import { Page, PageHeader } from "../../../../components/Page";
import { useLayout } from "../../../../lib/useLayout";
import { Appearance } from "../components/Appearance";
import { FoodsGrid } from "../components/desktop/FoodsGrid";
import { type SettingsGroup, SettingsMenu } from "../components/desktop/SettingsMenu";
import { TimerAlerts } from "../components/TimerAlerts";
import { AislesTab } from "../components/tabs/AislesTab";
import { AiTab } from "../components/tabs/AiTab";
import { BackupTab } from "../components/tabs/BackupTab";
import { DiagnosticsTab, recentCount } from "../components/tabs/DiagnosticsTab";
import { LibraryTab } from "../components/tabs/LibraryTab";
import { McpTab } from "../components/tabs/McpTab";
import { PlannerTab } from "../components/tabs/PlannerTab";
import { StyleTab } from "../components/tabs/StyleTab";
import { TagsTab } from "../components/tabs/TagsTab";
import { UnitsTab } from "../components/tabs/UnitsTab";
import { Version } from "../components/Version";

const route = getRouteApi("/settings");

export function SettingsPage() {
  const { aisles, units, foods, foodUsage, foodPacks, tags, recipes, styleRules, plannerRules, ai, mcp, diagnostics } = route.useLoaderData();
  const recent = recentCount(diagnostics, new Date());
  const layout = useLayout();

  // Every place but the library, which a phone shows as one tab of four and a desktop as four places.
  const rest = [
    { value: "style", label: "Style", badge: styleRules.filter((rule) => rule.enabled).length, content: <StyleTab rules={styleRules} /> },
    {
      value: "planner",
      label: "Planner",
      badge: plannerRules.filter((rule) => rule.enabled).length,
      content: <PlannerTab rules={plannerRules} />,
    },
    { value: "backup", label: "Backup", content: <BackupTab /> },
    { value: "ai", label: "AI", content: <AiTab status={ai} /> },
    {
      value: "mcp",
      label: "MCP",
      badge: mcp.connections.length > 0 ? mcp.connections.length : undefined,
      content: <McpTab status={mcp} />,
    },
    { value: "appearance", label: "Appearance", content: <Appearance /> },
    { value: "alerts", label: "Alerts", content: <TimerAlerts /> },
    // The badge is the last week's problems, so a quiet tab means nothing went wrong lately.
    { value: "diagnostics", label: "Diagnostics", badge: recent > 0 ? recent : undefined, content: <DiagnosticsTab events={diagnostics} /> },
  ];

  if (layout === "desktop") {
    const at = (...values: string[]) => values.flatMap((value) => rest.filter((item) => item.value === value));
    const groups: SettingsGroup[] = [
      {
        label: "Library",
        sections: [
          {
            value: "foods",
            label: "Foods",
            wide: true,
            content: <FoodsGrid foods={foods} usage={foodUsage} packs={foodPacks} aisles={aisles} units={units} recipes={recipes} />,
          },
          { value: "units", label: "Units", wide: true, content: <UnitsTab units={units} /> },
          { value: "aisles", label: "Aisles", content: <AislesTab aisles={aisles} /> },
          { value: "tags", label: "Tags", wide: true, content: <TagsTab tags={tags} /> },
        ],
      },
      { label: "Cooking", sections: at("style", "planner") },
      { label: "Data", sections: at("backup", "ai", "mcp") },
      { label: "App", sections: at("appearance", "alerts", "diagnostics") },
    ];
    return <SettingsMenu groups={groups} footer={<Version />} />;
  }

  const items: TabItem[] = [
    {
      value: "library",
      label: "Library",
      content: <LibraryTab foods={foods} foodUsage={foodUsage} foodPacks={foodPacks} aisles={aisles} units={units} tags={tags} recipes={recipes} />,
    },
    ...rest,
  ];

  return (
    <Page>
      <PageHeader title="Settings" />
      <Tabs items={items} defaultValue="library">
        {/* One row that scrolls sideways on a phone rather than wrapping, which split a count from its label.
            The padding (cancelled by the margin) keeps the focus ring's offset inside the scroller. The count's
            gap is closed so "Style 12" reads as one tab; its pill's fill comes from the theme (theme.css). */}
        <Tabs.List className="-m-1 max-w-[calc(100%+0.5rem)] overflow-x-auto p-1 [&_.badge]:ml-0" />
        <Tabs.Panels />
      </Tabs>
      <Version />
    </Page>
  );
}
