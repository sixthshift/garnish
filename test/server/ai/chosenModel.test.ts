// A use's model: the one selected in Settings › AI, or none — no default (decisions.md row 217).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { openDatabase } from "../../../src/db/connection/open";
import { listMigrations, MIGRATIONS_DIR, migrate } from "../../../src/db/migrations/migrate";
import { aiSettingRepository } from "../../../src/db/models/ai/repo";
import { modelFor, readChosenModels, requireModel } from "../../../src/server/ai/client";
import { migratedDb } from "../../helpers/db";

let restore: ReturnType<typeof readChosenModels> | null = null;
afterEach(() => {
  if (restore) readChosenModels(restore);
  restore = null;
  delete process.env.AI_COOK_MODEL;
});

function chosen() {
  const db = migratedDb();
  const settings = aiSettingRepository(db);
  restore = readChosenModels((use) => settings.model(use));
  return settings;
}

test("the model selected, or none: there is no default to fall back on", () => {
  const settings = chosen();
  expect(modelFor("cook")).toBeNull();
  expect(() => requireModel("cook")).toThrow("No Cooking assistant model is selected. Choose one in Settings › AI.");
  settings.choose("cook", "chosen-here");
  expect(modelFor("cook")).toBe("chosen-here");
  expect(requireModel("cook")).toBe("chosen-here");
  // A model variable means nothing.
  process.env.AI_COOK_MODEL = "from-env";
  expect(modelFor("cook")).toBe("chosen-here");
  // Not selected clears it.
  settings.choose("cook", null);
  expect(modelFor("cook")).toBeNull();
});

test("every use can be selected, each on its own", () => {
  const settings = chosen();
  settings.choose("import", "a");
  settings.choose("restyle", "b");
  settings.choose("planner", "c");
  expect([modelFor("import"), modelFor("restyle"), modelFor("planner"), modelFor("cook")]).toEqual(["a", "b", "c", null]);
});

test("the cooking assistant's choice survives the table being widened (034_ai_setting_uses.sql)", () => {
  const db = openDatabase(":memory:");
  const upTo = (last: number) =>
    Object.fromEntries(
      listMigrations()
        .filter((m) => m.id <= last)
        .map((m) => [m.file, readFileSync(join(MIGRATIONS_DIR, m.file), "utf8")])
    );
  migrate(db, { sources: upTo(33) });
  db.run("INSERT INTO ai_setting (use, model) VALUES ('cook', 'kept')");
  expect(() => db.run("INSERT INTO ai_setting (use, model) VALUES ('planner', 'x')")).toThrow();
  migrate(db);
  const settings = aiSettingRepository(db);
  expect(settings.model("cook")).toBe("kept");
  settings.choose("planner", "now-allowed");
  expect(settings.model("planner")).toBe("now-allowed");
});

test("a reader that throws is no choice", () => {
  restore = readChosenModels(() => {
    throw new Error("no database");
  });
  expect(modelFor("cook")).toBeNull();
});
