// A backup downloaded and restored: what was there when it was taken comes
// back, and what was added after it is gone (a restore replaces, it never
// merges — CLAUDE.md, decisions.md row 131). This replaces the whole database,
// which is why the config runs one worker.
import { join } from "node:path";
import { createRecipe, expect, test, unique } from "./fixtures";

test("a restored backup replaces everything with what it held", async ({ page, open }, testInfo) => {
  const kept = unique("Backed Up Soup");
  const lost = unique("After The Backup Salad");
  await createRecipe(page, open, { name: kept, servings: 2, ingredients: ["1 l stock"], steps: ["Heat."] });

  await open("/settings");
  await page.getByRole("tab", { name: "Backup" }).click();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Download backup" }).click()]);
  expect(download.suggestedFilename()).toMatch(/^garnish-backup-\d{8}-\d{6}\.zip$/);
  const zip = join(testInfo.outputDir, download.suggestedFilename());
  await download.saveAs(zip);

  await createRecipe(page, open, { name: lost, servings: 2, ingredients: ["1 cos lettuce"], steps: ["Toss."] });

  await open("/settings");
  await page.getByRole("tab", { name: "Backup" }).click();
  await page.getByLabel("Backup file").setInputFiles(zip);
  const sheet = page.getByRole("dialog", { name: "Restore from a backup" });
  const restore = sheet.getByRole("button", { name: "Restore" });
  await expect(restore).toBeDisabled();
  await sheet.getByRole("checkbox", { name: "I understand this replaces everything" }).check();
  await restore.click();
  await expect(sheet).toBeHidden();

  await open("/");
  await expect(page.getByRole("link", { name: kept })).toBeVisible();
  await expect(page.getByRole("link", { name: lost })).toHaveCount(0);
});
