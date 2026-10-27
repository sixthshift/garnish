import { type TabItem, Tabs } from "@sixthshift/design-system/tabs";
import { Page, PageHeader } from "../../components/shell/Page";
import { Appearance } from "./components/Appearance";
import { TimerAlerts } from "./components/TimerAlerts";
import { AiTab } from "./components/tabs/AiTab";
import { BackupTab } from "./components/tabs/BackupTab";
import { DiagnosticsTab, recentCount } from "./components/tabs/DiagnosticsTab";
import { LibraryTab } from "./components/tabs/LibraryTab";
import { McpTab } from "./components/tabs/McpTab";
import { PlannerTab } from "./components/tabs/PlannerTab";
import { StyleTab } from "./components/tabs/StyleTab";
import { Version } from "./components/Version";
import { Route } from "./route";

export function SettingsPage() {
  const { aisles, units, foods, foodUsage, tags, recipes, styleRules, plannerRules, ai, mcp, diagnostics } = Route.useLoaderData();
  const recent = recentCount(diagnostics, new Date());

  const items: TabItem[] = [
    {
      value: "library",
      label: "Library",
      content: <LibraryTab foods={foods} foodUsage={foodUsage} aisles={aisles} units={units} tags={tags} recipes={recipes} />,
    },
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
