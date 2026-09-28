import { useId, type ReactNode } from 'react'
import { useModalDialog } from '../dialogs'
import { DialogBackdrop } from '../DialogBackdrop'

/** In-page yes/no prompt; Escape or Cancel keeps things as they are. */
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string
  children: ReactNode
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const titleId = useId()

  useModalDialog(onCancel)

  return (
    <DialogBackdrop>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="dialog"
      >
        <h2 id={titleId}>{title}</h2>
        <p>{children}</p>
        <div className="dialog-actions">
          <button type="button" className="button" autoFocus onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="button primary" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </DialogBackdrop>
  )
}
