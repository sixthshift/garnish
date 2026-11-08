// The editor on a desktop (decisions.md row 211): the recipe page's three
// columns, each thing changed where the page shows it; on an import's Check,
// the text it read in the method's column.
import { expect, test, unique } from "./fixtures";

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

test("a recipe typed by hand is written in the page's three columns, and saves to the page it mirrors", async ({ page, open }) => {
  const name = unique("Columns Tart");
  await open("/recipes/new?source=manual");
  const about = page.getByTestId("about-column");
  const ingredients = page.getByRole("region", { name: "Ingredients" });
  const method = page.getByRole("region", { name: "Method" });
  await expect(about).toBeVisible();
  await expect(ingredients).toBeVisible();
  await expect(method).toBeVisible();

  await about.getByRole("textbox", { name: "Name" }).fill(name);
  await about.getByRole("spinbutton", { name: "Prep time (minutes)" }).fill("15");
  await about.getByRole("spinbutton", { name: "Cook time (minutes)" }).fill("30");
  await expect(about.getByTestId("times")).toContainText("Total 45 min");
  await about.getByRole("button", { name: "Add course, cuisine and more" }).click();
  await page.getByTestId("facet-sheet").getByRole("button", { name: "Weekend" }).click();
  await page.getByRole("button", { name: "Done" }).click();

  await ingredients.getByRole("textbox", { name: "New ingredients" }).fill("200 g plain flour");
  await ingredients.getByRole("button", { name: "Add", exact: true }).click();
  await ingredients.getByRole("button", { name: "Confirm" }).click();
  // The line reads back as the page shows it, and opens in place.
  const line = ingredients.getByRole("button", { name: "Edit ingredient 1" });
  await expect(line).toContainText("plain flour");
  await line.click();
  await ingredients.getByRole("textbox", { name: "Ingredient 1 note" }).fill("sifted");
  await ingredients.getByRole("button", { name: "Done" }).click();
  await expect(ingredients.getByRole("button", { name: "Edit ingredient 1" })).toContainText("sifted");

  await method.getByRole("textbox", { name: "New steps" }).fill("Rub in the butter.");
  await method.getByRole("button", { name: "Add", exact: true }).click();
  await expect(method.getByRole("textbox", { name: "Step 1" })).toHaveValue("Rub in the butter.");

  // A screen tall, no wider than the window: each column scrolls on its own.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.getByRole("button", { name: "Create recipe" }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await expect(page.getByTestId("facet-chips").getByRole("link", { name: "Weekend" })).toBeVisible();
});

test("Check turns the method's column to the text it read, and an ingredient lights its line", async ({ page, open }) => {
  await open("/recipes/new?source=paste");
  const html = `<html><head><script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: unique("Source Soup"),
    recipeIngredient: ["1 onion, diced", "2 cups stock"],
    recipeInstructions: [{ "@type": "HowToStep", text: "Simmer the onion in the stock." }],
  })}</script></head><body><h1>Soup</h1><p>A story about soup.</p><ul><li>1 onion, diced</li><li>2 cups stock</li></ul><ol><li>Simmer the onion in the stock.</li></ol></body></html>`;
  await page.getByRole("textbox", { name: "Pasted recipe" }).fill(html);
  await page.getByRole("button", { name: "Read the text" }).click();

  await page.getByRole("radio", { name: "What the import read" }).click();
  const source = page.getByTestId("source-view");
  await expect(source).toBeVisible();
  await expect(source.locator("[data-used]")).toHaveCount(3);

  await page.getByRole("region", { name: "Ingredients" }).locator("[data-row-id]").first().hover();
  await expect(source.locator("[data-lit]")).toHaveText(/1 onion, diced/);

  await page.getByRole("radio", { name: "Method" }).click();
  await expect(page.getByRole("textbox", { name: "Step 1" })).toHaveValue("Simmer the onion in the stock.");
});
