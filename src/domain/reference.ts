// Input schemas for the reference data server functions (foods, units, aisles,
// tags). Pure and client-importable. Shapes mirror the table columns; names are
// trimmed here so a blank name fails validation rather than the repository.
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

const FoodFields = z.object({
  pluralName: z.string().nullable(),
  aliases: z.array(z.string()),
  aisleId: Id.nullable(),
  recipeId: Id.nullable(),
  skipShopping: z.boolean(),
});
export const FoodCreate = FoodFields.partial().extend({ name: Name });
export const FoodUpdate = FoodFields.extend({ name: Name }).partial().extend({ id: Id });
export type FoodCreate = z.infer<typeof FoodCreate>;
export type FoodUpdate = z.infer<typeof FoodUpdate>;

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

export const TagCreate = NameInput;
export const TagUpdate = z.object({ id: Id, name: Name.optional() });
export type TagCreate = z.infer<typeof TagCreate>;
export type TagUpdate = z.infer<typeof TagUpdate>;
