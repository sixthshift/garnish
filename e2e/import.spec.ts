// A recipe imported from a web page with no model (decisions.md row 203): the
// address, one wait, Check with a line asked about, Add, Save, and the recipe
// page. The page is served by the spec itself, so nothing leaves the machine.
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { expect, test, unique } from "./fixtures";

let server: Server;
let base = "";

/** A recipe page with its JSON-LD, named by the address so every run's recipe is its own. */
function recipePage(name: string): string {
  const recipe = {
    "@context": "https://schema.org",
    "@type": "Recipe",
    name,
    recipeYield: "8",
    recipeIngredient: ["200 g plain flour", "100 g quince paste", "2 eggs"],
    recipeInstructions: [
      { "@type": "HowToStep", text: "Rub the flour and paste together." },
      { "@type": "HowToStep", text: "Beat in the eggs and bake for 40 minutes." },
    ],
  };
  return `<!doctype html><html><head><title>${name}</title><script type="application/ld+json">${JSON.stringify(recipe)}</script></head><body><h1>${name}</h1></body></html>`;
}

test.beforeAll(async () => {
  server = createServer((request, response) => {
    const name = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").searchParams.get("name") ?? "Quince tart");
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(recipePage(name));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

test.afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test("a web page becomes a recipe: read whole, checked, a new food added, saved", async ({ page, open }) => {
  const name = unique("Quince tart");
  await open("/recipes/new");
  await page.getByRole("textbox", { name: "Import from a web page" }).fill(`${base}/tart?name=${encodeURIComponent(name)}`);
  await page.getByRole("button", { name: "Import", exact: true }).click();

  // Check: the editor on the read, the source named, the unknown line asked about.
  await expect(page.getByTestId("import-check")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Name" })).toHaveValue(name);
  await expect(page.getByTestId("import-status")).toContainText("1 needs a food");
  await page.getByRole("button", { name: "Add new food: quince paste" }).click();
  await expect(page.getByTestId("import-status")).not.toContainText("needs a food");

  // No model, so Check saves.
  await page.getByRole("button", { name: "Save recipe" }).last().click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  const ingredients = page.getByRole("list", { name: "Ingredients", exact: true }).first();
  await expect(ingredients.getByRole("listitem")).toHaveCount(3);
  await expect(ingredients).toContainText("quince paste");
});
