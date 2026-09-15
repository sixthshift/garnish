// ingredient: a module. This index is its whole surface; nothing outside the folder
// imports anything else in it (test/modules.test.ts).
//
// The language of an ingredient line: parsing a line into quantity, unit and
// food against a vocabulary, formatting one back, and reviewing a bulk paste.

export type { Choice, CommitRef, ReviewRow, RowCommit } from "./bulkIngredients";
export { pendingCreations, reviewRow, reviewRows, rowCommit, rowStatus } from "./bulkIngredients";
export { bulkLines, paragraphs, splitOnBlankLines, stripLeadingNumbers, trimLines } from "./bulkText";
export { formatAmount, formatDuration, formatFood, formatIngredient, formatQuantity, formatYield, totalMinutes } from "./format";
export type { FoodCandidate } from "./parseFood";
export { parseIngredient } from "./parseIngredient";
export type { UnitCandidate } from "./parseUnit";
