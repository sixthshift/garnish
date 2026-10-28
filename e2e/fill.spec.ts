// Planning a week at the weekend (decisions.md rows 191 and 192): recipes
// marked Rotation and Weekend on their own pages, a week filled from them,
// and the result on the plan and the shopping list.
import { createRecipe, expect, test, unique } from "./fixtures";

// A Monday far enough ahead that no other spec has planned it.
const WEEK = "2027-03-01";

test("a week filled from the rotation and the weekend recipes lands on the plan and the list", async ({ page, open }) => {
  const regular = unique("Fill Laksa");
  const weekend = unique("Fill Lamb");
  await createRecipe(page, open, { name: regular, servings: 4, ingredients: ["400 ml coconut milk"], steps: ["Simmer."] });
  await page.getByRole("radio", { name: "Rotation" }).click();
  await expect(page.getByRole("radio", { name: "Rotation" })).toBeChecked();
  await createRecipe(page, open, { name: weekend, servings: 6, ingredients: ["2 kg lamb shoulder"], steps: ["Roast."] });
  // The other from the Recipes grid, the way a library is sorted in one sitting.
  await open(`/recipes?q=${encodeURIComponent(weekend)}`);
  await page.getByRole("button", { name: "Mark Rotation & Weekend" }).click();
  const kind = page.getByRole("radiogroup", { name: `How you cook ${weekend}` });
  await kind.getByRole("radio", { name: "Weekend" }).click();
  await expect(kind.getByRole("radio", { name: "Weekend" })).toBeChecked();

  await open(`/plan/fill?week=${WEEK}`);
  await expect(page.getByRole("heading", { level: 1, name: "Plan the week" })).toBeVisible();
  // The rotation's only recipe takes Monday; the rest of the week has nothing left to offer.
  await expect(page.getByText(regular)).toBeVisible();
  await expect(page.getByRole("button", { name: "Mon night off" })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("button", { name: "Tue night off" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Next" }).click();

  await page.getByRole("button", { name: new RegExp(weekend) }).click();
  await expect(page.getByRole("button", { name: new RegExp(`^Saturday.*${weekend}`) })).toBeVisible();
  await page.getByRole("button", { name: "Next" }).click();

  await expect(page.getByRole("checkbox", { name: "Add the week to the shopping list" })).toBeChecked();
  await page.getByRole("button", { name: "Add 2 to the plan" }).click();

  await expect(page).toHaveURL(new RegExp(`/plan\\?week=${WEEK}`));
  const week = page.getByRole("list", { name: /^Week of/ });
  await expect(week.getByRole("link", { name: regular })).toBeVisible();
  await expect(week.getByRole("link", { name: weekend })).toBeVisible();

  await open("/shopping");
  await expect(page.getByRole("checkbox", { name: /coconut milk/ })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /lamb shoulder/ })).toBeVisible();
});
