export type Shelf = "try";

export const shelfOptions = [
  { value: "all", label: "Everything" },
  { value: "try", label: "To try" },
] as const;

/** A toggle's value as a shelf: Everything, or nothing pressed, is no shelf. Pure. */
export function shelfFromValue(value: string): Shelf | undefined {
  return value === "try" ? value : undefined;
}
