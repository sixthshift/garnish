import { Button } from "@sixthshift/design-system/button";
import { Input } from "@sixthshift/design-system/input";
import { Modal, ModalBody, ModalHeader } from "@sixthshift/design-system/modal";
import { useId, useRef } from "react";
import { nextSearchIndex } from "../../../../lib/search";
import { CommandList } from "../../../components/command/CommandList";
import { useCommands } from "../../../components/command/useCommands";

/**
 * A phone's command bar, the tab bar's + (decisions.md row 208): the same
 * box as a desktop's palette (row 207), in a sheet from the bottom. It puts
 * a recipe on a day ("ragu tue"), adds a line to the shopping list, opens a
 * recipe or goes to a page, and closes with a toast for what it wrote. The
 * box has focus, so the keyboard is up at once; the chips under it are
 * examples to tap rather than type, made from the household's own planned
 * recipes. A tall sheet, as the plan's add sheet is, so the box stays put
 * while the options arrive under it.
 */
export function CommandSheet({ onClose, today: fixedToday }: { onClose: () => void; today?: string }) {
  const { today, query, setQuery, options, active, setSelected, run, examples } = useCommands({ onClose, today: fixedToday });
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const next = nextSearchIndex(active, options.length, event.key);
    if (next !== null) {
      event.preventDefault();
      setSelected(next);
    } else if (event.key === "Enter") {
      event.preventDefault();
      void run(options[active]);
    }
  };

  return (
    // No close button, as the mockup's sheet has none: the sheet's focus
    // manager gives focus to its first control, and with the box first that
    // is the box, which a focus of our own could only race (the plan's add
    // sheet's two frames lose to it in a real browser). The scrim above the
    // sheet, Esc and a done command close it.
    <Modal size="md" align="top" className="max-sm:h-[92dvh]" onOpenChange={(open) => !open && onClose()}>
      <ModalHeader className="pb-3">Plan, add or find</ModalHeader>
      <div className="flex flex-col gap-3 px-6 pb-2">
        <Input
          ref={input}
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={options.length > 0 ? `${listId}-${active}` : undefined}
          aria-label="Search, plan or add"
          placeholder="“ragu tue”, “milk”, “settings”…"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="go"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
          className="h-12 text-base"
        />
        <fieldset aria-label="Examples" className="flex flex-wrap gap-1.5">
          {examples.map((example) => (
            <Button
              key={example}
              size="sm"
              variant="outline"
              className="rounded-full"
              onClick={() => {
                setQuery(example);
                input.current?.focus();
              }}
            >
              {example}
            </Button>
          ))}
        </fieldset>
      </div>
      {/* Clear of the home indicator, as the plan's add sheet is. */}
      <ModalBody className="flex flex-col gap-2 px-4 max-sm:pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <CommandList
          id={listId}
          options={options}
          active={active}
          query={query}
          today={today}
          onHover={setSelected}
          onChoose={(option) => void run(option)}
          itemClassName="min-h-12 text-base"
          wrap
        />
        <p className="px-2.5 text-sm text-fg-subtle">End with a day to plan it. Anything else goes on the shopping list.</p>
      </ModalBody>
    </Modal>
  );
}
