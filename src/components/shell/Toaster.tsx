import { Toast } from "@sixthshift/design-system/toast";
import { useEffect } from "react";
import { dismissNotice, type Notice, useNotices } from "../../lib/notify";

export type NoticeToastProps = {
  notice: Notice;
  onDismiss: (id: string) => void;
};

export function NoticeToast({ notice, onDismiss }: NoticeToastProps) {
  const { id, duration } = notice;
  // Toast has no auto-dismiss of its own.
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
