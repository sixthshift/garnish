import { z } from "zod";
import { imageContentType } from "../../lib/imageFile";
import { MEALS } from "../planner";

// The backup's `garnish.json`, as architecture.md's Backup and restore draws
// it (decisions.md row 131). Normalised: a row names a food, unit, aisle, tag or
// recipe by id and the top-level list holds the one copy. Ids are the
// database's own, so a restore puts every link back as it was.

/** What `garnish.format` says. Anything else is not a garnish backup. */
export const BACKUP_FORMAT = "garnish-backup";

/** Bumped only when a reader of the old shape would misread the new one. */
export const BACKUP_VERSION = 1;

/** The name of the JSON inside the zip. */
export const BACKUP_JSON = "garnish.json";

const id = z.uuid();
const timestamp = z.iso.datetime();
const date = z.iso.date();
const nonEmpty = z.string().trim().min(1);
const text = z.string().default("");
const quantity = z.number().nonnegative().nullable().default(null);
const minutes = z.number().int().nonnegative().nullable().default(null);
const position = z.number().int().nonnegative();

// --- Images -----------------------------------------------------------------

/** Where each kind of image sits, in the zip and under `DATA_DIR/images/` alike. */
export const IMAGE_FOLDERS = { recipe: "images/", step: "images/steps/", timeline: "images/timeline/" } as const;
export type ImageKind = keyof typeof IMAGE_FOLDERS;

/** A stored file name as its path in the backup. Null stays null. Pure. */
export function imagePath(kind: ImageKind, file: string | null): string | null {
  const name = file?.trim() ?? "";
  return name === "" ? null : `${IMAGE_FOLDERS[kind]}${name}`;
}

/** The stored file name a backup path names, or null when it is not one of `kind`'s. Pure. */
export function imageFileOf(kind: ImageKind, path: string): string | null {
  const folder = IMAGE_FOLDERS[kind];
  if (!path.startsWith(folder)) return null;
  const file = path.slice(folder.length);
  return imageContentType(file) ? file : null;
}

const image = (kind: ImageKind) =>
  z
    .string()
    .refine((path) => imageFileOf(kind, path) !== null, `not a ${kind} image path (${IMAGE_FOLDERS[kind]}<uuid>.<ext>)`)
    .nullable()
    .default(null);

// --- Reference lists --------------------------------------------------------

export const backupAisleSchema = z.object({ id, name: nonEmpty, position });

export const backupUnitSchema = z.object({
  id,
  name: nonEmpty,
  pluralName: z.string().nullable().default(null),
  abbreviation: text,
  useAbbreviation: z.boolean().default(false),
  fraction: z.boolean().default(true),
  portion: z.boolean().default(false),
  standardQuantity: z.number().nonnegative().nullable().default(null),
  standardUnitId: id.nullable().default(null),
});

export const backupTagSchema = z.object({ id, name: nonEmpty, slug: nonEmpty });

export const backupConversionSchema = z.object({
  id,
  unitId: id,
  quantity: z.number().positive(),
  toUnitId: id,
  toQuantity: z.number().positive(),
});

export const backupFoodSchema = z.object({
  id,
  name: nonEmpty,
  pluralName: z.string().nullable().default(null),
  aliases: z.array(z.string()).default([]),
  aisleId: id.nullable().default(null),
  recipeId: id.nullable().default(null),
  skipShopping: z.boolean().default(false),
  conversions: z.array(backupConversionSchema).default([]),
});

// --- Recipes ----------------------------------------------------------------

export const backupIngredientSchema = z.object({
  id,
  quantity,
  unitId: id.nullable().default(null),
  foodId: id.nullable().default(null),
  note: text,
  originalText: text,
  fixed: z.boolean().default(false),
});

export const backupStepSchema = z.object({
  id,
  title: text,
  text,
  summary: text,
  ingredientIds: z.array(id).default([]),
  image: image("step"),
});

export const backupPartSchema = z.object({
  id,
  name: text,
  ingredients: z.array(backupIngredientSchema).default([]),
  steps: z.array(backupStepSchema).default([]),
});

export const backupRecipeSchema = z.object({
  id,
  slug: nonEmpty,
  name: nonEmpty,
  description: text,
  image: image("recipe"),
  rating: z.number().min(0).max(5).nullable().default(null),
  favourite: z.boolean().default(false),
  recipeServings: z.number().nonnegative().default(0),
  recipeYieldQuantity: z.number().nonnegative().default(0),
  yieldUnitId: id.nullable().default(null),
  recipeYield: text,
  prepTime: minutes,
  performTime: minutes,
  sourceUrl: z.string().nullable().default(null),
  tagIds: z.array(id).default([]),
  notes: z.array(z.object({ id, title: text, text })).default([]),
  parts: z.array(backupPartSchema).min(1, "a recipe needs at least one part"),
  createdAt: timestamp,
  updatedAt: timestamp,
});

// --- Around the recipe ------------------------------------------------------

export const backupTimelineEventSchema = z.object({
  id,
  recipeId: id,
  occurredOn: date,
  message: text,
  image: image("timeline"),
  servings: z.number().positive().nullable().default(null),
  createdAt: timestamp,
});

export const backupPlanEntrySchema = z.object({
  id,
  date,
  position,
  meal: z.enum(MEALS).nullable().default(null),
  recipeId: id.nullable().default(null),
  text,
  servings: z.number().positive().nullable().default(null),
});

export const backupShoppingSourceSchema = z.object({
  id,
  recipeId: id.nullable().default(null),
  recipeName: text,
  partName: text,
  servings: z.number().nonnegative().nullable().default(null),
  quantity: z.number().nonnegative().nullable().default(null),
});

export const backupShoppingItemSchema = z.object({
  id,
  position,
  quantity,
  unitId: id.nullable().default(null),
  foodId: id.nullable().default(null),
  text,
  ticked: z.boolean().default(false),
  createdAt: timestamp,
  updatedAt: timestamp,
  sources: z.array(backupShoppingSourceSchema).default([]),
});

export const backupRuleSchema = z.object({
  id,
  position,
  text: nonEmpty,
  enabled: z.boolean().default(true),
  createdAt: timestamp,
  updatedAt: timestamp,
});

// --- The file ---------------------------------------------------------------

/** The envelope alone, read first so a newer version is named rather than failed field by field. */
export const backupEnvelopeSchema = z.object({
  garnish: z.object({
    format: z.literal(BACKUP_FORMAT),
    version: z.number().int().positive(),
    createdAt: timestamp,
    appVersion: z.string().default(""),
  }),
});

export const backupSchema = z.object({
  garnish: z.object({
    format: z.literal(BACKUP_FORMAT),
    version: z.literal(BACKUP_VERSION),
    createdAt: timestamp,
    appVersion: z.string().default(""),
  }),
  aisles: z.array(backupAisleSchema).default([]),
  units: z.array(backupUnitSchema).default([]),
  tags: z.array(backupTagSchema).default([]),
  foods: z.array(backupFoodSchema).default([]),
  recipes: z.array(backupRecipeSchema).default([]),
  timeline: z.array(backupTimelineEventSchema).default([]),
  plan: z.array(backupPlanEntrySchema).default([]),
  shopping: z.array(backupShoppingItemSchema).default([]),
  styleRules: z.array(backupRuleSchema).default([]),
  plannerRules: z.array(backupRuleSchema).default([]),
});

export type Backup = z.infer<typeof backupSchema>;
export type BackupAisle = z.infer<typeof backupAisleSchema>;
export type BackupUnit = z.infer<typeof backupUnitSchema>;
export type BackupTag = z.infer<typeof backupTagSchema>;
export type BackupFood = z.infer<typeof backupFoodSchema>;
export type BackupRecipe = z.infer<typeof backupRecipeSchema>;
export type BackupTimelineEvent = z.infer<typeof backupTimelineEventSchema>;
export type BackupPlanEntry = z.infer<typeof backupPlanEntrySchema>;
export type BackupShoppingItem = z.infer<typeof backupShoppingItemSchema>;
export type BackupRule = z.infer<typeof backupRuleSchema>;

/** How many of each thing a backup holds: what the restore sheet and the CLIs report. */
export type BackupCounts = {
  recipes: number;
  foods: number;
  units: number;
  aisles: number;
  tags: number;
  timeline: number;
  plan: number;
  shopping: number;
  styleRules: number;
  plannerRules: number;
  images: number;
};

/** Every image path a backup names, in list order. Pure. */
export function imagePathsOf(backup: Backup): string[] {
  const paths: string[] = [];
  for (const recipe of backup.recipes) {
    if (recipe.image) paths.push(recipe.image);
    for (const part of recipe.parts) for (const step of part.steps) if (step.image) paths.push(step.image);
  }
  for (const event of backup.timeline) if (event.image) paths.push(event.image);
  return paths;
}

/** The counts of a backup. Pure. */
export function countsOf(backup: Backup): BackupCounts {
  return {
    recipes: backup.recipes.length,
    foods: backup.foods.length,
    units: backup.units.length,
    aisles: backup.aisles.length,
    tags: backup.tags.length,
    timeline: backup.timeline.length,
    plan: backup.plan.length,
    shopping: backup.shopping.length,
    styleRules: backup.styleRules.length,
    plannerRules: backup.plannerRules.length,
    images: imagePathsOf(backup).length,
  };
}

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

/** `garnish-backup-YYYYMMDD-HHmmss.zip`, UTC: digits and dashes only, safe on every filesystem. Pure. */
export function backupFileName(now: Date): string {
  const day = `${pad(now.getUTCFullYear(), 4)}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}`;
  const time = `${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
  return `garnish-backup-${day}-${time}.zip`;
}
