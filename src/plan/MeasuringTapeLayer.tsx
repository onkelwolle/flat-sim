import { Layer } from 'react-konva'
import { MeasuredLine } from './MeasuredLine'
import { selectMeasuredLength, usePlanStore } from './planStore'
import { formatLength } from './scale'

const COLOUR = '#2b6cb0'

/**
 * The measuring tape's current measurement: a line between its ends with the
 * real distance. Drawn in plan pixels; strokes and label keep a constant size
 * on screen, at the view's zoom or the given `zoom`. Nothing is drawn while
 * the tape is not active.
 */
export function MeasuringTapeLayer({ zoom: ownZoom }: { zoom?: number }) {
  const measurement = usePlanStore((s) => s.tape?.measurement)
  const lengthCm = usePlanStore(selectMeasuredLength)
  const viewZoom = usePlanStore((s) => s.view.scale)
  const zoom = ownZoom ?? viewZoom

  if (!measurement || lengthCm === null) return null

  return (
    <Layer listening={false}>
      <MeasuredLine
        start={measurement.start}
        end={measurement.end}
        label={formatLength(lengthCm)}
        colour={COLOUR}
        zoom={zoom}
      />
    </Layer>
  )
}
