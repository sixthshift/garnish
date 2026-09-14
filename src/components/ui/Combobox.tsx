// Free-text input with a suggestion list: type to filter, pick a suggestion,
// or keep what was typed. The design system's Select only picks from fixed
// options and its TagInput holds many values, so autocomplete over a single
// value (a unit, a food) is built here from Input.
//
// The parent owns both the text (`value`/`onChange`) and the suggestions
// (`options`), so it decides whether they come from a local list or a server
// query. When `onCreate` is given and the text matches no option label, a
// final "Create “text”" row offers the typed value as a new entry. The list
// opens while the input has focus and there is something to show; it renders
// closed on the server. Arrow keys move, Enter picks, Escape closes.
//
// Enter with the list closed — after an Escape, or a pick, or on a field whose
// suggestions never arrived — takes the typed text anyway: the exact option if
// there is one, else the new name (M21.5). That is Mealie's "press enter to
// create", and it also means Enter in this field never reaches the form and
// saves the recipe by accident, which is what it used to do.
import { Input } from "@sixthshift/design-system/input";
import { cn } from "@sixthshift/design-system/utils";
import { type KeyboardEvent, useId, useState } from "react";
import { type ComboboxOption, type ComboboxItem, listItems, enterChoice, stepActive } from "../../lib/ui/combobox";

export type ComboboxProps = {
  value: string;
  onChange: (text: string) => void;
  options: readonly ComboboxOption[];
  onSelect: (option: ComboboxOption) => void;
  /** When given, a "Create “text”" row shows for text that matches no option label. */
  onCreate?: (text: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  id?: string;
  name?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
};

export function Combobox({
  value,
  onChange,
  options,
  onSelect,
  onCreate,
  onFocus,
  onBlur,
  id,
  name,
  placeholder,
  disabled,
  className,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
}: ComboboxProps) {
  const listId = useId();
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [active, setActive] = useState(-1);

  const items = listItems(options, value, onCreate !== undefined);
  const open = focused && !dismissed && items.length > 0;
  const activeItem = open && active >= 0 && active < items.length ? items[active] : undefined;

  const pick = (item: ComboboxItem) => {
    if (item.kind === "option") onSelect(item.option);
    else onCreate?.(item.text);
    setActive(-1);
    setDismissed(true);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setDismissed(false);
      setActive((current) => stepActive(current, event.key === "ArrowDown" ? 1 : -1, items.length));
      return;
    }
    if (event.key === "Escape" && open) {
      event.preventDefault();
      setDismissed(true);
      setActive(-1);
      return;
    }
    if (event.key === "Enter") {
      const choice = enterChoice(items, options, value, open, activeItem, onCreate !== undefined);
      if (choice.kind === "pass") return;
      event.preventDefault();
      pick(choice.item);
    }
  };

  return (
    <div className={cn("relative", className)}>
      <Input
        id={id}
        name={name}
        type="text"
        role="combobox"
        autoComplete="off"
        aria-label={ariaLabel}
        aria-invalid={ariaInvalid || undefined}
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls={open ? listId : undefined}
        aria-activedescendant={activeItem ? `${listId}-${active}` : undefined}
        placeholder={placeholder}
        disabled={disabled}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setDismissed(false);
          setActive(-1);
        }}
        onFocus={() => {
          setFocused(true);
          setDismissed(false);
          onFocus?.();
        }}
        onBlur={() => {
          setFocused(false);
          setActive(-1);
          onBlur?.();
        }}
        onKeyDown={onKeyDown}
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={ariaLabel ? `${ariaLabel} suggestions` : undefined}
          className="absolute left-0 top-full z-10 mt-1 max-h-60 w-full min-w-40 overflow-auto rounded-lg border border-border-normal bg-bg-normal p-1 shadow-md"
        >
          {items.map((item, index) => {
            const selected = index === active;
            const key = item.kind === "option" ? item.option.value : "__create__";
            return (
              <li
                key={key}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={selected}
                className={cn(
                  "flex cursor-pointer items-baseline justify-between gap-2 rounded-md px-2 py-1.5 text-sm",
                  selected ? "bg-bg-subtle" : "hover:bg-bg-subtle",
                  item.kind === "create" && "text-fg-brand",
                )}
                // mousedown would blur the input and close the list before click lands.
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => pick(item)}
              >
                {item.kind === "option" ? (
                  <>
                    <span className="truncate">{item.option.label}</span>
                    {item.option.hint !== undefined && <span className="shrink-0 text-xs text-fg-subtle">{item.option.hint}</span>}
                  </>
                ) : (
                  <span>Create “{item.text}”</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
