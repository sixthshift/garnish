// A page's tags are offered on the review, not taken (decisions.md rows 170,
// 171): a new tag is made only when it is ticked, the household's own comes
// ticked under its own spelling, and keywords that repeat the name are left out.
import type { Page } from "@playwright/test";
import { expect, test, unique } from "./fixtures";

/** A page's HTML with one schema.org Recipe in it, as the paste source takes it. */
function page(recipe: { name: string; cuisine: string; keywords: string }): string {
  const node = {
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: recipe.name,
    recipeCuisine: recipe.cuisine,
    keywords: recipe.keywords,
    recipeIngredient: [],
    recipeInstructions: ["Cook it."],
  };
  return `<html><head><title>${recipe.name}</title><script type="application/ld+json">${JSON.stringify(node)}</script></head><body></body></html>`;
}

/** Paste `html` and land on the review. */
async function review(p: Page, open: (path: string) => Promise<void>, html: string) {
  await open("/recipes/new?source=paste");
  await p.getByRole("textbox", { name: "Pasted recipe" }).fill(html);
  await p.getByRole("button", { name: "Read the text" }).click();
  await expect(p.getByTestId("review-tags")).toBeVisible();
}

/** Create from the review, then save the form; resolves on the recipe's page. */
async function create(p: Page, name: string) {
  await p.getByRole("button", { name: "Create", exact: true }).click();
  await p.getByRole("button", { name: "Create recipe" }).click();
  await expect(p.getByRole("heading", { level: 1, name })).toBeVisible();
}

test("a new tag is made only when ticked, and the next import finds it ticked", async ({ page: p, open }) => {
  // A cuisine no other spec or run has, so it is new here; the page spells it
  // in lower case and the tag rule gives it a capital.
  const cuisine = unique("cuisine").replace(" ", "");
  const made = `C${cuisine.slice(1)}`;
  const first = unique("Chicken Fried Rice");

  await review(p, open, page({ name: first, cuisine, keywords: "easy, chicken fried rice, fried rice recipe" }));
  const newTag = p.getByRole("checkbox", { name: `${made} (new)` });
  await expect(newTag).not.toBeChecked();
  await expect(p.getByRole("checkbox", { name: "Easy (new)" })).not.toBeChecked();
  await expect(p.getByTestId("review-tags-left-out")).toContainText("Fried rice recipe");
  await newTag.click();
  await create(p, first);

  await expect(p.getByRole("main").getByRole("link", { name: made })).toBeVisible();
  await expect(p.getByRole("main").getByRole("link", { name: "Easy" })).toHaveCount(0);

  // Another site, shouting the same cuisine: the household's tag, ticked, not a new one.
  const second = unique("Egg Fried Rice");
  await review(p, open, page({ name: second, cuisine: made.toUpperCase(), keywords: "egg fried rice" }));
  await expect(p.getByRole("checkbox", { name: made, exact: true })).toBeChecked();
  await create(p, second);
  await expect(p.getByRole("main").getByRole("link", { name: made })).toBeVisible();
});

test("the editor finds the household's tags as you type, and creates one only when asked", async ({ page: p, open }) => {
  const shelf = unique("Shelf").replace(" ", "");
  const made = `S${shelf.slice(1).toLowerCase()}`;

  /** A new recipe's Details, with the tag field in reach. */
  const details = async (name: string) => {
    await open("/recipes/new?source=manual");
    await p.getByRole("textbox", { name: "Name" }).fill(name);
    await p.getByRole("textbox", { name: "New steps" }).fill("Cook it.");
    await p.getByRole("region", { name: "Parts" }).getByRole("button", { name: "Add", exact: true }).last().click();
    await p.getByText("Details", { exact: true }).click();
  };

  const first = unique("Tagged Soup");
  await details(first);
  await p.getByRole("combobox", { name: "Add a tag" }).fill(shelf.toLowerCase());
  await p.getByRole("option", { name: `Create “${shelf.toLowerCase()}”` }).click();
  await expect(p.getByRole("list", { name: "Recipe tags" })).toContainText(made);
  await p.getByRole("button", { name: "Create recipe" }).click();
  await expect(p.getByRole("main").getByRole("link", { name: made })).toBeVisible();

  const second = unique("Tagged Stew");
  await details(second);
  await p.getByRole("combobox", { name: "Add a tag" }).fill(shelf.slice(0, 8).toUpperCase());
  await p.getByRole("option", { name: made }).click();
  await p.getByRole("button", { name: "Create recipe" }).click();
  await expect(p.getByRole("main").getByRole("link", { name: made })).toBeVisible();
});

test("Settings › Tags: a rename onto another tag's name merges, and a tag nobody wants is deleted", async ({ page: p, open }) => {
  const keep = `K${unique("eep").replace(" ", "").slice(1).toLowerCase()}`;
  const dupe = `${keep} dinners`;
  const junk = `J${unique("unk").replace(" ", "").slice(1).toLowerCase()}`;

  // One recipe carrying all three, typed in through the editor.
  const name = unique("Tidy Soup");
  await open("/recipes/new?source=manual");
  await p.getByRole("textbox", { name: "Name" }).fill(name);
  await p.getByRole("textbox", { name: "New steps" }).fill("Cook it.");
  await p.getByRole("region", { name: "Parts" }).getByRole("button", { name: "Add", exact: true }).last().click();
  await p.getByText("Details", { exact: true }).click();
  await p.getByRole("combobox", { name: "Add a tag" }).fill(`${keep}, ${dupe}, ${junk}`);
  await p.getByRole("combobox", { name: "Add a tag" }).press("Enter");
  await p.getByRole("button", { name: "Create recipe" }).click();
  await expect(p.getByRole("heading", { level: 1, name })).toBeVisible();
  const recipe = new URL(p.url()).pathname;

  await open("/settings");
  await p.getByRole("radio", { name: "Tags" }).click();
  const table = p.getByRole("table", { name: "tags" });

  // Rename the duplicate onto the keeper's name: it offers a merge instead of failing.
  await table.getByRole("button", { name: `Actions for ${dupe}` }).click();
  await p.getByRole("menuitem", { name: "Rename" }).click();
  await p.getByRole("textbox", { name: "Name" }).fill(keep.toUpperCase());
  await p.getByRole("button", { name: "Save" }).click();
  await p
    .getByRole("dialog", { name: `Merge ${dupe} into ${keep}?` })
    .getByRole("button", { name: "Merge" })
    .click();
  await expect(table.getByRole("link", { name: dupe })).toHaveCount(0);

  // Select the junk tag and delete it.
  await table.getByRole("checkbox", { name: `Select ${junk}` }).check();
  await p.getByRole("button", { name: "Delete 1", exact: true }).click();
  await p.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await expect(table.getByRole("link", { name: junk })).toHaveCount(0);

  await open(recipe);
  const main = p.getByRole("main");
  await expect(main.getByRole("link", { name: keep })).toBeVisible();
  await expect(main.getByRole("link", { name: dupe })).toHaveCount(0);
  await expect(main.getByRole("link", { name: junk })).toHaveCount(0);
});
