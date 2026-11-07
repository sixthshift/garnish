import { getRouteApi } from "@tanstack/react-router";
import { useLayout } from "../../../../lib/useLayout";
import { Appearance } from "../components/Appearance";
import { FoodsGrid } from "../components/desktop/FoodsGrid";
import { type SettingsGroup, SettingsMenu } from "../components/desktop/SettingsMenu";
import { FoodsList } from "../components/mobile/FoodsList";
import { SettingsList, SettingsSectionScreen } from "../components/mobile/SettingsList";
import type { SettingsSectionId } from "../components/settingsSections";
import { TimerAlerts } from "../components/TimerAlerts";
import { AislesTab } from "../components/tabs/AislesTab";
import { AiTab } from "../components/tabs/AiTab";
import { BackupTab } from "../components/tabs/BackupTab";
import { DiagnosticsTab, recentCount } from "../components/tabs/DiagnosticsTab";
import { McpTab } from "../components/tabs/McpTab";
import { PlannerTab } from "../components/tabs/PlannerTab";
import { StyleTab } from "../components/tabs/StyleTab";
import { TagsTab } from "../components/tabs/TagsTab";
import { UnitsTab } from "../components/tabs/UnitsTab";
import { Version } from "../components/Version";

const route = getRouteApi("/settings");

/** A group of places as the page builds it: the menu's, with the phone list's count for the library. */
type Place = { label: string; sections: (SettingsGroup["sections"][number] & { value: SettingsSectionId; count?: number })[] };

export function SettingsPage() {
  const { aisles, units, foods, foodUsage, foodPacks, tags, recipes, styleRules, plannerRules, ai, mcp, diagnostics } = route.useLoaderData();
  const { section } = route.useSearch();
  const navigate = route.useNavigate();
  const recent = recentCount(diagnostics, new Date());
  const layout = useLayout();

  // Every place, grouped as both layouts show them: a desktop's menu down the left, a phone's one list.
  const at = (value: SettingsSectionId) => value;
  const groups: Place[] = [
    {
      label: "Library",
      sections: [
        {
          value: at("foods"),
          label: "Foods",
          wide: true,
          count: foods.length,
          content:
            layout === "desktop" ? (
              <FoodsGrid foods={foods} usage={foodUsage} packs={foodPacks} aisles={aisles} units={units} recipes={recipes} />
            ) : (
              <FoodsList foods={foods} usage={foodUsage} packs={foodPacks} aisles={aisles} units={units} recipes={recipes} />
            ),
        },
        { value: at("units"), label: "Units", wide: true, count: units.length, content: <UnitsTab units={units} /> },
        { value: at("aisles"), label: "Aisles", count: aisles.length, content: <AislesTab aisles={aisles} /> },
        { value: at("tags"), label: "Tags", wide: true, count: tags.length, content: <TagsTab tags={tags} /> },
      ],
    },
    {
      label: "Cooking",
      sections: [
        { value: at("style"), label: "Style", badge: styleRules.filter((rule) => rule.enabled).length, content: <StyleTab rules={styleRules} /> },
        { value: at("planner"), label: "Planner", badge: plannerRules.filter((rule) => rule.enabled).length, content: <PlannerTab rules={plannerRules} /> },
      ],
    },
    {
      label: "Data",
      sections: [
        { value: at("backup"), label: "Backup", content: <BackupTab /> },
        { value: at("ai"), label: "AI", content: <AiTab status={ai} /> },
        { value: at("mcp"), label: "MCP", badge: mcp.connections.length > 0 ? mcp.connections.length : undefined, content: <McpTab status={mcp} /> },
      ],
    },
    {
      label: "App",
      sections: [
        { value: at("appearance"), label: "Appearance", content: <Appearance /> },
        { value: at("alerts"), label: "Alerts", content: <TimerAlerts /> },
        // The count is the last week's problems, so a quiet row means nothing went wrong lately.
        { value: at("diagnostics"), label: "Diagnostics", badge: recent > 0 ? recent : undefined, content: <DiagnosticsTab events={diagnostics} /> },
      ],
    },
  ];

  if (layout === "desktop") {
    // The library's counts are the phone list's alone: the desktop menu badges what it always has.
    const menu = groups.map((group) => ({ ...group, sections: group.sections.map(({ count: _, ...rest }) => rest) }));
    return (
      <SettingsMenu groups={menu} footer={<Version />} value={section} onChange={(next) => navigate({ search: { section: next as SettingsSectionId } })} />
    );
  }

  const open = section === undefined ? undefined : groups.flatMap((group) => group.sections).find((place) => place.value === section);
  if (open !== undefined) {
    return (
      <SettingsSectionScreen label={open.label} bare={open.value === "foods"}>
        {open.content}
      </SettingsSectionScreen>
    );
  }
  return (
    <SettingsList
      groups={groups.map((group) => ({
        label: group.label,
        rows: group.sections.map((place) => ({ value: place.value, label: place.label, count: place.count ?? place.badge })),
      }))}
      footer={<Version />}
    />
  );
}
