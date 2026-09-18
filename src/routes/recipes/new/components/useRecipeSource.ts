// The stage state of /recipes/new and the flows between stages; RecipeSource renders what this returns.

import { useEffect, useRef, useState } from "react";
import type { IngredientReview } from "../../../../domain/draft";
import { type FileRecipe, type ImportedRecipe, review } from "../../../../domain/import";
import { reviewRows } from "../../../../domain/ingredient";
import type { FoodRow } from "../../../../domain/reference";
import { messageFrom } from "../../../../lib/errors";
import { postImportFile } from "../../../../lib/importFile";
import { listFoods } from "../../../../server/fns/foods";
import { importFromText, importFromUrl } from "../../../../server/fns/import";
import { type ModelReader, withRejectedAnswer } from "./importSummary";
import type { RecipeSourceProps } from "./RecipeSource";
import { draftFromReview, reviewOfUpload } from "./reviewFlows";
import { useModelPass } from "./useModelPass";

export function useRecipeSource(props: RecipeSourceProps) {
  const { units, tags, onChoose, onDraft, findDuplicate, findDuplicateByName, loadFoods, load, loadFile, linkSubRecipeFood } = props;
  const { aiAvailable = false, loadText, initialUrl = null } = props;
  const [url, setUrl] = useState(initialUrl ?? "");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [choices, setChoices] = useState<FileRecipe[] | null>(null);
  const [imported, setImported] = useState<ImportedRecipe | null>(null);
  const [rows, setRows] = useState<IngredientReview[]>([]);
  // Which step of the row's part owns the row, and the nested recipes the rows
  // stand for; only a Tandoor export knows either.
  const [rowSteps, setRowSteps] = useState<number[] | null>(null);
  const [subRecipes, setSubRecipes] = useState<string[]>([]);
  const [duplicate, setDuplicate] = useState<{ name: string; slug: string } | null>(null);
  // The food vocabulary the upload already fetched, so picking a recipe out of
  // a backup does not fetch it again.
  const [vocabulary, setVocabulary] = useState<readonly FoodRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reader: ModelReader = (pageText, anchor) =>
    loadText ? loadText(pageText, anchor) : importFromText({ data: { text: pageText, sourceUrl: url, anchor } });

  const model = useModelPass({
    aiAvailable,
    reader,
    onAnswer: (result, foods) => {
      setImported(result);
      setRows(reviewRows(review.ingredientLines(result.recipe), { units, foods }));
    },
  });

  const fetchFoods = loadFoods ?? (() => listFoods({ data: {} }));

  /** A page or a paste onto the review, with the vocabulary it was reviewed against. */
  const showReview = (found: ImportedRecipe, foods: readonly FoodRow[]) => {
    setImported(found);
    setRows(reviewRows(review.ingredientLines(found.recipe), { units, foods }));
    setRowSteps(null);
    setSubRecipes([]);
    setVocabulary(foods);
  };

  const read = async () => {
    setBusy(true);
    setError(null);
    model.clearError();
    try {
      const [found, foods] = await Promise.all([load ? load(url) : importFromUrl({ data: { url } }), fetchFoods()]);
      showReview(found, foods);
      setDuplicate(findDuplicate ? await findDuplicate(found.url) : null);
      model.readWithModel(found, foods);
    } catch (cause) {
      setError(messageFrom(cause));
    } finally {
      setBusy(false);
    }
  };

  // A shared address is read as soon as the stage mounts: the share already
  // said which page, so asking for "Read the page" again would be a second
  // tap for nothing. Once only, whatever the address later becomes.
  const readShared = useRef(initialUrl !== null && initialUrl !== "");
  useEffect(() => {
    if (!readShared.current) return;
    readShared.current = false;
    void read();
  });

  /**
   * Pasted text through `claude -p`, onto the same review. A failed
   * read — no binary, a timeout, an answer that was not a recipe — is shown
   * here and nothing is written, which is true of every rung above it too.
   */
  const readText = async () => {
    setBusy(true);
    setError(null);
    try {
      const [found, foods] = await Promise.all([loadText ? loadText(text) : importFromText({ data: { text, sourceUrl: "" } }), fetchFoods()]);
      showReview(found, foods);
      setDuplicate(findDuplicateByName ? await findDuplicateByName(found.recipe.name) : null);
    } catch (cause) {
      setError(messageFrom(cause));
    } finally {
      setBusy(false);
    }
  };

  /** One recipe out of an upload, onto the same review the URL import uses. */
  const chooseUploaded = async (recipe: FileRecipe, foods: readonly FoodRow[]) => {
    const reviewed = reviewOfUpload(recipe, units, foods);
    setImported(reviewed.imported);
    setRows(reviewed.rows);
    setRowSteps(reviewed.rowSteps);
    setSubRecipes(reviewed.subRecipeNames);
    setDuplicate(findDuplicateByName ? await findDuplicateByName(recipe.name) : null);
  };

  const readFile = async () => {
    if (file === null) return;
    setBusy(true);
    setError(null);
    try {
      const [found, foods] = await Promise.all([(loadFile ?? postImportFile)(file), fetchFoods()]);
      if (found.length === 0) throw new Error("No recipe in that file");
      setVocabulary(foods);
      if (found.length === 1) await chooseUploaded(found[0]!, foods);
      else setChoices(found);
    } catch (cause) {
      setError(messageFrom(cause));
    } finally {
      setBusy(false);
    }
  };

  /** Create only what the reviewer approved, then hand the draft up. */
  const create = async () => {
    if (imported === null) return;
    setBusy(true);
    setError(null);
    try {
      const draft = await draftFromReview({ imported, rows, rowSteps, subRecipes, tags, linkSubRecipeFood });
      onDraft(draft, imported.recipe.image);
    } catch (cause) {
      setBusy(false);
      setError(messageFrom(cause));
    }
  };

  /** Ask the model again after a failed read, against the vocabulary the first pass used. */
  const retryRead = () => {
    if (imported !== null) model.readWithModel(imported, vocabulary);
  };

  /** Take the rejected answer anyway. */
  const useRejected = () => {
    if (imported === null) return;
    const taken = withRejectedAnswer(imported);
    setImported(taken);
    setRows(reviewRows(review.ingredientLines(taken.recipe), { units, foods: vocabulary }));
  };

  /** One recipe out of a backup, by its place in the picker. */
  const pickUploaded = (index: number) => {
    const recipe = choices?.[index];
    if (recipe) void chooseUploaded(recipe, vocabulary);
  };

  /** Back from the review to the source it came from. */
  const leaveReview = () => {
    setImported(null);
    setRowSteps(null);
    setSubRecipes([]);
    setDuplicate(null);
    setError(null);
    model.reset();
  };

  /** Back from the picker to the file stage. */
  const leavePicker = () => {
    setChoices(null);
    setError(null);
  };

  /** Back from any source stage to the chooser. */
  const leaveSource = () => {
    setError(null);
    onChoose(null);
  };

  const changeText = (next: string) => {
    setText(next);
    setError(null);
  };

  const changeFile = (next: File | null) => {
    setFile(next);
    setError(null);
  };

  return {
    url,
    text,
    file,
    choices,
    imported,
    rows,
    busy,
    error,
    duplicate,
    reading: model.reading,
    readError: model.readError,
    setUrl,
    setRows,
    changeText,
    changeFile,
    read,
    readText,
    readFile,
    create,
    retryRead,
    useRejected,
    pickUploaded,
    leaveReview,
    leavePicker,
    leaveSource,
  };
}
