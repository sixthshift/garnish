// The editor on a desktop (decisions.md row 207): the recipe as it will be
// saved, beside the form and redrawn as it is typed; on an import's Check, the
// text it read beside it too.
import { expect, test, unique } from "./fixtures";

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

test("a recipe typed by hand shows in the preview beside the form as it is typed", async ({ page, open }) => {
  const name = unique("Preview Tart");
  await open("/recipes/new?source=manual");
  const preview = page.getByRole("article", { name: "Preview" });
  await expect(preview).toContainText("Untitled recipe");

  await page.getByRole("textbox", { name: "Name" }).fill(name);
  await expect(preview.getByRole("heading", { level: 2, name })).toBeVisible();

  const parts = page.getByRole("region", { name: "Parts" });
  await page.getByRole("textbox", { name: "New ingredients" }).fill("200 g plain flour");
  await parts.getByRole("button", { name: "Add", exact: true }).first().click();
  await parts.getByRole("button", { name: "Confirm" }).click();
  await expect(preview.getByRole("region", { name: "Ingredients" })).toContainText("plain flour");

  await page.getByRole("textbox", { name: "New steps" }).fill("Rub in the butter.");
  await parts.getByRole("button", { name: "Add", exact: true }).last().click();
  await expect(preview.getByRole("region", { name: "Method" })).toContainText("Rub in the butter.");

  // The preview stays in view beside the form, and the page is no wider than the window.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("Check shows the text it read beside the form, and an ingredient lights its line", async ({ page, open }) => {
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

  const source = page.getByRole("region", { name: "Source" });
  await expect(source).toBeVisible();
  await expect(source.locator("[data-used]")).toHaveCount(3);

  await page.locator("[data-row-id]").first().hover();
  await expect(source.locator("[data-lit]")).toHaveText(/1 onion, diced/);

  await page.getByRole("radio", { name: "Preview" }).click();
  await expect(page.getByRole("article", { name: "Preview" })).toContainText("Simmer the onion in the stock.");
});
