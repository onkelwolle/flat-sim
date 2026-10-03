import Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { useMemo } from 'react'
import { Circle, Group, Label, Line, Tag, Text } from 'react-konva'
import type { Point } from './zoomView'

const FONT_SIZE = 13
const PADDING = 4

/** Which ends of a `MeasuredLine` show a round handle. */
export type LineHandles = 'both' | 'start' | 'none'

/** One end of a line. */
export type LineEnd = 'start' | 'end'

/**
 * Dragging a line's end handles. `hitRadius` is how far from an end, in
 * screen pixels, a press grabs it. While an end is dragged, `onMove` gets
 * where it is, in plan pixels; when it is dropped, `onDrop` gets where, or
 * null if the drag was cancelled. Either way the handle first goes back to
 * the end as given: the new place counts once `start` or `end` changes.
 */
export type HandleDrag = {
  hitRadius: number
  onMove: (which: LineEnd, at: Point) => void
  onDrop: (which: LineEnd, at: Point | null) => void
  /** Whether a drag must stop at once, dropping nothing. */
  cancelled: () => boolean
  /** Called when the pointer starts or stops hovering over a handle. */
  onHoverChange?: (hovering: boolean) => void
}

/**
 * A straight line on the plan with its length label centred on its midpoint:
 * the calibration line, a measurement. Points are in plan pixels; strokes,
 * handles and label keep a constant size on screen at `zoom`, the scale the
 * plan is drawn at. Without `end`, only the start's handle is drawn (the
 * first point placed); without `label`, just the line. The label is turned
 * `labelRotation` degrees clockwise about its centre. With `drag`, both end
 * handles can be dragged.
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
  drag,
}: {
  start: Point
  end?: Point | null
  label?: string | null
  colour: string
  zoom: number
  dashed?: boolean
  handles?: LineHandles
  labelRotation?: number
  drag?: HandleDrag
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
          listening={false}
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
          listening={!!drag}
          {...(drag &&
            handleDragProps(drag, i === 0 ? 'start' : 'end', p, zoom))}
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

/** Props making an end handle at `at` draggable. */
function handleDragProps(
  drag: HandleDrag,
  which: LineEnd,
  at: Point,
  zoom: number,
) {
  const position = (e: KonvaEventObject<DragEvent>) => e.target.position()
  return {
    draggable: true,
    // A press anywhere within the hit radius grabs the handle
    hitFunc: (context: Konva.Context, shape: Konva.Shape) => {
      context.beginPath()
      context.arc(0, 0, drag.hitRadius / zoom, 0, Math.PI * 2)
      context.closePath()
      context.fillShape(shape)
    },
    onDragStart: (e: KonvaEventObject<DragEvent>) => {
      if (drag.cancelled()) e.target.stopDrag()
    },
    onDragMove: (e: KonvaEventObject<DragEvent>) =>
      drag.onMove(which, position(e)),
    onDragEnd: (e: KonvaEventObject<DragEvent>) => {
      const dropped = drag.cancelled() ? null : position(e)
      // Back to the end as given; React moves it if the end moves
      e.target.position(at)
      drag.onDrop(which, dropped)
    },
    onPointerEnter: () => drag.onHoverChange?.(true),
    onPointerLeave: () => drag.onHoverChange?.(false),
  }
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
      listening={false}
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
