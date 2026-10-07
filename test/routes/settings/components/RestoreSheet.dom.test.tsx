// The restore confirm, pressed (M40.5): Restore does nothing until the box is
// ticked, and once ticked it restores.
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { RestoreSheet } from "../../../../src/routes/settings/components/RestoreSheet";
import { RESTORE_CHECK as CHECK } from "../../../helpers/backup";
import { renderInRouter } from "../../../helpers/dom";

test("ticking the box enables Restore", async () => {
  const user = userEvent.setup();
  const onRestore = vi.fn();
  await renderInRouter(<RestoreSheet open check={CHECK} onRestore={onRestore} onCancel={() => {}} />);

  const button = screen.getByTestId("restore-confirm") as HTMLButtonElement;
  expect(button.disabled).toBe(true);
  await user.click(button);
  expect(onRestore).not.toHaveBeenCalled();

  await user.click(screen.getByRole("checkbox", { name: "I understand this replaces everything" }));
  expect(button.disabled).toBe(false);
  await user.click(button);
  expect(onRestore).toHaveBeenCalledOnce();
});
