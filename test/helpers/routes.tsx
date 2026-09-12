// Render a page through the real route tree with a memory history, the way the
// browser would after navigation: loaders run in `router.load()`, then the tree
// renders to a string. Route tests that hit loaders must also `vi.mock` the
// `src/server/*` modules through `runLocally` (see ./server.ts).
import { RouterProvider, createMemoryHistory, createRouter } from "@tanstack/react-router";
import { renderToString } from "react-dom/server";
import { RouteError, RouteNotFound, RoutePending } from "../../src/components/RouteStates";
import { routeTree } from "../../src/routeTree.gen";

export async function renderRoute(path: string): Promise<string> {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    defaultPendingComponent: RoutePending,
    defaultErrorComponent: RouteError,
    defaultNotFoundComponent: RouteNotFound,
  });
  await router.load();
  return renderToString(<RouterProvider router={router} />);
}

/**
 * The outer HTML of the single element carrying `data-testid`, brace-free:
 * the tag is found by its attribute, then the string is scanned forward
 * counting nested opens and closes of the same tag name. Only used for
 * container elements (div, aside, section), which are never void. Pure.
 */
export function elementHtml(html: string, testid: string): string {
  const attr = `data-testid="${testid}"`;
  const at = html.indexOf(attr);
  if (at < 0) return "";
  const open = html.lastIndexOf("<", at);
  const tag = /^<([a-zA-Z][a-zA-Z0-9-]*)/.exec(html.slice(open))?.[1];
  if (tag === undefined) return "";
  const opener = new RegExp(`<${tag}[\\s>]|</${tag}>`, "g");
  opener.lastIndex = open;
  let depth = 0;
  for (let match = opener.exec(html); match !== null; match = opener.exec(html)) {
    depth += match[0].startsWith("</") ? -1 : 1;
    if (depth === 0) return html.slice(open, match.index + match[0].length);
  }
  return html.slice(open);
}
