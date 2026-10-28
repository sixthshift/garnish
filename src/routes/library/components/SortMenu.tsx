import { Menu } from "../../../components/ui/Menu";
import { SORT_OPTIONS, type SortDir, type SortKey } from "../../../domain/recipe";

export type SortMenuProps = {
  sort: SortKey;
  dir: SortDir;
  onChange: (sort: SortKey, dir: SortDir) => void;
  /** Open a random recipe. Offered here below `md:`, where the toolbar has no room for the dice button beside the menu. */
  onRandom?: () => void;
  /** Forwarded to the underlying `Menu`; only tests render it open (Menu is closed by default and opens on click). */
  open?: boolean;
};

export function SortMenu({ sort, dir, onChange, onRandom, open }: SortMenuProps) {
  const current = SORT_OPTIONS.find((option) => option.key === sort && option.dir === dir) ?? SORT_OPTIONS[0]!;
  const label = `Sort: ${current.label}`;
  return (
    <Menu
      label={label}
      open={open}
      display={
        <>
          <span className="md:hidden">Sort</span>
          <span className="max-md:hidden">{label}</span>
        </>
      }
    >
      {SORT_OPTIONS.map((option) => {
        const active = option.key === sort && option.dir === dir;
        return (
          <Menu.Item key={`${option.key}-${option.dir}`} onSelect={() => onChange(option.key, option.dir)}>
            <span aria-hidden="true" className="inline-block w-4">
              {active ? "✓" : ""}
            </span>
            {option.label}
          </Menu.Item>
        );
      })}
      {onRandom && (
        // A rule drawn on the item, not a Menu.Separator, so it hides with the item from `md:` up.
        <Menu.Item onSelect={onRandom} className="mt-1 border-t border-border-subtle md:hidden">
          <span aria-hidden="true" className="inline-block w-4" />
          Open a random recipe
        </Menu.Item>
      )}
    </Menu>
  );
}
