// The editor's offline notice. RecipeForm reads useOnline() but takes an
// `online` prop override so the state can be fixed for a renderToString pass;
// the form needs a router for useNavigate/useMutate, so it is mounted under a
// one-route tree with a memory history.
import { RouterProvider, createMemoryHistory, createRootRoute, createRouter } from "@tanstack/react-router";
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { emptyDraft, RecipeForm, type RecipeFormProps } from "../../../../src/routes/recipes/components/RecipeForm";

async function render(props: Partial<RecipeFormProps>): Promise<string> {
  const rootRoute = createRootRoute({ component: () => <RecipeForm initial={emptyDraft()} units={[]} tags={[]} {...props} /> });
  const router = createRouter({ routeTree: rootRoute, history: createMemoryHistory({ initialEntries: ["/"] }) });
  await router.load();
  return renderToString(<RouterProvider router={router} />);
}

const submitButton = (html: string) => html.match(/<button[^>]*type="submit"[^>]*>/)?.[0] ?? "";
/** The `disabled` attribute on a tag, as opposed to Tailwind's `disabled:` variant classes. */
const isDisabled = (tag: string) => /\sdisabled(=""|\s|>)/.test(tag);

describe("RecipeForm offline", () => {
  test("offline: the notice shows and Save is disabled", async () => {
    const html = await render({ online: false });
    expect(html).toContain('data-testid="offline-notice"');
    expect(html).toContain("You are offline");
    expect(html).toContain("Changes cannot be saved offline");
    expect(html).toMatch(/data-intent="warning"|role="status"/);
    expect(isDisabled(submitButton(html))).toBe(true);
  });

  test("online: no notice and Save is enabled", async () => {
    const html = await render({ online: true });
    expect(html).not.toContain("offline-notice");
    expect(html).not.toContain("You are offline");
    expect(isDisabled(submitButton(html))).toBe(false);
  });

  test("with no override the server render assumes online (matches the first client render)", async () => {
    const html = await render({});
    expect(html).not.toContain("offline-notice");
    expect(isDisabled(submitButton(html))).toBe(false);
  });

  test("editing offline: the edit form carries the notice too", async () => {
    const html = await render({ online: false, existing: { id: "11111111-1111-4111-8111-111111111111", slug: "lemon-tart" } });
    expect(html).toContain('aria-label="Edit recipe"');
    expect(html).toContain("You are offline");
    expect(isDisabled(submitButton(html))).toBe(true);
  });
});
