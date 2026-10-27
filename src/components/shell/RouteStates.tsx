import { Button } from "@sixthshift/design-system/button";
import type { ErrorFallbackProps } from "@sixthshift/design-system/error-boundary";
import { Heading } from "@sixthshift/design-system/heading";
import { Message } from "@sixthshift/design-system/message";
import { Muted } from "@sixthshift/design-system/muted";
import { type ErrorComponentProps, Link, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { describeError } from "../../lib/errors";
import { useOnline } from "../../lib/useOnline";
import { buildLabel } from "../../lib/version";
import { LogoAnimated } from "./Logo";
import { reportError } from "./reportError";

/**
 * What fills the page while it loads: the shell the server sends on every cold
 * start, and a navigation whose loader outlasts `pendingMs`. In the middle of
 * the space above the tab bar the sprig grows, stem then leaves, and sways
 * until the page arrives. It starts only after a moment, so a quick load shows
 * nothing. Both are CSS (`.route-pending` in
 * styles.css), since in the shell they run before the app's JS has loaded.
 */
export function RoutePending() {
  return (
    <div className="route-pending flex min-h-[calc(100dvh-var(--app-bar,0px))] items-center justify-center p-6 text-fg-brand" role="status">
      <LogoAnimated size={56} />
      <span className="sr-only">Loading</span>
    </div>
  );
}

type ErrorViewProps = {
  error: unknown;
  /** Clears the boundary that caught the error. */
  reset: () => void;
  /** Which boundary caught it, for the report the server keeps. */
  where?: "route" | "shell";
};

/**
 * The one error view. Retry clears the boundary and re-runs every active
 * loader; without a router (a bare render in a test) it only clears. The error
 * is sent to the server's diagnostics as it is shown (a network failure is
 * not: the server cannot hear it), and the build is named under the message,
 * so a screenshot says what was running.
 */
export function ErrorView({ error, reset, where = "route" }: ErrorViewProps) {
  const router = useRouter({ warn: false });
  const online = useOnline();
  const { title, detail } = describeError(error, online);
  useEffect(() => reportError(error, where), [error, where]);
  const retry = () => {
    reset();
    void router?.invalidate();
  };
  return (
    <div className="flex flex-col gap-4 p-6" data-error-view>
      <Message intent="danger" title={title}>
        {detail}
      </Message>
      <div>
        <Button variant="outline" intent="neutral" onClick={retry}>
          Retry
        </Button>
      </div>
      <Muted as="p" className="text-xs" data-testid="error-build">
        {`Garnish ${buildLabel()}`}
      </Muted>
    </div>
  );
}

/** Route-level `errorComponent`: a loader or a route render threw. */
export function RouteError({ error, reset }: ErrorComponentProps) {
  return <ErrorView error={error} reset={reset} />;
}

/** Fallback for the design system `ErrorBoundary` around the whole shell. */
export function AppErrorFallback({ error, reset }: ErrorFallbackProps) {
  return (
    <div className="min-h-dvh bg-bg-subtle text-fg-normal">
      <ErrorView error={error} reset={reset} where="shell" />
    </div>
  );
}

export function RouteNotFound() {
  return (
    <div className="flex flex-col gap-4 p-6">
      <Heading as="h1">Not found</Heading>
      <Muted as="p">There is nothing at this address.</Muted>
      <div>
        <Button asChild variant="outline" intent="neutral">
          <Link to="/">Back to recipes</Link>
        </Button>
      </div>
    </div>
  );
}
