// Settings: aisle order and units are the reference data a household edits,
// plus Appearance — the light / dark / system choice, which needs no loader.
import { Heading } from "@sixthshift/design-system/heading";
import { Muted } from "@sixthshift/design-system/muted";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import { createFileRoute } from "@tanstack/react-router";
import { ThemeToggle } from "../components/ThemeToggle";
import type { Aisle, Unit } from "../domain/recipe";
import { listAisles } from "../server/aisles";
import { listUnits } from "../server/units";

export type SettingsData = { aisles: Aisle[]; units: Unit[] };

export const Route = createFileRoute("/settings")({
  loader: async (): Promise<SettingsData> => {
    const [aisles, units] = await Promise.all([listAisles({ data: {} }), listUnits({ data: {} })]);
    return { aisles, units };
  },
  component: SettingsPage,
});

function SettingsPage() {
  const { aisles, units } = Route.useLoaderData();
  return (
    <div className="flex flex-col gap-4 p-6">
      <Heading as="h1">Settings</Heading>
      <Muted as="p">
        {aisles.length} aisles, {units.length} units
      </Muted>
      <section className="flex flex-col gap-2" aria-label="Appearance">
        <SectionTitle as="h2">Appearance</SectionTitle>
        <Muted as="p" className="text-sm">
          System follows the device's light or dark setting.
        </Muted>
        <div>
          <ThemeToggle />
        </div>
      </section>
    </div>
  );
}
