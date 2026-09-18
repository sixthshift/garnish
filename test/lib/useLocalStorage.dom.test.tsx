// The generic hook: two components on one key move together, a write
// persists, a bad stored value reads as the fallback, and another tab's
// write arrives through the storage event.
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test } from "vitest";
import { useLocalStorage } from "../../src/lib/useLocalStorage";

const isCount = (value: unknown): value is number => typeof value === "number";

function Counter({ id }: { id: string }) {
  const [count, setCount] = useLocalStorage("test.count", 0, isCount);
  return (
    <button type="button" data-testid={id} onClick={() => setCount(count + 1)}>
      {count}
    </button>
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

test("two components on the same key update together, and the write persists", async () => {
  const user = userEvent.setup();
  render(
    <>
      <Counter id="a" />
      <Counter id="b" />
    </>
  );
  await user.click(screen.getByTestId("a"));
  expect(screen.getByTestId("a")).toHaveTextContent("1");
  expect(screen.getByTestId("b")).toHaveTextContent("1");
  expect(window.localStorage.getItem("test.count")).toBe("1");
});

test("a stored value the guard rejects reads as the fallback", () => {
  window.localStorage.setItem("test.count", '"many"');
  render(<Counter id="a" />);
  expect(screen.getByTestId("a")).toHaveTextContent("0");
});

test("another tab's write arrives through the storage event", () => {
  render(<Counter id="a" />);
  window.localStorage.setItem("test.count", "7");
  act(() => void window.dispatchEvent(new StorageEvent("storage", { key: "test.count" })));
  expect(screen.getByTestId("a")).toHaveTextContent("7");
});
