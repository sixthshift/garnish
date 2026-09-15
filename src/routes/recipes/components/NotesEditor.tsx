// The recipe's notes: a title input and a textarea per note in a ReorderList,
// with add, remove and move up/down. The parent owns the draft; every change
// goes through a pure helper and comes back through `onChange` as a new
// `RecipeDraft`. Positions are never edited here: the repository writes them
// from array order on save.
//
// A note's title is optional, as in Mealie; the view page shows a card with
// no heading for a blank one.
import { Button } from "@sixthshift/design-system/button";
import { EmptyBoundary } from "@sixthshift/design-system/empty-boundary";
import { Input } from "@sixthshift/design-system/input";
import { Muted } from "@sixthshift/design-system/muted";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import { Textarea } from "@sixthshift/design-system/textarea";
import { ReorderList } from "../../../components/ui/ReorderList";
import { addNote, type FieldErrors, type RecipeDraft, removeNote, updateNote } from "../../../domain/draft";

// --- Pure helpers -----------------------------------------------------------

// --- Component --------------------------------------------------------------

export type NotesEditorProps = {
  draft: RecipeDraft;
  onChange: (draft: RecipeDraft) => void;
  errors?: FieldErrors;
  disabled?: boolean;
};

export function NotesEditor({ draft, onChange, errors = {}, disabled }: NotesEditorProps) {
  const { notes } = draft;

  return (
    <section className="flex flex-col gap-3" aria-label="Notes">
      <div className="flex items-center justify-between gap-3">
        <SectionTitle as="h2">Notes</SectionTitle>
        <Button type="button" variant="outline" intent="neutral" size="sm" disabled={disabled} onClick={() => onChange(addNote(draft))}>
          Add note
        </Button>
      </div>
      <EmptyBoundary
        isEmpty={notes.length === 0}
        fallback={
          <Muted as="p" className="text-sm">
            No notes yet
          </Muted>
        }
      >
        <ReorderList
          items={notes}
          keyOf={(note) => note.id ?? "unsaved"}
          itemName="note"
          onReorder={(next) => onChange({ ...draft, notes: next })}
          onRemove={(_, ni) => onChange(removeNote(draft, ni))}
          renderItem={(note, ni) => {
            const label = `Note ${ni + 1}`;
            const titleError = errors[`notes.${ni}.title`];
            const textError = errors[`notes.${ni}.text`];
            return (
              <div className="flex flex-col gap-2 rounded-xl border border-border-normal p-3" data-note={ni}>
                <Input
                  name={`notes.${ni}.title`}
                  aria-label={`${label} title`}
                  aria-invalid={titleError !== undefined || undefined}
                  placeholder="Title (optional)"
                  autoComplete="off"
                  value={note.title ?? ""}
                  disabled={disabled}
                  onChange={(event) => onChange(updateNote(draft, ni, { title: event.target.value }))}
                />
                {titleError !== undefined && (
                  <p className="text-sm text-fg-danger" role="alert">
                    {titleError}
                  </p>
                )}
                <Textarea
                  name={`notes.${ni}.text`}
                  aria-label={`${label} text`}
                  aria-invalid={textError !== undefined || undefined}
                  rows={3}
                  placeholder="Anything worth remembering next time"
                  value={note.text ?? ""}
                  disabled={disabled}
                  onChange={(event) => onChange(updateNote(draft, ni, { text: event.target.value }))}
                />
                {textError !== undefined && (
                  <p className="text-sm text-fg-danger" role="alert">
                    {textError}
                  </p>
                )}
              </div>
            );
          }}
        />
      </EmptyBoundary>
    </section>
  );
}
