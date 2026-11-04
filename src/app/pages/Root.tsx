import { ErrorBoundary } from "@sixthshift/design-system/error-boundary";
import { OverlayProvider } from "@sixthshift/design-system/overlay";
import { TOAST_POSITION } from "../../lib/toast";
import { AppShell } from "../components/layout/AppShell";
import { AppErrorFallback } from "./RouteStates";

/**
 * Around every page: the root route's component. The provider hosts the toast
 * stack, outside the boundary so a render error in the shell does not take a
 * notice with it; `toast()` is callable from anywhere, and the stack is placed
 * above the phone's bottom nav. The boundary is the last line of defence: a
 * render error that escapes every route boundary (the shell itself, or a route
 * without an errorComponent) shows a message and a Retry instead of a blank
 * page. Route loader errors never get this far; the router's
 * defaultErrorComponent renders those inside the shell.
 */
export function Root() {
  return (
    <OverlayProvider toastClassName={TOAST_POSITION}>
      <ErrorBoundary fallback={(props) => <AppErrorFallback {...props} />}>
        <AppShell />
      </ErrorBoundary>
    </OverlayProvider>
  );
}
