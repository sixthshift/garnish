// A cook-mode ingredient row's pencil, pressed: the row becomes an amount
// field, and Save hands back what was typed (decisions.md row 193).
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { ingredientInputSchema } from "../../../../../src/domain/recipe";
import { CookIngredientItem } from "../../../../../src/routes/recipes/recipe/cook/components/CookIngredientItem";
import { renderInRouter } from "../../../../helpers/dom";

const soy = {
  ...ingredientInputSchema.parse({ quantity: 3, food: { id: "00000000-0000-4000-8000-0000000000b1", name: "soy sauce" } }),
  id: "00000000-0000-4000-8000-000000000003",
};

test("the pencil opens the amount, and Save hands back the number typed", async () => {
  const onChangeAmount = vi.fn();
  await renderInRouter(
    <ul>
      <CookIngredientItem recipeId="00000000-0000-4000-8000-000000000001" ingredient={soy} onChangeAmount={onChangeAmount} />
    </ul>
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Change the amount of 3 soy sauce" }));
  const field = screen.getByRole("textbox", { name: "How much soy sauce you used" });
  expect(field).toHaveValue("3");
  await user.clear(field);
  await user.type(field, "2,5");
  await user.click(screen.getByRole("button", { name: "Save" }));
  expect(onChangeAmount).toHaveBeenCalledWith(2.5);
  expect(screen.queryByRole("textbox")).toBeNull();
});

test("Cancel leaves the amount alone, and a row with no amount has no pencil", async () => {
  const onChangeAmount = vi.fn();
  const salt = { ...ingredientInputSchema.parse({ originalText: "salt, to taste" }), id: "00000000-0000-4000-8000-000000000004" };
  await renderInRouter(
    <ul>
      <CookIngredientItem recipeId="00000000-0000-4000-8000-000000000001" ingredient={soy} onChangeAmount={onChangeAmount} />
      <CookIngredientItem recipeId="00000000-0000-4000-8000-000000000001" ingredient={salt} onChangeAmount={onChangeAmount} />
    </ul>
  );
  const user = userEvent.setup();
  expect(screen.getAllByRole("button", { name: /^Change the amount/ })).toHaveLength(1);
  await user.click(screen.getByRole("button", { name: /^Change the amount/ }));
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  expect(onChangeAmount).not.toHaveBeenCalled();
});
