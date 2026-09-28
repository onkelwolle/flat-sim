import { Circle, Label, Layer, Line, Tag, Text } from 'react-konva'
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
  const { start, end } = measurement

  return (
    <Layer listening={false}>
      <Line
        points={[start.x, start.y, end.x, end.y]}
        stroke={COLOUR}
        strokeWidth={2 / zoom}
      />
      {[start, end].map((p, i) => (
        <Circle
          key={i}
          x={p.x}
          y={p.y}
          radius={4 / zoom}
          fill="#fff"
          stroke={COLOUR}
          strokeWidth={2 / zoom}
        />
      ))}
      <Label
        x={(start.x + end.x) / 2}
        y={(start.y + end.y) / 2}
        scaleX={1 / zoom}
        scaleY={1 / zoom}
        offsetY={-8}
      >
        <Tag fill={COLOUR} cornerRadius={4} />
        <Text
          text={formatLength(lengthCm)}
          fill="#fff"
          fontSize={13}
          padding={4}
        />
      </Label>
    </Layer>
  )
}
