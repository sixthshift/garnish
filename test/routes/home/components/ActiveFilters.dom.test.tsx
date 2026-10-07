// Pressing a chip's × clears just that filter; Clear all clears them together.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { ActiveFilters } from "../../../../src/routes/home/components/ActiveFilters";

const tags = [
  { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", name: "Weeknight", slug: "weeknight" },
  { id: "d2d2d2d2-d2d2-4d2d-8d2d-d2d2d2d2d2d2", name: "Pasta", slug: "pasta" },
];

test("each × removes its own filter, and Clear all calls through once", async () => {
  const user = userEvent.setup();
  const onTagsChange = vi.fn();
  const onFavouriteChange = vi.fn();
  const onClearAll = vi.fn();
  render(
    <ActiveFilters
      allTags={tags}
      allFoods={[]}
      tags={["weeknight", "pasta"]}
      foods={[]}
      favourite
      onTagsChange={onTagsChange}
      onFoodsChange={vi.fn()}
      onFavouriteChange={onFavouriteChange}
      onClearAll={onClearAll}
    />
  );

  await user.click(screen.getByRole("button", { name: "Remove Weeknight" }));
  expect(onTagsChange).toHaveBeenCalledWith(["pasta"]);
  await user.click(screen.getByRole("button", { name: "Remove Favourites" }));
  expect(onFavouriteChange).toHaveBeenCalledWith(false);
  await user.click(screen.getByRole("button", { name: "Clear all" }));
  expect(onClearAll).toHaveBeenCalledTimes(1);
});
