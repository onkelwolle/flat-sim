import type Konva from 'konva'
import { useRef, useState } from 'react'
import { Image, Layer, Stage } from 'react-konva'
import { CalibrationLayer } from './plan/CalibrationLayer'
import { FurnitureLayer } from './plan/FurnitureLayer'
import { MeasuringTapeLayer } from './plan/MeasuringTapeLayer'
import { PlanControls } from './plan/PlanControls'
import { planStore, usePlanStore } from './plan/planStore'
import { useFurnitureSelection } from './plan/useFurnitureSelection'
import { useMeasuringTape } from './plan/useMeasuringTape'
import { useViewNavigation } from './plan/useViewNavigation'
import { ProjectNoticeBanner } from './project/ProjectNoticeBanner'
import { useProjectPersistence } from './project/useProjectPersistence'
import type { Point } from './plan/zoomView'
import { useViewportSize } from './useViewportSize'

function App() {
  const viewport = useViewportSize()
  const project = useProjectPersistence(viewport)
  const plan = usePlanStore((s) => s.plan)
  const view = usePlanStore((s) => s.view)
  const calibrating = usePlanStore((s) => s.calibrationDraft !== null)
  const measuring = usePlanStore((s) => s.tape !== null)
  const stageRef = useRef<Konva.Stage>(null)
  // Pointer in plan pixels, tracked only while the calibrate tool needs it
  const [pointer, setPointer] = useState<Point | null>(null)
  const tape = useMeasuringTape(stageRef)
  const selection = useFurnitureSelection()
  const [overItem, setOverItem] = useState(false)

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
      : measuring
        ? tape.onCanvasPress
        : undefined,
  )

  return (
    <>
      <Stage
        ref={stageRef}
        {...navigation}
        onPointerDown={(e) => {
          selection.onPointerDown(e)
          navigation.onPointerDown(e)
        }}
        onPointerMove={(e) => {
          setPointer(calibrating ? pointerOnPlan() : null)
          tape.onPointerMove(e.evt)
        }}
        onPointerUp={(e) => {
          selection.onPointerUp(e)
          tape.onPointerUp(e.evt)
        }}
        style={{
          cursor:
            navigation.style.cursor ??
            (calibrating || measuring
              ? 'crosshair'
              : overItem
                ? 'move'
                : undefined),
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
        {/* Furniture sits on the plan, under the tools' lines */}
        {plan && <FurnitureLayer onHoverChange={setOverItem} />}
        {plan && <CalibrationLayer pointer={pointer} />}
        {plan && <MeasuringTapeLayer />}
      </Stage>
      {/* Controls wait for the saved project, so the empty state never flashes */}
      {!project.restoring && (
        <PlanControls viewport={viewport} onNewProject={project.newProject} />
      )}
      <ProjectNoticeBanner
        notice={project.notice}
        onDismiss={project.dismissNotice}
      />
    </>
  )
}

export default App
