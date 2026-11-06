import { Link } from "@tanstack/react-router";
import type { AnchorHTMLAttributes, ReactNode, Ref } from "react";
import type { RecipePanelTarget } from "../../app/model/panel";
import { useLayout } from "../../lib/useLayout";

export type RecipeLinkProps = RecipePanelTarget &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "children"> & {
    children: ReactNode;
    /** Forwarded, so a tooltip's or a button's `asChild` can hold the link. */
    ref?: Ref<HTMLAnchorElement>;
  };

/**
 * A link to a recipe, to look at (decisions.md row 206): on a phone its page;
 * on a desktop the side panel beside the page you are on, which stays put
 * (`?panel=`, so Back closes it). The plan's choices and servings travel
 * either way.
 */
export function RecipeLink({ slug, choices, servings, children, ...rest }: RecipeLinkProps) {
  const desktop = useLayout() === "desktop";
  const chosen = choices !== undefined && Object.keys(choices).length > 0 ? choices : undefined;
  if (desktop) {
    return (
      <Link
        to="."
        search={(prev: Record<string, unknown>) => ({
          ...prev,
          panel: { slug, ...(chosen && { choices: chosen }), ...(servings !== undefined && { servings }) },
        })}
        resetScroll={false}
        data-opens="panel"
        {...rest}
      >
        {children}
      </Link>
    );
  }
  return (
    <Link to="/recipes/$slug" params={{ slug }} search={{ ...(chosen && { choices: chosen }), ...(servings !== undefined && { servings }) }} {...rest}>
      {children}
    </Link>
  );
}
