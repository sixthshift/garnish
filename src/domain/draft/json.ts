// A draft as JSON and back (the editor's JSON tab).
import { recipeInputSchema } from "../recipe";
import { draftFromInput } from "./draft";
import type { RecipeDraft } from "./types";

/** The draft as the document text the JSON view shows: the write shape, indented, key order as written. Pure. */
export function draftToJson(draft: RecipeDraft): string {
  return `${JSON.stringify(draft, null, 2)}\n`;
}

export type JsonResult = { ok: true; draft: RecipeDraft } | { ok: false; error: string };

/** Text from the JSON view back to a draft: a syntax error or the failing field paths come back as one message. Pure apart from any ids it fills in. */
export function draftFromJson(text: string): JsonResult {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    return { ok: false, error: `That is not valid JSON: ${error instanceof Error ? error.message : String(error)}` };
  }
  const result = recipeInputSchema.safeParse(value);
  if (!result.success) {
    const lines = result.error.issues.slice(0, 5).map((issue) => `${issue.path.map(String).join(".") || "(root)"}: ${issue.message}`);
    const extra = result.error.issues.length - lines.length;
    return { ok: false, error: extra > 0 ? `${lines.join("; ")} (and ${extra} more)` : lines.join("; ") };
  }
  return { ok: true, draft: draftFromInput(result.data) };
}
