import { useState } from "react";
import { Page, PageHeader } from "../../../components/shell/Page";
import { emptyDraft, type RecipeDraft } from "../../../domain/draft";
import { recipeByName, recipeBySource } from "../../../server/fns/recipes";
import { RecipeForm } from "../components/RecipeForm";
import { ImportSteps } from "./components/ImportSteps";
import { ImportStyle } from "./components/ImportStyle";
import type { SourceKind } from "./components/importSummary";
import { RecipeSource } from "./components/RecipeSource";
import { Route } from "./route";

/** An imported draft in flight: the Style stage over it, or Edit details, with a picture picked there kept for Save. */
type Imported = { draft: RecipeDraft; imageUrl: string | null; file: File | null; stage: "style" | "details" };

export function NewRecipePage() {
  const { units, tags, aiAvailable } = Route.useLoaderData();
  const { source, url } = Route.useSearch();
  const navigate = Route.useNavigate();
  // An imported draft has no URL of its own, and the form must not be
  // remounted under an edit in progress. The blank one is made once per mount
  // so the form's dirty comparison has a stable object to compare against.
  const [imported, setImported] = useState<Imported | null>(null);
  const [blank] = useState(emptyDraft);

  const choose = (kind: SourceKind | null) => void navigate({ search: kind === null ? {} : { source: kind }, replace: true });

  // With a model, an import goes Review, Style, Save: the Style stage comes
  // before anything is stored, and the full form is a detour from it ("Edit
  // details") rather than a stop on the way. Without one it goes straight to
  // the form, as a recipe typed in by hand does.
  if (imported !== null && aiAvailable && imported.stage === "style") {
    return (
      <Page>
        <PageHeader title={imported.draft.name.trim() || "New recipe"} />
        <ImportSteps current="Style" />
        <ImportStyle
          draft={imported.draft}
          imageUrl={imported.imageUrl}
          file={imported.file}
          onEditDetails={() => setImported({ ...imported, stage: "details" })}
          onCancel={() => {
            setImported(null);
            choose(null);
          }}
        />
      </Page>
    );
  }

  if (imported !== null || source === "manual") {
    return (
      <Page>
        <PageHeader title="New recipe" />
        {imported !== null && aiAvailable && <ImportSteps current="Style" />}
        <RecipeForm
          initial={imported?.draft ?? blank}
          units={units}
          tags={tags}
          importedImageUrl={imported?.imageUrl ?? null}
          isImport={imported !== null}
          continueWith={
            imported !== null && aiAvailable
              ? {
                  label: "Continue to Style",
                  onContinue: (draft, file) => setImported({ ...imported, draft, file: file ?? imported.file, stage: "style" }),
                  onBack: () => setImported({ ...imported, stage: "style" }),
                }
              : undefined
          }
        />
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader title="New recipe" />
      <RecipeSource
        units={units}
        tags={tags}
        source={source ?? null}
        initialUrl={url ?? null}
        aiAvailable={aiAvailable}
        onChoose={choose}
        onDraft={(draft, imageUrl) => setImported({ draft, imageUrl, file: null, stage: "style" })}
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
