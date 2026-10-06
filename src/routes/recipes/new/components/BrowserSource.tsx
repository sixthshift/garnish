import { Button } from "@sixthshift/design-system/button";
import { Card } from "@sixthshift/design-system/card";
import { Muted } from "@sixthshift/design-system/muted";
import { Textarea } from "@sixthshift/design-system/textarea";
import { useEffect, useRef, useState } from "react";
import { bookmarklet } from "./bookmarklet";

export type BrowserSourceProps = { onBack: () => void };

/**
 * Setting up the Save to Garnish bookmark: a link to drag to the bookmarks
 * bar, and its code to paste by hand where there is no bar to drag to. The
 * code names the address this page is open at, so it is written once the page
 * is in a browser, never on the server.
 */
export function BrowserSource({ onBack }: BrowserSourceProps) {
  const link = useRef<HTMLAnchorElement>(null);
  const [code, setCode] = useState("");
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    const anchor = link.current;
    const next = bookmarklet(window.location.origin);
    setCode(next);
    if (anchor === null) return;
    // React refuses a `javascript:` href as a prop, so it is set on the
    // element; and pressed here it would run on Garnish's own page, so a
    // press only says to drag it. A drag carries the href regardless.
    anchor.setAttribute("href", next);
    const press = (event: MouseEvent) => {
      event.preventDefault();
      setPressed(true);
    };
    anchor.addEventListener("click", press);
    return () => anchor.removeEventListener("click", press);
  }, []);

  return (
    <Card size="lg" className="flex flex-col gap-4" data-source-stage="browser">
      <h2 className="text-lg font-medium">Save from your browser</h2>
      <ol className="flex list-decimal flex-col gap-3 pl-5">
        <li>
          <span>Drag this to your bookmarks bar:</span>
          <div className="mt-2">
            <Button asChild variant="outline" intent="brand">
              <a ref={link} href="#bookmark" data-testid="bookmarklet">
                {/* The text becomes the bookmark's name when dragged, and a bookmarklet can have no icon of its own, so the sprig stands in for one. */}
                <span aria-hidden="true">🌿</span> Save to Garnish
              </a>
            </Button>
          </div>
          {pressed && (
            <Muted as="p" className="mt-2 text-sm">
              Drag it rather than pressing it here. It works on the recipe's page, not on Garnish's.
            </Muted>
          )}
        </li>
        <li>On a recipe page, press it. Garnish opens in a new tab with the recipe, to review before anything is saved.</li>
      </ol>
      <Muted as="p" className="text-sm">
        It is for sites that block the import: your browser has already got past them, so it sends the page as you see it. Allow pop-ups for the site if your
        browser asks. With no bookmarks bar, make a bookmark of any page, edit it, and paste this as its address:
      </Muted>
      <Textarea
        readOnly
        rows={3}
        aria-label="The bookmark's code"
        className="font-mono text-xs"
        value={code}
        onFocus={(event) => event.currentTarget.select()}
      />
      <div>
        <Button type="button" variant="ghost" intent="neutral" onClick={onBack}>
          Back
        </Button>
      </div>
    </Card>
  );
}
