// What is typed the moment a page opens is kept. The server sends only the
// shell and the browser draws the page (decisions.md row 169), so there is no
// server-drawn field to type into before React owns it. When the server drew
// the whole page, typing in the moment before hydration finished was replayed
// as a change, failed the hydration (React #418), and redrew the form blank.
import { expect, test } from "./fixtures";

for (const path of ["/recipes/new?source=manual", "/shopping"]) {
  test(`typing as ${path} opens is kept`, async ({ page }) => {
    // page.goto, not open: this test types as early as the field allows.
    await page.goto(path, { waitUntil: "commit" });
    const field = page.getByRole("textbox").first();
    await field.fill("Typed at once");
    await page.waitForLoadState("networkidle");
    await expect(field).toHaveValue("Typed at once");
  });
}
