// Keyboard movement in components/ui/Menu.

/**
 * Where the arrow keys land next. `count` is how many items the menu has;
 * `current` is the focused index, or -1 for "nothing focused yet". Returns the
 * index to focus, or null when the key is not one the menu handles. Wraps at
 * both ends, the way a native menu does. Pure.
 */
export function nextMenuIndex(current: number, count: number, key: string): number | null {
  if (count <= 0) return null;
  switch (key) {
    case "ArrowDown":
      return current < 0 || current >= count - 1 ? 0 : current + 1;
    case "ArrowUp":
      return current <= 0 ? count - 1 : current - 1;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}
