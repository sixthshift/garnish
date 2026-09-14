// The module's second face: what the review screen needs to show a result and
// build its rows. Pure, and separate from the importer on purpose — the
// importer turns a source into a result; this turns a result into the review's
// rows. Reached as `review.*` from the index.
export { ingredientLines } from "./scraped";
export { reviewRowsFromMealie as rowsFromMealie } from "./sources/mealie";
export { isTandoorRecipe as isTandoor, reviewRowsFromTandoor as rowsFromTandoor } from "./sources/tandoor";
