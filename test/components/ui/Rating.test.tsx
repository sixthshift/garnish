import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { Rating, filledStars, nextRating, ratingLabel } from "../../../src/components/ui/Rating";

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

describe("nextRating", () => {
  test("pressing a star rates it; pressing the current rating clears it", () => {
    expect(nextRating(0, 3)).toBe(3);
    expect(nextRating(3, 5)).toBe(5);
    expect(nextRating(3, 3)).toBe(0);
    expect(nextRating(2.6, 3)).toBe(0); // the visually filled star counts as current
  });
});

describe("Rating editable", () => {
  test("with onChange renders five star buttons, the filled ones pressed", () => {
    const html = renderToString(<Rating value={2} onChange={() => {}} />);
    expect(html).toContain('role="group"');
    expect(html).toContain('aria-label="Rated 2 out of 5"');
    expect(html).not.toContain('role="img"');
    for (let star = 1; star <= 5; star++) expect(html).toContain(`aria-label="Rate ${star} out of 5"`);
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(2);
    expect(html.match(/aria-pressed="false"/g)).toHaveLength(3);
  });

  test("disabled disables every star", () => {
    const html = renderToString(<Rating value={2} onChange={() => {}} disabled />);
    expect(html.match(/<button[^>]*disabled=""/g)).toHaveLength(5);
  });
});
