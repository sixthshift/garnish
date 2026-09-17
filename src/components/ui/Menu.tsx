import { cn } from "@sixthshift/design-system/utils";
import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  type KeyboardEvent,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
  useContext,
  useId,
  useRef,
  useState,
} from "react";
import { nextMenuIndex } from "../../lib/ui/menu";

type MenuContext = { close: () => void };
const menuContext = createContext<MenuContext>({ close: () => {} });

export type MenuProps = {
  /** Trigger text. Hidden visually when `iconOnly`, but still the button's accessible name. */
  label: string;
  /** Render the trigger as a compact "…" button with `label` as its aria-label. */
  iconOnly?: boolean;
  /** Controlled open state. Omit to let the menu keep its own. */
  open?: boolean;
  /** Initial open state for an uncontrolled menu. */
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Which edge the panel hangs from. Default "end" (right-aligned). */
  align?: "start" | "end";
  className?: string;
  children: ReactNode;
};

const TRIGGER_CLASS =
  "inline-flex items-center gap-1 rounded-md border border-border-normal bg-bg-normal px-3 py-1.5 text-sm font-medium text-fg-normal hover:bg-bg-normal-hovered";

export function Menu({ label, iconOnly = false, open: openProp, defaultOpen = false, onOpenChange, align = "end", className, children }: MenuProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultOpen);
  const open = openProp ?? uncontrolled;
  const panelRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelId = useId();

  const setOpen = (next: boolean) => {
    if (openProp === undefined) setUncontrolled(next);
    onOpenChange?.(next);
  };

  const items = (): HTMLElement[] => Array.from(panelRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    const all = items();
    const active = document.activeElement;
    const index = active instanceof HTMLElement ? all.indexOf(active) : -1;
    const next = nextMenuIndex(index, all.length, event.key);
    if (next === null) return;
    event.preventDefault();
    all[next]?.focus();
  };

  return (
    <div className={cn("relative", className)} data-testid="menu">
      <button
        ref={triggerRef}
        type="button"
        data-testid="menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={iconOnly ? label : undefined}
        className={cn(TRIGGER_CLASS, iconOnly && "px-2")}
        onClick={() => setOpen(!open)}
      >
        {iconOnly ? <span aria-hidden="true">⋯</span> : label}
      </button>
      {open && (
        <>
          {/* Clicking anywhere else closes, without a document listener. */}
          <div data-testid="menu-scrim" className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            ref={panelRef}
            id={panelId}
            role="menu"
            aria-label={label}
            data-testid="menu-panel"
            onKeyDown={onKeyDown}
            className={cn(
              "absolute top-full z-20 mt-1 flex min-w-48 flex-col rounded-lg border border-border-normal bg-bg-normal py-1 shadow-lg",
              align === "end" ? "right-0" : "left-0"
            )}
          >
            <menuContext.Provider value={{ close: () => setOpen(false) }}>{children}</menuContext.Provider>
          </div>
        </>
      )}
    </div>
  );
}

export type MenuItemProps = {
  children: ReactNode;
  /** Run when the item is chosen. The menu closes either way. */
  onSelect?: () => void;
  /** "danger" paints the item as destructive (Delete). */
  intent?: "neutral" | "danger";
  disabled?: boolean;
  /** Render the single child element as the item instead of a button (a router Link). */
  asChild?: boolean;
  /** Forwarded to the rendered button, so a caller can give an item a stable test hook. */
  "data-testid"?: string;
};

const ITEM_CLASS = "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-bg-normal-hovered disabled:opacity-50";
const INTENT_CLASS = { neutral: "text-fg-normal", danger: "text-fg-danger" } as const;

/** One line in the menu. Choosing it runs `onSelect` and closes the menu. */
export function MenuItem({ children, onSelect, intent = "neutral", disabled = false, asChild = false, "data-testid": dataTestId }: MenuItemProps) {
  const { close } = useContext(menuContext);
  const className = cn(ITEM_CLASS, INTENT_CLASS[intent]);
  const choose = () => {
    if (disabled) return;
    onSelect?.();
    close();
  };

  if (asChild) {
    const child = Children.only(children) as ReactElement<{ className?: string; role?: string; onClick?: (event: MouseEvent) => void }>;
    if (!isValidElement(child)) return null;
    return cloneElement(child, {
      role: "menuitem",
      className: cn(className, child.props.className),
      onClick: (event: MouseEvent) => {
        child.props.onClick?.(event);
        choose();
      },
    });
  }

  return (
    <button type="button" role="menuitem" disabled={disabled} className={className} onClick={choose} data-testid={dataTestId}>
      {children}
    </button>
  );
}

/** A hairline between groups of items. */
export function MenuSeparator() {
  return <hr className="my-1 border-t border-border-subtle" />;
}

Menu.Item = MenuItem;
Menu.Separator = MenuSeparator;
