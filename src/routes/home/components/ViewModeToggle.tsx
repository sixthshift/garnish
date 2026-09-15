import { ToggleGroup } from "@sixthshift/design-system/toggle-group";
import { useViewMode, type ViewMode } from "../../../lib/prefs";
import { GridIcon, ListIcon } from "../../../components/ui/icons";

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
