import { createFood, setFoodPacks, updateFood } from "../../server/fns/foods";
import type { FoodPatch } from "./FoodEditSheet";

/**
 * What the food sheet's Save does, wherever the sheet is opened (Settings ›
 * Foods, a shopping row's "Edit food"): create or update the food, then write
 * the sizes it is sold in, which are kept beside it rather than on it
 * (decisions.md row 184). A new food with no sizes has none to write.
 */
export async function saveFood(patch: FoodPatch): Promise<void> {
  const { id, packs, ...fields } = patch;
  const saved = id === "" ? await createFood({ data: fields }) : await updateFood({ data: { id, ...fields } });
  if (id !== "" || packs.length > 0) await setFoodPacks({ data: { id: saved.id, packs } });
}
