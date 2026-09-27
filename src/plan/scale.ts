import { distance } from './geometry'
import type { Point } from './zoomView'

/**
 * How many plan-image pixels make one real-world metre. Measured in the
 * plan's own pixels, so it does not change with zoom or pan.
 */
export type Scale = { pixelsPerMetre: number }

/** Scale implied by a line on the plan that is `lengthCm` long in reality. */
export function scaleFromLine(
  start: Point,
  end: Point,
  lengthCm: number,
): Scale {
  return { pixelsPerMetre: distance(start, end) / (lengthCm / 100) }
}

/** Real length, in centimetres, of a distance in plan pixels. */
export const pxToCm = (px: number, scale: Scale) =>
  (px / scale.pixelsPerMetre) * 100

/** Distance in plan pixels of a real length in centimetres. */
export const cmToPx = (cm: number, scale: Scale) =>
  (cm / 100) * scale.pixelsPerMetre

export type LengthUnit = 'cm' | 'm'

const CM_PER_UNIT: Record<LengthUnit, number> = { cm: 1, m: 100 }

/**
 * A positive length typed by the user, in centimetres, or null if the text is
 * not one. Accepts a decimal point or comma.
 */
export function parseLength(text: string, unit: LengthUnit): number | null {
  const normalized = text.trim().replace(',', '.')
  if (!/^(\d+\.?\d*|\.\d+)$/.test(normalized)) return null
  const value = Number(normalized)
  if (!(value > 0)) return null
  // Drop float noise such as 4.2 m → 420.00000000000006 cm
  return Math.round(value * CM_PER_UNIT[unit] * 1e6) / 1e6
}

/** A real length for display: whole centimetres below a metre, else metres. */
export function formatLength(cm: number): string {
  const wholeCm = Math.round(cm)
  return wholeCm < 100 ? `${wholeCm} cm` : `${(cm / 100).toFixed(2)} m`
}
