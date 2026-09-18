import { SectionTitle } from "@sixthshift/design-system/section-title";
import type { ReactNode } from "react";

/**
 * The editor's section header: the section's name on the left, its actions on
 * the right. Four sections drew this row for themselves — Notes and Parts with
 * `SectionTitle`, Ingredients and Steps with a `Muted` span carrying
 * `uppercase tracking-wide` by hand, which is `SectionTitle` reimplemented one
 * type step smaller and in a different grey. One component means one label
 * style across the form.
 *
 * `flex-wrap` on both rows is the phone fix: the actions are `whitespace-nowrap`
 * buttons, and Steps has five of them, so unwrapped they pushed the form 100px
 * past a 390px viewport and scrolled the whole page sideways.
 *
 * `as` defaults to a plain span because two of the four are not headings — an
 * ingredient list inside a part is not a section of the document — and
 * promoting them would invent heading levels the page does not have.
 */
export function EditorSectionHeader({ children, actions, as = "span" }: { children: ReactNode; actions?: ReactNode; as?: "h2" | "h3" | "span" }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <SectionTitle as={as}>{children}</SectionTitle>
      {actions !== undefined && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
