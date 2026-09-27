import { Circle, Label, Layer, Line, Tag, Text } from 'react-konva'
import { usePlanStore } from './planStore'
import { formatLength } from './scale'
import type { Point } from './zoomView'

const COLOUR = '#dd6b20'

/**
 * The calibration line on the plan: the saved one with its real length, or,
 * while the calibrate tool is active, the line being drawn (rubber-banding to
 * `pointer` after the first click). Drawn in plan pixels; strokes and labels
 * keep a constant size on screen.
 */
export function CalibrationLayer({ pointer }: { pointer: Point | null }) {
  const calibration = usePlanStore((s) => s.calibration)
  const draft = usePlanStore((s) => s.calibrationDraft)
  const zoom = usePlanStore((s) => s.view.scale)

  // Placed points, then the line: to the pointer while only one is placed
  const points: Point[] =
    draft ?? (calibration ? [calibration.start, calibration.end] : [])
  const [start, end = draft && pointer] = points
  const label = !draft && calibration && formatLength(calibration.lengthCm)

  return (
    <Layer listening={false}>
      {start && end && (
        <Line
          points={[start.x, start.y, end.x, end.y]}
          stroke={COLOUR}
          strokeWidth={2 / zoom}
          dash={draft ? [6 / zoom, 4 / zoom] : undefined}
        />
      )}
      {points.map((p, i) => (
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
      {label && start && end && (
        <Label
          x={(start.x + end.x) / 2}
          y={(start.y + end.y) / 2}
          scaleX={1 / zoom}
          scaleY={1 / zoom}
          offsetY={-8}
        >
          <Tag fill={COLOUR} cornerRadius={4} />
          <Text text={label} fill="#fff" fontSize={13} padding={4} />
        </Label>
      )}
    </Layer>
  )
}
