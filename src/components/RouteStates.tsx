// Router-wide pending, error and not-found views, built from design system
// pieces, plus the fallback for the app-wide ErrorBoundary in __root.tsx.
//
// Two ways a page can fail: a loader throws (the route's errorComponent, here
// `RouteError`, renders in the outlet with the shell still up), or a render
// throws past every route boundary (the design system `ErrorBoundary` around
// the shell renders `AppErrorFallback`). Both read the same copy from
// `describeError`, and Retry on both clears the boundary and re-runs the
// loaders through `router.invalidate()`.
//
// A server function that cannot reach the server rejects with the browser's
// fetch TypeError ("Failed to fetch", "Load failed", "NetworkError when
// attempting to fetch resource.", Bun's "fetch failed"); that is the case the
// plan's kill-the-server check exercises, so it gets its own message, refined
// by `useOnline` when the browser knows it is offline.
import { Button } from "@sixthshift/design-system/button";
import type { ErrorFallbackProps } from "@sixthshift/design-system/error-boundary";
import { Heading } from "@sixthshift/design-system/heading";
import { Message } from "@sixthshift/design-system/message";
import { Muted } from "@sixthshift/design-system/muted";
import { Spinner } from "@sixthshift/design-system/spinner";
import { Link, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { useOnline } from "../lib/useOnline";

export type ErrorDescription = {
  title: string;
  detail: string;
  /** True when the failure is the network, not the app. */
  network: boolean;
};

/** Whether `error` is the TypeError a failed `fetch` rejects with, in any browser or in Bun. Pure. */
export function isNetworkError(error: unknown): boolean {
  if (!(error instanceof TypeError)) return false;
  return /fetch|network|load failed/i.test(error.message);
}

/**
 * Title and detail for an error view. A network failure while the browser
 * says it is offline is the user's connection; while online it is the server;
 * anything else is shown as itself. Pure.
 */
export function describeError(error: unknown, online = true): ErrorDescription {
  if (isNetworkError(error)) {
    if (!online) {
      return { title: "You are offline", detail: "Reconnect, then retry.", network: true };
    }
    return { title: "Can't reach the server", detail: "garnish is not answering. Check it is running, then retry.", network: true };
  }
  const message = error instanceof Error ? error.message : String(error);
  return { title: "Something went wrong", detail: message === "" ? "No details were given." : message, network: false };
}

export function RoutePending() {
  return (
    <div className="flex min-h-48 items-center justify-center p-6" role="status">
      <Spinner size="lg" />
      <span className="sr-only">Loading</span>
    </div>
  );
}

type ErrorViewProps = {
  error: unknown;
  /** Clears the boundary that caught the error. */
  reset: () => void;
};

/**
 * The one error view. Retry clears the boundary and re-runs every active
 * loader; without a router (a bare render in a test) it only clears.
 */
export function ErrorView({ error, reset }: ErrorViewProps) {
  const router = useRouter({ warn: false });
  const online = useOnline();
  const { title, detail } = describeError(error, online);
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
    <div className="min-h-dvh bg-bg-normal text-fg-normal">
      <ErrorView error={error} reset={reset} />
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
