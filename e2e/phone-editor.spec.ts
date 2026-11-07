// The editor on a phone (decisions.md rows 208, 211): the phone page's shape,
// Ingredients and Method as its two tabs; each ingredient line shows how it was
// read as it is typed, Preview shows the recipe as it will be saved, and on an
// import's Check a step opens beside the page it came from.
import { expect, test, unique } from "./fixtures";

test("a recipe typed by hand reads each line as it is typed, and Preview shows it as it will be saved", async ({ page, open }) => {
  const name = unique("Phone Dal");
  await open("/recipes/new?source=manual");
  await page.getByRole("textbox", { name: "Name" }).fill(name);

  const ingredients = page.getByRole("region", { name: "Ingredients" });
  await ingredients.getByRole("textbox", { name: "New ingredients" }).fill("200 g red lentils, rinsed\nsalt");
  const read = page.getByTestId("read-as-you-type");
  await expect(read.locator("[data-read-line='1'] [data-read-amount]")).toHaveText("200 g");
  await expect(read.locator("[data-read-line='1']")).toContainText("rinsed");
  await expect(read.locator("[data-read-line='2'] [data-read-amount]")).toHaveText("no amount");
  await ingredients.getByRole("button", { name: "Add", exact: true }).click();
  await ingredients.getByRole("button", { name: "Confirm" }).click();

  // Each row's line keeps showing it read apart.
  await expect(page.getByRole("button", { name: "Edit ingredient 1" }).locator("[data-read-amount]")).toHaveText("200 g");
  await expect(page.getByRole("button", { name: "Edit ingredient 2" }).locator("[data-read-amount]")).toHaveText("no amount");

  await page.getByRole("tab", { name: /^Method/ }).click();
  const method = page.getByRole("region", { name: "Method" });
  await method.getByRole("textbox", { name: "New steps" }).fill("Simmer until soft.");
  await method.getByRole("button", { name: "Add", exact: true }).click();

  await page.getByRole("button", { name: "Preview" }).click();
  const preview = page.getByRole("article", { name: "Preview" });
  await expect(preview.getByRole("heading", { level: 2, name })).toBeVisible();
  await expect(preview.getByRole("region", { name: "Method" })).toContainText("Simmer until soft.");
  await expect(page.getByRole("textbox", { name: "Name" })).toBeHidden();
  // Nothing on the phone runs wider than the screen.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.getByRole("button", { name: "Preview" }).click();
  await expect(page.getByRole("textbox", { name: "Name" })).toHaveValue(name);
  await page.getByRole("button", { name: "Create recipe" }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
});

test("on Check, a step opens beside the page it came from, and Edit the line goes to it", async ({ page, open }) => {
  await open("/recipes/new?source=paste");
  const html = `<html><head><script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: unique("Phone Soup"),
    recipeIngredient: ["1 onion, diced", "2 cups stock"],
    recipeInstructions: [
      { "@type": "HowToStep", text: "Soften the onion." },
      { "@type": "HowToStep", text: "Simmer the onion in the stock." },
    ],
  })}</script></head><body><h1>Soup</h1><p>A story about soup.</p><ul><li>1 onion, diced</li><li>2 cups stock</li></ul><ol><li>Soften the onion.</li><li>Simmer the onion in the stock.</li></ol><p>Comments</p></body></html>`;
  await page.getByRole("textbox", { name: "Pasted recipe" }).fill(html);
  await page.getByRole("button", { name: "Read the text" }).click();

  await page.getByRole("tab", { name: /^Method/ }).click();
  await page.getByRole("button", { name: "Step 2 actions" }).click();
  await page.getByRole("menuitem", { name: "Where's this from?" }).click();
  const sheet = page.getByRole("dialog", { name: "Step 2, where it came from" });
  await expect(sheet.locator("[data-lit]")).toHaveText("Simmer the onion in the stock.");
  // Its neighbours on the page, unlit.
  await expect(sheet.locator("[data-source-line]:not([data-lit])").first()).toBeVisible();
  await expect(sheet.getByRole("region", { name: "On the page" })).toContainText("Soften the onion.");
  await sheet.getByRole("button", { name: "Edit the line" }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByRole("textbox", { name: "Step 2", exact: true })).toBeFocused();
});
