import type Konva from 'konva'
import { useRef, useState } from 'react'
import { Image, Layer, Stage } from 'react-konva'
import { CalibrationLayer } from './plan/CalibrationLayer'
import { PlanControls } from './plan/PlanControls'
import { planStore, usePlanStore } from './plan/planStore'
import { useViewNavigation } from './plan/useViewNavigation'
import type { Point } from './plan/zoomView'
import { useViewportSize } from './useViewportSize'

function App() {
  const viewport = useViewportSize()
  const plan = usePlanStore((s) => s.plan)
  const view = usePlanStore((s) => s.view)
  const calibrating = usePlanStore((s) => s.calibrationDraft !== null)
  const stageRef = useRef<Konva.Stage>(null)
  // Pointer in plan pixels, tracked only while a tool needs it
  const [pointer, setPointer] = useState<Point | null>(null)

  const pointerOnPlan = () =>
    stageRef.current?.getRelativePointerPosition() ?? null

  const navigation = useViewNavigation(
    stageRef,
    viewport,
    calibrating
      ? () => {
          const at = pointerOnPlan()
          if (at) planStore.getState().placeCalibrationPoint(at)
        }
      : undefined,
  )

  return (
    <>
      <Stage
        ref={stageRef}
        {...navigation}
        onPointerMove={() => setPointer(calibrating ? pointerOnPlan() : null)}
        style={{
          cursor:
            navigation.style.cursor ?? (calibrating ? 'crosshair' : undefined),
        }}
        width={viewport.width}
        height={viewport.height}
        x={view.x}
        y={view.y}
        scaleX={view.scale}
        scaleY={view.scale}
        data-testid="plan-stage"
      >
        {/* Bottom layer: the plan image, in its own pixel coordinates */}
        <Layer listening={false}>{plan && <Image image={plan.image} />}</Layer>
        {plan && <CalibrationLayer pointer={pointer} />}
      </Stage>
      <PlanControls viewport={viewport} />
    </>
  )
}

export default App
