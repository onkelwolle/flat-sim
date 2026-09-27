import { Group, Layer, Rect, Text } from 'react-konva'
import { useShallow } from 'zustand/react/shallow'
import {
  planStore,
  selectFurnitureSizePx,
  usePlanStore,
  type Furniture,
} from './planStore'

const FILL = 'rgba(236, 201, 75, 0.6)'
const STROKE = '#975a16'
const SELECTED = '#2b6cb0'

/**
 * Furniture on the plan: each item a rectangle drawn to scale around its
 * centre, with its name. Pressing an item selects it. Items only take the
 * pointer while no tool is active.
 */
export function FurnitureLayer() {
  const furniture = usePlanStore((s) => s.furniture)
  const toolActive = usePlanStore(
    (s) => s.calibrationDraft !== null || s.tape !== null,
  )

  return (
    <Layer listening={!toolActive}>
      {furniture.map((item) => (
        <FurnitureItem key={item.id} item={item} />
      ))}
    </Layer>
  )
}

function FurnitureItem({ item }: { item: Furniture }) {
  const size = usePlanStore(useShallow((s) => selectFurnitureSizePx(s, item)))
  const selected = usePlanStore((s) => s.selectedId === item.id)
  const zoom = usePlanStore((s) => s.view.scale)
  if (!size) return null
  const { width, height } = size

  return (
    <Group
      x={item.position.x}
      y={item.position.y}
      rotation={item.rotationDeg}
      onPointerDown={(e) => {
        if (e.evt.button === 0) planStore.getState().selectFurniture(item.id)
      }}
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
  )
}
