// The one place notices are rendered. Mounted once in `__root.tsx`; every
// caller reaches it through `notify()` (src/lib/notify.ts), never by rendering
// a toast itself.
//
// The design system's `Toast` positions itself bottom-centre when standalone,
// which cannot stack, so it is rendered with `standalone={false}` inside a
// container this file positions: above the phone's bottom nav, bottom-right
// from md up. Each notice's wrapper keeps its own auto-dismiss timer — `Toast`
// has none — and the wrapper is also what carries the notice in the markup, so
// a server-rendered page can be asserted on (Toast paints only after its enter
// animation starts, i.e. on the client).
import { Toast } from "@sixthshift/design-system/toast";
import { useEffect } from "react";
import { type Notice, dismissNotice, useNotices } from "../lib/notify";

export type NoticeToastProps = {
  notice: Notice;
  onDismiss: (id: string) => void;
};

export function NoticeToast({ notice, onDismiss }: NoticeToastProps) {
  const { id, duration } = notice;
  useEffect(() => {
    if (duration <= 0) return;
    const timer = setTimeout(() => onDismiss(id), duration);
    return () => clearTimeout(timer);
  }, [id, duration, onDismiss]);

  return (
    <div className="pointer-events-auto" data-notice={notice.intent} data-notice-id={id}>
      <Toast
        standalone={false}
        intent={notice.intent}
        title={notice.title}
        {...(notice.action === undefined
          ? {}
          : {
              action: notice.action.label,
              onAction: () => {
                notice.action?.onSelect();
                onDismiss(id);
              },
            })}
        onClose={() => onDismiss(id)}
      >
        {notice.message}
      </Toast>
    </div>
  );
}

export type ToastStackProps = {
  notices: readonly Notice[];
  onDismiss: (id: string) => void;
};

/** The presentational half: a fixed, click-through column of notices, oldest at the top. */
export function ToastStack({ notices, onDismiss }: ToastStackProps) {
  return (
    <div
      data-testid="toasts"
      data-count={notices.length}
      className="pointer-events-none fixed inset-x-0 bottom-24 z-toast flex flex-col items-center gap-2 px-4 md:inset-x-auto md:right-6 md:bottom-6 md:items-end md:px-0"
    >
      {notices.map((notice) => (
        <NoticeToast key={notice.id} notice={notice} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

/** The stack bound to the app's notice store. */
export function Toaster() {
  return <ToastStack notices={useNotices()} onDismiss={dismissNotice} />;
}
