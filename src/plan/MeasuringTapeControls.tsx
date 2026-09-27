import type { MouseEvent } from 'react'
import {
  planStore,
  selectMeasuredLength,
  selectScale,
  usePlanStore,
} from './planStore'
import { formatLength } from './scale'

/**
 * Toolbar button that starts (or, while active, leaves) the measuring tape.
 * Disabled until the scale is set.
 */
export function MeasureButton({
  onMouseDown,
}: {
  onMouseDown: (e: MouseEvent) => void
}) {
  const measuring = usePlanStore((s) => s.tape !== null)
  const calibrated = usePlanStore((s) => selectScale(s) !== null)
  const { startMeasuring, stopMeasuring } = planStore.getState()

  return (
    <button
      type="button"
      className="button"
      aria-pressed={measuring}
      disabled={!calibrated}
      title={calibrated ? undefined : 'Calibrate the scale first'}
      onMouseDown={onMouseDown}
      onClick={measuring ? stopMeasuring : startMeasuring}
    >
      Measure
    </button>
  )
}

/** What the measuring tape shows in the status bar: how to use it, or the distance. */
export function MeasuringTapeStatus() {
  const lengthCm = usePlanStore(selectMeasuredLength)
  const stretching = usePlanStore((s) => s.tape?.stretching ?? false)

  const message =
    lengthCm === null
      ? 'Click or drag between two points to measure. Hold Shift to snap. Esc exits.'
      : `Distance: ${formatLength(lengthCm)}. ` +
        (stretching
          ? 'Click the other end; hold Shift to snap. Esc exits.'
          : 'Click to measure again. Esc exits.')

  return (
    <p className="status" role="status">
      {message}
    </p>
  )
}
