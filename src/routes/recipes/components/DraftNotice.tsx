import { Button } from "@sixthshift/design-system/button";
import { Message } from "@sixthshift/design-system/message";

export type DraftNoticeProps = {
  /** What the notice says about the stored draft (`draftNoticeText`). */
  text: string;
  onResume: () => void;
  onDiscard: () => void;
};

/**
 * The stored-draft notice the form opens with when an earlier visit left
 * changes behind: Resume puts them in the form, Discard clears them, and
 * nothing is written back until one is chosen.
 */
export function DraftNotice({ text, onResume, onDiscard }: DraftNoticeProps) {
  return (
    <Message intent="info" title="Unsaved changes" data-testid="draft-notice">
      <div className="flex flex-col gap-2">
        <p>{text}</p>
        <div className="flex gap-2">
          <Button type="button" intent="primary" size="sm" data-testid="draft-resume" onClick={onResume}>
            Resume
          </Button>
          <Button type="button" variant="outline" intent="neutral" size="sm" data-testid="draft-discard" onClick={onDiscard}>
            Discard
          </Button>
        </div>
      </div>
    </Message>
  );
}
