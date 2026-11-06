// Check, the import's stage in the editor (decisions.md row 203): the lines the
// read could not settle are asked about one by one or all at once, the page's
// new tags are one press away, and nothing reaches the library until Save.
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { RecipeForm } from "../../../../../src/domain/recipes/components/editor/RecipeForm";
import { importDraft } from "../../../../../src/domain/recipes/draft";
import type { ScrapedRecipe } from "../../../../../src/domain/recipes/import";
import { reviewRows } from "../../../../../src/domain/recipes/ingredient";
import type { RecipeInput } from "../../../../../src/domain/recipes/recipe";
import type { FoodRow, Unit } from "../../../../../src/domain/recipes/reference";
import { renderInRouter } from "../../../../helpers/dom";

const rpc = vi.hoisted(() => ({
  createRecipe: vi.fn(async (_: { data: unknown }) => ({ id: "99999999-9999-4999-8999-999999999999", slug: "lemon-tart" })),
  findOrCreateFood: vi.fn(),
  findOrCreateUnit: vi.fn(),
}));
vi.mock("../../../../../src/api/rpc/recipes", async (importOriginal) => ({ ...(await importOriginal<object>()), createRecipe: rpc.createRecipe }));
vi.mock("../../../../../src/api/rpc/foods", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listFoods: vi.fn(async () => []),
  findOrCreateFood: rpc.findOrCreateFood,
}));
vi.mock("../../../../../src/api/rpc/units", async (importOriginal) => ({ ...(await importOriginal<object>()), findOrCreateUnit: rpc.findOrCreateUnit }));

beforeEach(() => {
  rpc.createRecipe.mockClear();
  rpc.findOrCreateFood.mockClear();
  rpc.findOrCreateUnit.mockClear();
});

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
const SOURCE = "https://recipes.example/lemon-tart";
const scraped: ScrapedRecipe = {
  name: "Lemon tart",
  description: "",
  image: null,
  servings: 8,
  yieldText: "",
  prepMinutes: null,
  cookMinutes: null,
  tags: [],
  parts: [{ name: "", ingredients: ["200 g flour", "100 g quince paste", "2 tbsp verjuice"], steps: ["Rub in.", "Bake."] }],
};

/** The read as Check opens on it: flour linked, quince paste and verjuice asked about. */
function opened() {
  const rows = reviewRows(
    scraped.parts.flatMap((part) => part.ingredients),
    { units: [gram], foods: [flour] }
  );
  return importDraft({ scraped, sourceUrl: SOURCE, rows });
}

function memory() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  };
}

async function renderCheck(options: { onContinue?: (...args: unknown[]) => void } = {}) {
  const { draft, pending } = opened();
  const check = {
    pending,
    note: null,
    duplicate: { name: "Lemon tart", slug: "lemon-tart", by: "url" as const },
    suggestedTags: ["French"],
    onBack: vi.fn(),
  };
  const continueWith = options.onContinue ? { label: "Continue", onContinue: options.onContinue, onBack: check.onBack } : undefined;
  await renderInRouter(<RecipeForm initial={draft} units={[gram]} tags={[]} storage={memory()} isImport importCheck={check} continueWith={continueWith} />);
  return check;
}

const status = () => screen.getByTestId("import-status");
const saved = () => rpc.createRecipe.mock.calls[0]![0].data as RecipeInput;

test("says where the recipe came from, what is linked, and what is already here", async () => {
  await renderCheck();
  expect(screen.getByTestId("import-source")).toHaveAttribute("href", SOURCE);
  expect(screen.getByTestId("import-source")).toHaveTextContent("recipes.example");
  expect(status()).toHaveTextContent("1 linked · 2 need a food");
  expect(within(screen.getByTestId("duplicate-note")).getByRole("link", { name: "Lemon tart" })).toBeInTheDocument();
  expect(screen.getAllByText("New food: quince paste").length).toBeGreaterThan(0);
});

test("Add, Keep as text and a tag from the page, and only Save makes anything", async () => {
  const user = userEvent.setup();
  await renderCheck();

  await user.click(screen.getByRole("button", { name: "Add new food: quince paste" }));
  expect(status()).toHaveTextContent("2 linked · 1 needs a food");
  await user.click(screen.getByRole("button", { name: "Keep ingredient 3 as text" }));
  expect(status()).toHaveTextContent("2 linked");
  expect(screen.queryByRole("button", { name: "Add all as new foods" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Add the tag French" }));

  // Nothing has been added to the library: a placeholder is only a name until Save.
  expect(rpc.findOrCreateFood).not.toHaveBeenCalled();
  expect(rpc.findOrCreateUnit).not.toHaveBeenCalled();
  expect(rpc.createRecipe).not.toHaveBeenCalled();

  await user.click(screen.getAllByRole("button", { name: "Save recipe" })[0]!);
  await waitFor(() => expect(rpc.createRecipe).toHaveBeenCalledTimes(1));
  const [flourRow, quince, verjuice] = saved().parts[0]!.ingredients!;
  expect(flourRow!.food?.id).toBe(flour.id);
  expect(quince).toMatchObject({ quantity: 100, originalText: "100 g quince paste" });
  expect(quince!.unit?.id).toBe(gram.id);
  expect(quince!.food?.name).toBe("quince paste");
  expect(verjuice).toMatchObject({ food: null, originalText: "2 tbsp verjuice" });
  expect(saved().tags?.map((tag) => tag.name)).toEqual(["French"]);
  expect(saved().sourceUrl).toBe(SOURCE);
});

test("Add all as new foods settles every line at once", async () => {
  const user = userEvent.setup();
  await renderCheck();
  await user.click(screen.getByRole("button", { name: "Add all as new foods" }));
  expect(status()).toHaveTextContent("3 linked");
  expect(screen.queryByText("New food: verjuice")).not.toBeInTheDocument();
});

test("Pick fills the line and opens it, so another food can be chosen", async () => {
  const user = userEvent.setup();
  await renderCheck();
  await user.click(screen.getByRole("button", { name: "Pick a food for ingredient 2" }));
  const sheet = await screen.findByRole("dialog", { name: "Ingredient 2" });
  expect(within(sheet).getByRole("combobox", { name: "Ingredient 2 food" })).toHaveValue("quince paste");
});

test("with a model, Continue hands on the draft and the lines still asked about", async () => {
  const user = userEvent.setup();
  const onContinue = vi.fn();
  const { pending } = await renderCheck({ onContinue }).then((check) => ({ pending: check.pending }));
  await user.click(screen.getByRole("button", { name: "Add new food: quince paste" }));
  await user.click(screen.getAllByRole("button", { name: "Continue" })[0]!);
  await waitFor(() => expect(onContinue).toHaveBeenCalledTimes(1));
  const [draft, , stillAsking] = onContinue.mock.calls[0]!;
  expect((draft as { parts: { ingredients: { food: { name: string } | null }[] }[] }).parts[0]!.ingredients[1]!.food?.name).toBe("quince paste");
  expect(Object.keys(stillAsking as object)).toHaveLength(1);
  expect(Object.keys(pending)).toHaveLength(2);
  expect(rpc.createRecipe).not.toHaveBeenCalled();
});
