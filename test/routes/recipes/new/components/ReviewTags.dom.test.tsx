// The review's Tags (decisions.md row 171): a page's keywords are offered, not
// taken. The household's own tags come ticked, a new one is made only when it
// is ticked, and a keyword that repeats the name is never offered.
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import type { RecipeDraft } from "../../../../../src/domain/draft";
import type { ImportedRecipe } from "../../../../../src/domain/import";
import { RecipeSource } from "../../../../../src/routes/recipes/new/components/RecipeSource";
import { renderInRouter } from "../../../../helpers/dom";

const SOURCE = "https://recipes.example/fried-rice";

const found = (from: ImportedRecipe["from"]): ImportedRecipe => ({
  from,
  url: SOURCE,
  pageText: "",
  recipe: {
    name: "Chicken Fried Rice",
    description: "",
    image: null,
    servings: 4,
    yieldText: "",
    prepMinutes: null,
    cookMinutes: null,
    tags: ["chinese", "easy", "Chicken fried rice", "fried rice recipe"],
    // No ingredient rows, so Create makes no foods and needs no server.
    parts: [{ name: "", ingredients: [], steps: ["Fry the rice."] }],
  },
});

const chinese = { id: "c8986320-0c97-47ff-9ebe-3726bb2d04c3", name: "Chinese", slug: "chinese" };

async function review(from: ImportedRecipe["from"]) {
  const onDraft = vi.fn<(draft: RecipeDraft) => void>();
  await renderInRouter(
    <RecipeSource
      units={[]}
      tags={[chinese]}
      source="url"
      initialUrl={SOURCE}
      onChoose={() => {}}
      onDraft={onDraft}
      loadFoods={async () => []}
      load={async () => found(from)}
    />
  );
  await waitFor(() => expect(screen.getByTestId("review-tags")).toBeInTheDocument());
  return onDraft;
}

test("a page's known tag comes ticked; a new one goes on only when ticked; name repeats are left out", async () => {
  const user = userEvent.setup();
  const onDraft = await review("schema");

  expect(screen.getByRole("checkbox", { name: "Chinese" })).toBeChecked();
  expect(screen.getByRole("checkbox", { name: "Easy (new)" })).not.toBeChecked();
  expect(screen.queryByRole("checkbox", { name: /fried rice/i })).toBeNull();
  expect(screen.getByTestId("review-tags-left-out")).toHaveTextContent("Chicken fried rice, Fried rice recipe");

  await user.click(screen.getByRole("checkbox", { name: "Easy (new)" }));
  await user.click(screen.getByRole("button", { name: "Create" }));

  await waitFor(() => expect(onDraft).toHaveBeenCalled());
  expect(onDraft.mock.calls[0]![0].tags.map((tag) => tag.name)).toEqual(["Chinese", "Easy"]);
  // The known tag is the household's own, by id; the new one is made on save.
  expect(onDraft.mock.calls[0]![0].tags[0]).toEqual(chinese);
});

test("untouched, only the household's own tags go on", async () => {
  const user = userEvent.setup();
  const onDraft = await review("schema");
  await user.click(screen.getByRole("button", { name: "Create" }));
  await waitFor(() => expect(onDraft).toHaveBeenCalled());
  expect(onDraft.mock.calls[0]![0].tags).toEqual([chinese]);
});

test("a Mealie export's tags are the household's own: all come ticked, none left out", async () => {
  await review("mealie");
  for (const name of ["Chinese", "Easy (new)", "Chicken fried rice (new)", "Fried rice recipe (new)"]) {
    expect(screen.getByRole("checkbox", { name })).toBeChecked();
  }
  expect(screen.queryByTestId("review-tags-left-out")).toBeNull();
});
