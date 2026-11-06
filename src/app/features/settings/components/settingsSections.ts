/**
 * Settings' places, in the menu's order: what `?section=` may name. A phone
 * opens each as its own screen from one grouped list, so the place has an
 * address and Back returns to the list (decisions.md row 208); a desktop's
 * menu opens at the one named.
 */
export const SETTINGS_SECTIONS = [
  "foods",
  "units",
  "aisles",
  "tags",
  "style",
  "planner",
  "backup",
  "ai",
  "mcp",
  "appearance",
  "alerts",
  "diagnostics",
] as const;

export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number];
