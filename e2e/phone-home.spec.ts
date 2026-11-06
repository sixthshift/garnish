// Home on a phone (decisions.md row 208): tonight filling the screen, the week
// as a strip, the shopping card, and Settings behind a gear. The database is
// shared with the other specs, so this asserts on what it adds itself and on
// the page's shape, not on what else is planned.
import { createRecipe, expect, test, unique } from "./fixtures";

test("Home is tonight, the week as a strip, the list a tap away, and Settings behind the gear", async ({ page, open }) => {
  await open("/");
  await expect(page.getByRole("heading", { level: 1, name: /^(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day$/ })).toBeVisible();
  await expect(page.getByRole("region", { name: "Tonight" })).toBeVisible();

  const week = page.getByRole("region", { name: "This week" });
  await expect(week.getByRole("listitem")).toHaveCount(7);
  await expect(week.locator('[aria-current="date"]')).toHaveCount(1);
  // The strip opens at today, whatever day of the week it is.
  await expect(week.locator('[aria-current="date"]')).toBeInViewport();

  // The strip scrolls inside itself; the page never runs sideways.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await expect(page.getByRole("link", { name: /^(Start|Open the list)$/ })).toHaveAttribute("href", "/shopping");

  await page.getByRole("main").getByRole("link", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
});

test("tonight is planned or swapped from Home, through the plan's own add sheet", async ({ page, open }) => {
  const name = unique("Swap Soup");
  await createRecipe(page, open, { name, servings: 2, ingredients: ["1 leek"], steps: ["Sweat the leek."] });

  await open("/");
  const tonight = page.getByRole("region", { name: "Tonight" });
  // Another spec may have planned today already: either way the sheet opens for today.
  const plan = tonight.getByRole("button", { name: "Plan tonight" });
  await ((await plan.isVisible()) ? plan : tonight.getByRole("button", { name: "Swap" })).click();

  const sheet = page.getByRole("dialog");
  // Marked as the dinner, so it is the one Home calls tonight's whatever else today holds; a swap keeps the meal.
  await sheet.getByRole("button", { name: "Dinner" }).click();
  await sheet.getByRole("combobox").fill(name.split(" ").slice(-1)[0] ?? name);
  await sheet.getByRole("option", { name: new RegExp(name) }).click();
  await expect(sheet).toBeHidden();

  await expect(tonight.getByText(name)).toBeVisible();
  await expect(tonight.getByRole("link", { name: "Cook" })).toHaveAttribute("href", /\/cook/);

  // Swap puts something else in its place.
  await tonight.getByRole("button", { name: "Swap" }).click();
  const note = unique("Takeaway");
  await page.getByRole("dialog").getByRole("combobox").fill(note);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: `Add “${note}” as a note` })
    .click();
  await expect(tonight.getByText(note)).toBeVisible();
  await expect(tonight.getByText(name)).toBeHidden();
});

test("an empty day to come is planned from its + in the strip", async ({ page, open }) => {
  await open("/");
  const week = page.getByRole("region", { name: "This week" });
  const empty = week.getByRole("button", { name: /^Plan / });
  // Late in the week the other specs may have filled every day left.
  test.skip((await empty.count()) === 0, "no empty day left this week");

  const day = (await empty.first().getAttribute("aria-label"))?.replace(/^Plan /, "") ?? "";
  await empty.first().click();
  const sheet = page.getByRole("dialog", { name: day });
  const note = unique("Picnic");
  await sheet.getByRole("combobox").fill(note);
  await sheet.getByRole("button", { name: `Add “${note}” as a note` }).click();
  await expect(sheet).toBeHidden();
  await expect(week.getByText(note)).toBeVisible();
});
