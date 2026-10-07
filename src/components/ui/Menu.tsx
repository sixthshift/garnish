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
  /** An unboxed trigger: no border or fill until hovered, 44px square on a touch screen. For a menu repeated down a list. */
  ghost?: boolean;
  /** What the trigger shows instead of `label`, which stays its accessible name (a shorter text on a phone). */
  display?: ReactNode;
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

const GHOST_TRIGGER_CLASS =
  "inline-flex size-8 items-center justify-center rounded-md text-fg-subtle hover:bg-bg-normal-hovered hover:text-fg-normal pointer-coarse:size-11";

const TRIGGER_CLASS =
  "inline-flex items-center gap-1 rounded-md border border-border-normal bg-bg-normal px-3 py-1.5 text-sm font-medium text-fg-normal hover:bg-bg-normal-hovered";

export function Menu({
  label,
  iconOnly = false,
  ghost = false,
  display,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  align = "end",
  className,
  children,
}: MenuProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultOpen);
  const open = openProp ?? uncontrolled;
  const panelRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelId = useId();

  const setOpen = (next: boolean) => {
    if (openProp === undefined) setUncontrolled(next);
    onOpenChange?.(next);
  };

  // An item a breakpoint hides (`display: none`) has no layout box and cannot take focus, so the arrows pass over it.
  const items = (): HTMLElement[] =>
    Array.from(panelRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"], [role="menuitemcheckbox"]') ?? []).filter(
      (item) => item.checkVisibility?.() ?? true
    );

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
        aria-label={iconOnly || display !== undefined ? label : undefined}
        className={ghost ? GHOST_TRIGGER_CLASS : cn(TRIGGER_CLASS, iconOnly && "px-2")}
        onClick={() => setOpen(!open)}
      >
        {iconOnly ? <span aria-hidden="true">⋯</span> : (display ?? label)}
      </button>
      {open && (
        <>
          {/* Clicking anywhere else closes, without a document listener. Scrim and
              panel share the popover layer, above the phone's tab bar; the panel
              comes later in the DOM, so it paints over the scrim. */}
          <div data-testid="menu-scrim" className="fixed inset-0 z-popover" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            ref={panelRef}
            id={panelId}
            role="menu"
            aria-label={label}
            data-testid="menu-panel"
            onKeyDown={onKeyDown}
            className={cn(
              "absolute top-full z-popover mt-1 flex min-w-48 flex-col rounded-lg border border-border-normal bg-bg-normal py-1 shadow-lg",
              align === "end" ? "right-0" : "left-0"
            )}
          >
            {/* Choosing an item hands focus back to the trigger, as Escape does. An item that opens a dialog
                needs it: the dialog's focus manager returns focus on close to whatever held it at open, and
                that was the item itself, gone with the menu, so Cancel or Escape left focus on the body. */}
            <menuContext.Provider
              value={{
                close: () => {
                  setOpen(false);
                  triggerRef.current?.focus();
                },
              }}
            >
              {children}
            </menuContext.Provider>
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
  /** Extra classes for the item, e.g. a breakpoint that hides it. */
  className?: string;
  /** Makes the item a checkbox (`menuitemcheckbox`) showing this state with a tick, for a setting the row holds (Fixed). */
  checked?: boolean;
};

const ITEM_CLASS = "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-bg-normal-hovered disabled:opacity-50";
const INTENT_CLASS = { neutral: "text-fg-normal", danger: "text-fg-danger" } as const;

/** One line in the menu. Choosing it runs `onSelect` and closes the menu. */
export function MenuItem({
  children,
  onSelect,
  intent = "neutral",
  disabled = false,
  asChild = false,
  "data-testid": dataTestId,
  className: extra,
  checked,
}: MenuItemProps) {
  const { close } = useContext(menuContext);
  const className = cn(ITEM_CLASS, INTENT_CLASS[intent], extra);
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

  if (checked !== undefined) {
    return (
      <button type="button" role="menuitemcheckbox" aria-checked={checked} disabled={disabled} className={className} onClick={choose} data-testid={dataTestId}>
        {children}
        <span className="ml-auto w-4 shrink-0 text-center" aria-hidden="true">
          {checked ? "✓" : ""}
        </span>
      </button>
    );
  }

  return (
    <button type="button" role="menuitem" disabled={disabled} className={className} onClick={choose} data-testid={dataTestId}>
      {children}
    </button>
  );
}

/** A hairline between groups of items. `className` hides it with the group it divides. */
export function MenuSeparator({ className }: { className?: string } = {}) {
  return <hr className={cn("my-1 border-t border-border-subtle", className)} />;
}

Menu.Item = MenuItem;
Menu.Separator = MenuSeparator;
