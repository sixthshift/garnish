// Router-wide pending, error and not-found views, built from design system pieces.
import { Button } from "@sixthshift/design-system/button";
import { Heading } from "@sixthshift/design-system/heading";
import { Message } from "@sixthshift/design-system/message";
import { Muted } from "@sixthshift/design-system/muted";
import { Spinner } from "@sixthshift/design-system/spinner";
import { Link, type ErrorComponentProps } from "@tanstack/react-router";

export function RoutePending() {
  return (
    <div className="flex min-h-48 items-center justify-center p-6" role="status">
      <Spinner size="lg" />
      <span className="sr-only">Loading</span>
    </div>
  );
}

export function RouteError({ error, reset }: ErrorComponentProps) {
  return (
    <div className="flex flex-col gap-4 p-6">
      <Message intent="danger" title="Something went wrong">
        {error instanceof Error ? error.message : String(error)}
      </Message>
      <div>
        <Button variant="outline" intent="neutral" onClick={reset}>
          Try again
        </Button>
      </div>
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
