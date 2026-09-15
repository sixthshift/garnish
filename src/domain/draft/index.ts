// draft: a module. This index is its whole surface; nothing outside the folder
// imports anything else in it (test/modules.test.ts).
//
// A recipe as it is being edited, before it is a document: the draft types,
// every update to one, validation, JSON in and out, the vocabulary the editor
// reads, and a draft from an import.

export { draftFromInput, draftFromRecipe, emptyDraft, hasDetails, isDirty } from "./draft";
export {
  addIngredient,
  ingredientSummary,
  isTextOnly,
  moveIngredient,
  moveIngredientTo,
  newIngredient,
  removeIngredient,
  textOnlyPatch,
  updateIngredient,
  withIngredientReplaced,
  withIngredients,
} from "./ingredients";
export { draftFromJson, draftToJson } from "./json";
export {
  linkableIngredients,
  linkedIngredients,
  linkIngredient,
  stepLinks,
  suggestPartLinks,
  unionLinks,
  unlinkIngredient,
  unlinkStepIngredient,
} from "./links";
export { addNote, moveNote, newNote, removeNote, updateNote } from "./notes";
export { addPart, hasContent, ingredientLine, isBare, movePart, newPart, removePart, renamePart } from "./parts";
export type { IngredientReview } from "./review";
export {
  addReviewedIngredients,
  applyParsedRows,
  needsParseAll,
  parseAllRows,
  parsedRowPatch,
  parseRowFor,
  reviewedIngredient,
  unparsedIndices,
} from "./review";
export { draftFromScraped } from "./scraped";
export {
  addBulkSteps,
  addStep,
  canSplitAll,
  insertStepAbove,
  insertStepBelow,
  mergeAllSteps,
  mergeStepWithNext,
  moveStep,
  newStep,
  removeStep,
  setStepImage,
  splitAllSteps,
  splitStepByParagraph,
  stepsOf,
  stepsPath,
  updateStep,
  withStepReplaced,
  withSteps,
} from "./steps";
export type { DraftIngredient, DraftNote, DraftPart, RecipeDraft } from "./types";
export type { FieldErrors } from "./validate";
export { validateDraft } from "./validate";
export { filterUnits, foodReference, matchUnit, parseQuantity, quantityText, tagsFromNames, unitReference } from "./vocabulary";
