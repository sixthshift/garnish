import { ToggleGroup } from "@sixthshift/design-system/toggle-group";

export type Shelf = "rotation" | "weekend" | "try";

export const shelfOptions = [
  { value: "all", label: "Everything" },
  { value: "rotation", label: "Rotation" },
  { value: "weekend", label: "Weekend" },
  { value: "try", label: "To try" },
] as const;

/** A toggle's value as a shelf: Everything, or nothing pressed, is no shelf. Pure. */
export function shelfFromValue(value: string): Shelf | undefined {
  return value === "rotation" || value === "weekend" || value === "try" ? value : undefined;
}

/**
 * The library's shelves: the weeknight regulars, the weekend cooks (both as
 * the household marked them, decisions.md row 191), and the recipes never
 * made. One choice at a time, above the finer filters.
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
