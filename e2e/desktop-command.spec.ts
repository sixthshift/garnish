// A desktop's command bar (decisions.md row 207): a recipe's name and a day,
// typed anywhere, puts it on that day's plan; anything else goes on the list.
import { createRecipe, expect, test, unique } from "./fixtures";

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

/** `YYYY-MM-DD` of a local date, as the household's "today" is. */
function iso(at: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}

/** The next Tuesday that is today or later, and the Monday of its week. */
function nextTuesday(): { date: string; monday: string } {
  const at = new Date();
  at.setDate(at.getDate() + ((2 - at.getDay() + 7) % 7));
  const monday = new Date(at);
  monday.setDate(at.getDate() - 1);
  return { date: iso(at), monday: iso(monday) };
}

test("“<recipe> tue” puts the recipe on Tuesday's plan", async ({ page, open }) => {
  const name = unique("Command Ragu");
  await createRecipe(page, open, { name, servings: 4, ingredients: ["500 g beef chuck"], steps: ["Braise the beef."] });

  await open("/shopping");
  await page.keyboard.press("Control+k");
  const box = page.getByRole("combobox", { name: "Search, plan or add" });
  await expect(box).toBeFocused();
  await box.fill(`${name.toLowerCase()} tue`);
  const option = page.getByRole("option", { name: new RegExp(`^Put ${name} on Tuesday`) });
  await expect(option).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Command bar" })).toHaveCount(0);
  await expect(page.getByText(new RegExp(`${name} is on Tuesday`))).toBeVisible();

  const { monday } = nextTuesday();
  await open(`/plan?week=${monday}`);
  await expect(page.getByText(name).first()).toBeVisible();
});

test("a line that is not a recipe goes on the shopping list", async ({ page, open }) => {
  const line = unique("oat milk");
  await open("/plan");
  await page.getByRole("button", { name: /Search, plan or add anything/ }).click();
  await page.getByRole("combobox", { name: "Search, plan or add" }).fill(line);
  await expect(page.getByRole("option", { name: `Add “${line}” to the shopping list` })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.getByText(`Added “${line}” to the shopping list`)).toBeVisible();

  await open("/shopping");
  await expect(page.getByText(line).first()).toBeVisible();
});
