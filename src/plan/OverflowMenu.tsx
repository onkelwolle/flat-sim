import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from 'react'

export type MenuItem = {
  label: string
  onSelect: () => void
  disabled?: boolean
  /** Tooltip, e.g. naming the step Redo would make again. */
  title?: string
}

/**
 * A "⋯" button opening a menu of less used commands above it. Choosing one
 * closes the menu before running it; so do a tap or click anywhere else
 * (which does nothing more) and Esc. It opens on its first command; the arrow
 * keys, Home and End move between the commands available now.
 */
export function OverflowMenu({
  label,
  items,
  onMouseDown,
}: {
  /** Accessible name of the button and the menu. */
  label: string
  items: MenuItem[]
  onMouseDown: (e: MouseEvent) => void
}) {
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const enabledItems = () => [
    ...(menuRef.current?.querySelectorAll<HTMLButtonElement>(
      '[role=menuitem]:not(:disabled)',
    ) ?? []),
  ]

  useEffect(() => {
    if (!open) return
    enabledItems()[0]?.focus()
    // Capturing on the window runs before, and stops, every other key handler
    // (Esc would otherwise also leave a tool or select nothing)
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      setOpen(false)
      buttonRef.current?.focus()
    }
    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () =>
      window.removeEventListener('keydown', onKeyDown, { capture: true })
  }, [open])

  const onMenuKeyDown = (e: KeyboardEvent) => {
    const enabled = enabledItems()
    const at = enabled.indexOf(document.activeElement as HTMLButtonElement)
    const to = {
      ArrowDown: (at + 1) % enabled.length,
      ArrowUp: (at - 1 + enabled.length) % enabled.length,
      Home: 0,
      End: enabled.length - 1,
    }[e.key]
    if (to === undefined) return
    e.preventDefault()
    enabled[to]?.focus()
  }

  return (
    <div className="menu-anchor">
      <button
        ref={buttonRef}
        type="button"
        className="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onMouseDown={onMouseDown}
        onClick={() => setOpen(!open)}
      >
        ⋯
      </button>
      {open && (
        <>
          {/* Takes the whole tap or click that closes the menu, so nothing
              under it gets any of it (closing on press would hand the rest
              of the tap, and so ⋯'s click, to what is under it) */}
          <div className="menu-backdrop" onClick={() => setOpen(false)} />
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label={label}
            className="menu"
            onKeyDown={onMenuKeyDown}
            // Tabbing out of the menu closes it
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false)
            }}
          >
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                className="button menu-item"
                disabled={item.disabled}
                title={item.title}
                onClick={() => {
                  setOpen(false)
                  item.onSelect()
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
