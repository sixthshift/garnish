// Settings: aisle order and units are the reference data a household edits.
import { Heading } from "@sixthshift/design-system/heading";
import { Muted } from "@sixthshift/design-system/muted";
import { createFileRoute } from "@tanstack/react-router";
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
    </div>
  );
}
