// New recipe. The editor's pickers need the unit and tag lists.
//
// M23.6 puts a source chooser in front of this — where is the recipe from? —
// and until it lands the route goes straight to the blank editor, which is
// what it did before M19 put a paste box here (decisions.md row 57).
import { Heading } from "@sixthshift/design-system/heading";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { emptyDraft, RecipeForm } from "../../components/RecipeForm";
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
  // Made once per mount, so the form's dirty comparison has a stable object.
  const [draft] = useState(emptyDraft);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <Heading as="h1">New recipe</Heading>
      <RecipeForm initial={draft} units={units} tags={tags} />
    </div>
  );
}
