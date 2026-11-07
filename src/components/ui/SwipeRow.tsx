import { cn } from "@sixthshift/design-system/utils";
import { type PointerEvent, type ReactNode, useRef, useState } from "react";
import { type SwipeSide, swipeAxis, swipeOffset, swipeOutcome } from "../../lib/ui/swipeRow";

export type SwipeAction = {
  /** What the colour under the row says while it is dragged: "In the trolley", "Remove". */
  label: string;
  /** `go` (green) for the kind thing, `stop` (red) for removing. */
  tone: "go" | "stop";
  onSwipe: () => void;
};

/**
 * A phone's row that a finger drags sideways (decisions.md row 208): past
 * 90px, letting go does that side's action; under it, the row springs back.
 * The swipe is a shortcut and never the only way: every action a row swipes
 * to must also be a button or a menu item on the row, for a mouse, a keyboard
 * and a screen reader. A drag that turns out to be the page's scroll is left
 * to the page (`touch-action: pan-y`), and a drag that moved the row never
 * also counts as a tap on it.
 */
export function SwipeRow({ children, right, left, className }: { children: ReactNode; right?: SwipeAction; left?: SwipeAction; className?: string }) {
  const start = useRef<{ x: number; y: number; id: number; axis: "row" | "page" | null } | null>(null);
  const dragged = useRef(false);
  const [offset, setOffset] = useState(0);
  const [leaving, setLeaving] = useState<SwipeSide | null>(null);
  const sides = { right: right !== undefined, left: left !== undefined };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (leaving || (event.pointerType === "mouse" && event.button !== 0)) return;
    start.current = { x: event.clientX, y: event.clientY, id: event.pointerId, axis: null };
    dragged.current = false;
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const s = start.current;
    if (!s || s.id !== event.pointerId) return;
    const dx = event.clientX - s.x;
    if (s.axis === null) {
      s.axis = swipeAxis(dx, event.clientY - s.y);
      if (s.axis === "page") start.current = null;
      if (s.axis !== "row") return;
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }
    dragged.current = true;
    setOffset(swipeOffset(dx, sides));
  };
  const finish = () => {
    if (!start.current) return;
    start.current = null;
    const side = swipeOutcome(offset);
    if (side === null) return setOffset(0);
    setLeaving(side);
    // Let the row finish sliding off before the list redraws without it.
    window.setTimeout(() => {
      (side === "right" ? right : left)?.onSwipe();
      setLeaving(null);
      setOffset(0);
    }, 180);
  };

  const showing = leaving ?? (offset > 0 ? "right" : offset < 0 ? "left" : null);
  const action = showing === "right" ? right : showing === "left" ? left : undefined;
  const armed = Math.abs(offset) >= 90;

  return (
    <div
      className={cn("relative touch-pan-y overflow-hidden select-none", className)}
      data-swipe-row=""
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finish}
      onPointerCancel={finish}
      onClickCapture={(event) => {
        if (!dragged.current) return;
        dragged.current = false;
        event.stopPropagation();
        event.preventDefault();
      }}
    >
      {action && (
        <div
          aria-hidden="true"
          className={cn(
            "absolute inset-0 flex items-center px-5 font-semibold text-sm",
            showing === "right" ? "justify-start" : "justify-end",
            // Each fill with its own ink: in dark the strong fills go pale (green-300, red-300) and take dark text, where white vanished.
            action.tone === "go" ? "bg-bg-success-strong text-[var(--fg-on-success-strong)]" : "bg-bg-danger-strong text-[var(--fg-on-danger-strong)]"
          )}
        >
          <span className={cn("transition-transform", armed && "scale-110")}>{action.label}</span>
        </div>
      )}
      <div
        className={cn("relative bg-bg-normal", start.current === null && "transition-transform duration-200 motion-reduce:transition-none")}
        style={{ transform: leaving ? `translateX(${leaving === "right" ? 110 : -110}%)` : offset ? `translateX(${offset}px)` : undefined }}
      >
        {children}
      </div>
    </div>
  );
}
