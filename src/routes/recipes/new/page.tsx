import { Heading } from "@sixthshift/design-system/heading";
import { useState } from "react";
import { emptyDraft, type RecipeDraft } from "../../../domain/draft";
import { recipeByName, recipeBySource } from "../../../server/fns/recipes";
import { RecipeForm } from "../components/RecipeForm";
import type { SourceKind } from "./components/importSummary";
import { RecipeSource } from "./components/RecipeSource";
import { Route } from "./route";

export function NewRecipePage() {
  const { units, tags, aiAvailable } = Route.useLoaderData();
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
          /* An imported recipe lands on its page with the restyle sheet open
             when there is a model to rewrite with: the import keeps
             the author's words on purpose, so the offer to put them in the
             household's voice belongs at the end of the import and nowhere
             else. "My own" skips it. */
          afterSaveSearch={imported !== null && aiAvailable ? { restyle: true } : undefined}
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
        aiAvailable={aiAvailable}
        onChoose={choose}
        onDraft={(draft, imageUrl) => setImported({ draft, imageUrl })}
        findDuplicate={findDuplicateBySource}
        findDuplicateByName={findDuplicateByName}
      />
    </Page>
  );
}

/**
 * A recipe already imported from `url`, for the review's warning. A
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

/** A recipe already here under this name, for an uploaded export's warning. Same rule: a failed lookup is no duplicate. */
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
