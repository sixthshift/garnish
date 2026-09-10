import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { Rating, filledStars, ratingLabel } from "../../../src/components/ui/Rating";

describe("filledStars", () => {
  test.each([
    [0, 0],
    [1, 1],
    [2.4, 2],
    [2.5, 3],
    [4.5, 5],
    [5, 5],
    [7, 5], // clamped
    [-1, 0],
    [Number.NaN, 0],
  ])("%s -> %s", (value, expected) => {
    expect(filledStars(value)).toBe(expected);
  });
});

describe("ratingLabel", () => {
  test("names the exact value out of five", () => {
    expect(ratingLabel(4)).toBe("Rated 4 out of 5");
    expect(ratingLabel(4.5)).toBe("Rated 4.5 out of 5");
    expect(ratingLabel(3.25)).toBe("Rated 3.3 out of 5");
  });
});

describe("Rating", () => {
  test("renders five stars with the rounded count filled and the exact value in the label", () => {
    const html = renderToString(<Rating value={3.5} />);
    expect(html).toContain('aria-label="Rated 3.5 out of 5"');
    expect(html.match(/data-filled="true"/g)).toHaveLength(4);
    expect(html.match(/data-filled="false"/g)).toHaveLength(1);
  });
});
