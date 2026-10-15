// What every spec imports in place of @playwright/test. Its `page` fails the
// test on any uncaught error or console error, so every journey is also a
// check that nothing on its way threw — the failure the unit suite cannot see.
// A test that expects one (a 404 it asked for) names it in `allowedErrors`.
import { test as base, expect, type Page } from "@playwright/test";

type Fixtures = {
  /** Patterns of page errors this test expects; any other fails it. */
  allowedErrors: RegExp[];
  /** Go to `path` and resolve once the page is hydrated and safe to type into. */
  open: (path: string) => Promise<void>;
};

export const test = base.extend<Fixtures>({
  allowedErrors: [[], { option: true }],
  page: async ({ page, allowedErrors }, use) => {
    const errors: string[] = [];
    const record = (text: string) => {
      if (!allowedErrors.some((pattern) => pattern.test(text))) errors.push(`${page.url()}: ${text}`);
    };
    page.on("pageerror", (error) => record(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") record(message.text());
    });
    await use(page);
    expect(errors, "the page logged errors").toEqual([]);
  },
  // The server sends a prerendered shell and React hydrates it as the route's
  // lazy chunks arrive. Typing before that finishes is thrown away with the
  // mismatched DOM (React #418), and a fiber on the node is no sign it is
  // done: React attaches those before it commits. The chunks are the last
  // thing hydration waits on, so a quiet network is the signal.
  open: async ({ page }, use) => {
    await use(async (path) => {
      await page.goto(path, { waitUntil: "networkidle" });
    });
  },
});

export { expect };

/** A name no other spec, or an earlier run's leftovers, will have. */
export function unique(name: string): string {
  return `${name} ${crypto.randomUUID().slice(0, 8)}`;
}

/**
 * Type a recipe in by hand and create it, through the editor as a person
 * would: name, servings, bulk ingredients (reviewed and confirmed), bulk
 * steps. Resolves on the new recipe's page.
 */
export async function createRecipe(
  page: Page,
  open: Fixtures["open"],
  recipe: { name: string; servings: number; ingredients: string[]; steps: string[] }
): Promise<void> {
  await open("/recipes/new?source=manual");
  await page.getByRole("textbox", { name: "Name" }).fill(recipe.name);
  await page.getByRole("textbox", { name: "Servings" }).fill(String(recipe.servings));
  const parts = page.getByRole("region", { name: "Parts" });
  await page.getByRole("textbox", { name: "New ingredients" }).fill(recipe.ingredients.join("\n"));
  await parts.getByRole("button", { name: "Add", exact: true }).first().click();
  await parts.getByRole("button", { name: "Confirm" }).click();
  await page.getByRole("textbox", { name: "New steps" }).fill(recipe.steps.join("\n\n"));
  await parts.getByRole("button", { name: "Add", exact: true }).last().click();
  await page.getByRole("button", { name: "Create recipe" }).click();
  await expect(page.getByRole("heading", { level: 1, name: recipe.name })).toBeVisible();
}
