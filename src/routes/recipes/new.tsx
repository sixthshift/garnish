// New recipe. The editor's pickers need the unit and tag lists.
import { Heading } from "@sixthshift/design-system/heading";
import { Muted } from "@sixthshift/design-system/muted";
import { createFileRoute } from "@tanstack/react-router";
import type { Tag, Unit } from "../../domain/recipe";
import { listTags } from "../../server/tags";
import { listUnits } from "../../server/units";

export type NewRecipeData = { units: Unit[]; tags: Tag[] };

export const Route = createFileRoute("/recipes/new")({
  loader: async (): Promise<NewRecipeData> => {
    const [units, tags] = await Promise.all([listUnits({ data: {} }), listTags({ data: {} })]);
    return { units, tags };
  },
  component: NewRecipePage,
});

function NewRecipePage() {
  const { units, tags } = Route.useLoaderData();
  return (
    <div className="flex flex-col gap-4 p-6">
      <Heading as="h1">New recipe</Heading>
      <Muted as="p">
        {units.length} units, {tags.length} tags
      </Muted>
    </div>
  );
}
