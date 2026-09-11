// Root layout: bottom nav on phones, side nav from md up. Colours are design
// system tokens, so dark mode follows the `data-theme` attribute that
// `bootstrapTheme` keeps in step with the OS setting. A fullscreen route
// (cook mode) gets the outlet alone: no nav, no bottom padding.
import { bootstrapTheme } from "@sixthshift/design-system/hooks";
import { cn } from "@sixthshift/design-system/utils";
import { Link, Outlet, useMatches } from "@tanstack/react-router";
import { useEffect } from "react";
import { Logo } from "./Logo";

// Routes opt out of the nav with `staticData: { fullscreen: true }` (cook mode).
declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    fullscreen?: boolean;
  }
}

export const navItems = [
  { to: "/", label: "Recipes", exact: true },
  { to: "/recipes/new", label: "New", exact: false },
  { to: "/settings", label: "Settings", exact: false },
] as const;

const itemClass =
  "flex flex-1 items-center justify-center rounded-md px-3 py-2 text-sm font-medium text-fg-subtle " +
  "hover:bg-bg-normal-hovered hover:text-fg-normal md:flex-none md:justify-start";
const activeClass = "bg-bg-brand-subtle text-fg-brand";

function Nav({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <nav aria-label="Main" className={className} {...props}>
      {navItems.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          activeOptions={{ exact: item.exact }}
          className={itemClass}
          activeProps={{ className: cn(itemClass, activeClass) }}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function AppShell() {
  useEffect(() => bootstrapTheme(), []);
  const fullscreen = useMatches({ select: (matches) => matches.some((match) => match.staticData.fullscreen === true) });
  if (fullscreen) {
    return (
      <div className="min-h-dvh bg-bg-normal text-fg-normal">
        <Outlet />
      </div>
    );
  }
  return (
    <div className="flex min-h-dvh flex-col bg-bg-normal text-fg-normal md:flex-row">
      <aside className="hidden w-56 shrink-0 flex-col gap-1 border-r border-border-normal p-4 md:flex">
        <Link to="/" className="mb-4 px-3 text-fg-brand">
          <Logo size={22} />
        </Link>
        <Nav className="flex flex-col gap-1" />
      </aside>
      <main className="flex-1 pb-20 md:pb-0">
        <Outlet />
      </main>
      <Nav className="fixed inset-x-0 bottom-0 flex gap-1 border-t border-border-normal bg-bg-normal p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden" />
    </div>
  );
}
