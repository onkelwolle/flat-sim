import { useState, type CSSProperties, type MouseEvent } from 'react'
import { useModalDialog } from '../dialogs'
import type { Size } from '../useViewportSize'
import {
  planStore,
  selectScale,
  usePlanStore,
  type Furniture,
  type FurnitureSpec,
} from './planStore'
import { parseRotation } from './geometry'
import { parseLength } from './scale'

/**
 * Toolbar button that opens the form for adding an item of furniture.
 * Disabled until the scale is set; `compact` shortens its label for the
 * phone's bottom bar.
 */
export function AddFurnitureButton({
  viewport,
  compact = false,
  onMouseDown,
}: {
  viewport: Size
  compact?: boolean
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
        {compact ? 'Add item' : 'Add furniture'}
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

/**
 * Side panel for the selected item, editing its name, its size in cm and its
 * rotation in degrees. Shown only while an item is selected, below the screen
 * position `below` (the toolbar's bottom edge).
 */
export function FurniturePanel({ below }: { below: number }) {
  const item = usePlanStore((s) =>
    s.furniture.find((f) => f.id === s.selectedId),
  )
  if (!item) return null
  // A fresh form for each item, so edits never carry over to another
  return <FurniturePanelForm key={item.id} item={item} below={below} />
}

type PanelField = 'name' | 'width' | 'depth' | 'rotation'

function FurniturePanelForm({
  item,
  below,
}: {
  item: Furniture
  below: number
}) {
  const [error, setError] = useState<{ field: PanelField; message: string }>()
  const store = planStore.getState()

  const field = (
    name: PanelField,
    label: string,
    value: string,
    // Apply the text typed; false if it is rejected
    apply: (text: string) => boolean,
    message: string,
    decimal = true,
  ) => (
    <PanelInput
      label={label}
      value={value}
      decimal={decimal}
      invalid={error?.field === name}
      onCommit={(text) => {
        const valid = apply(text)
        if (valid) setError((e) => (e?.field === name ? undefined : e))
        else setError({ field: name, message })
        return valid
      }}
    />
  )

  const resize = (widthCm: number | null, depthCm: number | null) => {
    if (widthCm === null || depthCm === null) return false
    store.resizeFurniture(item.id, widthCm, depthCm)
    return true
  }

  return (
    <aside
      className="panel"
      aria-label="Selected item"
      style={{ '--below': `${below}px` } as CSSProperties}
    >
      <h2>{item.name}</h2>
      <div className="panel-fields">
        <div className="panel-wide">
          {field(
            'name',
            'Name',
            item.name,
            (text) => {
              const name = parseName(text)
              if (name) store.renameFurniture(item.id, name)
              return name !== null
            },
            NAME_ERROR,
            false,
          )}
        </div>
        {field(
          'width',
          'Width (cm)',
          String(item.widthCm),
          (text) => resize(parseLength(text, 'cm'), item.depthCm),
          SIZE_ERROR,
        )}
        {field(
          'depth',
          'Depth (cm)',
          String(item.depthCm),
          (text) => resize(item.widthCm, parseLength(text, 'cm')),
          SIZE_ERROR,
        )}
        {field(
          'rotation',
          'Rotation (°)',
          formatRotation(item.rotationDeg),
          (text) => {
            const deg = parseRotation(text)
            if (deg !== null) store.rotateFurniture(item.id, deg)
            return deg !== null
          },
          ROTATION_ERROR,
        )}
      </div>
      {error && (
        <p className="error" role="alert">
          {error.message}
        </p>
      )}
    </aside>
  )
}

/**
 * A text field in the item panel showing `value`, whose edits apply on Enter
 * or on leaving it. It follows `value` when that changes elsewhere (say, the
 * rotate handle), and shows `value` again once an edit applies.
 */
function PanelInput({
  label,
  value,
  decimal,
  invalid,
  onCommit,
}: {
  label: string
  value: string
  decimal: boolean
  invalid: boolean
  /** Apply the text typed; false if it is rejected. */
  onCommit: (text: string) => boolean
}) {
  const [text, setText] = useState(value)
  const [shown, setShown] = useState(value)
  if (value !== shown) {
    setShown(value)
    setText(value)
  }

  const commit = () => {
    // Leaving a field untouched never changes the item (a freely rotated item
    // shows its rotation rounded)
    if (text === value && !invalid) return
    if (onCommit(text)) setText(value)
  }

  return (
    <label>
      {label}
      <input
        className="input"
        type="text"
        inputMode={decimal ? 'decimal' : undefined}
        value={text}
        aria-invalid={invalid}
        onChange={(e) => setText(e.currentTarget.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
        }}
      />
    </label>
  )
}

/** A rotation for display, in whole degrees. */
const formatRotation = (deg: number) => String(Math.round(deg) % 360)

/** A name typed by the user, trimmed, or null if that leaves it empty. */
const parseName = (text: string) => text.trim() || null

type Field = 'name' | 'width' | 'depth'

/**
 * What the Add furniture form last added, to open with next time. Kept in
 * memory for the session only: a reload starts with an empty form.
 */
let lastAdded: Record<Field, string> = { name: '', width: '', depth: '' }

function AddFurnitureDialog({
  onSubmit,
  onCancel,
}: {
  onSubmit: (spec: FurnitureSpec) => void
  onCancel: () => void
}) {
  const [text, setText] = useState(lastAdded)
  const [error, setError] = useState<{ field: Field; message: string }>()

  useModalDialog(onCancel)

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
        // Selected whole, so typing replaces a remembered value
        onFocus={(e) => e.currentTarget.select()}
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
          const name = parseName(text.name)
          const widthCm = parseLength(text.width, 'cm')
          const depthCm = parseLength(text.depth, 'cm')
          if (!name) return setError({ field: 'name', message: NAME_ERROR })
          if (widthCm === null)
            return setError({ field: 'width', message: SIZE_ERROR })
          if (depthCm === null)
            return setError({ field: 'depth', message: SIZE_ERROR })
          lastAdded = {
            name,
            width: String(widthCm),
            depth: String(depthCm),
          }
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

const NAME_ERROR = 'Enter a name.'
const SIZE_ERROR = 'Enter a width and depth greater than zero.'
const ROTATION_ERROR = 'Enter a rotation in degrees.'
