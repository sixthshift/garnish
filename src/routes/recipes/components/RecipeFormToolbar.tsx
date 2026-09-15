import { Button } from "@sixthshift/design-system/button";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { EditorToolbar } from "../../../components/ui/EditorToolbar";
import { Menu } from "../../../components/ui/Menu";

export type RecipeFormCancelProps = {
  /** The recipe being edited; absent for a new one, which cancels to the list. */
  existing?: { slug: string; servings?: number };
  disabled?: boolean;
};

/** Cancel: back to the recipe at the scale the edit link carried, or to the list for a new recipe. */
export function RecipeFormCancel({ existing, disabled }: RecipeFormCancelProps) {
  return (
    <Button asChild variant="ghost" intent="neutral" size="sm" disabled={disabled}>
      {existing ? (
        <Link to="/recipes/$slug" params={{ slug: existing.slug }} search={{ servings: existing.servings }}>
          Cancel
        </Link>
      ) : (
        <Link to="/">Cancel</Link>
      )}
    </Button>
  );
}

export type RecipeFormToolbarProps = {
  title: string;
  existing: boolean;
  saving: boolean;
  online: boolean;
  dirty: boolean;
  cancel: ReactNode;
  /** True while the JSON view is showing; the menu item reads the other way. */
  jsonOpen: boolean;
  /** Forwarded to the `Menu` (tests); see `RecipeFormProps.jsonMenuOpen`. */
  jsonMenuOpen?: boolean;
  onToggleJson: () => void;
};

/** The editor toolbar above the form: name, save, cancel, the dirty note, and the one-item editor menu. */
export function RecipeFormToolbar({ title, existing, saving, online, dirty, cancel, jsonOpen, jsonMenuOpen, onToggleJson }: RecipeFormToolbarProps) {
  return (
    <EditorToolbar
      title={title}
      placeholder={existing ? "Untitled recipe" : "New recipe"}
      label={existing ? "Save changes" : "Create recipe"}
      busyLabel="Saving…"
      busy={saving}
      disabled={!online}
      note={dirty ? "Unsaved changes" : undefined}
      cancel={cancel}
      actions={
        <Menu label="Editor actions" iconOnly open={jsonMenuOpen}>
          <Menu.Item data-testid="json-toggle" disabled={saving} onSelect={onToggleJson}>
            {jsonOpen ? "Back to form" : "Edit as JSON"}
          </Menu.Item>
        </Menu>
      }
    />
  );
}
