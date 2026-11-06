import { Outlet } from "@tanstack/react-router";
import { TopBar } from "./TopBar";

/**
 * A desktop's layout (decisions.md row 206): the top bar, then the page. No
 * tab bar, so `--app-bar` is nothing and a save bar sits at the very bottom.
 */
export function DesktopLayout() {
  return (
    <div className="flex min-h-dvh flex-col bg-bg-subtle text-fg-normal [--app-bar:0px]">
      <TopBar />
      <div className="flex min-w-0 flex-1">
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
