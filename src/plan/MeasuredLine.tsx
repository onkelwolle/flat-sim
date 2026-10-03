import Konva from 'konva'
import { useMemo } from 'react'
import { Circle, Group, Label, Line, Tag, Text } from 'react-konva'
import type { Point } from './zoomView'

const FONT_SIZE = 13
const PADDING = 4

/** Which ends of a `MeasuredLine` show a round handle. */
export type LineHandles = 'both' | 'start' | 'none'

/**
 * A straight line on the plan with its length label centred on its midpoint:
 * the calibration line, a measurement. Points are in plan pixels; strokes,
 * handles and label keep a constant size on screen at `zoom`, the scale the
 * plan is drawn at. Without `end`, only the start's handle is drawn (the
 * first point placed); without `label`, just the line. The label is turned
 * `labelRotation` degrees clockwise about its centre.
 */
export function MeasuredLine({
  start,
  end,
  label,
  colour,
  zoom,
  dashed = false,
  handles = 'both',
  labelRotation = 0,
}: {
  start: Point
  end?: Point | null
  label?: string | null
  colour: string
  zoom: number
  dashed?: boolean
  handles?: LineHandles
  labelRotation?: number
}) {
  const handlePoints =
    handles === 'none'
      ? []
      : handles === 'start' || !end
        ? [start]
        : [start, end]

  return (
    <Group>
      {end && (
        <Line
          points={[start.x, start.y, end.x, end.y]}
          stroke={colour}
          strokeWidth={2 / zoom}
          dash={dashed ? [6 / zoom, 4 / zoom] : undefined}
        />
      )}
      {handlePoints.map((p, i) => (
        <Circle
          key={i}
          x={p.x}
          y={p.y}
          radius={4 / zoom}
          fill="#fff"
          stroke={colour}
          strokeWidth={2 / zoom}
        />
      ))}
      {end && label && (
        <LengthLabel
          at={{ x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }}
          text={label}
          colour={colour}
          zoom={zoom}
          rotation={labelRotation}
        />
      )}
    </Group>
  )
}

/**
 * A label centred on `at`, in screen pixels whatever the `zoom`, turned
 * `rotation` degrees clockwise about its centre.
 */
function LengthLabel({
  at,
  text,
  colour,
  zoom,
  rotation,
}: {
  at: Point
  text: string
  colour: string
  zoom: number
  rotation: number
}) {
  // Konva sizes a label by its text; measure it to centre the label on `at`
  const size = useMemo(() => {
    const measure = new Konva.Text({
      text,
      fontSize: FONT_SIZE,
      padding: PADDING,
    })
    const size = measure.size()
    measure.destroy()
    return size
  }, [text])

  return (
    <Label
      x={at.x}
      y={at.y}
      rotation={rotation}
      scaleX={1 / zoom}
      scaleY={1 / zoom}
      offsetX={size.width / 2}
      offsetY={size.height / 2}
    >
      <Tag fill={colour} cornerRadius={4} />
      <Text text={text} fill="#fff" fontSize={FONT_SIZE} padding={PADDING} />
    </Label>
  )
}
