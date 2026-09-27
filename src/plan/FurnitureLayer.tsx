import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { useEffect, useRef, useState } from 'react'
import { Group, Layer, Rect, Text, Transformer } from 'react-konva'
import { useShallow } from 'zustand/react/shallow'
import { labelFlipped, ROTATION_STEP, snapRotation } from './geometry'
import {
  planStore,
  selectFurnitureSizePx,
  usePlanStore,
  type Furniture,
} from './planStore'

const FILL = 'rgba(236, 201, 75, 0.6)'
const STROKE = '#975a16'
const SELECTED = '#2b6cb0'

/** Every multiple of the rotation step in a full turn. */
const ROTATION_SNAPS = Array.from(
  { length: 360 / ROTATION_STEP },
  (_, i) => i * ROTATION_STEP,
)

type FurnitureLayerProps = {
  /** Called when the pointer starts or stops hovering over an item. */
  onHoverChange: (hovering: boolean) => void
}

/**
 * Furniture on the plan: each item a rectangle drawn to scale around its
 * centre, with its name. Pressing an item selects it; dragging moves it. The
 * selected item has a handle to rotate it, snapping to 15° steps unless Shift
 * is held. Items only take the pointer while no tool is active.
 */
export function FurnitureLayer({ onHoverChange }: FurnitureLayerProps) {
  const furniture = usePlanStore((s) => s.furniture)
  const selectedId = usePlanStore((s) => s.selectedId)
  const zoom = usePlanStore((s) => s.view.scale)
  const toolActive = usePlanStore(
    (s) => s.calibrationDraft !== null || s.tape !== null,
  )
  const transformerRef = useRef<Konva.Transformer>(null)
  const shiftHeld = useShiftHeld()

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
        />
      ))}
      <Transformer
        ref={transformerRef}
        resizeEnabled={false}
        ignoreStroke
        borderStroke={SELECTED}
        anchorStroke={SELECTED}
        // Konva snaps while dragging; every angle is within half a step of one
        rotationSnaps={shiftHeld ? [] : ROTATION_SNAPS}
        rotationSnapTolerance={ROTATION_STEP / 2}
        onTransformEnd={(e) => {
          const node = e.target
          // Rotation only: undo any float noise in scale the transform left
          node.scale({ x: 1, y: 1 })
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
}: {
  item: Furniture
  zoom: number
  onHoverChange: (hovering: boolean) => void
}) {
  const size = usePlanStore(useShallow((s) => selectFurnitureSizePx(s, item)))
  const selected = usePlanStore((s) => s.selectedId === item.id)
  if (!size) return null
  const { width, height } = size

  const onDragEnd = (e: KonvaEventObject<DragEvent>) => {
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
        if (e.evt.button === 0) planStore.getState().selectFurniture(item.id)
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
