// Where the Save to Garnish bookmark lands: the tab says it is ready to the
// tab that opened it, reads the first page that tab sends, and ignores every
// other window.
import { act, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { PAGE, READY } from "../../../../../src/domain/recipes/components/new/bookmarklet";
import { RecipeSource } from "../../../../../src/domain/recipes/components/new/RecipeSource";
import type { ImportedRecipe } from "../../../../../src/domain/recipes/import";
import { noFacets } from "../../../../../src/domain/recipes/recipe";
import { renderInRouter } from "../../../../helpers/dom";

const SOURCE = "https://recipes.example/anzac";

const found: ImportedRecipe = {
  from: "schema",
  url: SOURCE,
  pageText: "",
  recipe: {
    name: "Anzac biscuits",
    description: "",
    image: null,
    servings: 24,
    yieldText: "",
    prepMinutes: null,
    cookMinutes: null,
    tags: [],
    facets: noFacets(),
    parts: [{ name: "", ingredients: ["200 g flour"], steps: ["Mix."] }],
  },
};

const sent = { type: PAGE, html: "<html>…</html>", url: SOURCE, title: "Anzac biscuits | Recipes" };

function withOpener(opener: unknown) {
  Object.defineProperty(window, "opener", { value: opener, configurable: true, writable: true });
}

afterEach(() => withOpener(null));

function props(loadPage: (page: { html: string; url: string }) => Promise<ImportedRecipe>, onDraft: (check: { draft: { name: string } }) => void = () => {}) {
  return { units: [], source: "page" as const, onChoose: () => {}, onDraft, loadFoods: async () => [], loadPage };
}

const post = (data: unknown, source: unknown) => act(() => void window.dispatchEvent(new MessageEvent("message", { data, source: source as Window })));

test("tells the opener it is ready, reads the page it sends, and opens Check on it", async () => {
  const opener = { postMessage: vi.fn() };
  withOpener(opener);
  const loadPage = vi.fn(async () => found);
  const onDraft = vi.fn();
  await renderInRouter(<RecipeSource {...props(loadPage, onDraft)} />);

  expect(screen.getByText("Waiting for the page…")).toBeInTheDocument();
  expect(opener.postMessage).toHaveBeenCalledWith({ type: READY }, "*");

  await post(sent, opener);
  await waitFor(() => expect(onDraft).toHaveBeenCalledTimes(1));
  expect(onDraft.mock.calls[0]![0].draft.name).toBe("Anzac biscuits");
  expect(loadPage).toHaveBeenCalledTimes(1);
  expect(loadPage).toHaveBeenCalledWith({ html: "<html>…</html>", url: SOURCE, title: "Anzac biscuits | Recipes" });
});

test("hands Check the page's text as what it read, for a desktop to show beside it (decisions.md row 207)", async () => {
  const opener = { postMessage: vi.fn() };
  withOpener(opener);
  const loadPage = vi.fn(async () => ({ ...found, pageText: "# Anzac biscuits\n200 g flour\nMix." }));
  const onDraft = vi.fn();
  await renderInRouter(<RecipeSource {...props(loadPage, onDraft)} />);

  await post(sent, opener);
  await waitFor(() => expect(onDraft).toHaveBeenCalledTimes(1));
  expect(onDraft.mock.calls[0]![0].sourceText).toBe("# Anzac biscuits\n200 g flour\nMix.");
});

test("ignores a page from any window but the opener", async () => {
  const opener = { postMessage: vi.fn() };
  withOpener(opener);
  const loadPage = vi.fn(async () => found);
  await renderInRouter(<RecipeSource {...props(loadPage)} />);

  await post(sent, {});
  await post({ type: "garnish:other" }, opener);
  expect(loadPage).not.toHaveBeenCalled();
  expect(screen.getByText("Waiting for the page…")).toBeInTheDocument();
});

test("a tab the bookmark did not open says so and offers the paste box", async () => {
  const onChoose = vi.fn();
  await renderInRouter(<RecipeSource {...props(async () => found)} onChoose={onChoose} />);

  expect(screen.getByText("No page to read")).toBeInTheDocument();
  act(() => screen.getByRole("button", { name: "Paste instead" }).click());
  expect(onChoose).toHaveBeenCalledWith("paste");
});
