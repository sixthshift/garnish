import { Menu } from "../../../components/ui/Menu";
import { SORT_OPTIONS, type SortDir, type SortKey } from "../../../domain/recipe";

export type SortMenuProps = {
  sort: SortKey;
  dir: SortDir;
  onChange: (sort: SortKey, dir: SortDir) => void;
  /** Forwarded to the underlying `Menu`; only tests render it open (Menu is closed by default and opens on click). */
  open?: boolean;
};

export function SortMenu({ sort, dir, onChange, open }: SortMenuProps) {
  const current = SORT_OPTIONS.find((option) => option.key === sort && option.dir === dir) ?? SORT_OPTIONS[0]!;
  return (
    <Menu label={`Sort: ${current.label}`} open={open}>
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
    </Menu>
  );
}
