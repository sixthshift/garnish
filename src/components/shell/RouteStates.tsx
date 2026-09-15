import { Button } from "@sixthshift/design-system/button";
import type { ErrorFallbackProps } from "@sixthshift/design-system/error-boundary";
import { Heading } from "@sixthshift/design-system/heading";
import { Message } from "@sixthshift/design-system/message";
import { Muted } from "@sixthshift/design-system/muted";
import { Spinner } from "@sixthshift/design-system/spinner";
import { type ErrorComponentProps, Link, useRouter } from "@tanstack/react-router";
import { describeError } from "../../lib/errors";
import { useOnline } from "../../lib/useOnline";

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
