import { renderToString } from "react-dom/server";
import { expect, test, vi } from "vitest";
import { KindToggle, kindFromValue } from "../../../src/components/recipe/KindToggle";

vi.mock("@tanstack/react-router", async (importOriginal) => ({ ...(await importOriginal()), useRouter: () => ({}) }));

test("a toggle value is a kind, and nothing pressed is not said", () => {
  expect(kindFromValue("rotation")).toBe("rotation");
  expect(kindFromValue("weekend")).toBe("weekend");
  expect(kindFromValue("")).toBeNull();
  expect(kindFromValue("other")).toBeNull();
});

test("the household's kind shows as the pressed segment", () => {
  const html = renderToString(<KindToggle id="00000000-0000-4000-8000-000000000001" kind="weekend" />);
  expect(html).toContain('aria-label="How you cook it"');
  expect(html.match(/aria-checked="true"/g)).toHaveLength(1);
  expect(html.indexOf('aria-checked="true"')).toBeGreaterThan(html.indexOf("Rotation"));
  expect(renderToString(<KindToggle id="00000000-0000-4000-8000-000000000001" kind={null} />)).not.toContain('aria-checked="true"');
});
