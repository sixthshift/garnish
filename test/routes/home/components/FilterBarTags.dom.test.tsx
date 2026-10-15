// The filter bar's tags (decisions.md row 173): the most used up front with
// their counts, the rest behind More tags with a search, and a choice made in
// one group keeps the selection made in the other.
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, test } from "vitest";
import type { TagUsage } from "../../../../src/domain/reference";
import { FilterBar } from "../../../../src/routes/home/components/FilterBar";

const tag = (name: string, recipes: number): TagUsage => ({ id: name, name, slug: name.toLowerCase().replace(/ /g, "-"), recipes });
const library = Array.from({ length: 8 }, (_, i) => tag(`Common ${i}`, 10 - i)).concat([tag("Gluten free", 1), tag("Party", 1)]);

let selected: string[] = [];
function Harness() {
  const [tags, setTags] = useState<string[]>(["common-0"]);
  selected = tags;
  return (
    <FilterBar
      allTags={library}
      allFoods={[]}
      tags={tags}
      match="any"
      foods={[]}
      favourite={false}
      onTagsChange={setTags}
      onMatchChange={() => {}}
      onFoodsChange={() => {}}
      onFavouriteChange={() => {}}
    />
  );
}

test("shows the most used with counts, and finds the rest behind More tags", async () => {
  const user = userEvent.setup();
  render(<Harness />);
  const top = screen.getByRole("group", { name: "Filter by tag" });
  expect(within(top).getByRole("button", { name: "Common 0 10" })).toHaveAttribute("aria-pressed", "true");
  expect(within(top).queryByRole("button", { name: /Party/ })).toBeNull();

  await user.click(screen.getByRole("button", { name: "More tags (2)" }));
  await user.type(screen.getByRole("textbox", { name: "Find a tag" }), "part");
  const more = screen.getByRole("group", { name: "More tags" });
  expect(within(more).queryByRole("button", { name: /Gluten free/ })).toBeNull();
  await user.click(within(more).getByRole("button", { name: "Party 1" }));

  expect(selected).toEqual(["common-0", "party"]);
  // Selected, Party now stays up front with the others.
  expect(within(screen.getByRole("group", { name: "Filter by tag" })).getByRole("button", { name: "Party 1" })).toHaveAttribute("aria-pressed", "true");
});
