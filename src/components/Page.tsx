import { Heading } from "@sixthshift/design-system/heading";
import { cn } from "@sixthshift/design-system/utils";
import type { ReactNode } from "react";

/**
 * How wide a page's content runs. Two values, because there are two jobs:
 *
 *   page   laying content out across the width — the recipe grid, the recipe's
 *          two columns, the reference tables, the week.
 *   focus  one column read top to bottom — the shopping list, the source
 *          chooser. Cook mode is the same idea and sets its own, since it is
 *          a fullscreen route with no page chrome at all.
 *
 * Before this the six pages used `max-w-5xl`, `6xl`, `7xl`, `3xl` and nothing
 * at all, which is five answers to a question nobody had asked. The design
 * system leaves wide-screen measure open (docs/responsive.md), so this is
 * garnish's answer rather than a rule imported from it.
 */
const WIDTH = {
  page: "max-w-6xl",
  focus: "max-w-3xl",
} as const;

export type PageWidth = keyof typeof WIDTH;

/**
 * The page container: one measure, one padding, centred. Renders a `<div>` by
 * default; the recipe page passes `as="article"` because its content is one
 * self-contained document.
 */
export function Page({
  children,
  width = "page",
  as: Element = "div",
  className,
  ...rest
}: { children: ReactNode; width?: PageWidth; as?: "div" | "article" } & React.HTMLAttributes<HTMLElement>) {
  return (
    <Element className={cn("mx-auto flex w-full flex-col gap-6 p-4 md:p-6", WIDTH[width], className)} {...rest}>
      {children}
    </Element>
  );
}

/**
 * The page's title row: the name on the left, its actions on the right.
 *
 * One component because the three pages that had a header each invented their
 * own — Recipes pushed its button to the far right, Plan set one button inline
 * beside the title and a week strip at the other end, and Shopping had a bare
 * heading — so no two pages agreed on where an action lives. `flex-wrap` keeps
 * the primary action reachable on a phone rather than pushing it off the edge,
 * which is the degradation order the design system's responsive doc asks for.
 */
export function PageHeader({ title, actions }: { title: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2" data-page-header="">
      <Heading as="h1">{title}</Heading>
      {actions !== undefined && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
