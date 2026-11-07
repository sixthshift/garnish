// Marking one value under every card (decisions.md rows 195 and 209): a press
// adds it or takes it away, written at once with the recipe's other layers.
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { MarkUnder } from "../../../../../src/domain/recipes/components/facets/MarkUnder";
import { noFacets, type RecipeSummary } from "../../../../../src/domain/recipes/recipe";
import { renderInRouter } from "../../../../helpers/dom";

const rpc = vi.hoisted(() => ({ setFacets: vi.fn(async ({ data }: { data: unknown }) => data) }));
vi.mock("../../../../../src/api/rpc/recipes", async (importOriginal) => ({ ...(await importOriginal<object>()), setFacets: rpc.setFacets }));

beforeEach(() => {
  rpc.setFacets.mockClear();
});

const recipe: RecipeSummary = {
  id: "00000000-0000-4000-8000-000000000001",
  slug: "pho",
  name: "Pho",
  image: null,
  rating: null,
  prepTime: null,
  performTime: null,
  totalTime: null,
  lastMade: null,
  favourite: false,
  kind: null,
  facets: { ...noFacets(), cuisine: ["vietnamese"] },
  tags: [],
  ingredientPreview: [],
};

test("marking the kind puts the two segments under the card", async () => {
  await renderInRouter(<MarkUnder recipe={recipe} marking={{ by: "kind" }} />);
  expect(screen.getByRole("radiogroup", { name: "How you cook Pho" })).toBeInTheDocument();
});

test("marking a value is one toggle named after its recipe, and a press writes it beside the recipe's other layers", async () => {
  const user = userEvent.setup();
  await renderInRouter(<MarkUnder recipe={recipe} marking={{ by: "facet", layer: "course", value: "soup" }} />);
  const toggle = screen.getByRole("button", { name: "Soup: Pho" });
  expect(toggle).toHaveAttribute("aria-pressed", "false");
  await user.click(toggle);
  expect(toggle).toHaveAttribute("aria-pressed", "true");
  await waitFor(() =>
    expect(rpc.setFacets).toHaveBeenCalledWith({ data: { id: recipe.id, facets: { ...noFacets(), course: ["soup"], cuisine: ["vietnamese"] } } })
  );
});
