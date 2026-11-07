import { useState } from "react";
import type { RecipeDraft } from "../../../draft";
import { RecipeTabs } from "../../mobile/RecipeTabs";
import { DraftPreview, usePictureUrl } from "../DraftPreview";
import { ImportCheckCard, type ImportCheckProps, type ImportCheckState } from "../ImportCheck";
import { NotesEditor } from "../NotesEditor";
import { IngredientsColumn, MethodColumn } from "../PartsColumns";
import { DescriptionField, NameField, NatureFields, PhotoField, type RecipeAboutProps, SourceField, TagsField, TimesFields, YieldFields } from "../RecipeAbout";
import { LineSourceProvider } from "./LineSource";
import { LinesToCheck } from "./LinesToCheck";

export type PhoneEditorProps = {
  /** The fields' shared props: the draft, its errors, the patches. */
  about: RecipeAboutProps;
  initial: RecipeDraft;
  file: File | null;
  importCheck?: ImportCheckProps;
  check: ImportCheckState | null;
  /** Showing the recipe as it will be saved rather than the fields (the save bar's Preview). */
  preview: boolean;
};

const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;

/**
 * The editor on a phone, in the phone's recipe page's own shape (decisions.md
 * row 211): the photo across the top, then the tags, the name, the words, the
 * times and servings, the kind and what it is; then Ingredients and Method as
 * the page's two tabs, held at the top as the form scrolls, so a long method
 * is one tab rather than the whole form; then the notes and the source. On an
 * import's Check, what the read says and the lines to look at come first, each
 * line opening in a sheet beside the page it came from (row 208). The save
 * bar's Preview swaps the fields for the recipe as it will be saved, keeping
 * them mounted so a half-typed box keeps its words.
 */
export function PhoneEditor({ about, initial, file, importCheck, check, preview }: PhoneEditorProps) {
  const { draft, units, errors, saving, onChange, importedImageUrl } = about;
  const [tab, setTab] = useState("ingredients");
  const image = usePictureUrl(file, draft.image, importedImageUrl);
  const ingredients = draft.parts.reduce((n, part) => n + part.ingredients.length, 0);
  const steps = draft.parts.reduce((n, part) => n + part.steps.length, 0);

  const body = (
    <>
      <div className="flex flex-col gap-5" hidden={preview} data-testid="phone-editor">
        {importCheck !== undefined && check !== null && (
          <>
            <ImportCheckCard draft={draft} check={importCheck} state={check} />
            <LinesToCheck draft={draft} check={check} />
          </>
        )}
        {/* Edge to edge, as the page's photo is. */}
        <PhotoField {...about} className="-mx-4 h-56" />
        <TagsField {...about} />
        <NameField {...about} />
        <DescriptionField {...about} />
        <TimesFields {...about} />
        <YieldFields {...about} />
        <NatureFields {...about} />
        <RecipeTabs
          value={tab}
          onValueChange={setTab}
          tabs={[
            {
              value: "ingredients",
              label: `Ingredients · ${ingredients}`,
              content: <IngredientsColumn draft={draft} onChange={onChange} units={units} errors={errors} disabled={saving} />,
              testId: "ingredients-tab",
            },
            {
              value: "method",
              label: `Method · ${count(steps, "step")}`,
              content: <MethodColumn draft={draft} onChange={onChange} units={units} errors={errors} disabled={saving} />,
              testId: "method-tab",
            },
          ]}
        />
        <div className="flex flex-col gap-4 border-t border-border-subtle pt-4">
          <NotesEditor draft={draft} onChange={onChange} errors={errors} disabled={saving} />
          <SourceField {...about} />
        </div>
      </div>
      {preview && <DraftPreview draft={draft} image={image} />}
    </>
  );

  if (importCheck === undefined || check === null) return body;
  return (
    <LineSourceProvider draft={draft} initial={initial} sourceText={importCheck.sourceText} check={check}>
      {body}
    </LineSourceProvider>
  );
}
