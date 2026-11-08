// The editor on a phone (decisions.md row 208): import's Check puts the lines
// it is unsure of first, each opening in a sheet beside the page it came from;
// every ingredient line shows how it was read, as it is typed; and Preview
// shows the recipe as it will be saved.
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { RecipeForm } from "../../../../../../src/domain/recipes/components/editor/RecipeForm";
import { emptyDraft, importDraft, type RecipeDraft } from "../../../../../../src/domain/recipes/draft";
import type { ScrapedRecipe } from "../../../../../../src/domain/recipes/import";
import { reviewRows } from "../../../../../../src/domain/recipes/ingredient";
import { noFacets } from "../../../../../../src/domain/recipes/recipe";
import type { FoodRow, Unit } from "../../../../../../src/domain/recipes/reference";
import { renderInRouter } from "../../../../../helpers/dom";
import { memoryStorage as memory } from "../../../../../helpers/storage";

const gram: Unit = {
  id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  name: "gram",
  pluralName: "grams",
  abbreviation: "g",
  useAbbreviation: true,
  fraction: false,
  portion: false,
  standardQuantity: null,
  standardUnitId: null,
};
const flour: FoodRow = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "flour",
  pluralName: null,
  aliases: [],
  aisleId: null,
  recipeId: null,
  skipShopping: false,
  conversions: [],
};

vi.mock("../../../../../../src/api/rpc/foods", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listFoods: vi.fn(async () => [flour]),
}));

const scraped: ScrapedRecipe = {
  name: "Lemon tart",
  description: "",
  image: null,
  servings: 8,
  yieldText: "",
  prepMinutes: null,
  cookMinutes: null,
  tags: [],
  facets: noFacets(),
  // "150 g" names no food at all, so the read keeps it as written without asking.
  parts: [{ name: "", ingredients: ["200 g flour", "100 g quince paste", "150 g"], steps: ["Rub the flour in.", "Bake until golden."] }],
};

const PAGE = [
  "# Lemon tart",
  "A sharp, short tart.",
  "200 g flour",
  "100 g quince paste",
  "150 g",
  "Rub the flour in.",
  "Bake until golden.",
  "Serve cold.",
].join("\n");

async function renderCheck(sourceText?: string) {
  const rows = reviewRows(
    scraped.parts.flatMap((part) => part.ingredients),
    { units: [gram], foods: [flour] }
  );
  const { draft, pending } = importDraft({ scraped, sourceUrl: "https://recipes.example/lemon-tart", rows });
  const check = { pending, note: null, duplicate: null, suggestedTags: [], onBack: () => {}, sourceText };
  await renderInRouter(<RecipeForm initial={draft} units={[gram]} tags={[]} storage={memory()} isImport importCheck={check} />);
  return draft;
}

const card = () => screen.getByTestId("lines-to-check");

test("the lines the import is unsure of come first, and one opens lit amid the page it came from", async () => {
  const user = userEvent.setup();
  await renderCheck(PAGE);

  // The food the library lacks, and the line no food was read from; the linked flour is not asked about.
  expect(within(card()).getByRole("heading")).toHaveTextContent("2 lines to check");
  expect(within(card()).getAllByRole("button")).toHaveLength(2);
  expect(card()).not.toHaveTextContent("flour");

  await user.click(within(card()).getByRole("button", { name: "Check 100 g quince paste" }));
  const sheet = await screen.findByRole("dialog", { name: "Ingredient 2, where it came from" });
  const page = within(sheet).getByRole("region", { name: "On the page" });
  expect(page).toHaveTextContent("On the page · line 4");
  // The line lit, with two either side of it.
  const lines = page.querySelectorAll("[data-source-line]");
  expect([...lines].map((line) => line.textContent)).toEqual(["A sharp, short tart.", "200 g flour", "100 g quince paste", "150 g", "Rub the flour in."]);
  expect(page.querySelector("[data-lit]")).toHaveTextContent("100 g quince paste");
  // What garnish made of it: the amount, and the food it would add.
  expect(within(sheet).getByTestId("read-as")).toHaveTextContent("100 g quince paste · new food");
  expect(within(sheet).getByTestId("line-flag")).toHaveTextContent("“quince paste” isn't one of your foods yet");

  // A food the library lacks asks what its line does; Looks right would have been a guess.
  expect(within(sheet).queryByRole("button", { name: "Looks right" })).not.toBeInTheDocument();
  await user.click(within(sheet).getByRole("button", { name: "Add as a new food" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(within(card()).getByRole("heading")).toHaveTextContent("1 line to check");
});

test("Looks right clears a line kept as text, and the card then says nothing is left", async () => {
  const user = userEvent.setup();
  await renderCheck(PAGE);
  await user.click(within(card()).getByRole("button", { name: "Check 150 g" }));
  const sheet = await screen.findByRole("dialog", { name: "Ingredient 3, where it came from" });
  expect(within(sheet).getByTestId("line-flag")).toHaveTextContent("No food was read from this line");
  await user.click(within(sheet).getByRole("button", { name: "Looks right" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(within(card()).getByRole("heading")).toHaveTextContent("1 line to check");

  // The row is unchanged: still the words as written.
  expect(screen.getByRole("button", { name: "Edit ingredient 3" })).toHaveTextContent("150 g · as text");

  await user.click(screen.getByRole("button", { name: "Keep ingredient 2 as text" }));
  expect(screen.queryByTestId("lines-to-check")).not.toBeInTheDocument();
  expect(screen.getByTestId("lines-checked")).toHaveTextContent("Nothing left to check");
});

test("Where's this from? on a step lights its line, and Edit the line puts the cursor in it", async () => {
  const user = userEvent.setup();
  await renderCheck(PAGE);
  await user.click(screen.getByRole("button", { name: "Step 2 actions" }));
  await user.click(screen.getByRole("menuitem", { name: "Where's this from?" }));
  const sheet = await screen.findByRole("dialog", { name: "Step 2, where it came from" });
  expect(within(sheet).getByRole("region", { name: "On the page" })).toHaveTextContent("On the page · line 7");
  expect(sheet.querySelector("[data-lit]")).toHaveTextContent("Bake until golden.");
  expect(within(sheet).getByTestId("read-as")).toHaveTextContent("Bake until golden.");
  expect(within(sheet).queryByTestId("line-flag")).not.toBeInTheDocument();

  await user.click(within(sheet).getByRole("button", { name: "Edit the line" }));
  await waitFor(() => expect(screen.getByRole("textbox", { name: "Step 2" })).toHaveFocus());
});

test("Edit the line on an ingredient opens its fields", async () => {
  const user = userEvent.setup();
  await renderCheck(PAGE);
  await user.click(screen.getByRole("button", { name: "Ingredient 1 actions" }));
  await user.click(screen.getByRole("menuitem", { name: "Where's this from?" }));
  const sheet = await screen.findByRole("dialog", { name: "Ingredient 1, where it came from" });
  expect(sheet.querySelector("[data-lit]")).toHaveTextContent("200 g flour");
  await user.click(within(sheet).getByRole("button", { name: "Edit the line" }));
  expect(await screen.findByRole("dialog", { name: "Ingredient 1" })).toBeInTheDocument();
});

test("with no page behind it (a file), a flagged line opens with no page part and nothing offers where it came from", async () => {
  const user = userEvent.setup();
  await renderCheck();
  expect(card()).toHaveTextContent("Tap one to see what garnish made of it.");
  await user.click(within(card()).getByRole("button", { name: "Check 150 g" }));
  const sheet = await screen.findByRole("dialog", { name: "Ingredient 3, where it came from" });
  expect(within(sheet).queryByRole("region", { name: "On the page" })).not.toBeInTheDocument();
  expect(within(sheet).getByRole("button", { name: "Looks right" })).toBeInTheDocument();
  await user.click(within(sheet).getByRole("button", { name: "Looks right" }));

  await user.click(screen.getByRole("button", { name: "Ingredient 1 actions" }));
  expect(screen.queryByRole("menuitem", { name: "Where's this from?" })).not.toBeInTheDocument();
});

test("the ingredient box shows how each line reads as it is typed", async () => {
  const user = userEvent.setup();
  await renderInRouter(<RecipeForm initial={emptyDraft()} units={[gram]} tags={[]} storage={memory()} />);
  await user.type(screen.getByRole("textbox", { name: "New ingredients" }), "200 g flour, sifted{enter}salt");
  const read = await screen.findByTestId("read-as-you-type");
  const [first, second] = [...read.querySelectorAll("[data-read-line]")];
  expect(first!.querySelector("[data-read-amount]")).toHaveTextContent("200 g");
  expect(first!.querySelector("strong")).toHaveTextContent("flour");
  expect(first).toHaveTextContent(", sifted");
  // No amount is said in amber, and a food the library lacks is named as new.
  expect(second!.querySelector("[data-read-amount]")).toHaveTextContent("no amount");
  expect(second).toHaveTextContent("salt · new food");
});

function typed(): RecipeDraft {
  return {
    ...emptyDraft(),
    name: "Fried rice",
    parts: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        name: "",
        ingredients: [{ id: "22222222-2222-4222-8222-222222222222", originalText: "2 eggs", note: "" }],
        steps: [{ id: "44444444-4444-4444-8444-444444444444", text: "Fry the rice.", title: "", summary: "", ingredientIds: [] }],
      },
    ],
  };
}

test("Preview in the save bar shows the recipe as it will be saved, and pressing it again brings the form back as it was", async () => {
  const user = userEvent.setup();
  await renderInRouter(<RecipeForm initial={typed()} units={[]} tags={[]} storage={memory()} existing={{ id: "r", slug: "fried-rice" }} />);
  expect(screen.queryByTestId("draft-preview")).not.toBeInTheDocument();

  await user.type(screen.getByRole("textbox", { name: /^Name/ }), " with egg");
  await user.click(screen.getByRole("button", { name: "Preview" }));
  const preview = screen.getByTestId("draft-preview");
  expect(within(preview).getByTestId("preview-name")).toHaveTextContent("Fried rice with egg");
  expect(within(preview).getAllByTestId("preview-step")[0]).toHaveTextContent("Fry the rice.");
  expect(screen.queryByRole("textbox", { name: /^Name/ })).not.toBeInTheDocument();
  // Save stays under the thumb either way.
  expect(screen.getAllByRole("button", { name: "Save changes" }).length).toBeGreaterThan(0);

  await user.click(screen.getByRole("button", { name: "Preview" }));
  expect(screen.queryByTestId("draft-preview")).not.toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: /^Name/ })).toHaveValue("Fried rice with egg");
});

test("the phone's editor is the phone page's shape: the details, then Ingredients and Method as two tabs", async () => {
  const user = userEvent.setup();
  await renderInRouter(<RecipeForm initial={typed()} units={[]} tags={[]} storage={memory()} existing={{ id: "r", slug: "fried-rice" }} />);
  expect(screen.queryByRole("radiogroup", { name: "How you cook it" })).toBeNull();
  expect(screen.getByRole("button", { name: "Add course, cuisine and more" })).toBeInTheDocument();
  const tabs = screen.getByRole("tablist", { name: "Recipe" });
  expect(within(tabs).getByRole("tab", { name: /^Ingredients/ })).toHaveAttribute("aria-selected", "true");
  // The other tab is drawn and hidden by its class (RecipeTabs), so a half-typed step keeps its words.
  const panel = () => screen.getByRole("textbox", { name: "Step 1", hidden: true }).closest('[role="tabpanel"]')!;
  expect(panel()).toHaveClass("hidden");
  await user.click(within(tabs).getByRole("tab", { name: /^Method/ }));
  expect(panel()).toHaveClass("flex");
});
