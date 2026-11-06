// The import's Style stage as markup: where the import is, and what it says when the draft cannot be styled yet.
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { ImportSteps } from "../../../../../src/domain/recipes/components/new/ImportSteps";
import { ImportStyle } from "../../../../../src/domain/recipes/components/new/ImportStyle";
import { draftFromInput, emptyDraft } from "../../../../../src/domain/recipes/draft";
import { recipeInputSchema } from "../../../../../src/domain/recipes/recipe";

/** Render inside a throwaway router, since the stage navigates after Save. */
async function renderWithRouter(component: () => ReactNode): Promise<string> {
  const rootRoute = createRootRoute({ component });
  const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: () => null });
  const router = createRouter({ routeTree: rootRoute.addChildren([indexRoute]), history: createMemoryHistory({ initialEntries: ["/"] }) });
  await router.load();
  return renderToString(<RouterProvider router={router} />);
}

describe("ImportSteps", () => {
  test("ticks the stages before the current one and marks the current one for a screen reader", () => {
    const html = renderToString(<ImportSteps current="Style" model />);
    expect(html.match(/data-state="complete"/g)).toHaveLength(2);
    expect(html).toMatch(/aria-current="step"[^>]*>.*Style/);
    expect(html).toContain('aria-label="Import steps"');
    expect(html).toContain("Check");
    expect(html).toContain("Save");
  });

  test("without a model the path has no Style, so the marker does not show one (decisions.md row 203)", () => {
    const html = renderToString(<ImportSteps current="Check" model={false} />);
    expect(html).not.toContain("Style");
    expect(html).not.toContain("Review");
    expect(html.match(/data-state="complete"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-current="step"[^>]*>.*Check/);
  });
});

describe("ImportStyle", () => {
  test("a draft that does not validate is sent to Edit details rather than restyled", async () => {
    const html = await renderWithRouter(() => <ImportStyle draft={emptyDraft()} imageUrl={null} file={null} onEditDetails={() => {}} onCancel={() => {}} />);
    expect(html).toContain('data-testid="import-style-invalid"');
    expect(html).toContain("Edit details");
    expect(html).not.toContain('data-testid="style-space"');
  });

  test("a valid draft opens the Style space on its steps, with Save recipe, Edit details and Cancel", async () => {
    const draft = draftFromInput(
      recipeInputSchema.parse({ name: "Kung pao chicken", parts: [{ name: "", ingredients: [], steps: [{ text: "Toast the peanuts." }] }] })
    );
    const html = await renderWithRouter(() => <ImportStyle draft={draft} imageUrl={null} file={null} onEditDetails={() => {}} onCancel={() => {}} />);
    expect(html).toContain('data-testid="style-space"');
    expect(html).toContain("Toast the peanuts.");
    expect(html).toContain("Save recipe");
    expect(html).toContain("Edit details");
    expect(html).toContain(">Cancel<");
  });
});
