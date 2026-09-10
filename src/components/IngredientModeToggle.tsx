// Structured vs. Summary (M11.3): a per-device switch, not per-recipe, so it
// lives in prefs.ts (localStorage) rather than in the recipe document. "on"
// is Summary; the recipe view reads the same preference to decide whether to
// show each component's own ingredient block or one list from
// `mergeIngredients` (src/domain/merge.ts).
import { Switch } from "@sixthshift/design-system/switch";
import { useIngredientMode } from "../lib/prefs";

export function IngredientModeToggle() {
  const [mode, setMode] = useIngredientMode();
  return (
    <Switch
      checked={mode === "summary"}
      onCheckedChange={(checked) => setMode(checked ? "summary" : "structured")}
      label="Summary"
      data-testid="ingredient-mode-toggle"
    />
  );
}
