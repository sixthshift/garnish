import { useTheme as usePaintedTheme } from "@sixthshift/design-system/hooks";
import { ToggleGroup } from "@sixthshift/design-system/toggle-group";
import { prefs, useTheme as useThemePref } from "../../../lib/prefs";

export function ThemeToggle() {
  const [theme, persist] = useThemePref();
  const { setTheme: paint } = usePaintedTheme();

  const choose = (value: string) => {
    if (!prefs.theme.isValid(value)) return;
    // Both writers on purpose: prefs persists the choice, the design system repaints <html data-theme> now rather than on the next reload.
    persist(value);
    paint(value);
  };

  return <ToggleGroup type="single" appearance="segmented" size="sm" aria-label="Theme" options={themeOptions} value={theme} onValueChange={choose} />;
}

export const themeOptions = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
] as const;
