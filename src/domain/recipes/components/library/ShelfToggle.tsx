import { ToggleGroup } from "@sixthshift/design-system/toggle-group";

export type Shelf = "try";

export const shelfOptions = [
  { value: "all", label: "Everything" },
  { value: "try", label: "To try" },
] as const;

/** A toggle's value as a shelf: Everything, or nothing pressed, is no shelf. Pure. */
export function shelfFromValue(value: string): Shelf | undefined {
  return value === "try" ? value : undefined;
}

/**
 * The library's shelves: everything, or the recipes never made. One choice at
 * a time, above the finer filters; weeknight and weekend are the week facet
 * among those (decisions.md row 219).
 */
export function ShelfToggle({ shelf, onChange }: { shelf: Shelf | undefined; onChange: (shelf: Shelf | undefined) => void }) {
  return (
    <ToggleGroup
      type="single"
      appearance="segmented"
      variant="outline"
      size="sm"
      aria-label="Shelf"
      options={shelfOptions}
      value={shelf ?? "all"}
      onValueChange={(value) => onChange(shelfFromValue(value))}
      className="self-start"
    />
  );
}
