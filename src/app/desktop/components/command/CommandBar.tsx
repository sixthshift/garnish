import { useEffect, useState } from "react";
import { useHydrated } from "../../../../lib/useHydrated";
import { CommandPalette } from "./CommandPalette";
import { Kbd, SearchIcon } from "./Kbd";

/** Whether a key press belongs to a field being typed in. */
function typing(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/** A Mac names the key ⌘; everything else Ctrl. Asked only once the page is the browser's. */
function isMac(): boolean {
  return typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
}

/**
 * The command bar's pill in a desktop's top bar (decisions.md row 207), and
 * the keys that open it from anywhere: Ctrl K or ⌘ K toggles it, "/" opens it
 * when no field has the keyboard (a "/" typed into a note is a "/"), and no
 * other dialog is up. Esc, the Modal's, closes it.
 */
export function CommandBar() {
  const hydrated = useHydrated();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((was) => !was);
        return;
      }
      if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) return;
      if (typing(event.target) || document.querySelector('[role="dialog"]') !== null) return;
      event.preventDefault();
      setOpen(true);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [hydrated]);

  // The shell before hydration is the same on every machine, so it names Ctrl.
  const mod = hydrated && isMac() ? "⌘" : "Ctrl";
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-keyshortcuts="Control+K Meta+K /"
        className="mx-auto flex w-[min(28.75rem,36%)] min-w-56 items-center gap-2.5 rounded-lg border border-transparent bg-bg-subtle px-3 py-2 text-left text-sm text-fg-subtle hover:border-border-normal hover:bg-bg-normal"
      >
        <SearchIcon />
        <span className="min-w-0 flex-1 truncate">Search, plan or add anything…</span>
        <span className="flex shrink-0 gap-1">
          <Kbd>{mod}</Kbd>
          <Kbd>K</Kbd>
        </span>
      </button>
      {open && <CommandPalette onClose={() => setOpen(false)} />}
    </>
  );
}
