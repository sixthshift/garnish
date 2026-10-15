// The editor's tags (decisions.md row 172): typing finds the household's tags,
// a name it does not find is created only when picked as "Create", and a chip
// removes its tag.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, test } from "vitest";
import type { Tag } from "../../../../src/domain/reference";
import { TagField } from "../../../../src/routes/recipes/components/TagField";

const weeknight: Tag = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "Weeknight", slug: "weeknight" };
const vegetarian: Tag = { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name: "Vegetarian", slug: "vegetarian" };

let latest: Tag[] = [];
function Harness({ initial = [] as Tag[] }) {
  const [tags, setTags] = useState<Tag[]>(initial);
  latest = tags;
  return <TagField value={tags} known={[weeknight, vegetarian]} onChange={setTags} />;
}

const chips = () => screen.queryByRole("list", { name: "Recipe tags" })?.textContent ?? "";

test("typing finds a tag the household has, and picking it adds that tag, not a new one", async () => {
  const user = userEvent.setup();
  render(<Harness />);
  await user.type(screen.getByRole("combobox", { name: "Add a tag" }), "week");
  await user.click(await screen.findByRole("option", { name: "Weeknight" }));
  expect(latest).toEqual([weeknight]);
  expect(screen.getByRole("combobox", { name: "Add a tag" })).toHaveValue("");
});

test("a name it does not find is offered as Create, and made in the house style", async () => {
  const user = userEvent.setup();
  render(<Harness />);
  await user.type(screen.getByRole("combobox", { name: "Add a tag" }), "slow cooked");
  expect(screen.queryByRole("option", { name: "Weeknight" })).toBeNull();
  await user.click(await screen.findByRole("option", { name: "Create “slow cooked”" }));
  expect(latest.map((tag) => tag.name)).toEqual(["Slow cooked"]);
  expect(latest[0]!.id).not.toBe(weeknight.id);
});

test("Enter on a known name in any case takes the household's tag", async () => {
  const user = userEvent.setup();
  render(<Harness />);
  await user.type(screen.getByRole("combobox", { name: "Add a tag" }), "VEGETARIAN{Enter}");
  expect(latest).toEqual([vegetarian]);
});

test("a list typed with commas is several tags", async () => {
  const user = userEvent.setup();
  render(<Harness />);
  await user.type(screen.getByRole("combobox", { name: "Add a tag" }), "quick, weeknight{Enter}");
  expect(latest.map((tag) => tag.name)).toEqual(["Quick", "Weeknight"]);
  expect(latest[1]).toEqual(weeknight);
});

test("a chip's remove takes its tag off", async () => {
  const user = userEvent.setup();
  render(<Harness initial={[weeknight, vegetarian]} />);
  expect(chips()).toContain("Weeknight");
  await user.click(screen.getByRole("button", { name: /Remove Weeknight/i }));
  expect(latest).toEqual([vegetarian]);
});
