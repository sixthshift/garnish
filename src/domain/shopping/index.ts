// shopping: a module. This index is its whole surface; nothing outside the folder
// imports anything else in it (test/modules.test.ts).
//
// The one shopping list: its document, the merge rule (by food and unit, into
// an unticked line), what a recipe adds to it, and how it groups by aisle.

export type {
  ParsedShoppingItemInput,
  ShoppingAddition,
  ShoppingItem,
  ShoppingItemInput,
  ShoppingItemPatch,
  ShoppingItemSourceInput,
  ShoppingListMerge,
  ShoppingMergePlan,
} from "./shopping";
export {
  additionsFor,
  additionsForWithSubRecipes,
  groupByAisle,
  ingredientText,
  mergeIntoList,
  recipeAdditions,
  shoppingGroups,
  shoppingItemInputSchema,
  shoppingItemLabel,
  shoppingItemPatchSchema,
  shoppingItemSchema,
  shoppingItemSourceInputSchema,
  sourceLabel,
} from "./shopping";
