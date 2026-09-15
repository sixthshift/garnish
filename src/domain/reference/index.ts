// reference: a module. This index is its whole surface; nothing outside the folder
// imports anything else in it (test/modules.test.ts).
//
// The four small lists a recipe points at — foods, units, aisles, tags — as the
// document nests them, as the foods list returns them (FoodRow), as they are
// written (the input schemas), and one conversion between a food's units.

export { convert } from "./convert";
export type { Aisle, Food, FoodConversion, FoodRow, Tag, Unit } from "./reference";
export {
  AisleCreate,
  AisleReorder,
  AisleUpdate,
  FoodConversionInput,
  FoodConversions,
  FoodCreate,
  FoodMerge,
  FoodUpdate,
  foodSchema,
  Id,
  IdInput,
  ListQuery,
  NameInput,
  RecipeFoodInput,
  TagCreate,
  TagMerge,
  TagUpdate,
  tagSchema,
  UnitCreate,
  UnitMerge,
  UnitUpdate,
  unitSchema,
} from "./reference";
