import { Heading } from "@sixthshift/design-system/heading";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/recipes/new")({
  component: NewRecipePage,
});

function NewRecipePage() {
  return (
    <div className="flex flex-col gap-4 p-6">
      <Heading as="h1">New recipe</Heading>
    </div>
  );
}
