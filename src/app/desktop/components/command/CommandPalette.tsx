import { Modal } from "@sixthshift/design-system/modal";
import { useEffect, useId, useRef } from "react";
import { nextSearchIndex } from "../../../../lib/search";
import { CommandList } from "../../../components/command/CommandList";
import { useCommands } from "../../../components/command/useCommands";
import { Kbd, SearchIcon } from "./Kbd";

/**
 * The command bar's palette (decisions.md row 207): one box that opens a
 * recipe, puts one on a day ("ragu tue"), adds a line to the shopping list or
 * goes to a page. What was typed becomes options in `commands.ts`, and
 * `useCommands` reads the recipes and the plan they need and does what is
 * chosen, as a phone's + sheet does. The box keeps focus and the keyboard:
 * the arrows move the highlight, Enter does it, Esc (the Modal's) closes it.
 */
export function CommandPalette({ onClose, today: fixedToday }: { onClose: () => void; today?: string }) {
  const { today, query, setQuery, options, active, setSelected, run } = useCommands({ onClose, today: fixedToday });
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => input.current?.focus(), []);

  useEffect(() => {
    document.getElementById(`${listId}-${active}`)?.scrollIntoView?.({ block: "nearest" });
  }, [listId, active]);

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
    <Modal align="top" aria-label="Command bar" onOpenChange={(open) => !open && onClose()} className="sm:top-[11vh] sm:w-[min(42.5rem,90vw)] shadow-2xl">
      <div className="flex items-center gap-3 border-b border-border-normal px-4 py-3.5">
        <span className="text-fg-subtle">
          <SearchIcon size={18} />
        </span>
        <input
          ref={input}
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={options.length > 0 ? `${listId}-${active}` : undefined}
          aria-label="Search, plan or add"
          placeholder="Try “ragu tue”, “milk” or “plan”"
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 bg-transparent text-lg outline-none placeholder:text-fg-subtle focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        <Kbd>Esc</Kbd>
      </div>
      <CommandList
        id={listId}
        options={options}
        active={active}
        query={query}
        today={today}
        onHover={setSelected}
        onChoose={(option) => void run(option)}
        className="max-h-[27.5rem] overflow-y-auto p-2"
      />
      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border-normal bg-bg-subtle px-4 py-2.5 text-xs text-fg-subtle">
        <span>
          <Kbd>↑</Kbd> <Kbd>↓</Kbd> choose
        </span>
        <span>
          <Kbd>↵</Kbd> do it
        </span>
        <span>End with a day to plan it: “risotto wed”</span>
        <span>Anything else goes on the shopping list</span>
      </div>
    </Modal>
  );
}
