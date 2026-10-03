import {
  useId,
  useState,
  type CSSProperties,
  type MouseEvent,
  type Ref,
} from 'react'
import { useModalDialog } from '../dialogs'
import { DialogBackdrop } from '../DialogBackdrop'
import {
  useCoarsePointer,
  useFinePointer,
  usePhoneLayout,
} from '../useMediaQuery'
import type { Size } from '../useViewportSize'
import {
  planStore,
  selectScale,
  usePlanStore,
  type Furniture,
  type FurnitureSpec,
} from './planStore'
import { parseRotation } from './geometry'
import { presetLibrary, type Preset, type PresetList } from './presets'
import { parseLength } from './scale'

/**
 * Toolbar button that opens the form for adding an item of furniture (see
 * `AddFurnitureForm`). Disabled until the scale is set; `compact` shortens its
 * label for the phone's bottom bar.
 */
export function AddFurnitureButton({
  compact = false,
  onMouseDown,
  onClick,
}: {
  compact?: boolean
  onMouseDown: (e: MouseEvent) => void
  onClick: () => void
}) {
  const calibrated = usePlanStore((s) => selectScale(s) !== null)

  return (
    <button
      type="button"
      className="button"
      disabled={!calibrated}
      title={calibrated ? undefined : 'Calibrate the scale first'}
      onMouseDown={onMouseDown}
      onClick={onClick}
    >
      {compact ? 'Add item' : 'Add furniture'}
    </button>
  )
}

/**
 * The Add furniture form, adding the item in the middle of `viewport`, then
 * closing. Rendered apart from the button that opens it, so it stays open,
 * with whatever has been typed, while the button moves between the toolbar
 * and the phone's bottom bar.
 */
export function AddFurnitureForm({
  viewport,
  onClose,
}: {
  viewport: Size
  onClose: () => void
}) {
  return (
    <AddFurnitureDialog
      onSubmit={(spec) => {
        planStore.getState().addFurniture(spec, viewport)
        onClose()
      }}
      onCancel={onClose}
    />
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

/**
 * What the status bar shows while an item is selected: how to delete it. A
 * mouse or trackpad suggests a keyboard, so the Delete key; a touch screen
 * the Delete item command, named with where it is on a phone (the ⋯ menu).
 * A touchscreen laptop has both, and gets both.
 */
export function FurnitureStatus() {
  const name = usePlanStore(
    (s) => s.furniture.find((f) => f.id === s.selectedId)?.name,
  )
  const touch = useCoarsePointer()
  const keys = useFinePointer()
  const command = usePhoneLayout() ? '⋯ › Delete item' : 'Delete item'

  const how = !touch
    ? 'Press Delete'
    : keys
      ? `Press Delete or tap ${command}`
      : `Tap ${command}`

  return (
    <p className="status" role="status">
      {name} selected. {how} to remove it.
    </p>
  )
}

/**
 * Side panel for the selected item, editing its name, its size in cm and its
 * rotation in degrees. Shown only while an item is selected, below the screen
 * position `below` (the toolbar's bottom edge); as a `sheet`, it sits on the
 * phone's bottom bar instead, and `expandedSheetRef` holds it while it is
 * expanded. Rendered in the same place either way, it can switch between the
 * two and keep what is typed in it.
 */
export function FurniturePanel({
  below = 0,
  sheet = false,
  expandedSheetRef,
}: {
  below?: number
  sheet?: boolean
  expandedSheetRef?: Ref<HTMLElement>
}) {
  const item = usePlanStore((s) =>
    s.furniture.find((f) => f.id === s.selectedId),
  )
  if (!item) return null
  // A fresh form for each item, so edits never carry over to another
  return (
    <FurniturePanelForm
      key={item.id}
      item={item}
      below={below}
      sheet={sheet}
      expandedSheetRef={expandedSheetRef}
    />
  )
}

type PanelField = 'name' | 'width' | 'depth' | 'rotation'

function FurniturePanelForm({
  item,
  below,
  sheet,
  expandedSheetRef,
}: {
  item: Furniture
  below: number
  sheet: boolean
  expandedSheetRef?: Ref<HTMLElement>
}) {
  const [error, setError] = useState<{ field: PanelField; message: string }>()
  // A sheet opens expanded, and collapses to its title to show the plan. The
  // side panel always shows it all, but a sheet collapsed before widening the
  // screen is collapsed again on narrowing it
  const [expanded, setExpanded] = useState(true)
  const bodyId = useId()
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
      ref={sheet && expanded ? expandedSheetRef : undefined}
      className={sheet ? 'panel sheet' : 'panel'}
      aria-label="Selected item"
      style={{ '--below': `${below}px` } as CSSProperties}
    >
      <h2>
        {sheet ? (
          <button
            type="button"
            className="sheet-title"
            aria-expanded={expanded}
            aria-controls={bodyId}
            onClick={() => setExpanded(!expanded)}
          >
            {item.name}
            <span className="sheet-chevron" aria-hidden="true" />
          </button>
        ) : (
          item.name
        )}
      </h2>
      <div
        id={bodyId}
        className={sheet ? 'sheet-body' : undefined}
        hidden={sheet && !expanded}
      >
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
      </div>
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
  const [error, setError] = useState<{ field?: Field; message: string }>()
  const [presets, setPresets] = useState(() => presetLibrary.list())
  // The preset picked, as its option's value; '' for none
  const [picked, setPicked] = useState('')

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

  // The item the form describes, or undefined once its error is shown
  const parse = (): FurnitureSpec | undefined => {
    const name = parseName(text.name)
    const widthCm = parseLength(text.width, 'cm')
    const depthCm = parseLength(text.depth, 'cm')
    if (!name) return void setError({ field: 'name', message: NAME_ERROR })
    if (widthCm === null)
      return void setError({ field: 'width', message: SIZE_ERROR })
    if (depthCm === null)
      return void setError({ field: 'depth', message: SIZE_ERROR })
    return { name, widthCm, depthCm }
  }

  const pick = (value: string) => {
    setPicked(value)
    const preset = presetOf(presets, value)
    if (!preset) return
    setText({
      name: preset.name,
      width: String(preset.widthCm),
      depth: String(preset.depthCm),
    })
    setError(undefined)
  }

  // Saved and picked, so the form can go on to add it
  const saveAsPreset = () => {
    const spec = parse()
    if (!spec) return
    if (!presetLibrary.save(spec))
      return setError({ message: PRESET_SAVE_ERROR })
    const next = presetLibrary.list()
    setPresets(next)
    const saved = next.user.find((p) => p.name === spec.name)
    setPicked(saved ? userValue(saved) : '')
  }

  // The form keeps what the preset filled it with
  const deletePreset = (preset: Preset) => {
    if (!presetLibrary.remove(preset.name))
      return setError({ message: PRESET_DELETE_ERROR })
    setPresets(presetLibrary.list())
    setPicked('')
  }

  // Only saved presets can be deleted
  const pickedSaved = picked.startsWith(SAVED)
    ? presetOf(presets, picked)
    : undefined

  return (
    <DialogBackdrop>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-furniture-title"
        className="dialog"
        onSubmit={(e) => {
          e.preventDefault()
          const spec = parse()
          if (!spec) return
          lastAdded = {
            name: spec.name,
            width: String(spec.widthCm),
            depth: String(spec.depthCm),
          }
          onSubmit(spec)
        }}
      >
        <h2 id="add-furniture-title">Add furniture</h2>
        <p>The item appears in the middle of the view.</p>
        <div className="preset-picker">
          <label>
            Preset
            <select
              className="input"
              value={picked}
              onChange={(e) => pick(e.currentTarget.value)}
            >
              <option value="">Choose a preset…</option>
              {presets.user.length > 0 && (
                <optgroup label="Saved">
                  {presets.user.map((p) => (
                    <option key={p.name} value={userValue(p)}>
                      {presetLabel(p)}
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label="Built-in">
                {presets.builtIn.map((p, i) => (
                  <option key={i} value={`${BUILT_IN}${i}`}>
                    {presetLabel(p)}
                  </option>
                ))}
              </optgroup>
            </select>
          </label>
          {pickedSaved && (
            <button
              type="button"
              className="button"
              onClick={() => deletePreset(pickedSaved)}
            >
              Delete preset
            </button>
          )}
        </div>
        <div className="furniture-fields">
          {input('name', 'Name')}
          {input('width', 'Width (cm)', true)}
          {input('depth', 'Depth (cm)', true)}
        </div>
        <button type="button" className="button" onClick={saveAsPreset}>
          Save as preset
        </button>
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
    </DialogBackdrop>
  )
}

// A preset's option value: its place among the built-ins, or its saved name
const BUILT_IN = 'built-in:'
const SAVED = 'saved:'
const userValue = (preset: Preset) => `${SAVED}${preset.name}`

const presetOf = (presets: PresetList, value: string) =>
  value.startsWith(BUILT_IN)
    ? presets.builtIn[Number(value.slice(BUILT_IN.length))]
    : presets.user.find((p) => userValue(p) === value)

const presetLabel = ({ name, widthCm, depthCm }: Preset) =>
  `${name} (${widthCm} × ${depthCm} cm)`

const PRESET_SAVE_ERROR =
  "The preset couldn't be saved: this browser won't keep it."
const PRESET_DELETE_ERROR =
  "The preset couldn't be deleted: this browser won't change it."
const NAME_ERROR = 'Enter a name.'
const SIZE_ERROR = 'Enter a width and depth greater than zero.'
const ROTATION_ERROR = 'Enter a rotation in degrees.'
