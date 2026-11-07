// A desktop's library filters as a column (decisions.md row 207): the shelves
// and the tags as pressed toggles with their counts, the food filter, the
// favourites and the order, each change handed up as the phone's sheet hands
// it, and a Clear once anything is set.
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { FiltersColumn, type FiltersColumnProps } from "../../../../../src/domain/recipes/components/library/desktop/FiltersColumn";
import { noFacets } from "../../../../../src/domain/recipes/recipe";
import type { TagUsage } from "../../../../../src/domain/recipes/reference";

const tag = (name: string, recipes: number): TagUsage => ({ id: `tag-${name}`, name, slug: name.toLowerCase(), recipes });
const allTags = [tag("Weeknight", 6), tag("Baking", 4), ...Array.from({ length: 9 }, (_, i) => tag(`Extra ${i + 1}`, 1))];
const flour = { id: "11111111-1111-4111-8111-111111111111", name: "flour" };

function column(overrides: Partial<FiltersColumnProps> = {}) {
  const props: FiltersColumnProps = {
    allTags,
    allFoods: [flour, { id: "22222222-2222-4222-8222-222222222222", name: "rice" }],
    tags: [],
    match: "any",
    foods: [],
    favourite: false,
    facets: noFacets(),
    facetCounts: [],
    onFacetsChange: vi.fn(),
    onTagsChange: vi.fn(),
    onMatchChange: vi.fn(),
    onFoodsChange: vi.fn(),
    onFavouriteChange: vi.fn(),
    query: "",
    onQueryChange: vi.fn(),
    onQuerySubmit: vi.fn(),
    shelf: undefined,
    shelves: { all: 18, rotation: 5, weekend: 2, try: 6 },
    onShelfChange: vi.fn(),
    sort: "created",
    dir: "desc",
    onSortChange: vi.fn(),
    filterCount: 0,
    onClearFilters: vi.fn(),
    ...overrides,
  };
  render(<FiltersColumn {...props} />);
  return props;
}

const shelves = () => within(screen.getByRole("region", { name: "Collections" }));
const tags = () => within(screen.getByRole("region", { name: "Tags" }));

test("the shelves show their counts, Everything pressed with none set, and a press chooses one", async () => {
  const user = userEvent.setup();
  const props = column();
  expect(shelves().getByRole("button", { name: "Everything 18" })).toHaveAttribute("aria-pressed", "true");
  expect(shelves().getByRole("button", { name: "Rotation 5" })).toHaveAttribute("aria-pressed", "false");
  expect(shelves().getByRole("button", { name: "To try 6" })).toBeInTheDocument();
  await user.click(shelves().getByRole("button", { name: "Weekend 2" }));
  expect(props.onShelfChange).toHaveBeenCalledWith("weekend");
  await user.click(shelves().getByRole("button", { name: "Everything 18" }));
  expect(props.onShelfChange).toHaveBeenLastCalledWith(undefined);
});

test("a tag toggles on and off with its count beside it; the rest wait behind More tags", async () => {
  const user = userEvent.setup();
  const props = column({ tags: ["baking"] });
  expect(tags().getByRole("button", { name: "Baking 4" })).toHaveAttribute("aria-pressed", "true");
  await user.click(tags().getByRole("button", { name: "Weeknight 6" }));
  expect(props.onTagsChange).toHaveBeenCalledWith(["baking", "weeknight"]);
  await user.click(tags().getByRole("button", { name: "Baking 4" }));
  expect(props.onTagsChange).toHaveBeenLastCalledWith([]);

  // Eight up front; the other three behind the button, with a field to find one.
  expect(tags().queryByRole("button", { name: "Extra 9 1" })).toBeNull();
  await user.click(tags().getByRole("button", { name: "More tags (3)" }));
  await user.type(tags().getByRole("textbox", { name: "Find a tag" }), "9");
  await user.click(tags().getByRole("button", { name: "Extra 9 1" }));
  expect(props.onTagsChange).toHaveBeenLastCalledWith(["baking", "extra 9"]);
  await user.click(tags().getByRole("switch", { name: "Match all" }));
  expect(props.onMatchChange).toHaveBeenCalledWith("all");
});

test("the search, the food, the favourites and the order hand their changes up", async () => {
  const user = userEvent.setup();
  const props = column({ foods: [flour.id] });
  await user.type(screen.getByRole("textbox", { name: "Search recipes" }), "l");
  expect(props.onQueryChange).toHaveBeenCalledWith("l");
  await user.keyboard("{Enter}");
  expect(props.onQuerySubmit).toHaveBeenCalled();

  // A chosen food is a chip, removed by its ×.
  await user.click(screen.getByRole("button", { name: "Remove flour" }));
  expect(props.onFoodsChange).toHaveBeenCalledWith([]);

  await user.click(screen.getByRole("switch", { name: "Favourites only" }));
  expect(props.onFavouriteChange).toHaveBeenCalledWith(true);
  expect(screen.getByRole("button", { name: "Sort: Newest created" })).toBeInTheDocument();
});

test("Clear filters appears once something is set, and clears", async () => {
  const user = userEvent.setup();
  const props = column({ filterCount: 2 });
  await user.click(screen.getByRole("button", { name: "Clear filters (2)" }));
  expect(props.onClearFilters).toHaveBeenCalled();
});

test("nothing set, nothing to clear", () => {
  column();
  expect(screen.queryByRole("button", { name: /Clear filters/ })).toBeNull();
});

// What a recipe is (decisions.md row 209): a list a layer under the shelves.

const counts = [
  { layer: "course" as const, value: "main", count: 9 },
  { layer: "course" as const, value: "sauce", count: 2 },
  { layer: "cuisine" as const, value: "thai", count: 3 },
];

test("each layer lists the values some recipe has, with their counts, and a layer none has is named and says so", () => {
  column({ facetCounts: counts });
  const course = within(screen.getByRole("region", { name: "Course" }));
  expect(course.getByRole("button", { name: "Main 9" })).toHaveAttribute("aria-pressed", "false");
  expect(course.getByRole("button", { name: "Sauce or dressing 2" })).toBeInTheDocument();
  expect(course.queryByRole("button", { name: /Side/ })).toBeNull();
  expect(screen.getByRole("region", { name: "Cuisine" })).toBeInTheDocument();
  const diet = within(screen.getByRole("region", { name: "Diet" }));
  expect(diet.getByText("None marked yet")).toBeInTheDocument();
  expect(diet.queryByRole("button")).toBeNull();
});

test("pressing a value asks for it beside the layer's others, and pressing it again lets it go", async () => {
  const user = userEvent.setup();
  const props = column({ facetCounts: counts, facets: { ...noFacets(), course: ["sauce"] } });
  const course = within(screen.getByRole("region", { name: "Course" }));
  expect(course.getByRole("button", { name: "Sauce or dressing 2" })).toHaveAttribute("aria-pressed", "true");
  await user.click(course.getByRole("button", { name: "Main 9" }));
  expect(props.onFacetsChange).toHaveBeenLastCalledWith({ ...noFacets(), course: ["main", "sauce"] });
  await user.click(course.getByRole("button", { name: "Sauce or dressing 2" }));
  expect(props.onFacetsChange).toHaveBeenLastCalledWith(noFacets());
});

test("a value asked for that no recipe has now still shows, so it can be let go", () => {
  column({ facetCounts: [], facets: { ...noFacets(), season: ["winter"] } });
  expect(within(screen.getByRole("region", { name: "Season" })).getByRole("button", { name: "Winter 0" })).toHaveAttribute("aria-pressed", "true");
});
