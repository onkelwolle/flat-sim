import type Konva from 'konva'
import { useRef, useState } from 'react'
import { Image, Layer, Stage } from 'react-konva'
import { CalibrationLayer } from './plan/CalibrationLayer'
import { FurnitureLayer } from './plan/FurnitureLayer'
import { Loupe } from './plan/Loupe'
import { MeasuringTapeLayer } from './plan/MeasuringTapeLayer'
import { PlanControls } from './plan/PlanControls'
import { planStore, usePlanStore } from './plan/planStore'
import { useFurnitureSelection } from './plan/useFurnitureSelection'
import { useMeasuringTape } from './plan/useMeasuringTape'
import { usePlacingPress } from './plan/usePlacingPress'
import { useUndoShortcuts } from './plan/useUndoShortcuts'
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
  // A touch or pen press placing a point, shown in the loupe until it lifts
  const placing = usePlacingPress(stageRef)
  const tape = useMeasuringTape(stageRef, placing)
  const selection = useFurnitureSelection()
  useUndoShortcuts(viewport)
  const [overItem, setOverItem] = useState(false)

  const pointerOnPlan = () =>
    stageRef.current?.getRelativePointerPosition() ?? null

  // A click places a calibration point at once; a finger or pen where it lifts
  const onCalibratePress = (e: PointerEvent) => {
    if (placing.begin(e)) return setPointer(pointerOnPlan())
    const at = pointerOnPlan()
    if (at) planStore.getState().placeCalibrationPoint(at)
  }

  const {
    stageProps: navigation,
    panning,
    pinching,
  } = useViewNavigation(
    stageRef,
    viewport,
    calibrating ? onCalibratePress : measuring ? tape.onCanvasPress : undefined,
    // A second finger cancels what the first was doing, placing nothing;
    // calibration points already placed stay
    () => {
      placing.cancel()
      selection.cancelPress()
      tape.cancelMeasurement()
    },
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
          // Panning moves the pointer with the plan: line ends stay put
          if (panning || pinching) return
          placing.follow(e.evt)
          setPointer(calibrating ? pointerOnPlan() : null)
          tape.onPointerMove(e.evt)
        }}
        onPointerUp={(e) => {
          if (pinching) return
          selection.onPointerUp(e)
          if (calibrating) {
            const at = placing.lift(e.evt)?.at
            if (at) planStore.getState().placeCalibrationPoint(at)
          }
          tape.onPointerUp(e.evt)
        }}
        style={{
          ...navigation.style,
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
        {plan && (
          <FurnitureLayer onHoverChange={setOverItem} interrupted={pinching} />
        )}
        {plan && <CalibrationLayer pointer={pointer} />}
        {plan && <MeasuringTapeLayer />}
      </Stage>
      {placing.press && (
        <Loupe finger={placing.press.finger} pointer={pointer} />
      )}
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
