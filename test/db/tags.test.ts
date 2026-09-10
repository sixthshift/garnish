import type { Database } from "bun:sqlite";
import { beforeEach, expect, test } from "vitest";
import { migrate, openDatabase } from "../../src/db/migrate";
import { tags, type TagRepository } from "../../src/db/tags";

let db: Database;
let repo: TagRepository;
beforeEach(async () => {
  db = openDatabase(":memory:");
  await migrate(db);
  repo = tags(db);
});

test("create derives the slug from the name and de-duplicates slugs", () => {
  const weeknight = repo.create({ name: "Week Night" });
  expect(weeknight).toEqual({ id: weeknight.id, name: "Week Night", slug: "week-night" });
  // Different name, same slug: names are unique but slugs need a suffix.
  expect(repo.create({ name: "Week-Night!" }).slug).toBe("week-night-2");
  expect(repo.create({ name: "???" }).slug).toBe("untitled");
  expect(repo.list().map((t) => t.name)).toEqual(["???", "Week Night", "Week-Night!"]);
  expect(repo.getBySlug("week-night")).toEqual(weeknight);
  expect(repo.getBySlug("nope")).toBeNull();
});

test("names collide case-insensitively; findOrCreate returns the match", () => {
  const weeknight = repo.create({ name: "Weeknight" });
  expect(() => repo.create({ name: "weeknight" })).toThrow(/UNIQUE/);
  expect(repo.findOrCreate("WEEKNIGHT")).toEqual(weeknight);
  expect(repo.findOrCreate("Dessert")).toMatchObject({ name: "Dessert", slug: "dessert" });
  expect(repo.list()).toHaveLength(2);
});

test("update renames, refreshes the slug and keeps its own slug when unchanged", () => {
  const tag = repo.create({ name: "Weeknight" });
  expect(repo.update(tag.id, { name: "Weeknight" })).toEqual(tag);
  expect(repo.update(tag.id, { name: "Quick Dinner" })).toEqual({ id: tag.id, name: "Quick Dinner", slug: "quick-dinner" });
  expect(repo.update("missing", { name: "x" })).toBeNull();
});

test("remove cascades recipe_tag links and leaves recipes alone", () => {
  const tag = repo.create({ name: "Weeknight" });
  db.run("INSERT INTO recipe (id, slug, name) VALUES ('r', 'r', 'R')");
  db.run("INSERT INTO recipe_tag (recipe_id, tag_id) VALUES ('r', ?)", [tag.id]);
  expect(repo.remove(tag.id)).toBe(true);
  expect(repo.remove(tag.id)).toBe(false);
  expect(db.query<{ n: number }, []>("SELECT count(*) AS n FROM recipe_tag").get()?.n).toBe(0);
  expect(db.query<{ n: number }, []>("SELECT count(*) AS n FROM recipe").get()?.n).toBe(1);
});

test("list with q filters by case-insensitive substring", () => {
  repo.create({ name: "Dinner" });
  repo.create({ name: "Weeknight dinner" });
  repo.create({ name: "Dessert" });
  expect(repo.list("DINNER").map((t) => t.name)).toEqual(["Dinner", "Weeknight dinner"]);
  expect(repo.list().map((t) => t.name)).toEqual(["Dessert", "Dinner", "Weeknight dinner"]);
  expect(repo.list("lunch")).toEqual([]);
});
