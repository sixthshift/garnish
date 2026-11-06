import { bootstrapTheme } from "@sixthshift/design-system/hooks";
import { cn } from "@sixthshift/design-system/utils";
import { Outlet, useMatches, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useHydrated } from "../../../lib/useHydrated";
import { useLayout } from "../../../lib/useLayout";
import { DesktopLayout } from "../../desktop/components/DesktopLayout";
import { TopBar } from "../../desktop/components/TopBar";
import { MobileLayout } from "../../mobile/components/MobileLayout";
import { APP_BAR_HEIGHT, TabBar } from "../../mobile/components/TabBar";

// The app's frame: a phone's layout or a desktop's (decisions.md row 206),
// chosen by the screen. Routes opt out of the frame with
// `staticData: { fullscreen: true }` (cook mode). `hideNav` drops only the
// phone's tab bar, for a task finished with Save or Cancel (the editor, Style,
// the new-recipe stages): a desktop's top bar stays.
// A function decides from the route's search, for a route whose first screen
// is a place and the rest a task (`/recipes/new`'s chooser keeps the bar).
declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    fullscreen?: boolean;
    hideNav?: boolean | ((search: Record<string, unknown>) => boolean);
  }
}

/**
 * A thin bar sweeping along the top of the screen while the router loads the
 * next page, so a press answers at once; the page being left stays in place
 * until `pendingMs`, when `RoutePending` takes over. Fades in after a moment
 * (`.nav-progress` in styles.css), so a quick navigation shows nothing. Not
 * drawn before hydration: the cold start has `RoutePending` already.
 */
function NavigationProgress() {
  const hydrated = useHydrated();
  const loading = useRouterState({ select: (state) => state.isLoading });
  if (!hydrated || !loading) return null;
  return (
    <div className="nav-progress pointer-events-none fixed inset-x-0 top-0 z-app-bar h-0.5 overflow-hidden" aria-hidden="true">
      <div className="nav-progress-bar h-full w-2/5 bg-bg-brand" />
    </div>
  );
}

export function AppShell() {
  useEffect(() => bootstrapTheme(), []);
  // The address and the screen decide these only once the page is the
  // browser's: the shell is the same for every address (row 169).
  const hydrated = useHydrated();
  const layout = useLayout();
  const fullscreenRoute = useMatches({ select: (matches) => matches.some((match) => match.staticData.fullscreen === true) });
  const hideNavRoute = useMatches({
    select: (matches) =>
      matches.some(({ staticData: { hideNav }, search }) => hideNav === true || (typeof hideNav === "function" && hideNav(search as Record<string, unknown>))),
  });
  if (hydrated && fullscreenRoute) {
    return (
      <div className="min-h-dvh bg-bg-subtle text-fg-normal">
        <NavigationProgress />
        <Outlet />
      </div>
    );
  }
  if (!hydrated) return <ShellBeforeHydration />;
  return (
    <>
      <NavigationProgress />
      {layout === "desktop" ? <DesktopLayout /> : <MobileLayout hideNav={hideNavRoute} />}
    </>
  );
}

/**
 * The shell the server sends, before the page is the browser's: the one place
 * both layouts' chrome is drawn, each hidden by its variant (decisions.md row
 * 206). It has nothing to run, the boot script has already put the layout on
 * `<html data-layout>`, and one cached copy must answer every address offline
 * (row 169), so it cannot ask the screen in React.
 */
function ShellBeforeHydration() {
  return (
    <div className={cn("flex min-h-dvh flex-col bg-bg-subtle text-fg-normal desktop:[--app-bar:0px]", APP_BAR_HEIGHT)}>
      <TopBar className="mobile:hidden" />
      <main className="min-w-0 flex-1 pb-(--app-bar)">
        <Outlet />
      </main>
      <TabBar className="desktop:hidden" />
    </div>
  );
}
