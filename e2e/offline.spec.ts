// Offline, the service worker answers every page with the one shell it cached
// and the data it last fetched (decisions.md row 169): a page visited online
// opens cold offline, drawn by the browser, with no error. The shell is the
// same for every address, so the cached copy fits whichever page is asked for.
import { expect, test } from "./fixtures";

test("a page visited online opens cold offline from the cached shell", async ({ page, context, open }) => {
  await open("/plan");
  await page.evaluate(() => navigator.serviceWorker.ready);
  // Once more, so this page's data is in the worker's cache as well as the shell.
  await page.reload({ waitUntil: "networkidle" });

  await context.setOffline(true);
  await page.goto("/plan");
  await expect(page.getByRole("heading", { level: 1, name: "Plan" })).toBeVisible();
  // The cached shell is the one fetched for "/": had it marked Recipes as the
  // current place, that mark would outlive hydration here. It marks nothing,
  // and the browser marks Plan.
  await expect(page.locator('nav[aria-label="Main"] a[aria-current="page"]')).toHaveText(["Plan", "Plan"]);
  await context.setOffline(false);
});
