import { type ParsedRecipeInput, recipeInputSchema } from "../recipe";
import type { RecipeDraft } from "./types";

/** Field path ("name", "parts.0.name") to its first error message. */
export type FieldErrors = Record<string, string>;

export type ValidationResult = { ok: true; data: ParsedRecipeInput } | { ok: false; errors: FieldErrors };

/** A friendlier line for the errors a person can actually cause here. */
export function messageFor(path: string, code: string, fallback: string): string {
  if (path === "name" && code === "too_small") return "Name is required";
  if ((path === "prepTime" || path === "performTime") && code === "invalid_type") return "Enter whole minutes";
  if ((path === "prepTime" || path === "performTime") && code === "too_small") return "Minutes cannot be negative";
  if ((path === "prepTime" || path === "performTime") && code === "invalid_format") return "Enter whole minutes";
  if (path === "recipeYieldQuantity" && code === "too_small") return "Yield cannot be negative";
  if (path === "recipeServings" && code === "too_small") return "Servings cannot be negative";
  return fallback;
}

/** Parse the draft with `recipeInputSchema`; either the document to send or one message per failing field. Pure. */
export function validateDraft(draft: RecipeDraft): ValidationResult {
  const result = recipeInputSchema.safeParse(draft);
  if (result.success) return { ok: true, data: result.data };
  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const path = issue.path.map(String).join(".");
    if (!(path in errors)) errors[path] = messageFor(path, issue.code, issue.message);
  }
  return { ok: false, errors };
}
