// Settings › Foods is a virtual list (decisions.md row 176): a screenful of the
// seeded foods is drawn, the page scrolls through every one of them, and a
// row's open ⋯ menu survives a scroll that takes its row off the screen.
import { expect, test, unique } from "./fixtures";

test("Settings › Foods scrolls through every food while drawing only a screenful", async ({ page, open }) => {
  await open("/settings");
  const rows = page.locator("tbody tr[data-row]");
  await expect(rows.first()).toBeVisible();
  const total = Number((await page.locator("[data-table-count]").innerText()).match(/\d+/)?.[0]);
  expect(total).toBeGreaterThan(500);
  expect(await rows.count()).toBeLessThan(60);

  // The first row's menu stays open across a jump to the end of the list.
  const first = await rows.first().getAttribute("data-row");
  await page
    .getByRole("button", { name: /^Actions for / })
    .first()
    .click();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect(page.getByRole("menu")).toBeVisible();
  await expect(page.locator(`tbody tr[data-row="${first}"]`)).toHaveCount(1);
  await page.keyboard.press("Escape");

  // The last row is the last food A–Z, and still only a screenful is drawn.
  await expect(page.locator(`tbody tr[aria-rowindex="${total + 1}"]`)).toBeVisible();
  expect(await rows.count()).toBeLessThan(60);
});

test("Settings › Foods: add a food, find it by an alias, tap its row to edit it, and filter to what is on hand", async ({ page, open }) => {
  const name = unique("Yuzu kosho").toLowerCase();
  // A word only the alias has, so the search below can match nothing but the alias.
  const token = `kp${name.split(" ").at(-1)?.split("").reverse().join("")}`;
  const alias = `citrus chilli ${token}`;
  await open("/settings");

  await page.getByRole("button", { name: "Add food" }).click();
  const sheet = page.getByRole("dialog", { name: "New food" });
  await sheet.getByRole("textbox", { name: "Name" }).fill(name);
  await sheet.getByRole("textbox", { name: "Aliases" }).fill(alias);
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect(sheet).toBeHidden();

  await page.getByRole("textbox", { name: "Search foods" }).fill(token);
  const row = page.locator("tbody tr[data-row]", { hasText: name });
  await expect(row).toContainText(alias);

  // A tap on the row, away from the name, opens the editor.
  await row.locator("td").nth(2).click();
  const editor = page.getByRole("dialog", { name: `Edit ${name}` });
  await editor.getByRole("checkbox", { name: "On hand" }).click();
  await editor.getByRole("button", { name: "Save" }).click();
  await expect(editor).toBeHidden();
  await expect(row).toContainText("on hand");

  await page.getByRole("textbox", { name: "Search foods" }).fill("");
  await page.getByRole("button", { name: "On hand" }).click();
  await expect(page.locator("tbody tr[data-row]", { hasText: name })).toBeVisible();
  await expect(page.locator("tbody tr[data-row]", { hasText: "almond meal" })).toHaveCount(0);
});
