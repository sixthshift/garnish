import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@sixthshift/design-system/button";
import { Heading } from "@sixthshift/design-system/heading";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <main className="flex flex-col gap-4 p-6">
      <Heading as="h1">garnish</Heading>
      <Button variant="solid" intent="neutral">
        Add recipe
      </Button>
    </main>
  );
}
