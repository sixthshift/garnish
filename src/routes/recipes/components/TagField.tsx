import { SearchInput } from "@sixthshift/design-system/search-input";
import { TagChip } from "@sixthshift/design-system/tag-chip";
import { useState } from "react";
import { tagsFromNames } from "../../../domain/draft";
import { type Tag, tagKey } from "../../../domain/reference";
import { type PickerOption, picker } from "../../../lib/ui/picker";

/** As many of the household's tags as the field offers at once. */
const SHOWN = 8;

/**
 * The household's tags that `text` finds and the recipe does not have yet,
 * those starting with it first. Nothing while the field is empty. Pure.
 */
export function tagOptions(known: readonly Tag[], chosen: readonly Tag[], text: string): PickerOption[] {
  const key = tagKey(text);
  if (key === "") return [];
  const have = new Set(chosen.map((tag) => tagKey(tag.name)));
  const found = known.filter((tag) => !have.has(tagKey(tag.name)) && tagKey(tag.name).includes(key));
  const starts = found.filter((tag) => tagKey(tag.name).startsWith(key));
  return [...starts, ...found.filter((tag) => !starts.includes(tag))].slice(0, SHOWN).map((tag) => ({ value: tag.id, label: tag.name }));
}

export type TagFieldProps = {
  id?: string;
  /** The recipe's tags. */
  value: readonly Tag[];
  /** The household's tags, to suggest from. */
  known: readonly Tag[];
  disabled?: boolean;
  onChange: (tags: Tag[]) => void;
};

/**
 * The editor's tags (decisions.md row 172): the recipe's own as removable
 * chips, and a field that finds the household's tags as it is typed into. A
 * name it does not find is offered as "Create “…”", so a new tag is always a
 * choice rather than a typo; a list typed with commas is split by the tag
 * rule (row 170).
 */
export function TagField({ id, value, known, disabled, onChange }: TagFieldProps) {
  const [text, setText] = useState("");
  const add = (names: string[]) => {
    onChange(tagsFromNames([...value.map((tag) => tag.name), ...names], [...value, ...known]));
    setText("");
  };
  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1" aria-label="Recipe tags">
          {value.map((tag) => (
            <li key={tag.id}>
              <TagChip tag={tag.name} onRemove={disabled ? undefined : () => onChange(value.filter((other) => other.id !== tag.id))} />
            </li>
          ))}
        </ul>
      )}
      <SearchInput
        id={id}
        value={text}
        onValueChange={setText}
        aria-label="Add a tag"
        placeholder="Find or add a tag"
        disabled={disabled}
        {...picker({
          options: tagOptions(known, value, text),
          text,
          label: "Tag suggestions",
          onSelect: (option) => add([option.label]),
          onCreate: (typed) => add([typed]),
        })}
      />
    </div>
  );
}
