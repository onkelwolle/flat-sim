import { useEffect, useState, type MouseEvent } from 'react'
import type { Size } from '../useViewportSize'
import {
  planStore,
  selectScale,
  usePlanStore,
  type FurnitureSpec,
} from './planStore'
import { parseLength } from './scale'

/**
 * Toolbar button that opens the form for adding an item of furniture.
 * Disabled until the scale is set.
 */
export function AddFurnitureButton({
  viewport,
  onMouseDown,
}: {
  viewport: Size
  onMouseDown: (e: MouseEvent) => void
}) {
  const calibrated = usePlanStore((s) => selectScale(s) !== null)
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        className="button"
        disabled={!calibrated}
        title={calibrated ? undefined : 'Calibrate the scale first'}
        onMouseDown={onMouseDown}
        onClick={() => setOpen(true)}
      >
        Add furniture
      </button>
      {open && (
        <AddFurnitureDialog
          onSubmit={(spec) => {
            planStore.getState().addFurniture(spec, viewport)
            setOpen(false)
          }}
          onCancel={() => setOpen(false)}
        />
      )}
    </>
  )
}

/** Toolbar button that deletes the selected item; shown only while one is. */
export function DeleteFurnitureButton({
  onMouseDown,
}: {
  onMouseDown: (e: MouseEvent) => void
}) {
  const selected = usePlanStore((s) => s.selectedId !== null)
  if (!selected) return null

  return (
    <button
      type="button"
      className="button"
      onMouseDown={onMouseDown}
      onClick={() => planStore.getState().deleteSelectedFurniture()}
    >
      Delete item
    </button>
  )
}

/** What the status bar shows while an item is selected. */
export function FurnitureStatus() {
  const name = usePlanStore(
    (s) => s.furniture.find((f) => f.id === s.selectedId)?.name,
  )

  return (
    <p className="status" role="status">
      {name} selected. Press Delete to remove it.
    </p>
  )
}

type Field = 'name' | 'width' | 'depth'

function AddFurnitureDialog({
  onSubmit,
  onCancel,
}: {
  onSubmit: (spec: FurnitureSpec) => void
  onCancel: () => void
}) {
  const [text, setText] = useState<Record<Field, string>>({
    name: '',
    width: '',
    depth: '',
  })
  const [error, setError] = useState<{ field: Field; message: string }>()

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  const input = (field: Field, label: string, decimal = false) => (
    <label>
      {label}
      <input
        className="input"
        type="text"
        inputMode={decimal ? 'decimal' : undefined}
        autoFocus={field === 'name'}
        value={text[field]}
        aria-invalid={error?.field === field}
        onChange={(e) => {
          setText({ ...text, [field]: e.currentTarget.value })
          setError(undefined)
        }}
      />
    </label>
  )

  return (
    <div className="backdrop">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-furniture-title"
        className="dialog"
        onSubmit={(e) => {
          e.preventDefault()
          const name = text.name.trim()
          const widthCm = parseLength(text.width, 'cm')
          const depthCm = parseLength(text.depth, 'cm')
          if (!name)
            return setError({ field: 'name', message: 'Enter a name.' })
          if (widthCm === null)
            return setError({ field: 'width', message: SIZE_ERROR })
          if (depthCm === null)
            return setError({ field: 'depth', message: SIZE_ERROR })
          onSubmit({ name, widthCm, depthCm })
        }}
      >
        <h2 id="add-furniture-title">Add furniture</h2>
        <p>The item appears in the middle of the view.</p>
        <div className="furniture-fields">
          {input('name', 'Name')}
          {input('width', 'Width (cm)', true)}
          {input('depth', 'Depth (cm)', true)}
        </div>
        {error && (
          <p className="error" role="alert">
            {error.message}
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" className="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="button primary">
            Add
          </button>
        </div>
      </form>
    </div>
  )
}

const SIZE_ERROR = 'Enter a width and depth greater than zero.'
