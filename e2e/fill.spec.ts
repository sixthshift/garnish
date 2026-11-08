// Planning a week at the weekend (decisions.md rows 192 and 219): recipes
// marked Weeknight and Weekend on their own pages, a week filled from them,
// and the result on the plan and the shopping list.
import type { Page } from "@playwright/test";
import { createRecipe, expect, test, unique } from "./fixtures";

/** The week facet, set on the recipe page's facet sheet like any layer, and shown as its chip. */
async function markWeek(page: Page, value: "Weeknight" | "Weekend") {
  await page.getByRole("button", { name: "Add course, cuisine and more" }).click();
  await page.getByTestId("facet-sheet").getByRole("button", { name: value }).click();
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByTestId("facet-chips").getByRole("link", { name: value })).toBeVisible();
}

// A Monday far enough ahead that no other spec has planned it.
const WEEK = "2027-03-01";

test("a week filled from the weeknight and weekend recipes lands on the plan and the list", async ({ page, open }) => {
  const regular = unique("Fill Laksa");
  const weekend = unique("Fill Lamb");
  await createRecipe(page, open, { name: regular, servings: 4, ingredients: ["400 ml coconut milk"], steps: ["Simmer."] });
  await markWeek(page, "Weeknight");
  await createRecipe(page, open, { name: weekend, servings: 6, ingredients: ["2 kg lamb shoulder"], steps: ["Roast."] });
  await markWeek(page, "Weekend");

  await open(`/plan/fill?week=${WEEK}`);
  await expect(page.getByRole("heading", { level: 1, name: "Plan the week" })).toBeVisible();
  // The only weeknight recipe takes Monday; the rest of the week has nothing left to offer.
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
