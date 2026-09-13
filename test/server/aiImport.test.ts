// The AI import rung (M34.5, decisions.md row 74): the command shape, the
// answer parser, and the whole read against an injected runner. The binary is
// never actually run here — a test that spends a subscription turn is not a
// test — so every case drives `runAiImport` with a fake runner.
import { describe, expect, test } from "vitest";
import {
  AI_IMPORT_TIMEOUT_MS,
  aiPrompt,
  AiImportError,
  type AiRunner,
  claudeArgs,
  claudePath,
  ImportFromTextInput,
  MAX_AI_TEXT,
  parseAiAnswer,
  runAiImport,
  SCRAPED_JSON_SCHEMA,
  stripFence,
} from "../../src/server/aiImport";
import { aiImportAvailable, importFromText } from "../../src/server/aiImport";
import { ScrapedRecipeSchema } from "../../src/domain/schemaRecipe";
import { callServerFn, useTempDataDir } from "../helpers/server";

useTempDataDir();

/** What a good answer looks like: the CLI's envelope around a structured recipe. */
const FIXTURE = {
  name: "Anzac biscuits",
  description: "A family recipe.",
  image: null,
  servings: 24,
  yieldText: "biscuits",
  prepMinutes: 20,
  cookMinutes: 15,
  tags: ["biscuits"],
  ingredients: ["1 cup plain flour", "125 g butter"],
  parts: [
    { name: "", steps: ["Mix the dry ingredients.", "Bake for 15 minutes."] },
    { name: "Golden syrup mixture", steps: ["Melt the butter and syrup."] },
  ],
};

const envelope = (over: Record<string, unknown> = {}): string =>
  JSON.stringify({ type: "result", subtype: "success", is_error: false, result: JSON.stringify(FIXTURE), structured_output: FIXTURE, ...over });

/** A runner that answers with `stdout` and records what it was asked to run. */
function fakeRunner(stdout: string, over: { exitCode?: number; stderr?: string } = {}): AiRunner & { calls: { args: readonly string[]; timeoutMs: number }[] } {
  const calls: { args: readonly string[]; timeoutMs: number }[] = [];
  const run = (async (args, timeoutMs) => {
    calls.push({ args, timeoutMs });
    return { stdout, exitCode: over.exitCode ?? 0, stderr: over.stderr ?? "" };
  }) as AiRunner & { calls: typeof calls };
  run.calls = calls;
  return run;
}

describe("the command", () => {
  test("is `claude -p` with a JSON envelope and the schema, in one place", () => {
    const args = claudeArgs("Anzac biscuits\n1 cup flour");
    expect(args[0]).toBe("-p");
    expect(args[1]).toContain("Anzac biscuits");
    expect(args.slice(2)).toEqual(["--output-format", "json", "--json-schema", JSON.stringify(SCRAPED_JSON_SCHEMA)]);
  });

  test("the prompt carries the text and the rules that keep the answer honest", () => {
    const prompt = aiPrompt("some prose");
    expect(prompt).toContain("some prose");
    expect(prompt).toMatch(/verbatim/);
    expect(prompt).toMatch(/Never invent/);
  });

  test("the JSON Schema names exactly the fields the zod schema does, and requires all of them", () => {
    const zodKeys = Object.keys(ScrapedRecipeSchema.shape).sort();
    expect(Object.keys(SCRAPED_JSON_SCHEMA.properties).sort()).toEqual(zodKeys);
    expect([...SCRAPED_JSON_SCHEMA.required].sort()).toEqual(zodKeys);
    expect(SCRAPED_JSON_SCHEMA.additionalProperties).toBe(false);
  });

  test("the deadline is a minute", () => {
    expect(AI_IMPORT_TIMEOUT_MS).toBe(60_000);
  });
});

describe("stripFence", () => {
  test("takes a fenced answer down to its JSON and leaves a bare one alone", () => {
    expect(stripFence('```json\n{"a":1}\n```')).toBe('{"a":1}');
    expect(stripFence('```\n{"a":1}\n```')).toBe('{"a":1}');
    expect(stripFence('  {"a":1} ')).toBe('{"a":1}');
  });
});

describe("parseAiAnswer", () => {
  test("reads the structured answer out of the envelope", () => {
    const recipe = parseAiAnswer(envelope());
    expect(recipe.name).toBe("Anzac biscuits");
    expect(recipe.ingredients).toEqual(["1 cup plain flour", "125 g butter"]);
    expect(recipe.parts.map((part) => part.name)).toEqual(["", "Golden syrup mixture"]);
  });

  test("falls back to the envelope's result text, fenced or not", () => {
    const recipe = parseAiAnswer(JSON.stringify({ type: "result", subtype: "success", result: "```json\n" + JSON.stringify(FIXTURE) + "\n```" }));
    expect(recipe.name).toBe("Anzac biscuits");
  });

  test("accepts a bare answer from a version that prints no envelope", () => {
    expect(parseAiAnswer(JSON.stringify(FIXTURE)).servings).toBe(24);
  });

  test("fills what the answer left out, and always has a main body", () => {
    const recipe = parseAiAnswer(JSON.stringify({ name: "Toast", ingredients: ["bread"] }));
    expect(recipe).toEqual({
      name: "Toast",
      description: "",
      image: null,
      servings: 0,
      yieldText: "",
      prepMinutes: null,
      cookMinutes: null,
      tags: [],
      ingredients: ["bread"],
      parts: [{ name: "", steps: [] }],
    });
  });

  test("a CLI error in the envelope is reported as a failure, not parsed", () => {
    const caught = (() => {
      try {
        parseAiAnswer(JSON.stringify({ type: "result", subtype: "error_during_execution", is_error: true, result: "Credit balance too low" }));
      } catch (cause) {
        return cause;
      }
    })();
    expect(caught).toBeInstanceOf(AiImportError);
    expect((caught as AiImportError).kind).toBe("failed");
    expect((caught as Error).message).toContain("Credit balance too low");
  });

  test("garbage, prose and the wrong shape are all malformed", () => {
    for (const stdout of [
      "not json at all",
      "",
      JSON.stringify({ type: "result", subtype: "success", result: "Sorry, I could not find a recipe." }),
      JSON.stringify({ name: 42, ingredients: "flour" }),
      JSON.stringify({ description: "no name" }),
    ]) {
      const caught = (() => {
        try {
          parseAiAnswer(stdout);
        } catch (cause) {
          return cause;
        }
      })();
      expect(caught, stdout).toBeInstanceOf(AiImportError);
      expect((caught as AiImportError).kind, stdout).toBe("malformed");
    }
  });

  test("an answer with nothing in it is a miss rather than an empty recipe", () => {
    expect(() => parseAiAnswer(JSON.stringify({ name: "", ingredients: [], parts: [] }))).toThrow(/no recipe/i);
  });
});

describe("runAiImport", () => {
  test("with the runner injected, a fixture comes back as an importable recipe from the `ai` rung", async () => {
    const run = fakeRunner(envelope());
    const imported = await runAiImport("Anzac biscuits\n1 cup plain flour\nMix and bake.", { run });
    expect(imported.from).toBe("ai");
    expect(imported.url).toBe("");
    expect(imported.recipe.name).toBe("Anzac biscuits");
    expect(run.calls).toHaveLength(1);
    expect(run.calls[0]!.timeoutMs).toBe(AI_IMPORT_TIMEOUT_MS);
    expect(run.calls[0]!.args[1]).toContain("Anzac biscuits");
  });

  test("a source URL is carried through so the draft keeps it", async () => {
    const imported = await runAiImport("text", { run: fakeRunner(envelope()), sourceUrl: "https://example.test/x" });
    expect(imported.url).toBe("https://example.test/x");
  });

  test("a malformed answer is reported, and nothing about it looks like a recipe", async () => {
    const caught = await runAiImport("text", { run: fakeRunner(envelope({ structured_output: null, result: "here is your recipe!" })) }).catch(
      (cause: unknown) => cause,
    );
    expect(caught).toBeInstanceOf(AiImportError);
    expect((caught as AiImportError).kind).toBe("malformed");
    expect((caught as Error).message).toMatch(/nothing was imported/i);
  });

  test("a missing binary is an unavailable error rather than a crash", async () => {
    const run: AiRunner = () => Promise.reject(new AiImportError("unavailable", "The claude command is not installed here."));
    const caught = await runAiImport("text", { run }).catch((cause: unknown) => cause);
    expect(caught).toBeInstanceOf(AiImportError);
    expect((caught as AiImportError).kind).toBe("unavailable");
  });

  test("a killed process is the deadline, and a plain failure carries the last line of stderr", async () => {
    const killed = await runAiImport("text", { run: fakeRunner("", { exitCode: 137, stderr: "" }) }).catch((cause: unknown) => cause);
    expect((killed as AiImportError).kind).toBe("timeout");
    const failed = await runAiImport("text", { run: fakeRunner("", { exitCode: 1, stderr: "warming up\nNot logged in" }) }).catch((c: unknown) => c);
    expect((failed as AiImportError).kind).toBe("failed");
    expect((failed as Error).message).toBe("Not logged in");
  });

  test("empty and oversized pastes never reach the runner", async () => {
    const run = fakeRunner(envelope());
    await expect(runAiImport("   ", { run })).rejects.toThrow(/Paste the recipe/);
    await expect(runAiImport("x".repeat(MAX_AI_TEXT + 1), { run })).rejects.toThrow(/too much text/);
    expect(run.calls).toHaveLength(0);
  });
});

describe("the server functions", () => {
  test("availability follows Bun.which", async () => {
    await expect(callServerFn(aiImportAvailable)).resolves.toEqual({ available: claudePath() !== null });
  });

  test("a blank paste is refused by the validator, before any process is started", async () => {
    await expect(callServerFn(importFromText, { text: "   " } as never)).rejects.toThrow(/too_small|at least 1/);
    expect(ImportFromTextInput.parse({ text: " hi " })).toEqual({ text: "hi", sourceUrl: "" });
  });
});
