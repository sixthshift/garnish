// Settings › Foods on a phone is a virtual list (decisions.md row 176) filed
// by letter (row 208): a screenful of the seeded foods is drawn, the alphabet
// down the side jumps through every one of them, and a food opens in a sheet.
import { expect, test, unique } from "./fixtures";

test("Settings › Foods jumps through every food by its letter while drawing only a screenful", async ({ page, open }) => {
  await open("/settings?section=foods");
  const rows = page.locator('[data-kind="food"]');
  await expect(rows.first()).toBeVisible();
  const total = Number((await page.locator("[data-table-count]").innerText()).match(/\d+/)?.[0]);
  expect(total).toBeGreaterThan(500);
  expect(await rows.count()).toBeLessThan(60);

  // The last letter's header comes up under the search, and still only a screenful is drawn.
  const strip = page.getByRole("navigation", { name: "Jump to a letter" });
  await strip.getByRole("button", { name: "Jump to W" }).click();
  await expect(page.locator('[data-letter="W"]')).toBeInViewport();
  await expect(page.locator('[data-letter="A"]')).toHaveCount(0);
  expect(await rows.count()).toBeLessThan(60);
  await strip.getByRole("button", { name: "Jump to A" }).click();
  await expect(page.locator('[data-letter="A"]')).toBeInViewport();
});

test("Settings › Foods: add a food, find it by an alias, tap its row to edit it, and filter to what is on hand", async ({ page, open }) => {
  const name = unique("Yuzu kosho").toLowerCase();
  // A word only the alias has, so the search below can match nothing but the alias.
  const token = `kp${name.split(" ").at(-1)?.split("").reverse().join("")}`;
  const alias = `citrus chilli ${token}`;
  await open("/settings?section=foods");

  await page.getByRole("button", { name: "Add food" }).click();
  const sheet = page.getByRole("dialog", { name: "New food" });
  await sheet.getByRole("textbox", { name: "Name" }).fill(name);
  await sheet.getByRole("textbox", { name: "Aliases" }).fill(alias);
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect(sheet).toBeHidden();

  await page.getByRole("textbox", { name: "Search foods" }).fill(token);
  const row = page.getByRole("button", { name: new RegExp(`^${name}`) });
  await expect(row).toContainText(alias);

  // A tap on the row opens the food's sheet; the full editor is a press away.
  await row.click();
  const food = page.getByRole("dialog", { name });
  await food.getByRole("button", { name: "Edit all fields" }).click();
  const editor = page.getByRole("dialog", { name: `Edit ${name}` });
  await editor.getByRole("checkbox", { name: "On hand" }).click();
  await editor.getByRole("button", { name: "Save" }).click();
  await expect(editor).toBeHidden();
  await expect(row).toContainText("on hand");

  await page.getByRole("textbox", { name: "Search foods" }).fill("");
  await page.getByRole("button", { name: "On hand" }).click();
  await expect(page.getByRole("button", { name: new RegExp(`^${name}`) })).toBeVisible();
  await expect(page.getByRole("button", { name: /^almond meal/ })).toHaveCount(0);
});
