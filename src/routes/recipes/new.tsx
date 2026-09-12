// New recipe. Two screens behind one route (M19.2): `RecipeImport` until it
// hands back a draft — from a pasted recipe, or blank — and `RecipeForm` on
// that draft after. The editor's pickers need the unit and tag lists, and the
// import needs the units too: they are the parser's unit vocabulary.
//
// `?blank` skips the paste box. It is what "Start blank" navigates to rather
// than a piece of component state, so the browser's Back leaves the blank form
// for the paste box the way it leaves any other screen, and a link straight to
// the empty editor is a link anyone can keep.
//
// The draft lives here rather than inside `RecipeImport` so the form is
// mounted once, on a draft that never changes identity under it; Back from
// the review stage is inside the import, not a step out of the form.
import { Heading } from "@sixthshift/design-system/heading";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { RecipeImport } from "../../components/RecipeImport";
import { emptyDraft, type RecipeDraft, RecipeForm } from "../../components/RecipeForm";
import type { Tag, Unit } from "../../domain/recipe";
import { listTags } from "../../server/tags";
import { listUnits } from "../../server/units";

export const NewRecipeSearch = z.object({
  /** Skip the paste box and open the empty editor. */
  blank: z.boolean().optional(),
});

export type NewRecipeData = { units: Unit[]; tags: Tag[] };

export const Route = createFileRoute("/recipes/new")({
  validateSearch: NewRecipeSearch,
  loader: async (): Promise<NewRecipeData> => {
    const [units, tags] = await Promise.all([listUnits({ data: {} }), listTags({ data: {} })]);
    return { units, tags };
  },
  component: NewRecipePage,
});

function NewRecipePage() {
  const { units, tags } = Route.useLoaderData();
  const { blank } = Route.useSearch();
  const navigate = Route.useNavigate();
  // Held rather than derived: the draft a paste produced has no URL, and the
  // form must not be remounted under an edit in progress. `?blank` gets one of
  // its own, made once per mount so the form's dirty comparison has a stable
  // object to compare against.
  const [imported, setImported] = useState<RecipeDraft | null>(null);
  const [blankDraft] = useState(emptyDraft);
  const draft = imported ?? (blank === true ? blankDraft : null);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <Heading as="h1">New recipe</Heading>
      {draft === null ? (
        <RecipeImport units={units} onDraft={setImported} onBlank={() => void navigate({ search: { blank: true }, replace: true })} />
      ) : (
        <RecipeForm initial={draft} units={units} tags={tags} />
      )}
    </div>
  );
}
