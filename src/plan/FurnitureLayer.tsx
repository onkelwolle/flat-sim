import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { useEffect, useRef, useState, type RefObject } from 'react'
import { Group, Layer, Rect, Text, Transformer } from 'react-konva'
import { useShallow } from 'zustand/react/shallow'
import { useCoarsePointer } from '../useMediaQuery'
import {
  labelFlipped,
  readableRotation,
  ROTATION_STEP,
  snapRotation,
} from './geometry'
import { MeasuredLine } from './MeasuredLine'
import {
  planStore,
  selectFurnitureSizePx,
  usePlanStore,
  type Furniture,
} from './planStore'
import { formatLength } from './scale'

const FILL = 'rgba(236, 201, 75, 0.6)'
const STROKE = '#975a16'
const SELECTED = '#2b6cb0'

/** How far outside its edge a dimension line runs, in screen pixels. */
const DIMENSION_OFFSET = 16

/**
 * The rotate handle for fingers: bigger, further from the item so the finger
 * turning it hides less of it, and taking a touch anywhere in a 44 px square
 * (its size plus a hit stroke half as wide again on each side).
 */
const TOUCH_HANDLE = {
  anchorSize: 20,
  rotateAnchorOffset: 60,
  anchorStyleFunc: (anchor: Konva.Rect) => {
    if (anchor.hasName('rotater')) anchor.hitStrokeWidth(44 - 20)
  },
}

/** Every multiple of the rotation step in a full turn. */
const ROTATION_SNAPS = Array.from(
  { length: 360 / ROTATION_STEP },
  (_, i) => i * ROTATION_STEP,
)

type FurnitureLayerProps = {
  /** Called when the pointer starts or stops hovering over an item. */
  onHoverChange: (hovering: boolean) => void
  /**
   * Whether a two-finger gesture is under way: it cancels any drag or turn,
   * which snaps back and records no step, and starts none until it ends.
   */
  interrupted: boolean
}

/**
 * Furniture on the plan: each item a rectangle drawn to scale around its
 * centre, with its name. Pressing an item selects it; dragging moves it. The
 * selected item has a handle to rotate it, snapping to 15° steps unless Shift
 * is held. Items only take the pointer while no tool is active.
 */
export function FurnitureLayer({
  onHoverChange,
  interrupted,
}: FurnitureLayerProps) {
  const furniture = usePlanStore((s) => s.furniture)
  const selectedId = usePlanStore((s) => s.selectedId)
  const zoom = usePlanStore((s) => s.view.scale)
  const toolActive = usePlanStore(
    (s) => s.calibrationDraft !== null || s.tape !== null,
  )
  const transformerRef = useRef<Konva.Transformer>(null)
  const shiftHeld = useShiftHeld()
  const coarsePointer = useCoarsePointer()
  const interruptedRef = useRef(interrupted)

  useEffect(() => {
    interruptedRef.current = interrupted
    if (!interrupted) return
    const transformer = transformerRef.current
    transformer?.stopTransform()
    // Ending a drag or turn now snaps it back (see the end handlers)
    transformer
      ?.getLayer()
      ?.getChildren((node) => node.isDragging())
      .forEach((node) => node.stopDrag())
  }, [interrupted])

  // Attach the rotate handle to the selected item, and refit it whenever an
  // item's size or the zoom changes
  useEffect(() => {
    const transformer = transformerRef.current
    if (!transformer) return
    const node = selectedId
      ? transformer.getLayer()?.findOne(`#${selectedId}`)
      : undefined
    transformer.nodes(node ? [node] : [])
    transformer.forceUpdate()
  }, [selectedId, furniture, zoom])

  // The pointer may leave an item without a leave event if it goes away
  useEffect(() => () => onHoverChange(false), [onHoverChange])

  return (
    <Layer listening={!toolActive}>
      {furniture.map((item) => (
        <FurnitureItem
          key={item.id}
          item={item}
          zoom={zoom}
          onHoverChange={onHoverChange}
          interruptedRef={interruptedRef}
        />
      ))}
      <SelectedDimensions zoom={zoom} />
      <Transformer
        ref={transformerRef}
        resizeEnabled={false}
        ignoreStroke
        borderStroke={SELECTED}
        anchorStroke={SELECTED}
        {...(coarsePointer && TOUCH_HANDLE)}
        // Konva snaps while dragging; every angle is within half a step of one
        rotationSnaps={shiftHeld ? [] : ROTATION_SNAPS}
        rotationSnapTolerance={ROTATION_STEP / 2}
        onTransformStart={() => {
          if (interruptedRef.current) transformerRef.current?.stopTransform()
        }}
        onTransformEnd={(e) => {
          const node = e.target
          // Rotation only: undo any float noise in scale the transform left
          node.scale({ x: 1, y: 1 })
          if (interruptedRef.current) {
            // Snap back to the stored angle
            const item = furniture.find((f) => f.id === node.id())
            if (item) node.rotation(item.rotationDeg)
            return
          }
          const deg = snapRotation(
            node.rotation(),
            shiftHeld ? null : ROTATION_STEP,
          )
          // Set here too: React skips the prop if the stored angle is unchanged
          node.rotation(deg)
          planStore.getState().rotateFurniture(node.id(), deg)
        }}
      />
    </Layer>
  )
}

function FurnitureItem({
  item,
  zoom,
  onHoverChange,
  interruptedRef,
}: {
  item: Furniture
  zoom: number
  onHoverChange: (hovering: boolean) => void
  interruptedRef: RefObject<boolean>
}) {
  const size = usePlanStore(useShallow((s) => selectFurnitureSizePx(s, item)))
  const selected = usePlanStore((s) => s.selectedId === item.id)
  if (!size) return null
  const { width, height } = size

  const onDragEnd = (e: KonvaEventObject<DragEvent>) => {
    if (interruptedRef.current) {
      e.target.position(item.position)
      return
    }
    const { x, y } = e.target.position()
    planStore.getState().moveFurniture(item.id, { x, y })
  }

  return (
    <Group
      id={item.id}
      x={item.position.x}
      y={item.position.y}
      rotation={item.rotationDeg}
      draggable
      onPointerDown={(e) => {
        // A second finger is a pinch, never a press on the item under it
        if (e.evt.button === 0 && e.evt.isPrimary)
          planStore.getState().selectFurniture(item.id)
      }}
      onDragStart={(e) => {
        if (interruptedRef.current) e.target.stopDrag()
      }}
      onDragEnd={onDragEnd}
      onPointerEnter={() => onHoverChange(true)}
      onPointerLeave={() => onHoverChange(false)}
    >
      <Rect
        x={-width / 2}
        y={-height / 2}
        width={width}
        height={height}
        fill={FILL}
        stroke={selected ? SELECTED : STROKE}
        strokeWidth={(selected ? 3 : 1.5) / zoom}
      />
      {/* Turned half a turn when the item is, so it never reads upside down */}
      <Group rotation={labelFlipped(item.rotationDeg) ? 180 : 0}>
        {/* The name keeps a constant size on screen, clipped to the item */}
        <Text
          x={-width / 2}
          y={-height / 2}
          width={width * zoom}
          height={height * zoom}
          scaleX={1 / zoom}
          scaleY={1 / zoom}
          text={item.name}
          fontSize={13}
          fill="#222"
          align="center"
          verticalAlign="middle"
          wrap="none"
          ellipsis
          padding={4}
          listening={false}
        />
      </Group>
    </Group>
  )
}

/** Where an item is drawn: its centre and clockwise rotation. */
type Pose = { x: number; y: number; rotation: number }

/**
 * The selected item's width and depth, each on a line along its edge: the
 * width below it, the depth to its right, clear of the rotate handle above,
 * each label reading from the bottom or the right however the item is turned.
 * Drawn beside the item rather than in it, so the rotate handle fits the item
 * alone, and following it as it is dragged or turned; strokes and labels keep
 * a constant size on screen at `zoom`.
 */
function SelectedDimensions({ zoom }: { zoom: number }) {
  const item = usePlanStore((s) =>
    s.furniture.find((f) => f.id === s.selectedId),
  )
  const size = usePlanStore(
    useShallow((s) => (item ? selectFurnitureSizePx(s, item) : null)),
  )
  const groupRef = useRef<Konva.Group>(null)
  // Where the item is while a drag or turn moves it; the stored pose else
  const [moving, setMoving] = useState<Pose | null>(null)
  const id = item?.id

  useEffect(() => {
    const node = id
      ? groupRef.current?.getLayer()?.findOne(`#${id}`)
      : undefined
    if (!node) return
    const follow = () =>
      setMoving({ x: node.x(), y: node.y(), rotation: node.rotation() })
    const stop = () => setMoving(null)
    node.on('dragmove.dimensions transform.dimensions', follow)
    node.on('dragend.dimensions transformend.dimensions', stop)
    return () => {
      node.off('.dimensions')
      setMoving(null)
    }
  }, [id])

  if (!item || !size) return <Group ref={groupRef} />
  const pose = moving ?? { ...item.position, rotation: item.rotationDeg }
  const { width, height } = size
  const offset = DIMENSION_OFFSET / zoom
  const bottom = height / 2 + offset
  const right = width / 2 + offset
  // Each label along its line, turned to read from the bottom or the right
  const labelRotation = (lineDeg: number) =>
    readableRotation(pose.rotation + lineDeg) - pose.rotation

  return (
    <Group
      ref={groupRef}
      x={pose.x}
      y={pose.y}
      rotation={pose.rotation}
      listening={false}
    >
      <MeasuredLine
        start={{ x: -width / 2, y: bottom }}
        end={{ x: width / 2, y: bottom }}
        label={formatLength(item.widthCm)}
        colour={SELECTED}
        zoom={zoom}
        handles="none"
        labelRotation={labelRotation(0)}
      />
      <MeasuredLine
        start={{ x: right, y: -height / 2 }}
        end={{ x: right, y: height / 2 }}
        label={formatLength(item.depthCm)}
        colour={SELECTED}
        zoom={zoom}
        handles="none"
        labelRotation={labelRotation(90)}
      />
    </Group>
  )
}

/** Whether Shift is held, which turns off snapping while rotating. */
function useShiftHeld() {
  const [held, setHeld] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => setHeld(e.shiftKey)
    const release = () => setHeld(false)
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)
    window.addEventListener('blur', release)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKey)
      window.removeEventListener('blur', release)
    }
  }, [])
  return held
}
