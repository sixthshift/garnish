import { useBlocker } from "@tanstack/react-router";
import { useRef } from "react";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";

/**
 * The one question every way out of an unsaved import asks: the Style stage's
 * Cancel, and leaving /recipes/new from the review, Style or Edit details by
 * the browser's Back, a nav link or a reload.
 */
export function DiscardImportDialog({ onStay, onDiscard }: { onStay: () => void; onDiscard: () => void }) {
  return (
    <ConfirmDialog title="Discard this import?" confirmLabel="Discard" aria-label="Discard this import" onCancel={onStay} onConfirm={onDiscard}>
      <p>Nothing has been saved yet. Leaving now loses the recipe and any changes made to it.</p>
    </ConfirmDialog>
  );
}

/**
 * Holds the page while `holding`: a navigation off /recipes/new waits on
 * `DiscardImportDialog`, and a reload or a closed tab asks the browser's own
 * question. The stages swap without touching the URL, or with a `replace`
 * that stays on /recipes/new, so the browser's Back from any of them leaves
 * the page; a move inside it (the chooser and its sources) is never held.
 * `release` lets the stage's own save leave unasked.
 */
export function useImportGuard(holding: boolean) {
  const released = useRef(false);
  const blocker = useBlocker({
    shouldBlockFn: ({ current, next }) => !released.current && next.pathname !== current.pathname,
    enableBeforeUnload: () => !released.current,
    disabled: !holding,
    withResolver: true,
  });
  const dialog = blocker.status === "blocked" ? <DiscardImportDialog onStay={blocker.reset} onDiscard={blocker.proceed} /> : null;
  return {
    dialog,
    release: () => {
      released.current = true;
    },
  };
}
