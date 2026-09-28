import { Image, Layer, Stage } from 'react-konva'
import { CalibrationLayer } from './CalibrationLayer'
import { LOUPE_SIZE, loupeCentre, loupeView } from './loupeGeometry'
import { MeasuringTapeLayer } from './MeasuringTapeLayer'
import { usePlanStore } from './planStore'
import { screenToPlan, type Point } from './zoomView'

const CROSSHAIR = '#1a202c'

/**
 * The plan under a finger, magnified, with a crosshair on the point it is
 * placing: shown beside the finger, which covers that point. `finger` is in
 * client pixels on the full-window stage; `placing` is the point, in plan
 * pixels, if it is not the one under the finger (a snapped measurement end);
 * `pointer` is the calibrate tool's rubber-band end, as for
 * `CalibrationLayer`.
 */
export function Loupe({
  finger,
  placing,
  pointer,
}: {
  finger: Point
  placing?: Point
  pointer: Point | null
}) {
  const plan = usePlanStore((s) => s.plan)
  const view = usePlanStore((s) => s.view)
  if (!plan) return null
  const centre = loupeCentre(finger)
  const magnified = loupeView(placing ?? screenToPlan(view, finger), view.scale)
  const half = LOUPE_SIZE / 2

  return (
    <div
      className="loupe"
      data-testid="loupe"
      style={{
        left: centre.x - half,
        top: centre.y - half,
        width: LOUPE_SIZE,
        height: LOUPE_SIZE,
      }}
    >
      <Stage
        width={LOUPE_SIZE}
        height={LOUPE_SIZE}
        x={magnified.x}
        y={magnified.y}
        scaleX={magnified.scale}
        scaleY={magnified.scale}
        listening={false}
      >
        <Layer listening={false}>
          <Image image={plan.image} />
        </Layer>
        <CalibrationLayer pointer={pointer} zoom={magnified.scale} />
        <MeasuringTapeLayer zoom={magnified.scale} />
      </Stage>
      <svg
        className="loupe-crosshair"
        width={LOUPE_SIZE}
        height={LOUPE_SIZE}
        aria-hidden="true"
      >
        <path
          d={`M${half} ${half - 12}V${half - 3}M${half} ${half + 3}V${half + 12}M${half - 12} ${half}H${half - 3}M${half + 3} ${half}H${half + 12}`}
          stroke={CROSSHAIR}
          strokeWidth={1.5}
        />
      </svg>
    </div>
  )
}
