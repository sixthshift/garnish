import { useTheme as usePaintedTheme } from "@sixthshift/design-system/hooks";
import { ToggleGroup } from "@sixthshift/design-system/toggle-group";
import { type Theme, useTheme as useThemePref } from "../../../lib/prefs";

export function ThemeToggle() {
  const [theme, persist] = useThemePref();
  const { setTheme: paint } = usePaintedTheme();

  const choose = (value: string) => {
    if (!isTheme(value)) return;
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

/** Is this one of the three themes? Guards the string the toggle group hands back. Pure. */
export function isTheme(value: string): value is Theme {
  return themeOptions.some((option) => option.value === value);
}
