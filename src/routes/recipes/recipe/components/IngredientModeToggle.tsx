import { Switch } from "@sixthshift/design-system/switch";
import { useIngredientMode } from "../../../../lib/prefs";

export function IngredientModeToggle() {
  const [mode, setMode] = useIngredientMode();
  return (
    <Switch
      checked={mode === "summary"}
      onCheckedChange={(checked) => setMode(checked ? "summary" : "structured")}
      label="One list"
      data-testid="ingredient-mode-toggle"
    />
  );
}
