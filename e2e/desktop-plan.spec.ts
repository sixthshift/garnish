// The plan on a desktop as a board (decisions.md row 207): this week and the
// next, a shelf that adds to the chosen day by a click, a drag from the shelf
// onto any day, an entry dragged between days, and an entry opening in the panel.
import { createRecipe, expect, test, unique } from "./fixtures";

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

test("the board shows this week and the next; the arrows move it a week and keep ?week=", async ({ page, open }) => {
  await open("/plan");
  await expect(page.getByRole("heading", { level: 1, name: "Plan" })).toBeVisible();
  const thisWeek = page.getByRole("region", { name: "This week" });
  const nextWeek = page.getByRole("region", { name: "Next week" });
  await expect(thisWeek.getByTestId("plan-day")).toHaveCount(7);
  await expect(nextWeek.getByTestId("plan-day")).toHaveCount(7);
  await expect(page.getByRole("region", { name: /^Adding to / })).toBeVisible();

  await page.getByRole("link", { name: "Next week" }).click();
  await expect(page).toHaveURL(/[?&]week=\d{4}-\d{2}-\d{2}/);
  await expect(page.getByRole("heading", { level: 2, name: "This week" })).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 2, name: "Next week" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("a shelf card clicked goes on the chosen day, one dragged on the day it is dropped, and an entry drags to another day", async ({ page, open }) => {
  const dal = unique("Board Dal");
  const rice = unique("Board Rice");
  await createRecipe(page, open, { name: dal, servings: 4, ingredients: ["200 g red lentils"], steps: ["Simmer."] });
  await createRecipe(page, open, { name: rice, servings: 4, ingredients: ["300 g rice"], steps: ["Steam."] });

  await open("/plan");
  const nextWeek = page.getByRole("region", { name: "Next week" });
  const dayOf = (weekday: string) =>
    nextWeek.getByRole("listitem").filter({ has: page.getByRole("heading", { level: 3, name: new RegExp(`^${weekday}`, "i") }) });

  // Never made, so both are on To try.
  await nextWeek.getByRole("button", { name: /^Add to Tuesday/ }).click();
  await expect(page.getByRole("region", { name: /^Adding to Tuesday/ })).toBeVisible();
  await page.getByRole("tab", { name: "To try" }).click();
  await page.getByRole("button", { name: new RegExp(`^Add ${dal} to Tuesday`) }).click();
  await expect(dayOf("Tue").getByRole("link", { name: new RegExp(dal) })).toBeVisible();

  await page.getByRole("button", { name: new RegExp(`^Add ${rice} to `) }).dragTo(nextWeek.getByRole("button", { name: /^Add to Thursday/ }));
  await expect(dayOf("Thu").getByRole("link", { name: new RegExp(rice) })).toBeVisible();

  await dayOf("Tue")
    .getByTestId("plan-entry")
    .filter({ hasText: dal })
    .dragTo(nextWeek.getByRole("button", { name: /^Add to Friday/ }));
  await expect(dayOf("Fri").getByRole("link", { name: new RegExp(dal) })).toBeVisible();
  await expect(dayOf("Tue").getByRole("link", { name: new RegExp(dal) })).toHaveCount(0);

  await dayOf("Fri")
    .getByRole("link", { name: new RegExp(dal) })
    .click();
  await expect(page.getByRole("complementary", { name: "Recipe" }).getByRole("heading", { level: 2, name: dal })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Plan" })).toBeVisible();
});
