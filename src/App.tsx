import { Image, Layer, Stage } from 'react-konva'
import { PlanControls } from './plan/PlanControls'
import { usePlanStore } from './plan/planStore'
import { useViewportSize } from './useViewportSize'

function App() {
  const viewport = useViewportSize()
  const plan = usePlanStore((s) => s.plan)
  const view = usePlanStore((s) => s.view)

  return (
    <>
      <Stage
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
      </Stage>
      <PlanControls viewport={viewport} />
    </>
  )
}

export default App
