import { Menu } from "../../../../components/ui/Menu";
import { SORT_OPTIONS, type SortDir, type SortKey } from "../../recipe";

export type SortMenuProps = {
  sort: SortKey;
  dir: SortDir;
  onChange: (sort: SortKey, dir: SortDir) => void;
  /** Forwarded to the underlying `Menu`; only tests render it open (Menu is closed by default and opens on click). */
  open?: boolean;
};

/** A desktop's order, in its filters column. A phone chooses the order in its filters sheet (FiltersSheet). */
export function SortMenu({ sort, dir, onChange, open }: SortMenuProps) {
  const current = SORT_OPTIONS.find((option) => option.key === sort && option.dir === dir) ?? SORT_OPTIONS[0]!;
  const label = `Sort: ${current.label}`;
  return (
    <Menu label={label} defaultOpen={open}>
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
