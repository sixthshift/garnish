// The plan on a phone (decisions.md row 208): the add sheet of photos that
// stays open for the next, an entry swiped right to the next day by a finger
// (touch, through the browser's own touch events), one taken off from its
// menu, the header's day buttons, and the page opening at today.
import { createRecipe, expect, test, unique } from "./fixtures";

// A Monday far enough ahead that no other spec plans it.
const WEEK = "2027-05-03";

test("two recipes added from the sheet, which stays open; one swiped to the next day, the other removed from its menu", async ({ page, open }) => {
  const dal = unique("Phone Dal");
  const rice = unique("Phone Rice");
  await createRecipe(page, open, { name: dal, servings: 4, ingredients: ["200 g yellow split peas"], steps: ["Simmer."] });
  await createRecipe(page, open, { name: rice, servings: 4, ingredients: ["300 g rice"], steps: ["Steam."] });

  await open(`/plan?week=${WEEK}`);
  const week = page.getByRole("list", { name: /^Week of/ });
  await week.getByRole("button", { name: "Add to Tuesday 4 May" }).click();
  const sheet = page.getByRole("dialog", { name: "Adding to Tuesday 4 May" });
  await sheet.getByRole("tab", { name: "All" }).click();

  await sheet.getByRole("button", { name: `Add ${dal} to Tuesday 4 May` }).click();
  await expect(sheet.getByRole("button", { name: `${dal}, added to Tuesday 4 May` })).toBeDisabled();
  await sheet.getByRole("button", { name: `Add ${rice} to Tuesday 4 May` }).click();
  await expect(sheet.getByRole("button", { name: `${rice}, added to Tuesday 4 May` })).toBeDisabled();
  // Still open after both.
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: "Done" }).click();
  await expect(sheet).toBeHidden();

  const tuesday = page.getByRole("region", { name: "Tuesday 4" });
  const wednesday = page.getByRole("region", { name: "Wednesday 5" });
  await expect(tuesday.getByRole("link", { name: dal })).toBeVisible();
  await expect(tuesday.getByRole("link", { name: rice })).toBeVisible();
  // Wednesday is empty: one dashed Add, the size of a card.
  await expect(wednesday.getByRole("button", { name: "Add to Wednesday 5 May" })).toHaveText("+ Add to Wednesday");

  // A finger drags the dal's card to the right, past the line: it goes to Wednesday.
  const card = tuesday.getByTestId("plan-entry").filter({ hasText: dal });
  const box = await card.boundingBox();
  if (box === null) throw new Error("the card has no box");
  const y = box.y + box.height / 2;
  const cdp = await page.context().newCDPSession(page);
  const touch = (type: "touchStart" | "touchMove" | "touchEnd", x: number) =>
    cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
  await touch("touchStart", box.x + 20);
  for (let x = box.x + 30; x <= box.x + 200; x += 20) await touch("touchMove", x);
  await touch("touchEnd", box.x + 200);
  await expect(wednesday.getByRole("link", { name: dal })).toBeVisible();
  await expect(tuesday.getByRole("link", { name: dal })).toHaveCount(0);

  // The rice comes off from its menu, the swipe's other way.
  await page.getByRole("button", { name: `Actions for ${rice}` }).click();
  await page.getByRole("menuitem", { name: "Remove" }).click();
  await expect(page.getByRole("link", { name: rice })).toHaveCount(0);
  await expect(tuesday.getByRole("button", { name: "Add to Tuesday 4 May" })).toHaveText("+ Add to Tuesday");
});

test("the header holds the week's day buttons as the page scrolls, and one brings its day up", async ({ page, open }) => {
  await open(`/plan?week=${WEEK}`);
  const strip = page.getByRole("navigation", { name: "Days of the week" });
  await expect(strip.getByRole("button")).toHaveCount(7);
  await strip.getByRole("button", { name: /^Sunday 9 May/ }).click();
  const sunday = page.getByRole("region", { name: "Sunday 9" });
  await expect(sunday).toBeInViewport();
  // The strip is still on screen, above the day it brought up.
  await expect(strip).toBeInViewport();
  const stripBox = await strip.boundingBox();
  const dayBox = await sunday.boundingBox();
  expect(stripBox && dayBox && stripBox.y + stripBox.height <= dayBox.y).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("this week opens at today, its button filled", async ({ page, open }) => {
  await open("/plan");
  const today = page.getByRole("navigation", { name: "Days of the week" }).locator('[aria-current="date"]');
  await expect(today).toHaveCount(1);
  const name = ((await today.getAttribute("aria-label")) ?? "").replace(/, planned$/, "");
  const section = page.getByRole("region", { name: name.split(" ").slice(0, 2).join(" ") });
  await expect(section).toBeInViewport();
  await expect(section.getByText("Today", { exact: true })).toBeVisible();
});
