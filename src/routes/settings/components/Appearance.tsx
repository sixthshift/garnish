import { Muted } from "@sixthshift/design-system/muted";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import { ThemeToggle } from "./ThemeToggle";

export function Appearance() {
  return (
    <section className="flex flex-col gap-2" aria-label="Appearance">
      <SectionTitle as="h2">Theme</SectionTitle>
      <Muted as="p" className="text-sm">
        System follows the device's light or dark setting.
      </Muted>
      <div>
        <ThemeToggle />
      </div>
    </section>
  );
}
