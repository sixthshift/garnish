// The bottom rung of the import (M34.5, decisions.md row 74): hand the text to
// `claude -p` and let it do what no rule can — read a recipe out of prose.
//
// It sits under the two rules-based rungs in `recipeImport.ts`, not over them.
// A page with `ld+json` is read by `schema`, a page with OpenGraph tags by
// `stub`, and both are free, instant and deterministic. This one costs a
// subscription turn and takes seconds, so it is what you reach for when the
// page had nothing structured in it, or when what you have is not a page at
// all: the block of text off a photograph, an email, a book you typed out.
//
// Three rules hold it in place:
//
//   nothing is written    the answer lands on the same M17.5 review the URL
//                         import uses. Claude proposes; the household approves.
//   nothing is trusted    the answer is parsed through `ScrapedRecipeSchema`
//                         like any other untrusted input. A malformed answer
//                         is reported on the import screen, never saved.
//   nothing is assumed    the option only exists when the `claude` binary is
//                         on the path. In the container it is not, until a
//                         `claude setup-token` is injected (decision 12), and
//                         a button that always fails is worse than no button.
//
// It runs on a subscription through the CLI rather than the Agent SDK, which
// is API-key only (decision 11). The command shape lives in `claudeArgs` and
// nowhere else, so the day a flag changes there is one line to change.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { normaliseScraped, type ScrapedRecipe, ScrapedRecipeSchema } from "../domain/schemaRecipe";
import { notFoundMiddleware } from "./fn";
import type { ImportedRecipe } from "./recipeImport";

/** How long a read is given before the process is killed. A recipe answers in seconds; a minute is the outer bound. */
export const AI_IMPORT_TIMEOUT_MS = 60_000;

/** The most text worth sending. A recipe is a page; anything past this is a book, and it would only cost tokens. */
export const MAX_AI_TEXT = 40_000;

/** The binary this rung shells out to. */
export const CLAUDE_BINARY = "claude";

/** Why the AI rung did not produce a recipe. The screen shows `message`; the kind is what a test asserts on. */
export type AiFailure = "unavailable" | "timeout" | "failed" | "malformed";

/** A failed read, carrying which of the four ways it failed. Never a partial write: nothing is written here at all. */
export class AiImportError extends Error {
  readonly kind: AiFailure;
  constructor(kind: AiFailure, message: string) {
    super(message);
    this.name = "AiImportError";
    this.kind = kind;
  }
}

/**
 * `ScrapedRecipe` as a JSON Schema for `--json-schema`, written out rather
 * than generated: the CLI hands it to structured output, which wants every
 * property named, every one required, and no extras, and a generated schema
 * carries zod's defaults and optionality into a place that does not want them.
 * `test/server/aiImport.test.ts` holds it to the zod schema's shape so the two
 * cannot drift.
 */
export const SCRAPED_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["name", "description", "image", "servings", "yieldText", "prepMinutes", "cookMinutes", "tags", "ingredients", "parts"],
  properties: {
    name: { type: "string" },
    description: { type: "string" },
    image: { type: ["string", "null"] },
    servings: { type: "number" },
    yieldText: { type: "string" },
    prepMinutes: { type: ["number", "null"] },
    cookMinutes: { type: ["number", "null"] },
    tags: { type: "array", items: { type: "string" } },
    ingredients: { type: "array", items: { type: "string" } },
    parts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "steps"],
        properties: { name: { type: "string" }, steps: { type: "array", items: { type: "string" } } },
      },
    },
  },
} as const;

/**
 * What Claude is asked. The fields are described in the app's own terms
 * because the schema only gives their types: an empty string is "the text did
 * not say", ingredient lines are copied verbatim for `parseIngredient` to read
 * (row 47), and a named section is a part, as row 59 already has the URL
 * import treat a `HowToSection`. Pure.
 */
export function aiPrompt(text: string): string {
  return [
    "Read the recipe out of the text below and answer with JSON matching the schema. Rules:",
    "- Copy ingredient lines verbatim, one per line, quantity and unit and all. Do not convert, round or reword them.",
    "- `parts`: a named section of the recipe (a sauce, a topping) is a part with that name; everything else goes in the part named \"\" (empty), which is the main body. Steps are that part's method, one entry per step, without numbering.",
    "- `servings` is a number and 0 when the text does not say. `yieldText` is what it makes without the count (\"biscuits\", \"loaf\"), empty when the yield was only a number.",
    "- `prepMinutes` and `cookMinutes` are whole minutes or null. `image` is a URL found in the text or null.",
    "- `tags` are short topic words the text itself gives. Do not invent any.",
    "- Never invent an ingredient, a step, a time or a quantity. What is not in the text is empty, 0 or null.",
    "- Answer with the JSON only.",
    "",
    "TEXT:",
    text,
  ].join("\n");
}

/**
 * The whole command, in one place. `-p` prints and exits, `--output-format
 * json` wraps the answer in an envelope so a failure is legible instead of
 * being mistaken for prose, and `--json-schema` makes the answer structured
 * rather than hopefully-structured. Pure.
 */
export function claudeArgs(text: string): string[] {
  return ["-p", aiPrompt(text), "--output-format", "json", "--json-schema", JSON.stringify(SCRAPED_JSON_SCHEMA)];
}

/** What running the binary gave back. The shape a test fakes. */
export type AiRunResult = { exitCode: number; stdout: string; stderr: string };

/** How the binary is run. Injectable so a test can answer with a fixture, or with garbage. */
export type AiRunner = (args: readonly string[], timeoutMs: number) => Promise<AiRunResult>;

/** The path to the `claude` binary, or null when it is not installed. */
export function claudePath(): string | null {
  return Bun.which(CLAUDE_BINARY);
}

/**
 * The default runner: the binary, with the deadline enforced by the kernel
 * rather than by hope. `Bun.$` has no timeout of its own — a hung read would
 * leave a `claude` process holding a session for as long as the app lives — so
 * this uses the spawn underneath it, which does (decisions.md row 74).
 */
export const spawnRunner: AiRunner = async (args, timeoutMs) => {
  const path = claudePath();
  if (path === null) throw new AiImportError("unavailable", "The claude command is not installed here.");
  const child = Bun.spawn([path, ...args], { stdout: "pipe", stderr: "pipe", timeout: timeoutMs, killSignal: "SIGKILL" });
  const [stdout, stderr] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text()]);
  const exitCode = await child.exited;
  return { exitCode, stdout, stderr };
};

/** The envelope `--output-format json` prints, read defensively: it grows fields between versions. */
type Envelope = { is_error?: unknown; subtype?: unknown; result?: unknown; structured_output?: unknown };

/** A ```json fence off an answer that came back as prose despite the schema. Pure. */
export function stripFence(text: string): string {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*\n([\s\S]*?)\n?```$/.exec(trimmed);
  return fenced === null ? trimmed : fenced[1]!.trim();
}

/**
 * The recipe out of the CLI's stdout: the envelope's `structured_output` when
 * the schema was honoured, else its `result` text, else the whole of stdout
 * for a version that prints the answer bare. Throws `AiImportError` for
 * anything that is not a recipe. Pure.
 */
export function parseAiAnswer(stdout: string): ScrapedRecipe {
  const raw = stripFence(stdout);
  if (raw === "") throw new AiImportError("malformed", "Claude answered with nothing.");

  let envelope: unknown;
  try {
    envelope = JSON.parse(raw);
  } catch {
    throw new AiImportError("malformed", "Claude's answer was not JSON, so nothing was imported.");
  }

  let answer: unknown = envelope;
  if (typeof envelope === "object" && envelope !== null && ("result" in envelope || "structured_output" in envelope)) {
    const wrapper = envelope as Envelope;
    if (wrapper.is_error === true || (typeof wrapper.subtype === "string" && wrapper.subtype !== "success")) {
      throw new AiImportError("failed", typeof wrapper.result === "string" && wrapper.result !== "" ? wrapper.result : "Claude could not read that.");
    }
    if (wrapper.structured_output !== undefined && wrapper.structured_output !== null) answer = wrapper.structured_output;
    else if (typeof wrapper.result === "string") {
      try {
        answer = JSON.parse(stripFence(wrapper.result));
      } catch {
        throw new AiImportError("malformed", "Claude answered in prose rather than the recipe format, so nothing was imported.");
      }
    } else answer = wrapper.result;
  }

  const parsed = ScrapedRecipeSchema.safeParse(answer);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const where = first && first.path.length > 0 ? ` (${first.path.join(".")}: ${first.message})` : "";
    throw new AiImportError("malformed", `Claude's answer was not in the expected shape${where}. Nothing was imported.`);
  }
  const recipe = normaliseScraped(parsed.data);
  if (recipe.name === "" && recipe.ingredients.length === 0) {
    throw new AiImportError("malformed", "Claude found no recipe in that text.");
  }
  return recipe;
}

/** What the paste screen sends and gets back: the same `ImportedRecipe` the URL import produces, from the `ai` rung. */
export async function runAiImport(text: string, options: { run?: AiRunner; sourceUrl?: string } = {}): Promise<ImportedRecipe> {
  const { run = spawnRunner, sourceUrl = "" } = options;
  const body = text.trim();
  if (body === "") throw new AiImportError("failed", "Paste the recipe first.");
  if (body.length > MAX_AI_TEXT) throw new AiImportError("failed", "That is too much text to read in one go. Paste one recipe at a time.");

  let result: AiRunResult;
  try {
    result = await run(claudeArgs(body), AI_IMPORT_TIMEOUT_MS);
  } catch (cause) {
    if (cause instanceof AiImportError) throw cause;
    throw new AiImportError("failed", `The claude command could not be run: ${cause instanceof Error ? cause.message : String(cause)}`);
  }
  // A killed process is the deadline: SIGKILL exits 137 and prints nothing.
  if (result.exitCode !== 0 && result.stdout.trim() === "") {
    const detail = result.stderr.trim().split("\n").slice(-1)[0] ?? "";
    if (result.exitCode === 137 || result.exitCode === 143) throw new AiImportError("timeout", "Claude took too long to answer. Try a shorter paste.");
    throw new AiImportError("failed", detail === "" ? `The claude command failed (exit ${result.exitCode}).` : detail);
  }
  return { from: "ai", url: sourceUrl, recipe: parseAiAnswer(result.stdout) };
}

// --- Server functions ------------------------------------------------------

/**
 * Whether the AI rung can run at all, for the chooser and the Settings note.
 * Read on the server every time rather than cached: installing the CLI in the
 * container should not need the app restarted.
 */
export const aiImportAvailable = createServerFn({ method: "GET" })
  .middleware([notFoundMiddleware])
  .handler(() => ({ available: claudePath() !== null }));

export const ImportFromTextInput = z.object({
  text: z.string().trim().min(1),
  /** The address the text came from, when it came from one; becomes the recipe's `sourceUrl`. */
  sourceUrl: z.string().trim().default(""),
});

/** Read a recipe out of pasted text with `claude -p`. Nothing is written: the caller reviews it first. */
export const importFromText = createServerFn({ method: "POST" })
  .middleware([notFoundMiddleware])
  .validator(ImportFromTextInput)
  .handler(async ({ data }) => runAiImport(data.text, { sourceUrl: data.sourceUrl }));
