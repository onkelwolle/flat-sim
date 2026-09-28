import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useKeyboardInset } from './keyboardInset'

/**
 * The dimmed layer a modal dialog sits on, over the whole page. It ends at the
 * on-screen keyboard, so a dialog (full screen on a phone) keeps its buttons
 * above it. Rendered straight into the body, so a dialog opened from a bar
 * takes none of the bar's styles.
 */
export function DialogBackdrop({ children }: { children: ReactNode }) {
  const keyboard = useKeyboardInset()
  return createPortal(
    <div className="backdrop" style={{ bottom: keyboard }}>
      {children}
    </div>,
    document.body,
  )
}
