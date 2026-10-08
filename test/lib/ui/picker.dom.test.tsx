// SearchInput as a picker, pressed: a row is picked from the list, and Enter
// takes the top row without ever submitting the form the field sits in.

import { SearchInput } from "@sixthshift/design-system/search-input";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, test, vi } from "vitest";
import { type PickerOption, picker } from "../../../src/lib/ui/picker";

const units: PickerOption[] = [
  { value: "g", label: "gram", hint: "g" },
  { value: "cup", label: "cup" },
];

function Harness({ onSelect, onCreate, onSubmit }: { onSelect: (o: PickerOption) => void; onCreate: (t: string) => void; onSubmit: () => void }) {
  const [text, setText] = useState("");
  const options = units.filter((unit) => unit.label.includes(text.trim().toLowerCase()));
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <SearchInput aria-label="Unit" value={text} onValueChange={setText} {...picker({ options, text, onSelect, onCreate, label: "Unit suggestions" })} />
    </form>
  );
}

function setup() {
  const calls = { onSelect: vi.fn(), onCreate: vi.fn(), onSubmit: vi.fn() };
  render(<Harness {...calls} />);
  return { user: userEvent.setup(), field: screen.getByLabelText("Unit"), ...calls };
}

test("a row picked from the list is the option, and the field reads its label", async () => {
  const { user, field, onSelect } = setup();
  await user.type(field, "gr");
  await user.click(await screen.findByRole("option", { name: "gram · g" }));
  expect(onSelect).toHaveBeenCalledWith(units[0]);
  expect(field).toHaveValue("gram");
});

test("Enter on an unknown name creates it and does not submit the form", async () => {
  const { user, field, onCreate, onSubmit } = setup();
  await user.type(field, "pinch");
  expect(await screen.findByRole("option", { name: "Create “pinch”" })).toBeInTheDocument();
  await user.keyboard("{Enter}");
  expect(onCreate).toHaveBeenCalledWith("pinch");
  expect(onSubmit).not.toHaveBeenCalled();
});

test("Enter on part of a name takes the top suggestion, and an arrowed-to row wins", async () => {
  const { user, field, onSelect, onSubmit } = setup();
  await user.type(field, "u{Enter}");
  expect(onSelect).toHaveBeenLastCalledWith(units[1]);
  expect(field).toHaveValue("cup");
  await user.clear(field);
  await user.click(field);
  await user.keyboard("{ArrowDown}{Enter}");
  expect(onSelect).toHaveBeenLastCalledWith(units[1]);
  expect(onSubmit).not.toHaveBeenCalled();
});
