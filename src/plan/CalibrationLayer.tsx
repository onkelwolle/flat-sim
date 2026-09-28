import { Layer } from 'react-konva'
import { MeasuredLine } from './MeasuredLine'
import { usePlanStore } from './planStore'
import { formatLength } from './scale'
import type { Point } from './zoomView'

const COLOUR = '#dd6b20'

/**
 * The calibration line on the plan: the saved one with its real length, or,
 * while the calibrate tool is active, the line being drawn (rubber-banding to
 * `pointer` after the first click). Drawn in plan pixels; strokes and labels
 * keep a constant size on screen, at the view's zoom or the given `zoom`.
 */
export function CalibrationLayer({
  pointer,
  zoom: ownZoom,
}: {
  pointer: Point | null
  zoom?: number
}) {
  const calibration = usePlanStore((s) => s.calibration)
  const draft = usePlanStore((s) => s.calibrationDraft)
  const viewZoom = usePlanStore((s) => s.view.scale)
  const zoom = ownZoom ?? viewZoom

  // Placed points, then the line: to the pointer while only one is placed
  const points: Point[] =
    draft ?? (calibration ? [calibration.start, calibration.end] : [])
  const [start, end = draft && pointer] = points
  const label =
    !draft && calibration ? formatLength(calibration.lengthCm) : null

  return (
    <Layer listening={false}>
      {start && (
        <MeasuredLine
          start={start}
          end={end}
          label={label}
          colour={COLOUR}
          zoom={zoom}
          dashed={!!draft}
          handles={points.length > 1 ? 'both' : 'start'}
        />
      )}
    </Layer>
  )
}
