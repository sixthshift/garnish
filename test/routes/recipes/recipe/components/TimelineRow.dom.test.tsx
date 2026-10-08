// Critique #8: a cook-log entry's Delete removed the entry, its comment and its
// photo from one red menu item, with nothing to bring them back. The menu item
// now opens a confirm, and only the confirm deletes; leaving it puts focus back
// on the row's ⋯ rather than the page body.
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { timelineEventSchema } from "../../../../../src/domain/recipe";
import { TimelineRow } from "../../../../../src/routes/recipes/recipe/components/TimelineRow";
import { renderInRouter } from "../../../../helpers/dom";

const deleteTimelineEvent = vi.hoisted(() => vi.fn(async () => ({})));
vi.mock("../../../../../src/server/fns/timeline", () => ({ deleteTimelineEvent }));

const event = timelineEventSchema.parse({
  id: "11111111-1111-4111-8111-111111111111",
  recipeId: "22222222-2222-4222-8222-222222222222",
  occurredOn: "2026-01-07",
  message: "Lovely",
  createdAt: "2026-01-07T00:00:00.000Z",
});

beforeEach(() => deleteTimelineEvent.mockClear());

async function openConfirm(entry = event) {
  const user = userEvent.setup();
  await renderInRouter(
    <ul>
      <TimelineRow event={entry} />
    </ul>
  );
  await user.click(screen.getByRole("button", { name: /^Actions for entry from/ }));
  await user.click(screen.getByRole("menuitem", { name: "Delete" }));
  return user;
}

test("Delete asks first, and deletes only on the confirm", async () => {
  const user = await openConfirm();
  expect(deleteTimelineEvent).not.toHaveBeenCalled();
  const dialog = screen.getByRole("dialog");
  await user.click(screen.getAllByRole("button", { name: "Delete" }).find((button) => dialog.contains(button))!);
  expect(deleteTimelineEvent).toHaveBeenCalledOnce();
});

const trigger = () => screen.getByRole("button", { name: /^Actions for entry from/ });

test("Cancel keeps the entry, and focus goes back to the row's ⋯", async () => {
  const user = await openConfirm();
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  expect(deleteTimelineEvent).not.toHaveBeenCalled();
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(trigger());
});

test("Escape closes the confirm, and focus goes back to the row's ⋯", async () => {
  const user = await openConfirm();
  const dialog = screen.getByRole("dialog");
  // Where a browser's focus manager puts it: inside the dialog.
  screen.getByRole("button", { name: "Cancel" }).focus();
  await user.keyboard("{Escape}");
  // Escape plays the modal's exit and reports the close on `animationend`, which happy-dom never fires.
  fireEvent.animationEnd(dialog);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(deleteTimelineEvent).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(trigger());
});

// G3: the confirm said "Its comment and photo go with it" for every entry. It names only what the entry holds.
test.each([
  ["a comment and a photo", "Lovely", "photo.webp", "Its comment and photo go with it."],
  ["only a comment", "Lovely", null, "Its comment goes with it."],
  ["only a photo", "", "photo.webp", "Its photo goes with it."],
  ["neither", "", null, null],
])("the confirm for an entry with %s says what goes with it", async (_, message, image, line) => {
  await openConfirm({ ...event, message, image });
  const dialog = screen.getByRole("dialog");
  for (const other of ["Its comment and photo go with it.", "Its comment goes with it.", "Its photo goes with it."]) {
    expect(dialog.textContent?.includes(other)).toBe(other === line);
  }
  expect(dialog.textContent).toContain("Delete the entry from");
});
