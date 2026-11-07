// A model chosen in Settings › AI comes before the environment's (decisions.md row 215).
import { afterEach, expect, test } from "vitest";
import { openDatabase } from "../../../src/db/connection/open";
import { migrate } from "../../../src/db/migrations/migrate";
import { aiSettingRepository } from "../../../src/db/models/ai/repo";
import { modelFor, readChosenModels } from "../../../src/server/ai/client";

let restore: ReturnType<typeof readChosenModels> | null = null;
afterEach(() => {
  if (restore) readChosenModels(restore);
  restore = null;
  delete process.env.AI_COOK_MODEL;
});

test("chosen, then AI_COOK_MODEL, then the provider's default", () => {
  const db = openDatabase(":memory:");
  migrate(db);
  const settings = aiSettingRepository(db);
  restore = readChosenModels((use) => settings.model(use));

  expect(modelFor("cook", "fallback")).toBe("fallback");
  process.env.AI_COOK_MODEL = "from-env";
  expect(modelFor("cook", "fallback")).toBe("from-env");
  settings.choose("cook", "chosen-here");
  expect(modelFor("cook", "fallback")).toBe("chosen-here");
  // The other uses are not chosen here.
  expect(modelFor("planner", "fallback")).toBe("fallback");
  // Default goes back to the environment.
  settings.choose("cook", null);
  expect(modelFor("cook", "fallback")).toBe("from-env");
});

test("a reader that throws is no choice", () => {
  restore = readChosenModels(() => {
    throw new Error("no database");
  });
  expect(modelFor("cook", "fallback")).toBe("fallback");
});
