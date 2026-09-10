import { Heading } from "@sixthshift/design-system/heading";
import { Muted } from "@sixthshift/design-system/muted";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/recipes/$slug/")({
  component: RecipePage,
});

function RecipePage() {
  const { slug } = Route.useParams();
  return (
    <div className="flex flex-col gap-4 p-6">
      <Heading as="h1">Recipe</Heading>
      <Muted as="p">{slug}</Muted>
    </div>
  );
}
