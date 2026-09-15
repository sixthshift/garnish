import { Input } from "@sixthshift/design-system/input";
import { useState } from "react";

/** The box at the top: Enter adds a free-text line and clears the field. */
export function AddItemForm({ onAdd, busy }: { onAdd: (text: string) => void; busy: boolean }) {
  const [text, setText] = useState("");
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const line = text.trim();
    if (line === "") return;
    onAdd(line);
    setText("");
  };
  return (
    <form onSubmit={submit} data-testid="shopping-add">
      <Input
        value={text}
        onChange={(event) => setText(event.target.value)}
        disabled={busy}
        name="item"
        placeholder="Add an item"
        aria-label="Add an item"
        enterKeyHint="done"
      />
    </form>
  );
}
