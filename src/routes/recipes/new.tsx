// New recipe. The first question is where the recipe is from (M23.6,
// decisions.md row 57): a web page, a Mealie export (M34.3), or your own.
// `?source` carries the answer — `url`, `file` or `manual` — so each stage is a place the browser's Back button
// leaves the way it leaves any other, and a link to the blank editor is a link
// anyone can keep.
//
// The editor's pickers need the unit and tag lists, and the import needs the
// units too: they are the parser's unit vocabulary.
import { Heading } from "@sixthshift/design-system/heading";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { emptyDraft, type RecipeDraft, RecipeForm } from "../../components/RecipeForm";
import { RecipeSource, type SourceKind } from "../../components/RecipeSource";
import type { Tag, Unit } from "../../domain/recipe";
import { recipeByName, recipeBySource } from "../../server/recipes";
import { listTags } from "../../server/tags";
import { listUnits } from "../../server/units";

export const NewRecipeSearch = z.object({
  /** Where the recipe is from. Absent shows the chooser. */
  source: z.enum(["url", "manual", "file"]).optional(),
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
  const { source } = Route.useSearch();
  const navigate = Route.useNavigate();
  // An imported draft has no URL of its own, and the form must not be
  // remounted under an edit in progress. The blank one is made once per mount
  // so the form's dirty comparison has a stable object to compare against.
  const [imported, setImported] = useState<{ draft: RecipeDraft; imageUrl: string | null } | null>(null);
  const [blank] = useState(emptyDraft);

  const choose = (kind: SourceKind | null) => void navigate({ search: kind === null ? {} : { source: kind }, replace: true });

  if (imported !== null || source === "manual") {
    return (
      <Page>
        <RecipeForm
          initial={imported?.draft ?? blank}
          units={units}
          tags={tags}
          importedImageUrl={imported?.imageUrl ?? null}
        />
      </Page>
    );
  }

  return (
    <Page>
      <RecipeSource
        units={units}
        tags={tags}
        source={source ?? null}
        onChoose={choose}
        onDraft={(draft, imageUrl) => setImported({ draft, imageUrl })}
        findDuplicate={findDuplicateBySource}
        findDuplicateByName={findDuplicateByName}
      />
    </Page>
  );
}

/**
 * A recipe already imported from `url`, for the review's warning (M23.7). A
 * lookup that fails is reported as "no duplicate": a warning nobody got is
 * better than an import nobody could finish.
 */
async function findDuplicateBySource(url: string): Promise<{ name: string; slug: string } | null> {
  try {
    return await recipeBySource({ data: { sourceUrl: url } });
  } catch {
    return null;
  }
}

/** A recipe already here under this name, for an uploaded export's warning (M34.3). Same rule: a failed lookup is no duplicate. */
async function findDuplicateByName(name: string): Promise<{ name: string; slug: string } | null> {
  if (name.trim() === "") return null;
  try {
    return await recipeByName({ data: { name } });
  } catch {
    return null;
  }
}

function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-6">
      <Heading as="h1">New recipe</Heading>
      {children}
    </div>
  );
}
