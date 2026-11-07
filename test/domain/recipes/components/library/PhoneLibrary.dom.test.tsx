// A phone's library (decisions.md row 208): two columns of photo cards, each
// going to its recipe's page; the collections as chips; the search held at the
// foot with a round Filters button that carries the count and opens the
// filters sheet, which sets the order, offers a random recipe and ends in
// "Show N recipes".
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, test, vi } from "vitest";
import { PhoneLibrary, type PhoneLibraryProps } from "../../../../../src/domain/recipes/components/library/mobile/PhoneLibrary";
import type { RecipeSummary } from "../../../../../src/domain/recipes/recipe";
import { noFacets } from "../../../../../src/domain/recipes/recipe";
import { renderInRouter } from "../../../../helpers/dom";

vi.mock("../../../../../src/api/rpc/recipes", () => ({ setFavourite: vi.fn(async () => ({})), setKind: vi.fn(async () => ({})) }));

const summary = (slug: string, name: string, totalTime: number | null, favourite = false): RecipeSummary => ({
  id: crypto.randomUUID(),
  slug,
  name,
  image: null,
  rating: null,
  prepTime: null,
  performTime: null,
  totalTime,
  lastMade: null,
  favourite,
  kind: null,
  facets: noFacets(),
  tags: [],
  ingredientPreview: [],
});

const recipes = [summary("laksa", "Laksa", 45), summary("ragu", "Ragu", 180, true), summary("tart", "Lemon tart", null)];
const weeknight = { id: crypto.randomUUID(), name: "Weeknight", slug: "weeknight", recipes: 2 };

function props(overrides: Partial<PhoneLibraryProps> = {}): PhoneLibraryProps {
  return {
    recipes,
    total: 12,
    filtered: false,
    filters: {
      allTags: [weeknight],
      allFoods: [],
      tags: [],
      match: "any",
      foods: [],
      favourite: false,
      onTagsChange: vi.fn(),
      onMatchChange: vi.fn(),
      onFoodsChange: vi.fn(),
      onFavouriteChange: vi.fn(),
    },
    filterCount: 0,
    onClearFilters: vi.fn(),
    shelf: undefined,
    onShelfChange: vi.fn(),
    query: "",
    onQueryChange: vi.fn(),
    onQuerySubmit: vi.fn(),
    sort: "created",
    dir: "desc",
    onSortChange: vi.fn(),
    onDice: vi.fn(),
    marking: false,
    onMarkingChange: vi.fn(),
    ...overrides,
  };
}

describe("the grid", () => {
  test("two columns of photo cards, each named, timed and going to its recipe's page", async () => {
    await renderInRouter(<PhoneLibrary {...props()} />);
    const grid = screen.getByRole("list", { name: "Recipes" });
    expect(grid).toHaveClass("grid-cols-2");
    const cards = within(grid).getAllByRole("listitem");
    expect(cards).toHaveLength(3);
    const laksa = within(grid).getByRole("link", { name: /^Laksa/ });
    expect(laksa).toHaveAttribute("href", "/recipes/laksa");
    expect(laksa).toHaveClass("aspect-4/5");
    expect(laksa).toHaveTextContent("45 min");
    // No time recorded, no badge.
    expect(within(grid).getByRole("link", { name: "Lemon tart" })).toBeInTheDocument();
    // The heart beside each, pressed on a favourite.
    expect(within(cards[1]!).getByRole("button", { name: "Remove from favourites" })).toHaveAttribute("aria-pressed", "true");
    expect(within(cards[0]!).getByRole("button", { name: "Add to favourites" })).toHaveAttribute("aria-pressed", "false");
  });

  test("Mark puts how each is cooked under its card", async () => {
    const user = userEvent.setup();
    function Marking() {
      const [marking, setMarking] = useState(false);
      return <PhoneLibrary {...props({ marking, onMarkingChange: setMarking })} />;
    }
    await renderInRouter(<Marking />);
    expect(screen.queryByRole("radiogroup", { name: "How you cook Ragu" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Mark Rotation & Weekend" }));
    expect(screen.getByRole("radiogroup", { name: "How you cook Ragu" })).toBeInTheDocument();
  });
});

describe("the collections", () => {
  test("a chip chooses the shelf, and Favourites narrows it", async () => {
    const user = userEvent.setup();
    const p = props();
    await renderInRouter(<PhoneLibrary {...p} />);
    const chips = screen.getByRole("radiogroup", { name: "Collection" });
    expect(within(chips).getByRole("radio", { name: "Everything" })).toBeChecked();
    await user.click(within(chips).getByRole("radio", { name: "Weekend" }));
    expect(p.onShelfChange).toHaveBeenCalledWith("weekend");
    await user.click(screen.getByRole("button", { name: "Favourites" }));
    expect(p.filters.onFavouriteChange).toHaveBeenCalledWith(true);
  });
});

describe("the search at the foot", () => {
  test("names how many there are to search, and types through", async () => {
    const user = userEvent.setup();
    const p = props();
    await renderInRouter(<PhoneLibrary {...p} />);
    const pill = screen.getByTestId("search-pill");
    expect(pill).toHaveClass("sticky");
    const box = within(pill).getByRole("textbox", { name: "Search recipes" });
    expect(box).toHaveAttribute("placeholder", "Search 12 recipes");
    await user.type(box, "l");
    expect(p.onQueryChange).toHaveBeenCalledWith("l");
  });

  test("the round Filters button carries the count and opens the sheet, which sets the order and ends in Show N recipes", async () => {
    const user = userEvent.setup();
    const p = props({ filterCount: 2 });
    await renderInRouter(<PhoneLibrary {...p} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Filters, 2 set" }));

    const sheet = await screen.findByRole("dialog", { name: "Filters" });
    // The tags with their counts, and Match all.
    expect(within(sheet).getByRole("group", { name: "Filter by tag" })).toHaveTextContent("Weeknight2");
    expect(within(sheet).getByRole("switch", { name: "Match all" })).toBeInTheDocument();
    // The order, the current one chosen.
    const order = within(sheet).getByRole("radiogroup", { name: "Order" });
    expect(within(order).getByRole("radio", { name: "Newest created" })).toBeChecked();
    await user.click(within(order).getByRole("radio", { name: "Name (A–Z)" }));
    expect(p.onSortChange).toHaveBeenCalledWith("name", "asc");
    // A random recipe from what is left.
    await user.click(within(sheet).getByRole("button", { name: "Open a random recipe" }));
    expect(p.onDice).toHaveBeenCalled();

    await user.click(within(sheet).getByRole("button", { name: "Show 3 recipes" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  test("with nothing set the button carries no count, and an empty list offers no random recipe", async () => {
    const user = userEvent.setup();
    await renderInRouter(<PhoneLibrary {...props({ recipes: [], filtered: true })} />);
    expect(screen.getByText("No recipes match that search.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Filters" }));
    const sheet = await screen.findByRole("dialog", { name: "Filters" });
    expect(within(sheet).queryByRole("button", { name: "Open a random recipe" })).not.toBeInTheDocument();
    expect(within(sheet).getByRole("button", { name: "Show 0 recipes" })).toBeInTheDocument();
  });
});
