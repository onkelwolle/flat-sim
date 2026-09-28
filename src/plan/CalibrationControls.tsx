import { useEffect, useState, type MouseEvent } from 'react'
import { DialogBackdrop } from '../DialogBackdrop'
import { isDialogOpen, useModalDialog } from '../dialogs'
import { planStore, selectScale, usePlanStore } from './planStore'
import { parseLength, type LengthUnit } from './scale'

/**
 * Toolbar button that starts (or, while active, cancels) the calibrate tool;
 * `compact` shortens its label for the phone's bottom bar.
 */
export function CalibrateButton({
  compact = false,
  onMouseDown,
}: {
  compact?: boolean
  onMouseDown: (e: MouseEvent) => void
}) {
  const calibrating = usePlanStore((s) => s.calibrationDraft !== null)
  const calibrated = usePlanStore((s) => s.calibration !== null)
  const { startCalibration, cancelCalibration } = planStore.getState()

  return (
    <button
      type="button"
      className="button"
      aria-pressed={calibrating}
      onMouseDown={onMouseDown}
      onClick={calibrating ? cancelCalibration : startCalibration}
    >
      {calibrated ? 'Recalibrate' : compact ? 'Calibrate' : 'Calibrate scale'}
    </button>
  )
}

const formatScale = (pixelsPerMetre: number) =>
  `Scale: 1 m = ${Number(pixelsPerMetre.toFixed(1))} plan px`

/**
 * What the calibration needs from the user next: a prompt to set the scale,
 * where to tap or click, or the scale once it is set; plus the length dialog.
 */
export function CalibrationStatus() {
  const scale = usePlanStore(selectScale)
  const draft = usePlanStore((s) => s.calibrationDraft)

  useEffect(() => {
    if (!draft) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isDialogOpen())
        planStore.getState().cancelCalibration()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [draft])

  const message = !draft
    ? scale
      ? formatScale(scale.pixelsPerMetre)
      : 'Scale not set: calibrate it to measure the plan.'
    : draft.length === 0
      ? 'Tap or click one end of a wall whose length you know. Esc cancels.'
      : draft.length === 1
        ? 'Tap or click the other end of the wall. Esc cancels.'
        : 'Enter the real length of the line.'

  return (
    <>
      <p className="status" role="status">
        {message}
      </p>
      {draft?.length === 2 && (
        <LengthDialog
          onSubmit={(cm) => planStore.getState().finishCalibration(cm)}
          onCancel={() => planStore.getState().cancelCalibration()}
        />
      )}
    </>
  )
}

function LengthDialog({
  onSubmit,
  onCancel,
}: {
  onSubmit: (lengthCm: number) => void
  onCancel: () => void
}) {
  const [text, setText] = useState('')
  const [unit, setUnit] = useState<LengthUnit>('m')
  const [invalid, setInvalid] = useState(false)
  useModalDialog(onCancel)

  return (
    <DialogBackdrop>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="length-dialog-title"
        className="dialog"
        onSubmit={(e) => {
          e.preventDefault()
          const cm = parseLength(text, unit)
          if (cm === null) return setInvalid(true)
          onSubmit(cm)
        }}
      >
        <h2 id="length-dialog-title">How long is this line?</h2>
        <p>Enter the real length of the wall you drew the line along.</p>
        <div className="length-fields">
          <label>
            Length
            <input
              className="input"
              type="text"
              inputMode="decimal"
              autoFocus
              value={text}
              aria-invalid={invalid}
              onChange={(e) => {
                setText(e.currentTarget.value)
                setInvalid(false)
              }}
            />
          </label>
          <label>
            Unit
            <select
              className="input"
              value={unit}
              onChange={(e) => setUnit(e.currentTarget.value as LengthUnit)}
            >
              <option value="m">m</option>
              <option value="cm">cm</option>
            </select>
          </label>
        </div>
        {invalid && (
          <p className="error" role="alert">
            Enter a length greater than zero.
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" className="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="button primary">
            Set scale
          </button>
        </div>
      </form>
    </DialogBackdrop>
  )
}
