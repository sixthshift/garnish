import { getRouteApi } from "@tanstack/react-router";
import { useState } from "react";
import { recipeByName, recipeBySource } from "../../../api/rpc/recipes";
import { Page, PageHeader } from "../../../components/Page";
import { DiscardImportDialog } from "../components/editor/DiscardImport";
import { RecipeForm } from "../components/editor/RecipeForm";
import { ImportSteps } from "../components/new/ImportSteps";
import { ImportStyle } from "../components/new/ImportStyle";
import type { SourceKind } from "../components/new/importSummary";
import { RecipeSource } from "../components/new/RecipeSource";
import type { ImportedCheck } from "../components/new/reviewFlows";
import { emptyDraft, type PendingLines, type RecipeDraft } from "../draft";

const route = getRouteApi("/recipes/new");

/**
 * An import in flight (decisions.md row 203): the read as Check opens on it,
 * the draft as Check last left it, the lines Check still asks about, a picture
 * picked there, and which stage it is on. `version` remounts Check on a return
 * from Style, so the form opens on the draft as it was handed on.
 */
type Imported = { check: ImportedCheck; draft: RecipeDraft; pending: PendingLines; file: File | null; stage: "check" | "style"; version: number };

export function NewRecipePage() {
  const { units, tags, aiAvailable } = route.useLoaderData();
  const { source, url } = route.useSearch();
  const navigate = route.useNavigate();
  // An import has no URL of its own, and the form must not be remounted under
  // an edit in progress. The blank one is made once per mount so the form's
  // dirty comparison has a stable object to compare against.
  const [imported, setImported] = useState<Imported | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [blank] = useState(emptyDraft);

  const choose = (kind: SourceKind | null) => void navigate({ search: kind === null ? {} : { source: kind }, replace: true });
  const discard = () => {
    setLeaving(false);
    setImported(null);
    choose(null);
  };
  const leave = leaving && <DiscardImportDialog onStay={() => setLeaving(false)} onDiscard={discard} />;

  // With a model, Check continues to Style, where Save is; without one, Check saves.
  if (imported !== null && aiAvailable && imported.stage === "style") {
    return (
      <Page>
        <PageHeader title={imported.draft.name.trim() || "New recipe"} />
        <ImportSteps current="Style" model />
        <ImportStyle
          draft={imported.draft}
          imageUrl={imported.check.imageUrl}
          file={imported.file}
          onEditDetails={() => setImported({ ...imported, stage: "check", version: imported.version + 1 })}
          onCancel={discard}
        />
      </Page>
    );
  }

  if (imported !== null) {
    return (
      <Page>
        <PageHeader title="New recipe" />
        <ImportSteps current="Check" model={aiAvailable} />
        <RecipeForm
          key={imported.version}
          initial={imported.draft}
          units={units}
          tags={tags}
          importedImageUrl={imported.check.imageUrl}
          isImport
          importCheck={{
            pending: imported.pending,
            note: imported.check.note,
            duplicate: imported.check.duplicate,
            suggestedTags: imported.check.suggestedTags,
            onBack: () => setLeaving(true),
          }}
          continueWith={
            aiAvailable
              ? {
                  label: "Continue",
                  onContinue: (draft, file, pending) => setImported({ ...imported, draft, pending, file: file ?? imported.file, stage: "style" }),
                  onBack: () => setLeaving(true),
                }
              : undefined
          }
        />
        {leave}
      </Page>
    );
  }

  if (source === "manual") {
    return (
      <Page>
        <PageHeader title="New recipe" />
        <RecipeForm initial={blank} units={units} tags={tags} />
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
        onDraft={(check) => setImported({ check, draft: check.draft, pending: check.pending, file: null, stage: "check", version: 0 })}
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
