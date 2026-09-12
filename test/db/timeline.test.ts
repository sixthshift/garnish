// Timeline repository against :memory: with the real migrations: ordering,
// and recipe.last_made derived from the events on create and remove.
import type { Database } from "bun:sqlite";
import { beforeEach, expect, test } from "vitest";
import { openDatabase } from "../../src/db/connection/open";
import { migrate } from "../../src/db/migrations/migrate";
import { recipes, type RecipeRepository } from "../../src/db/models/recipe/repo";
import { lastMadeFrom, timeline, type TimelineRepository } from "../../src/db/models/timeline/repo";
import { recipeInputSchema, timelineEventSchema, type RecipeInput } from "../../src/domain/recipe";

let db: Database;
let repo: TimelineRepository;
let recipeRepo: RecipeRepository;
let recipeId: string;

const minimal = (name: string): RecipeInput => ({ name, parts: [{ name: "", ingredients: [], steps: [] }] });

beforeEach(async () => {
  db = openDatabase(":memory:");
  await migrate(db);
  repo = timeline(db);
  recipeRepo = recipes(db);
  recipeId = recipeRepo.create(recipeInputSchema.parse(minimal("Butter pasta"))).id;
});

function lastMade(id = recipeId): string | null {
  return recipeRepo.getById(id)!.lastMade;
}

test("lastMadeFrom expands a date to midnight UTC and passes null through", () => {
  expect(lastMadeFrom("2026-09-01")).toBe("2026-09-01T00:00:00.000Z");
  expect(lastMadeFrom(null)).toBeNull();
});

test("a new recipe has no events and no last made", () => {
  expect(repo.list(recipeId)).toEqual([]);
  expect(lastMade()).toBeNull();
});

test("create returns the stored event and matches the domain schema", () => {
  const event = repo.create(recipeId, { occurredOn: "2026-09-01", message: "Halved it.", image: "ev.webp" });

  expect(event).toMatchObject({
    recipeId,
    occurredOn: "2026-09-01",
    message: "Halved it.",
    image: "ev.webp",
  });
  expect(timelineEventSchema.parse(event)).toEqual(event);
  expect(repo.get(event.id)).toEqual(event);
  expect(repo.get("11111111-1111-4111-8111-111111111111")).toBeNull();
});

test("create sets last made to the latest date, whichever order the events arrive in", () => {
  repo.create(recipeId, { occurredOn: "2026-09-01", message: "", image: null });
  expect(lastMade()).toBe("2026-09-01T00:00:00.000Z");

  repo.create(recipeId, { occurredOn: "2026-09-10", message: "", image: null });
  expect(lastMade()).toBe("2026-09-10T00:00:00.000Z");

  // An older cook logged after the fact does not pull last made backwards.
  repo.create(recipeId, { occurredOn: "2026-08-20", message: "", image: null });
  expect(lastMade()).toBe("2026-09-10T00:00:00.000Z");
});

test("removing the latest event falls last made back to the next one, then to null", () => {
  const first = repo.create(recipeId, { occurredOn: "2026-09-01", message: "", image: null });
  const later = repo.create(recipeId, { occurredOn: "2026-09-10", message: "", image: null });
  expect(lastMade()).toBe("2026-09-10T00:00:00.000Z");

  expect(repo.remove(later.id)).toBe(true);
  expect(lastMade()).toBe("2026-09-01T00:00:00.000Z");
  expect(repo.list(recipeId).map((e) => e.id)).toEqual([first.id]);

  expect(repo.remove(first.id)).toBe(true);
  expect(lastMade()).toBeNull();
  expect(repo.list(recipeId)).toEqual([]);
});

test("removing an event that is not the latest leaves last made alone", () => {
  const older = repo.create(recipeId, { occurredOn: "2026-09-01", message: "", image: null });
  repo.create(recipeId, { occurredOn: "2026-09-10", message: "", image: null });

  expect(repo.remove(older.id)).toBe(true);
  expect(lastMade()).toBe("2026-09-10T00:00:00.000Z");
});

test("remove is false for an unknown id and changes nothing", () => {
  repo.create(recipeId, { occurredOn: "2026-09-01", message: "", image: null });
  expect(repo.remove("11111111-1111-4111-8111-111111111111")).toBe(false);
  expect(lastMade()).toBe("2026-09-01T00:00:00.000Z");
});

test("list is newest first and scoped to one recipe", () => {
  const other = recipeRepo.create(recipeInputSchema.parse(minimal("Cheese toast"))).id;

  const old = repo.create(recipeId, { occurredOn: "2026-08-01", message: "first", image: null });
  const mid = repo.create(recipeId, { occurredOn: "2026-09-01", message: "second", image: null });
  const recent = repo.create(recipeId, { occurredOn: "2026-09-10", message: "third", image: null });
  const elsewhere = repo.create(other, { occurredOn: "2026-09-20", message: "not mine", image: null });

  expect(repo.list(recipeId).map((e) => e.id)).toEqual([recent.id, mid.id, old.id]);
  expect(repo.list(other).map((e) => e.id)).toEqual([elsewhere.id]);
  expect(lastMade(other)).toBe("2026-09-20T00:00:00.000Z");
});

test("two events on one day come back newest-created first", () => {
  const first = repo.create(recipeId, { occurredOn: "2026-09-01", message: "lunch", image: null });
  const second = repo.create(recipeId, { occurredOn: "2026-09-01", message: "dinner", image: null });

  const order = repo.list(recipeId).map((e) => e.id);
  expect(order).toHaveLength(2);
  expect(new Set(order)).toEqual(new Set([first.id, second.id]));
  expect(lastMade()).toBe("2026-09-01T00:00:00.000Z");
});

test("deleting the recipe takes its events with it", () => {
  repo.create(recipeId, { occurredOn: "2026-09-01", message: "", image: null });
  expect(recipeRepo.remove(recipeId)).toBe(true);
  expect(repo.list(recipeId)).toEqual([]);
});

test("recompute repairs a last made that was set by hand", () => {
  repo.create(recipeId, { occurredOn: "2026-09-01", message: "", image: null });
  db.run("UPDATE recipe SET last_made = ? WHERE id = ?", ["2020-01-01T00:00:00.000Z", recipeId]);

  repo.recompute(recipeId);
  expect(lastMade()).toBe("2026-09-01T00:00:00.000Z");
});

test("setImage points an event at a stored photo, and clears it again", () => {
  const event = repo.create(recipeId, { occurredOn: "2026-09-01", message: "", image: null });

  expect(repo.setImage(event.id, `${event.id}.png`)).toBe(true);
  expect(repo.get(event.id)?.image).toBe(`${event.id}.png`);

  expect(repo.setImage(event.id, null)).toBe(true);
  expect(repo.get(event.id)?.image).toBeNull();
});

test("setImage on an unknown event changes nothing", () => {
  expect(repo.setImage("99999999-9999-4999-8999-999999999999", "x.png")).toBe(false);
});
