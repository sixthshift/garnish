import { expect, test } from "vitest";
import { lazy } from "../../src/lib/lazy";

type Handle = { name: string };
type Repo = { handle: Handle; hello(): string };

function harness() {
  let handle: Handle = { name: "a" };
  let builds = 0;
  const repo = lazy(
    () => handle,
    (h: Handle): Repo => {
      builds += 1;
      return { handle: h, hello: () => `hello from ${h.name}` };
    }
  );
  return { repo, builds: () => builds, swap: (name: string) => (handle = { name }) };
}

test("nothing is built until the first property read", () => {
  const h = harness();
  expect(h.builds()).toBe(0);
  expect(h.repo.hello()).toBe("hello from a");
  expect(h.builds()).toBe(1);
});

test("one build per key: repeated reads reuse it", () => {
  const h = harness();
  h.repo.hello();
  h.repo.hello();
  expect(h.repo.handle.name).toBe("a");
  expect(h.builds()).toBe(1);
});

test("a new key builds again; the old key's value is not reused for it", () => {
  const h = harness();
  h.repo.hello();
  h.swap("b");
  expect(h.repo.hello()).toBe("hello from b");
  expect(h.builds()).toBe(2);
  h.repo.hello();
  expect(h.builds()).toBe(2);
});

test("the object reports the built value's keys", () => {
  const h = harness();
  expect("hello" in h.repo).toBe(true);
  expect(Object.keys(h.repo).sort()).toEqual(["handle", "hello"]);
});
