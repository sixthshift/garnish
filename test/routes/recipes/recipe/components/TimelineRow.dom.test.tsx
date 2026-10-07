// Critique #8: a cook-log entry's Delete removed the entry, its comment and its
// photo from one red menu item, with nothing to bring them back. The menu item
// now opens a confirm, and only the confirm deletes.
import { screen } from "@testing-library/react";
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

async function openConfirm() {
  const user = userEvent.setup();
  await renderInRouter(
    <ul>
      <TimelineRow event={event} />
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

test("Cancel keeps the entry", async () => {
  const user = await openConfirm();
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  expect(deleteTimelineEvent).not.toHaveBeenCalled();
  expect(screen.queryByRole("dialog")).toBeNull();
});
