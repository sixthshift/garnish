// Recipe repository. Server-only; pass the Database opened by openDatabase.
// Reads and writes exactly the document in src/domain/recipe.ts.
//
// Writes replace the whole recipe in one transaction: the recipe row is
// inserted or updated, every child row (note, component, ingredient, step,
// recipe_tag) is deleted and re-inserted from the document, positions come
// from array index. Referenced units, foods, tags and aisles are resolved by
// id, then by name (case-insensitive); a name nobody has yet is inserted so a
// document with a new tag or food saves. Existing reference rows are never
// modified by a recipe write.
import type { Database } from "bun:sqlite";
import type {
  Component,
  Food,
  Ingredient,
  ParsedRecipeInput,
  Recipe,
  RecipeNote,
  RecipeSummary,
  Step,
  Tag,
  Unit,
} from "../domain/recipe";
import { aisles as aisleRepository } from "./aisles";
import { foods as foodRepository } from "./foods";
import { slugify, uniqueSlug } from "./names";
import { tags as tagRepository } from "./tags";
import { units as unitRepository } from "./units";

export type ListFilter = {
  /** Case-insensitive substring of the recipe name. */
  q?: string;
  /** Tag slug; only recipes carrying that tag. */
  tag?: string;
};

type RecipeRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  image: string | null;
  rating: number | null;
  last_made: string | null;
  servings: number;
  yield_quantity: number;
  yield_unit_id: string | null;
  yield_text: string;
  prep_minutes: number | null;
  cook_minutes: number | null;
  source_url: string | null;
  created_at: string;
  updated_at: string;
};

type SummaryRow = Pick<RecipeRow, "id" | "slug" | "name" | "image" | "rating" | "prep_minutes" | "cook_minutes">;
type NoteRow = { id: string; title: string; text: string };
type ComponentRow = { id: string; name: string };
type IngredientRow = {
  id: string;
  component_id: string;
  quantity: number | null;
  unit_id: string | null;
  food_id: string | null;
  note: string;
  original_text: string;
  fixed: 0 | 1;
};
type StepRow = { id: string; component_id: string | null; text: string };

const RECIPE_COLUMNS =
  "id, slug, name, description, image, rating, last_made, servings, yield_quantity, yield_unit_id, yield_text, prep_minutes, cook_minutes, source_url, created_at, updated_at";
const SUMMARY_COLUMNS = "id, slug, name, image, rating, prep_minutes, cook_minutes";

export function recipes(db: Database) {
  const units = unitRepository(db);
  const foods = foodRepository(db);
  const aisles = aisleRepository(db);
  const tags = tagRepository(db);

  // --- Reads ---------------------------------------------------------------
  const selectBySlug = db.query<RecipeRow, [string]>(`SELECT ${RECIPE_COLUMNS} FROM recipe WHERE slug = ?`);
  const selectById = db.query<RecipeRow, [string]>(`SELECT ${RECIPE_COLUMNS} FROM recipe WHERE id = ?`);
  const selectTags = db.query<Tag, [string]>(
    "SELECT t.id, t.name, t.slug FROM recipe_tag rt JOIN tag t ON t.id = rt.tag_id WHERE rt.recipe_id = ? ORDER BY t.name",
  );
  const selectNotes = db.query<NoteRow, [string]>("SELECT id, title, text FROM recipe_note WHERE recipe_id = ? ORDER BY position");
  const selectComponents = db.query<ComponentRow, [string]>("SELECT id, name FROM component WHERE recipe_id = ? ORDER BY position");
  const selectIngredients = db.query<IngredientRow, [string]>(
    "SELECT i.id, i.component_id, i.quantity, i.unit_id, i.food_id, i.note, i.original_text, i.fixed FROM ingredient i JOIN component c ON c.id = i.component_id WHERE c.recipe_id = ? ORDER BY c.position, i.position",
  );
  const selectSteps = db.query<StepRow, [string]>("SELECT id, component_id, text FROM step WHERE recipe_id = ? ORDER BY position");
  const selectSummaries = db.query<SummaryRow, [string | null, string | null]>(
    `SELECT ${SUMMARY_COLUMNS} FROM recipe r
     WHERE (?1 IS NULL OR instr(lower(r.name), lower(?1)) > 0)
       AND (?2 IS NULL OR EXISTS (SELECT 1 FROM recipe_tag rt JOIN tag t ON t.id = rt.tag_id WHERE rt.recipe_id = r.id AND t.slug = ?2))
     ORDER BY r.created_at DESC, r.name COLLATE NOCASE`,
  );

  // --- Writes --------------------------------------------------------------
  const slugTaken = db.query<{ id: string }, [string, string]>("SELECT id FROM recipe WHERE slug = ? AND id <> ?");
  // name columns are COLLATE NOCASE, so `=` is the case-insensitive match.
  const unitIdByName = db.query<{ id: string }, [string]>("SELECT id FROM unit WHERE name = ?");
  const foodIdByName = db.query<{ id: string }, [string]>("SELECT id FROM food WHERE name = ?");
  const insertRecipe = db.prepare(
    "INSERT INTO recipe (id, slug, name, description, image, rating, last_made, servings, yield_quantity, yield_unit_id, yield_text, prep_minutes, cook_minutes, source_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const updateRecipe = db.prepare(
    "UPDATE recipe SET slug = ?, name = ?, description = ?, image = ?, rating = ?, last_made = ?, servings = ?, yield_quantity = ?, yield_unit_id = ?, yield_text = ?, prep_minutes = ?, cook_minutes = ?, source_url = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?",
  );
  const deleteRecipe = db.prepare("DELETE FROM recipe WHERE id = ?");
  const updateImage = db.prepare("UPDATE recipe SET image = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?");
  // Steps reference components with SET NULL, so components go after steps.
  const deleteChildren = [
    db.prepare("DELETE FROM recipe_tag WHERE recipe_id = ?"),
    db.prepare("DELETE FROM recipe_note WHERE recipe_id = ?"),
    db.prepare("DELETE FROM step WHERE recipe_id = ?"),
    db.prepare("DELETE FROM component WHERE recipe_id = ?"), // ingredients cascade
  ];
  const insertTag = db.prepare("INSERT OR IGNORE INTO recipe_tag (recipe_id, tag_id) VALUES (?, ?)");
  const insertNote = db.prepare("INSERT INTO recipe_note (id, recipe_id, position, title, text) VALUES (?, ?, ?, ?, ?)");
  const insertComponent = db.prepare("INSERT INTO component (id, recipe_id, position, name) VALUES (?, ?, ?, ?)");
  const insertIngredient = db.prepare(
    "INSERT INTO ingredient (id, component_id, position, quantity, unit_id, food_id, note, original_text, fixed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertStep = db.prepare("INSERT INTO step (id, recipe_id, component_id, position, text) VALUES (?, ?, ?, ?, ?)");

  // --- Reference resolution ------------------------------------------------
  // By id when that row exists, else by name (NOCASE), else a new row copying
  // the document's attributes. The id the caller sent is not kept for new rows.

  function resolveAisle(ref: Food["aisle"]): string | null {
    if (!ref) return null;
    return (aisles.get(ref.id) ?? aisles.findOrCreate(ref.name)).id;
  }

  function resolveUnit(ref: Unit | null): string | null {
    if (!ref) return null;
    const existing = units.get(ref.id) ?? unitIdByName.get(ref.name.trim());
    if (existing) return existing.id;
    return units.create({
      name: ref.name,
      pluralName: ref.pluralName,
      abbreviation: ref.abbreviation,
      useAbbreviation: ref.useAbbreviation,
      fraction: ref.fraction,
      standardQuantity: ref.standardQuantity,
      standardUnitId: ref.standardUnitId && units.get(ref.standardUnitId) ? ref.standardUnitId : null,
    }).id;
  }

  function resolveFood(ref: Food | null): string | null {
    if (!ref) return null;
    const existing = foods.get(ref.id) ?? foodIdByName.get(ref.name.trim());
    if (existing) return existing.id;
    return foods.create({
      name: ref.name,
      pluralName: ref.pluralName,
      aliases: ref.aliases,
      aisleId: resolveAisle(ref.aisle),
      recipeId: ref.recipeId && selectById.get(ref.recipeId) ? ref.recipeId : null,
      skipShopping: ref.skipShopping,
    }).id;
  }

  function resolveTag(ref: Tag): string {
    return (tags.get(ref.id) ?? tags.findOrCreate(ref.name)).id;
  }

  // --- Document assembly ---------------------------------------------------

  function readUnit(id: string | null, cache: Map<string, Unit | null>): Unit | null {
    if (!id) return null;
    if (!cache.has(id)) cache.set(id, units.get(id));
    return cache.get(id) ?? null;
  }

  function readFood(id: string | null, cache: Map<string, Food | null>): Food | null {
    if (!id) return null;
    if (!cache.has(id)) {
      const row = foods.get(id);
      if (!row) cache.set(id, null);
      else {
        const { aisleId, ...rest } = row;
        cache.set(id, { ...rest, aisle: aisleId ? aisles.get(aisleId) : null });
      }
    }
    return cache.get(id) ?? null;
  }

  function assemble(row: RecipeRow): Recipe {
    const unitCache = new Map<string, Unit | null>();
    const foodCache = new Map<string, Food | null>();

    const ingredientsByComponent = new Map<string, Ingredient[]>();
    for (const i of selectIngredients.all(row.id)) {
      const list = ingredientsByComponent.get(i.component_id) ?? [];
      list.push({
        id: i.id,
        quantity: i.quantity,
        unit: readUnit(i.unit_id, unitCache),
        food: readFood(i.food_id, foodCache),
        note: i.note,
        originalText: i.original_text,
        fixed: i.fixed === 1,
      });
      ingredientsByComponent.set(i.component_id, list);
    }

    const stepsByComponent = new Map<string | null, Step[]>();
    for (const s of selectSteps.all(row.id)) {
      const list = stepsByComponent.get(s.component_id) ?? [];
      list.push({ id: s.id, text: s.text });
      stepsByComponent.set(s.component_id, list);
    }

    const components: Component[] = selectComponents.all(row.id).map((c) => ({
      id: c.id,
      name: c.name,
      ingredients: ingredientsByComponent.get(c.id) ?? [],
      steps: stepsByComponent.get(c.id) ?? [],
    }));

    const notes: RecipeNote[] = selectNotes.all(row.id);

    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      image: row.image,
      rating: row.rating,
      lastMade: row.last_made,
      recipeServings: row.servings,
      recipeYieldQuantity: row.yield_quantity,
      yieldUnit: readUnit(row.yield_unit_id, unitCache),
      recipeYield: row.yield_text,
      prepTime: row.prep_minutes,
      performTime: row.cook_minutes,
      sourceUrl: row.source_url,
      notes,
      tags: selectTags.all(row.id),
      components,
      steps: stepsByComponent.get(null) ?? [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  function summarise(row: SummaryRow): RecipeSummary {
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      image: row.image,
      rating: row.rating,
      prepTime: row.prep_minutes,
      performTime: row.cook_minutes,
      tags: selectTags.all(row.id),
    };
  }

  function getById(id: string): Recipe | null {
    const row = selectById.get(id);
    return row ? assemble(row) : null;
  }

  // --- Write ---------------------------------------------------------------

  function slugFor(name: string, ownId: string): string {
    return uniqueSlug(slugify(name), (s) => slugTaken.get(s, ownId) !== null);
  }

  /** Delete every child row and re-insert them from the document. */
  function writeChildren(recipeId: string, doc: ParsedRecipeInput): void {
    for (const stmt of deleteChildren) stmt.run(recipeId);

    for (const tag of doc.tags) insertTag.run(recipeId, resolveTag(tag));

    doc.notes.forEach((note, position) => {
      insertNote.run(note.id ?? crypto.randomUUID(), recipeId, position, note.title, note.text);
    });

    // Step position is recipe-wide: component order first, then recipe-level steps.
    let stepPosition = 0;
    doc.components.forEach((component, position) => {
      const componentId = component.id ?? crypto.randomUUID();
      insertComponent.run(componentId, recipeId, position, component.name);
      component.ingredients.forEach((ingredient, i) => {
        insertIngredient.run(
          ingredient.id ?? crypto.randomUUID(),
          componentId,
          i,
          ingredient.quantity,
          resolveUnit(ingredient.unit),
          resolveFood(ingredient.food),
          ingredient.note,
          ingredient.originalText,
          ingredient.fixed ? 1 : 0,
        );
      });
      for (const step of component.steps) {
        insertStep.run(step.id ?? crypto.randomUUID(), recipeId, componentId, stepPosition++, step.text);
      }
    });
    for (const step of doc.steps) {
      insertStep.run(step.id ?? crypto.randomUUID(), recipeId, null, stepPosition++, step.text);
    }
  }

  const createTx = db.transaction((doc: ParsedRecipeInput): string => {
    const id = doc.id ?? crypto.randomUUID();
    insertRecipe.run(
      id,
      slugFor(doc.name, id),
      doc.name,
      doc.description,
      doc.image,
      doc.rating,
      doc.lastMade,
      doc.recipeServings,
      doc.recipeYieldQuantity,
      resolveUnit(doc.yieldUnit),
      doc.recipeYield,
      doc.prepTime,
      doc.performTime,
      doc.sourceUrl,
    );
    writeChildren(id, doc);
    return id;
  });

  const updateTx = db.transaction((id: string, doc: ParsedRecipeInput): boolean => {
    const current = selectById.get(id);
    if (!current) return false;
    // Mealie: the slug follows the name only when the name changes.
    const slug = current.name === doc.name ? current.slug : slugFor(doc.name, id);
    updateRecipe.run(
      slug,
      doc.name,
      doc.description,
      doc.image,
      doc.rating,
      doc.lastMade,
      doc.recipeServings,
      doc.recipeYieldQuantity,
      resolveUnit(doc.yieldUnit),
      doc.recipeYield,
      doc.prepTime,
      doc.performTime,
      doc.sourceUrl,
      id,
    );
    writeChildren(id, doc);
    return true;
  });

  return {
    /** Full document by slug, or null. */
    get(slug: string): Recipe | null {
      const row = selectBySlug.get(slug);
      return row ? assemble(row) : null;
    },

    /** Full document by id, or null. */
    getById,

    /** Card summaries, newest first, filtered by name substring and/or tag slug. */
    list(filter: ListFilter = {}): RecipeSummary[] {
      const q = filter.q?.trim() || null;
      const tag = filter.tag?.trim() || null;
      return selectSummaries.all(q, tag).map(summarise);
    },

    /** Insert a recipe and its children in one transaction; the slug comes from the name. */
    create(doc: ParsedRecipeInput): Recipe {
      return getById(createTx(doc))!;
    },

    /**
     * Replace the recipe with `doc`, keeping its id, slug and created_at.
     * Children are deleted and re-inserted in the same transaction. Null when `id` is unknown.
     */
    update(id: string, doc: ParsedRecipeInput): Recipe | null {
      return updateTx(id, doc) ? getById(id) : null;
    },

    /** Set the image file name alone (null clears it). Nothing else changes. True when `id` exists. */
    setImage: (id: string, image: string | null): boolean => updateImage.run(image, id).changes > 0,

    /** True when a recipe was deleted. Children cascade; references stay. */
    remove: (id: string): boolean => deleteRecipe.run(id).changes > 0,
  };
}

export type RecipeRepository = ReturnType<typeof recipes>;
