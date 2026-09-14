// Structured vs. Summary (M11.3): a per-device switch, not per-recipe, so it
// lives in prefs.ts (localStorage) rather than in the recipe document. "on"
// is Summary; the recipe view reads the same preference to decide whether to
// show each component's own ingredient block or one list from
// `mergeIngredients` (src/domain/recipe/mergeIngredients.ts). Labelled "One list" (M24.2)
// rather than "Summary": the caller only renders this when the recipe has
// more than one part, so the switch is about merging those parts' lists
// together, not a mode name that means nothing over a flat recipe.
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
