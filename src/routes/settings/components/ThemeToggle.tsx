// Light / dark / system, in Settings. Before this the app was system-only:
// `bootstrapTheme` painted whatever the OS asked for and nothing could
// override it.
//
// Two writers, deliberately. `prefs.setTheme` owns the persistence (one key,
// one encoding, with the same try/catch as every other preference), and the
// design system's `setTheme` — same key, same JSON — is what repaints
// `<html data-theme>` and tells its own subscribers. Writing through prefs
// alone would persist the choice but not apply it until the next reload; the
// second call costs one localStorage write and keeps both stores honest.
import { useTheme as usePaintedTheme } from "@sixthshift/design-system/hooks";
import { ToggleGroup } from "@sixthshift/design-system/toggle-group";
import { type Theme, useTheme as useThemePref } from "../../../lib/prefs";

export const themeOptions = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
] as const;

/** Is this one of the three themes? Guards the string the toggle group hands back. Pure. */
export function isTheme(value: string): value is Theme {
  return themeOptions.some((option) => option.value === value);
}

export function ThemeToggle() {
  const [theme, persist] = useThemePref();
  const { setTheme: paint } = usePaintedTheme();

  const choose = (value: string) => {
    if (!isTheme(value)) return;
    persist(value);
    paint(value);
  };

  return <ToggleGroup type="single" appearance="segmented" size="sm" aria-label="Theme" options={themeOptions} value={theme} onValueChange={choose} />;
}
