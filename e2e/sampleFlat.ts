// A small sample flat, drawn to scale: the source of fixtures/sample-flat.png.
// Regenerate the PNG with `node e2e/fixtures/render-sample-flat.ts`.
//
// The image is 1280×720, the viewport the e2e specs use, so it fits at 1× and
// screen coordinates equal plan pixels. Walls are drawn centred on their
// lines; all lengths below are between wall centre lines.

/** Plan pixels per real metre. */
export const PX_PER_METRE = 100

export const WIDTH = 1280
export const HEIGHT = 720

/** The flat's outer size in metres. */
export const FLAT = { width: 10, depth: 5.8 }

/** Where the flat's top-left corner sits, in plan pixels. */
const ORIGIN = { x: 140, y: 70 }

/** A point in metres from the flat's top-left corner, in plan pixels. */
export const toPx = (x: number, y: number): [number, number] => [
  ORIGIN.x + x * PX_PER_METRE,
  ORIGIN.y + y * PX_PER_METRE,
]

type Rect = { x: number; y: number; width: number; depth: number }

type Room = Rect & {
  name: string
  /** Where the name goes, in metres, if not the room's centre. */
  label?: [number, number]
}

export const ROOMS = {
  living: {
    name: 'Living room',
    x: 0,
    y: 0,
    width: 5.5,
    depth: 3.4,
    label: [4.3, 1.3],
  },
  kitchen: { name: 'Kitchen', x: 5.5, y: 0, width: 4.5, depth: 3.4 },
  bedroom: {
    name: 'Bedroom',
    x: 0,
    y: 3.4,
    width: 4,
    depth: 2.4,
    label: [2.65, 4.4],
  },
  hall: { name: 'Hall', x: 4, y: 3.4, width: 2.5, depth: 2.4 },
  bathroom: { name: 'Bathroom', x: 6.5, y: 3.4, width: 3.5, depth: 2.4 },
} satisfies Record<string, Room>

/** A gap in a wall: along x (horizontal wall at `at`) or y (vertical). */
type Opening = { along: 'x' | 'y'; at: number; from: number; to: number }

type Door = Opening & {
  /** Which side of the wall the door swings into: +1 (right/down) or -1. */
  side: 1 | -1
}

const DOORS: Door[] = [
  { along: 'x', at: 3.4, from: 4.2, to: 5.0, side: -1 }, // hall → living
  { along: 'x', at: 3.4, from: 5.7, to: 6.4, side: -1 }, // hall → kitchen
  { along: 'y', at: 4, from: 3.9, to: 4.7, side: -1 }, // hall → bedroom
  { along: 'y', at: 6.5, from: 3.9, to: 4.7, side: 1 }, // hall → bathroom
  { along: 'x', at: 5.8, from: 4.8, to: 5.8, side: -1 }, // entrance
]

/** An open passage between living room and kitchen. */
const PASSAGES: Opening[] = [{ along: 'y', at: 5.5, from: 0.8, to: 2.4 }]

const WINDOWS: Opening[] = [
  { along: 'x', at: 0, from: 1, to: 4 },
  { along: 'y', at: 0, from: 0.8, to: 2.6 },
  { along: 'x', at: 0, from: 6.5, to: 9 },
  { along: 'y', at: 10, from: 1, to: 2.4 },
  { along: 'y', at: 0, from: 4, to: 5.2 },
  { along: 'x', at: 5.8, from: 1, to: 3 },
  { along: 'x', at: 5.8, from: 7.8, to: 9 },
]

const OUTER_WALL = 20
const INNER_WALL = 10

type Segment = { along: 'x' | 'y'; at: number; from: number; to: number }

const OUTER: Segment[] = [
  { along: 'x', at: 0, from: 0, to: FLAT.width },
  { along: 'x', at: FLAT.depth, from: 0, to: FLAT.width },
  { along: 'y', at: 0, from: 0, to: FLAT.depth },
  { along: 'y', at: FLAT.width, from: 0, to: FLAT.depth },
]

const INNER: Segment[] = [
  { along: 'x', at: 3.4, from: 0, to: FLAT.width },
  { along: 'y', at: 5.5, from: 0, to: 3.4 },
  { along: 'y', at: 4, from: 3.4, to: FLAT.depth },
  { along: 'y', at: 6.5, from: 3.4, to: FLAT.depth },
]

const ends = (s: Segment | Opening, from: number, to: number) =>
  s.along === 'x'
    ? [...toPx(from, s.at), ...toPx(to, s.at)]
    : [...toPx(s.at, from), ...toPx(s.at, to)]

const line = ([x1, y1, x2, y2]: number[], attrs: string): string =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${attrs}/>`

/** A wall with the openings that lie on it cut out. */
const wall = (s: Segment, thickness: number, gaps: Opening[]) => {
  const cuts = gaps
    .filter((g) => g.along === s.along && g.at === s.at)
    .filter((g) => g.from >= s.from && g.to <= s.to)
    .sort((a, b) => a.from - b.from)
  const pieces: [number, number][] = []
  let start = s.from
  for (const cut of cuts) {
    pieces.push([start, cut.from])
    start = cut.to
  }
  pieces.push([start, s.to])
  // Outer corners get square ends so the walls meet cleanly
  const cap = thickness === OUTER_WALL ? 'square' : 'butt'
  return pieces
    .filter(([a, b]) => b > a)
    .map(([a, b]) =>
      line(
        ends(s, a, b),
        `stroke="#222" stroke-width="${thickness}" stroke-linecap="${cap}"`,
      ),
    )
    .join('')
}

const windowGlass = (w: Opening) => {
  const [x1, y1, x2, y2] = ends(w, w.from, w.to)
  const offset = OUTER_WALL / 4
  const [dx, dy] = w.along === 'x' ? [0, offset] : [offset, 0]
  return [
    line([x1, y1, x2, y2], `stroke="#fff" stroke-width="${OUTER_WALL}"`),
    line(
      [x1 - dx, y1 - dy, x2 - dx, y2 - dy],
      'stroke="#222" stroke-width="2"',
    ),
    line(
      [x1 + dx, y1 + dy, x2 + dx, y2 + dy],
      'stroke="#222" stroke-width="2"',
    ),
    line(
      w.along === 'x'
        ? [x1, y1 - OUTER_WALL / 2, x1, y1 + OUTER_WALL / 2]
        : [x1 - OUTER_WALL / 2, y1, x1 + OUTER_WALL / 2, y1],
      'stroke="#222" stroke-width="2"',
    ),
    line(
      w.along === 'x'
        ? [x2, y2 - OUTER_WALL / 2, x2, y2 + OUTER_WALL / 2]
        : [x2 - OUTER_WALL / 2, y2, x2 + OUTER_WALL / 2, y2],
      'stroke="#222" stroke-width="2"',
    ),
  ].join('')
}

/** A door leaf hinged at the opening's start, open 90°, and its swing. */
const doorSwing = (d: Door) => {
  const [hx, hy] = d.along === 'x' ? toPx(d.from, d.at) : toPx(d.at, d.from)
  const [ex, ey] = d.along === 'x' ? toPx(d.to, d.at) : toPx(d.at, d.to)
  const r = (d.to - d.from) * PX_PER_METRE
  const [lx, ly] =
    d.along === 'x' ? [hx, hy + d.side * r] : [hx + d.side * r, hy]
  const sweep = (d.along === 'x') === (d.side === 1) ? 1 : 0
  return (
    line([hx, hy, lx, ly], 'stroke="#222" stroke-width="3"') +
    `<path d="M ${lx} ${ly} A ${r} ${r} 0 0 ${sweep} ${ex} ${ey}" fill="none" stroke="#888" stroke-width="1.5" stroke-dasharray="6 4"/>`
  )
}

const roomLabel = (room: Room) => {
  const [cx, cy] = toPx(
    ...(room.label ?? [room.x + room.width / 2, room.y + room.depth / 2]),
  )
  const area = (room.width * room.depth).toFixed(1)
  return (
    `<text x="${cx}" y="${cy - 4}" font-size="20" font-weight="600" text-anchor="middle" fill="#333">${room.name}</text>` +
    `<text x="${cx}" y="${cy + 20}" font-size="15" text-anchor="middle" fill="#666">${area} m²</text>`
  )
}

/** A dimension line with end ticks, labelled with its length in metres. */
const dimension = (
  [x1, y1]: [number, number],
  [x2, y2]: [number, number],
  labelAt: [number, number],
) => {
  const metres = (Math.hypot(x2 - x1, y2 - y1) / PX_PER_METRE).toFixed(2)
  const tick = (x: number, y: number) =>
    line(
      x1 === x2 ? [x - 8, y, x + 8, y] : [x, y - 8, x, y + 8],
      'stroke="#2b6cb0" stroke-width="1.5"',
    )
  const [lx, ly] = labelAt
  const rotate = x1 === x2 ? ` transform="rotate(-90 ${lx} ${ly})"` : ''
  return (
    line([x1, y1, x2, y2], 'stroke="#2b6cb0" stroke-width="1.5"') +
    tick(x1, y1) +
    tick(x2, y2) +
    `<text x="${lx}" y="${ly}" font-size="15" text-anchor="middle" fill="#2b6cb0" paint-order="stroke" stroke="#fff" stroke-width="6"${rotate}>${metres} m</text>`
  )
}

/** Where the dimension lines run, in plan pixels (outside the walls). */
export const DIMENSIONS = {
  /** The flat's full width, below the bottom wall. */
  width: { from: toPx(0, 6.15), to: toPx(FLAT.width, 6.15) },
  /** The flat's full depth, left of the left wall. */
  depth: { from: toPx(-0.35, 0), to: toPx(-0.35, FLAT.depth) },
}

export const svg = () => {
  const gaps = [...DOORS, ...PASSAGES, ...WINDOWS]
  const [wx, wy] = DIMENSIONS.width.from
  const [dx, dy1] = DIMENSIONS.depth.from
  const [, dy2] = DIMENSIONS.depth.to
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" font-family="Helvetica, Arial, sans-serif">`,
    `<rect width="${WIDTH}" height="${HEIGHT}" fill="#fff"/>`,
    ...INNER.map((s) => wall(s, INNER_WALL, gaps)),
    ...OUTER.map((s) => wall(s, OUTER_WALL, gaps)),
    ...WINDOWS.map(windowGlass),
    ...DOORS.map(doorSwing),
    ...Object.values(ROOMS).map(roomLabel),
    // Labelled off-centre, clear of the app's status bar
    dimension(DIMENSIONS.width.from, DIMENSIONS.width.to, [wx + 150, wy + 5]),
    dimension(DIMENSIONS.depth.from, DIMENSIONS.depth.to, [
      dx - 8,
      (dy1 + dy2) / 2,
    ]),
    `</svg>`,
  ].join('\n')
}
