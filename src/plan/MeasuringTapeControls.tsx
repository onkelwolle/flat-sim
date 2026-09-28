import type { MouseEvent } from 'react'
import {
  planStore,
  selectMeasuredLength,
  selectScale,
  usePlanStore,
} from './planStore'
import { useFinePointer } from '../useMediaQuery'
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

/**
 * What the measuring tape shows in the status bar: how to use it, or the
 * distance. Hints about Shift and Esc show only if there is a mouse or
 * trackpad (and so likely a keyboard); fingers and pens snap by themselves.
 */
export function MeasuringTapeStatus() {
  const lengthCm = usePlanStore(selectMeasuredLength)
  const stretching = usePlanStore((s) => s.tape?.stretching ?? false)
  const keys = useFinePointer()

  const message =
    lengthCm === null
      ? 'Tap or click two points, or drag between them, to measure.' +
        (keys ? ' Hold Shift to snap. Esc exits.' : '')
      : `Distance: ${formatLength(lengthCm)}. ` +
        (stretching
          ? 'Tap or click the other end' +
            (keys ? '; hold Shift to snap. Esc exits.' : '.')
          : 'Tap or click to measure again.' + (keys ? ' Esc exits.' : ''))

  return (
    <p className="status" role="status">
      {message}
    </p>
  )
}
