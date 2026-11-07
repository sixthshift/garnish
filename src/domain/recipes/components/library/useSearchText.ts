import { useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SEARCH_DEBOUNCE_MS, searchParam } from "../../../../lib/search";

export type SearchText = {
  /** What the search box shows: typing is instant, the address follows. */
  query: string;
  setQuery: (query: string) => void;
  /** Enter in the box: the address takes the text now, as a step Back can undo. */
  submit: () => void;
};

/**
 * The library's search text (both layouts). The box is local state so typing
 * is instant; after a pause the address follows (`?q=`, replacing, so Back is
 * not a step per word) and the loader with it.
 *
 * The write that waits out the pause belongs to the page it was typed on. If
 * the address leaves that page before the pause is over (Enter on the side
 * panel's recipe, a link, Back), the text is dropped with the page: writing
 * it then would build on the new address and replace it, pulling the reader
 * back to the library with every other param gone. React cannot tell us in
 * time (the page stays mounted until the next one's loader resolves), so the
 * router's own latest address decides.
 */
export function useSearchText(q: string): SearchText {
  const router = useRouter();
  const navigate = useNavigate();
  const [query, setQuery] = useState(q);
  useEffect(() => setQuery(q), [q]);

  useEffect(() => {
    if (searchParam(query) === searchParam(q)) return;
    const typedOn = router.latestLocation.pathname;
    const timer = setTimeout(() => {
      if (router.latestLocation.pathname !== typedOn) return;
      void navigate({ to: ".", search: (prev: Record<string, unknown>) => ({ ...prev, q: searchParam(query) }), replace: true });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, q, navigate, router]);

  const submit = () => void navigate({ to: ".", search: (prev: Record<string, unknown>) => ({ ...prev, q: searchParam(query) }) });
  return { query, setQuery, submit };
}
