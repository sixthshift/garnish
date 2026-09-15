import { z } from "zod";

/** A row id. */
export const Id = z.string().min(1);
export const IdInput = z.object({ id: Id });
export type IdInput = z.infer<typeof IdInput>;

/** A required name; whitespace-only is rejected. */
export const Name = z.string().trim().min(1);
export const NameInput = z.object({ name: Name });
export type NameInput = z.infer<typeof NameInput>;

/** Optional case-insensitive substring on name; pass `{}` for everything. */
export const ListQuery = z.object({ q: z.string().optional() });
export type ListQuery = z.infer<typeof ListQuery>;

/** "1 cup of flour is 125 g" as it is written: no id, the food is the parent. */
export const FoodConversionInput = z
  .object({
    unitId: Id,
    quantity: z.number().positive(),
    toUnitId: Id,
    toQuantity: z.number().positive(),
  })
  .refine((row) => row.unitId !== row.toUnitId, { message: "A conversion needs two different units." });
export type FoodConversionInput = z.infer<typeof FoodConversionInput>;

const FoodFields = z.object({
  pluralName: z.string().nullable(),
  aliases: z.array(z.string()),
  aisleId: Id.nullable(),
  recipeId: Id.nullable(),
  skipShopping: z.boolean(),
  conversions: z.array(FoodConversionInput),
});
export const FoodCreate = FoodFields.partial().extend({ name: Name });
export const FoodUpdate = FoodFields.extend({ name: Name }).partial().extend({ id: Id });
export type FoodCreate = z.infer<typeof FoodCreate>;
export type FoodUpdate = z.infer<typeof FoodUpdate>;

/** This food's conversions, replaced wholesale. */
export const FoodConversions = z.object({ id: Id, conversions: z.array(FoodConversionInput) });
export type FoodConversions = z.infer<typeof FoodConversions>;

/** The recipe a food is made by; the food is found or created from the recipe's name. */
export const RecipeFoodInput = z.object({ recipeId: Id });
export type RecipeFoodInput = z.infer<typeof RecipeFoodInput>;

/** Merge `sourceId` into `targetId`: the source is deleted, its ingredients repointed. */
export const FoodMerge = z.object({ sourceId: Id, targetId: Id });
export type FoodMerge = z.infer<typeof FoodMerge>;

const UnitFields = z.object({
  pluralName: z.string().nullable(),
  abbreviation: z.string(),
  useAbbreviation: z.boolean(),
  fraction: z.boolean(),
  standardQuantity: z.number().nonnegative().nullable(),
  standardUnitId: Id.nullable(),
});
export const UnitCreate = UnitFields.partial().extend({ name: Name });
export const UnitUpdate = UnitFields.extend({ name: Name }).partial().extend({ id: Id });
export type UnitCreate = z.infer<typeof UnitCreate>;
export type UnitUpdate = z.infer<typeof UnitUpdate>;

/** Merge `sourceId` into `targetId`: the source is deleted, its ingredients and recipe yields repointed. */
export const UnitMerge = z.object({ sourceId: Id, targetId: Id });
export type UnitMerge = z.infer<typeof UnitMerge>;

const AisleFields = z.object({ position: z.number().int() });
export const AisleCreate = AisleFields.partial().extend({ name: Name });
export const AisleUpdate = AisleFields.extend({ name: Name }).partial().extend({ id: Id });
export type AisleCreate = z.infer<typeof AisleCreate>;
export type AisleUpdate = z.infer<typeof AisleUpdate>;

/** The full ordered id list after a drag; positions are set from the array index. */
export const AisleReorder = z.object({ ids: z.array(Id) });
export type AisleReorder = z.infer<typeof AisleReorder>;

export const TagCreate = NameInput;
export const TagUpdate = z.object({ id: Id, name: Name.optional() });
export type TagCreate = z.infer<typeof TagCreate>;
export type TagUpdate = z.infer<typeof TagUpdate>;

/** Merge `sourceId` into `targetId`: the source is deleted, its recipes repointed to the target tag. */
export const TagMerge = z.object({ sourceId: Id, targetId: Id });
export type TagMerge = z.infer<typeof TagMerge>;

// --- The four reference tables, as the recipe document nests them -----------
// Mirrors 001_init.sql column for column in camelCase; the recipe document
// (src/domain/recipe/recipe.ts) embeds these where a row points at one.

const id = z.uuid();
const nonEmpty = z.string().trim().min(1);
const text = z.string().default("");

export const aisleSchema = z.object({
  id,
  name: nonEmpty,
  position: z.number().int().nonnegative().default(0),
});

export const unitSchema = z.object({
  id,
  name: nonEmpty,
  pluralName: z.string().nullable().default(null),
  abbreviation: text,
  useAbbreviation: z.boolean().default(false),
  fraction: z.boolean().default(true),
  standardQuantity: z.number().nonnegative().nullable().default(null),
  standardUnitId: id.nullable().default(null),
});

/**
 * "1 cup of plain flour is 125 g": `quantity` of `unitId`
 * of the owning food equals `toQuantity` of `toUnitId`. Units are ids, not
 * nested objects — the conversion is only ever read beside a units list.
 */
export const foodConversionSchema = z.object({
  id,
  unitId: id,
  quantity: z.number().positive(),
  toUnitId: id,
  toQuantity: z.number().positive(),
});

export const foodSchema = z.object({
  id,
  name: nonEmpty,
  pluralName: z.string().nullable().default(null),
  aliases: z.array(z.string()).default([]),
  aisle: aisleSchema.nullable().default(null),
  recipeId: id.nullable().default(null), // sub-recipe hook, behaviour deferred
  skipShopping: z.boolean().default(false),
  conversions: z.array(foodConversionSchema).default([]),
});

export const tagSchema = z.object({
  id,
  name: nonEmpty,
  slug: nonEmpty,
});

export type Aisle = z.infer<typeof aisleSchema>;
export type Unit = z.infer<typeof unitSchema>;
export type Food = z.infer<typeof foodSchema>;
export type FoodConversion = z.infer<typeof foodConversionSchema>;
export type Tag = z.infer<typeof tagSchema>;

/**
 * A food as the foods list returns it: the row, with `aisleId` flat rather
 * than the nested aisle the recipe document carries. The repository's own
 * row type is this one.
 */
export type FoodRow = {
  id: string;
  name: string;
  pluralName: string | null;
  aliases: string[];
  aisleId: string | null;
  recipeId: string | null;
  skipShopping: boolean;
  /** "1 cup of flour is 125 g". Empty for most foods. */
  conversions: FoodConversion[];
};
