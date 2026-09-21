import { Muted } from "@sixthshift/design-system/muted";
import { VERSION } from "../../../lib/version";

/** What is running, at the foot of Settings: the version the release workflow stamped into this build. */
export function Version() {
  return (
    <Muted as="p" className="pt-2 text-center text-xs">
      {`Garnish ${VERSION}`}
    </Muted>
  );
}
