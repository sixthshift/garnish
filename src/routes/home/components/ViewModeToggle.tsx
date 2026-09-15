// Grid vs list view (M12.2): a per-device switch, not persisted per recipe.
// Same pattern as IngredientModeToggle: a thin wrapper over a `prefs.ts` hook,
// icon-only so each option carries its own accessible label. Mealie offers
// the same two-way choice (grid vs its RecipeCardMobile list rows).
import { ToggleGroup } from "@sixthshift/design-system/toggle-group";
import { useViewMode, type ViewMode } from "../../../lib/prefs";

function GridIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="8" height="8" rx="1" />
      <rect x="13" y="3" width="8" height="8" rx="1" />
      <rect x="3" y="13" width="8" height="8" rx="1" />
      <rect x="13" y="13" width="8" height="8" rx="1" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

export function ViewModeToggle() {
  const [mode, setMode] = useViewMode();
  return (
    <ToggleGroup
      type="single"
      appearance="separate"
      variant="outline"
      intent="neutral"
      size="sm"
      iconOnly
      aria-label="View"
      value={mode}
      onValueChange={(value) => setMode(value as ViewMode)}
      options={[
        { value: "grid", label: <GridIcon />, ariaLabel: "Grid view" },
        { value: "list", label: <ListIcon />, ariaLabel: "List view" },
      ]}
    />
  );
}
