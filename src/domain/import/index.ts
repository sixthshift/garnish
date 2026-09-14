// The import module. Its job in one sentence: turn what a source hands over
// into an `ImportedRecipe`, and check it. A source is a web page, a paste, or
// another app's export file; the module does not care which, and the review
// screen that receives the result does not have to.
//
// This file is the module's whole surface. Everything not exported here —
// the JSON-LD and OpenGraph readers, the zip reader, the schema.org field
// parsers — is internal, and nothing outside `src/domain/import` imports it
// (`test/modules.test.ts` holds that line). Tests of internals live in
// `test/domain/import` and may reach in.

// The contract every source produces, and the result the review receives.
export type { ImportedRecipe, ImportSource } from "./result";
export type { ScrapedPart, ScrapedRecipe } from "./scraped";
export { ingredientLines, normaliseScraped, ScrapedPartSchema, ScrapedRecipeSchema } from "./scraped";

// A page in, a result out. The fetch is the caller's; everything after it is here.
export { extractRecipe } from "./extract";
export { looksLikeHtml, MAX_PAGE_TEXT, readableText } from "./page/text";

// Another app's export file in, review rows out.
export { IMPORT_FIELD, type ImportFile, type MealieRecipe, reviewRowsFromMealie } from "./sources/mealie";
export { type FileRecipe, isTandoorRecipe, readExport, reviewRowsFromTandoor, type TandoorRecipe } from "./sources/tandoor";

// The model's answer against its anchor.
export { checkAgainstAnchor, type ImportCheck } from "./check";
