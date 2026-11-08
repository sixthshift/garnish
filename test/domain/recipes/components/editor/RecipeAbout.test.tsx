// The times row: a time the form refuses says why, not only with a red field.
import { renderToString } from "react-dom/server";
import { expect, test } from "vitest";
import { TimesFields } from "../../../../../src/domain/recipes/components/editor/RecipeAbout";
import { emptyDraft } from "../../../../../src/domain/recipes/draft";

const props = {
  draft: { ...emptyDraft(), prepTime: -5 },
  saving: false,
  units: [],
  knownTags: [],
  existing: false,
  onPatch: () => {},
  onChange: () => {},
  onFile: () => {},
};

test("a refused time says why under the pair", () => {
  const html = renderToString(<TimesFields {...props} errors={{ prepTime: "Minutes cannot be negative" }} />);
  expect(html).toContain('role="alert"');
  expect(html).toContain("Minutes cannot be negative");
  expect(html).toContain('aria-invalid="true"');
});

test("with nothing refused there is no message", () => {
  expect(renderToString(<TimesFields {...props} errors={{}} />)).not.toContain('role="alert"');
});
