import * as THREE from 'three'
import { MATERIALS } from './materials.js'
import { GARAGES } from './garages.js'

// The ribbon: one continuous cobalt band that winds through the garages and links three places:
//   start: the green wedge at the Parkstraße / Haydnstraße junction,
//   middle: the corner where Richard-Wagner-Straße ends at Stollberger Straße,
//   end: the green above the Haydnstraße / Stollberger Straße junction, just under the school (Haydnstraße 21).
// Along the way it folds up and down into places to rest, meet, play and do sport, but it never breaks.
// Twice it dives through three garages (in at a door, through the back wall, sideways, out at a door);
// those six garages are cleared inside. It lifts into two repair ramps and two lookouts.

export const COBALT = '#0047ab'
export const THICK = 0.1 // thickness of the band, metres
export const DEFAULT_WIDTH = 2.4 // metres
export const VERSION = 3 // plans saved with an older ribbon start again from the new one

// The line it follows in plan, in local metres (east, north). It is drawn as a smooth curve through these points.
// Checked against the map: at least 0.7 m between the ribbon's edge and every garage, and no building in the way.
export const ROUTE = [
  [70, -84], // green wedge at Parkstraße / Haydnstraße
  [72, -70],
  [70, -60],
  [62, -57], // over Parkstraße
  [52, -51],
  [48, -40], // along Haydnstraße, outside the garages
  [44, -26],
  [40, -14],
  [33, -10.5], // into the yard between R5 and R6
  [27, -9.6],
  [25.3, -6], // in at the door of R5-4, through its back wall into R4-4,
  [24.5, -1.5],
  [23.7, 2.9],
  [20.1, 5.3], // sideways into R4-3 and out of its door
  [19.5, 8.6],
  [15, 8.4], // the narrow yard between R3 and R4
  [10.5, 8.4],
  [6.5, 8.8], // in at the door of R7-9, through into R8-9,
  [3.8, 8.4],
  [-2.1, 7.4],
  [-4.7, 4.0], // sideways into R8-8 and out of its door
  [-7.6, 3.2],
  [-10.2, 0], // down the yard between R8 and R9 (repair ramp)
  [-9.6, -8],
  [-8.6, -15],
  [-11, -20.6], // the south lane (lookout)
  [-18, -21],
  [-26, -21.4],
  [-30.3, -15], // up the yard between R10 and R12 (repair ramp)
  [-31.2, -6],
  [-33, -1],
  [-38, 1.5], // the corner where Richard-Wagner-Straße meets Stollberger Straße
  [-40, 5.5],
  [-35, 9],
  [-28.5, 15], // along Stollberger Straße, past the ends of R10, R9 and R8
  [-22, 17.5],
  [-16, 22],
  [-12, 28.6],
  [-6, 31],
  [0, 31.5],
  [5, 29],
  [12, 26.8], // the yard between R1 and R2 (lookout)
  [20, 28.6],
  [29, 31],
  [34, 40],
  [36, 48], // over Haydnstraße
  [47, 57],
  [49, 68], // the green strips between Haydnstraße and Stollberger Straße
  [52, 80],
  [55, 90],
  [47, 106], // over Stollberger Straße and the tram
  [42, 120],
  [42, 132], // the green under the school
  [47, 148],
  [41, 166],
  [45, 190],
]

// Where the ribbon lies over a street, in metres along it (measured against the street data).
export const STREETS = [
  ['Parkstraße', 30, 40],
  ['Haydnstraße', 321, 331],
  ['Stollberger Straße and the tram', 372, 398],
]

const B = THICK / 2 // centre of the band when it lies on the ground
const top = (h) => h - B // centre height for a surface at h

// Each kind of piece: its name, the shortest it can be, how much wider than the ribbon it gets, and its shape.
// A shape is a list of [distance along the piece, height] points; the ribbon folds at each one.
const repeat = (L, unit, one) => {
  const n = Math.max(1, Math.floor(L / unit))
  const pad = (L - n * unit) / 2
  const out = [[0, B]]
  for (let k = 0; k < n; k++) for (const [s, h] of one) out.push([pad + k * unit + s, h])
  out.push([L, B])
  return out
}
const up = (L, e, h) => [[0, B], [e, B], [e, top(h)], [L - e, top(h)], [L - e, B], [L, B]]
function steps(n, rise, tread, s0, h0, dir) {
  const out = []
  let s = s0
  let h = h0
  for (let i = 0; i < n; i++) {
    if (dir > 0) {
      h += rise
      out.push([s, h])
      s += tread
      out.push([s, h])
    } else {
      s += tread
      out.push([s, h])
      h -= rise
      out.push([s, h])
    }
  }
  return out
}
// a smooth curve between two heights, flat at both ends
const ease = (s0, s1, h0, h1, n = 10) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const f = i / n
    return [s0 + (s1 - s0) * f, h0 + (h1 - h0) * (0.5 - 0.5 * Math.cos(f * Math.PI))]
  })

// Monkey bars: where the rungs are, as [centre, half-width] along the piece, in metres.
// A ladder up (a rung every 10 cm along the ground, so about every 27 cm up), bars at 2.2 m about every 40 cm, a ladder down.
function monkeyRungs(L) {
  const out = []
  for (let r = 0.25; r < 0.99; r += 0.1) out.push([r, 0.012])
  const n = Math.max(2, Math.round((L - 2) / 0.4))
  for (let i = 0; i <= n; i++) out.push([1 + (i * (L - 2)) / n, 0.03])
  for (let r = L - 0.25; r > L - 0.99; r -= 0.1) out.push([r, 0.012])
  return out.sort((a, b) => a[0] - b[0])
}
const monkeyHeight = (s, L) => {
  const t = top(2.2)
  if (s <= 0.2 || s >= L - 0.2) return B
  if (s < 1) return B + ((t - B) * (s - 0.2)) / 0.8
  if (s > L - 1) return B + ((t - B) * (L - 0.2 - s)) / 0.8
  return t
}
// Seesaw: a plank from a 35 cm seat up to 1 m, with a handle near each end and a pivot under the middle.
const seesawHeight = (s, L) => top(0.35 + (0.65 * (s - 0.3)) / (L - 0.6))

// Walls: the ribbon folds straight up into a wall across its whole width, over the top and back down; 20 cm thick.
// An opening is cut through both faces: [from, to] in height, and how wide. Extra points sit at its edges so they stay sharp.
function wallShape(L, H, open) {
  const a = L / 2 - 0.05
  const b = L / 2 + 0.05
  const t = top(H)
  const face = open ? [open[0] - 0.01, open[0], open[1], open[1] + 0.01] : []
  return [[0, B], [a, B], ...face.map((h) => [a, h]), [a, t], [b, t], ...[...face].reverse().map((h) => [b, h]), [b, B], [L, B]]
}
// an opening has to stay under the top of the wall; on a very low wall there is no room for it
const fit = (o0, o1, H) => {
  const hi = Math.min(o1, top(H) - 0.06)
  return hi - o0 >= 0.1 ? [o0, hi] : null
}
const windowAt = (H) => {
  const sill = Math.max(0.3, Math.min(0.9, H * 0.375))
  return fit(sill, H - Math.max(0.3, H * 0.17), H)
}
const doorAt = (H) => fit(0.15, Math.min(2.1, H - 0.3), H)
const wallSlot = (at, wide) => (s, L, h, w, H) => {
  const o = at(H)
  return o && h >= o[0] - 1e-4 && h <= o[1] + 1e-4 ? wide(w) : 0
}

// The groups the panel shows the kinds in.
export const RIBBON_GROUPS = [
  ['Move', ['path', 'crossing', 'passage', 'stairs', 'onewaystairs', 'gap']],
  ['Walls', ['wall', 'wallwindow', 'walldoor']],
  ['Lifted', ['lookout', 'repair']],
  ['Rest', ['bench', 'chairs', 'daybed', 'shade']],
  ['Meet', ['table', 'picnic', 'stage', 'seats']],
  ['Sport and play', ['pingpong', 'workout', 'balance', 'monkeybars', 'seesaw', 'skate', 'climb', 'wave']],
]

export const RIBBON_KINDS = {
  path: { name: 'PATH', min: 1, shape: (L) => [[0, B], [L, B]] },
  gap: {
    name: 'GAP',
    min: 0.5,
    gap: true,
    note: 'No ribbon here: the band is cut and its two ends stop. A piece you detach leaves a gap; reattach a module to fill it.',
    shape: (L) => [[0, B], [L, B]],
  },
  crossing: { name: 'CROSSING', min: 1, shape: (L) => [[0, B], [L, B]], note: 'Lies flat on the street.' },
  passage: {
    name: 'GARAGE PASSAGE',
    min: 1,
    wide: 0.75,
    note: 'A 1.8 m walkway. Where the ribbon runs through garages, they are cleared of their inside walls and only the outer shell and roof stay.',
    shape: (L) => [[0, B], [L, B]],
  },
  repair: {
    name: 'REPAIR RAMP',
    min: 16.5,
    wide: 1.1,
    note: 'Drive up a 15% ramp onto a deck 1.6 m high. The ribbon splits into two wheel tracks with a 1 m slot between them, so you can work on the car from underneath. A wheel stop at the end; reverse back down.',
    // ramp up, deck, a wheel stop, then the ribbon drops to the ground and goes on
    shape: (L) => [[0, B], [0.2, B], [10.9, top(1.6)], [L - 0.45, top(1.6)], [L - 0.4, top(1.85)], [L - 0.25, top(1.85)], [L - 0.25, B], [L, B]],
    // the slot between the wheel tracks: opens up the ramp, full on the deck, closed at the wheel stop
    slot: (s, L) => (s < 0.2 ? 0 : s < 10.9 ? (s - 0.2) / 10.7 : s <= L - 0.45 ? 1 : 0),
  },
  lookout: {
    name: 'LOOKOUT',
    min: 15.5,
    wide: 1.7,
    note: 'Stairs up to a wide platform 4.2 m high, above the garage roofs, to see the whole complex come together. Stairs down the other side.',
    shape: (L) => {
      const upS = steps(24, 0.175, 0.28, 0.2, B, 1)
      const down = steps(24, 0.175, 0.28, L - 0.2 - 24 * 0.28, upS.at(-1)[1], -1)
      return [[0, B], [0.2, B], ...upS, ...down, [L, B]]
    },
  },
  bench: { name: 'BENCH', min: 1.6, shape: (L) => up(L, 0.3, 0.45), note: 'Seat 45 cm.' },
  chairs: {
    name: 'CHAIRS',
    min: 2.4,
    note: 'Seat 42 cm, back 95 cm, one every 2.4 m.',
    // seat, a leaning back, then the band slides back down to the ground
    shape: (L) => repeat(L, 2.4, [[0.2, B], [0.2, top(0.42)], [0.7, top(0.42)], [0.88, top(0.95)], [1.0, top(0.95)], [2.1, B]]),
  },
  daybed: {
    name: 'DAYBED',
    min: 2.4,
    note: 'Lie down: 40 cm high, with a raised head end.',
    shape: (L) => [[0, B], [0.3, B], [0.3, top(0.4)], [L - 0.8, top(0.4)], [L - 0.4, top(0.62)], [L - 0.3, top(0.62)], [L - 0.3, B], [L, B]],
  },
  table: { name: 'TABLE', min: 1.6, shape: (L) => up(L, 0.3, 0.75), note: 'Top 75 cm.' },
  picnic: {
    name: 'BENCH + TABLE',
    min: 3.6,
    note: 'Bench, table, bench.',
    shape: (L) => {
      const t = top(0.75)
      const s = top(0.45)
      return [[0, B], [0.25, B], [0.25, s], [0.75, s], [0.75, B], [1.05, B], [1.05, t], [L - 1.05, t], [L - 1.05, B], [L - 0.75, B], [L - 0.75, s], [L - 0.25, s], [L - 0.25, B], [L, B]]
    },
  },
  stage: {
    name: 'STAGE',
    min: 3,
    note: 'A 60 cm platform with two steps at each end, to talk, play or perform.',
    shape: (L) => {
      const up2 = steps(2, 0.3, 0.35, 0.2, B, 1)
      const down2 = steps(2, 0.3, 0.35, L - 0.2 - 0.7, up2.at(-1)[1], -1)
      return [[0, B], [0.2, B], ...up2, ...down2, [L, B]]
    },
  },
  shade: {
    name: 'SHADE',
    min: 3,
    wide: 1.7,
    note: 'A wavy roof 2.6–3.0 m up, wider than the ribbon.',
    shape: (L) => {
      const a = 0.4
      const out = [[0, B], [a, B], [a, top(2.6)]]
      const n = Math.max(2, Math.round((L - 2 * a) / 0.5))
      for (let i = 1; i < n; i++) {
        const f = i / n
        out.push([a + f * (L - 2 * a), top(2.6 + 0.4 * Math.sin(f * Math.PI) ** 2)])
      }
      out.push([L - a, top(2.6)], [L - a, B], [L, B])
      return out
    },
  },
  stairs: {
    name: 'STAIRS',
    min: 3,
    note: 'Up to a lookout and down again, 17 cm steps.',
    shape: (L) => {
      const n = Math.max(1, Math.min(8, Math.floor((L - 1) / 0.6)))
      const upS = steps(n, 0.17, 0.3, 0.2, B, 1)
      const down = steps(n, 0.17, 0.3, L - 0.2 - n * 0.3, upS.at(-1)[1], -1)
      return [[0, B], [0.2, B], ...upS, ...down, [L, B]]
    },
  },
  // Kinds with a `height` draw themselves at the height you set (shape(L, H)); the others are stretched up or down to it.
  onewaystairs: {
    name: 'ONE-WAY STAIRS',
    min: 2.5,
    len: 4,
    height: 1.5,
    note: 'Stairs that only go up: steps of about 17 cm to a landing, then the ribbon drops straight down at the back. Flip it to climb the other way.',
    shape: (L, H) => {
      const n = Math.max(1, Math.round((H - 2 * B) / 0.17))
      const tread = Math.min(0.28, (L - 1) / n) // shorter treads if the piece is short, so a 60 cm landing always fits
      const upS = steps(n, (H - 2 * B) / n, tread, 0.2, B, 1)
      return [[0, B], [0.2, B], ...upS, [L - 0.2, top(H)], [L - 0.2, B], [L, B]]
    },
  },
  wall: {
    name: 'WALL',
    min: 1,
    len: 1.5,
    height: 2.4,
    note: 'The ribbon folds straight up into a 20 cm wall across its width, then back down.',
    shape: (L, H) => wallShape(L, H),
  },
  wallwindow: {
    name: 'WALL + WINDOW',
    min: 1,
    len: 1.5,
    height: 2.4,
    note: 'A wall with a window half as wide as the wall, its sill at 90 cm (on a 2.4 m wall).',
    shape: (L, H) => wallShape(L, H, windowAt(H)),
    slot: wallSlot(windowAt, (w) => w * 0.5),
  },
  walldoor: {
    name: 'WALL + DOORWAY',
    min: 1,
    len: 1.5,
    height: 2.4,
    note: 'A wall with a 1 m wide doorway, 2.1 m high, to walk through. The band stays whole at the bottom: a 15 cm threshold.',
    shape: (L, H) => wallShape(L, H, doorAt(H)),
    slot: wallSlot(doorAt, () => 1),
  },
  seats: {
    name: 'SEAT STEPS',
    min: 5,
    note: 'Three big steps to sit on, facing back along the ribbon, then a slope down.',
    shape: (L) => {
      const up3 = steps(3, 0.45, 0.8, 0.2, B, 1)
      const h = up3.at(-1)[1]
      return [[0, B], [0.2, B], ...up3, [Math.min(L - 0.4, up3.at(-1)[0] + 0.6), h], [L - 0.2, B], [L, B]]
    },
  },
  pingpong: {
    name: 'PING PONG',
    min: 3.4,
    wide: 0.64,
    note: 'A 2.74 × 1.52 m table, 76 cm high, with a net.',
    shape: (L) => {
      const e = (L - 2.74) / 2
      const m = L / 2
      const t = top(0.76)
      return [[0, B], [e, B], [e, t], [m - 0.02, t], [m - 0.02, top(0.91)], [m + 0.02, top(0.91)], [m + 0.02, t], [L - e, t], [L - e, B], [L, B]]
    },
  },
  workout: {
    name: 'WORKOUT BARS',
    min: 2.4,
    wide: 0.5,
    note: 'Dip bars at 1.2 m and pull-up bars at 2.2 m, repeating.',
    shape: (L) => repeat(L, 2.4, [[0.3, B], [0.3, top(1.2)], [0.75, top(1.2)], [0.75, B], [1.25, B], [1.25, top(2.2)], [1.7, top(2.2)], [1.7, B]]),
  },
  balance: {
    name: 'BALANCE BEAM',
    min: 3,
    wide: 0.25,
    note: 'The ribbon narrows to a beam that rises and dips between 30 and 60 cm.',
    shape: (L) => {
      const out = [[0, B], [0.3, B], [0.3, top(0.3)]]
      const n = Math.max(4, Math.round((L - 0.6) / 0.3))
      for (let i = 1; i < n; i++) {
        const f = i / n
        out.push([0.3 + f * (L - 0.6), top(0.3 + 0.3 * Math.sin(f * Math.PI * Math.max(1, Math.round(L / 4))) ** 2)])
      }
      out.push([L - 0.3, top(0.3)], [L - 0.3, B], [L, B])
      return out
    },
  },
  monkeybars: {
    name: 'MONKEY BARS',
    min: 4,
    wide: 0.5,
    note: 'Climb a ladder, swing along bars 2.2 m up, climb down the other side. The ribbon opens into two side rails with rungs between them.',
    shape: (L) => {
      const pts = [[0, B], [0.2, B], [1, top(2.2)], [L - 1, top(2.2)], [L - 0.2, B], [L, B]]
      for (const [c, hw] of monkeyRungs(L)) for (const d of [-1.5, -1, 1, 1.5]) pts.push([c + d * hw, null])
      return pts
        .sort((a, b) => a[0] - b[0])
        .filter((p, i, all) => i === 0 || p[0] - all[i - 1][0] > 1e-4)
        .map(([a, h]) => [a, h ?? monkeyHeight(a, L)])
    },
    // open between the rails, closed at each rung and at both ends
    slot: (s, L) => {
      if (s <= 0.21 || s >= L - 0.21) return 0
      for (const [c, hw] of monkeyRungs(L)) if (Math.abs(s - c) <= hw + 1e-4) return 0
      return 2
    },
  },
  seesaw: {
    name: 'SEESAW',
    min: 3.6,
    wide: 0.25,
    note: 'A plank for two, from a 35 cm seat up to 1 m, with a handle near each end. The ribbon folds down into a pivot under the middle; drawn tipped to one side.',
    shape: (L) => {
      const m = L / 2
      const h = (a) => seesawHeight(a, L)
      const handle = (a) => [[a - 0.03, h(a - 0.03)], [a - 0.03, h(a - 0.03) + 0.25], [a + 0.03, h(a + 0.03) + 0.25], [a + 0.03, h(a + 0.03)]]
      return [
        [0, B], [0.3, B], [0.3, h(0.3)],
        ...handle(0.75),
        [m - 0.1, h(m - 0.1)], [m - 0.1, B], [m + 0.1, B], [m + 0.1, h(m + 0.1)],
        ...handle(L - 0.75),
        [L - 0.3, h(L - 0.3)], [L - 0.3, B], [L, B],
      ]
    },
  },
  skate: {
    name: 'SKATE RAMP',
    min: 7,
    note: 'A small half-pipe: 1 m decks, curved walls, a flat bottom.',
    shape: (L) => {
      const r = 1.4
      const deck = 1.0
      const x0 = r - Math.sqrt(r * r - (r - deck) ** 2) // where the curve reaches deck height
      const curve = (from, dir) => {
        const pts = []
        for (let i = 0; i <= 12; i++) {
          const x = x0 + ((r - x0) * i) / 12
          const h = r - Math.sqrt(Math.max(0, r * r - (r - x) ** 2))
          pts.push([from + dir * (x - x0), Math.max(B, top(h))])
        }
        return pts
      }
      const a = curve(0.9, 1)
      const b = curve(L - 0.9, -1).reverse()
      return [[0, B], [0.3, B], [0.3, top(deck)], [0.9, top(deck)], ...a, ...b, [L - 0.9, top(deck)], [L - 0.3, top(deck)], [L - 0.3, B], [L, B]]
    },
  },
  climb: {
    name: 'CLIMB + SLIDE',
    min: 5,
    note: 'Climb a 3 m wall, cross the top, slide back down.',
    shape: (L) => [[0, B], [0.3, B], [0.3, top(3)], [1.1, top(3)], ...ease(1.1, L - 0.2, top(3), B, 14).slice(1), [L, B]],
  },
  wave: {
    name: 'PLAY WAVE',
    min: 3,
    note: 'Humps to climb and slide, up to 70 cm.',
    shape: (L) => {
      const out = []
      const n = Math.max(8, Math.round(L / 0.25))
      const humps = Math.max(1, Math.round(L / 3))
      for (let i = 0; i <= n; i++) {
        const f = i / n
        out.push([f * L, B + 0.7 * Math.sin(f * Math.PI * humps) ** 2])
      }
      return out
    },
  },
}
export const RIBBON_KIND_IDS = Object.keys(RIBBON_KINDS)

// A single blue module: one piece of ribbon on its own, straight. Its usual length, and its highest point.
export function moduleLen(kind) {
  const p = DEFAULT_PIECES.find((q) => q.kind === kind)
  return Math.max(RIBBON_KINDS[kind].min, p ? Math.min(p.len, 17) : (RIBBON_KINDS[kind].len ?? 4))
}

// Sizes you set yourself: a piece or module can carry its own width `w` and top height `h` (metres).
// Without them it keeps its usual size, so pieces you don't change look exactly as before.
// The shape at height H: kinds with their own height use it; the others are stretched up or down so their top is at H.
export function pieceShape(kind, L, H) {
  const K = RIBBON_KINDS[kind]
  if (K.height) return K.shape(L, H ?? K.height)
  const pts = K.shape(L)
  if (H == null) return pts
  let hi = B
  for (const [, h] of pts) hi = Math.max(hi, h)
  if (hi - B < 0.02) return pts // flat pieces have no height to change
  const f = Math.max(0, H - 2 * B) / (hi - B)
  return pts.map(([s, h]) => [s, B + (h - B) * f])
}
// can you change this kind's height? (not for flat ones like PATH)
export const hasHeight = (kind) => !!RIBBON_KINDS[kind].height || pieceTop(kind, Math.max(RIBBON_KINDS[kind].min, 4)) > 0.15
export const pieceWidth = (kind, bandWidth, w) => w ?? Math.round(bandWidth * (RIBBON_KINDS[kind].wide ?? 1) * 100) / 100
export function pieceTop(kind, len, H) {
  let top = 0
  for (const [, h] of pieceShape(kind, len, H)) top = Math.max(top, h + B)
  return Math.round(top * 100) / 100
}
// the straight module as a mesh, running along its own length (front at +z)
export function buildModule({ rk, len, flip, bw, w, h }) {
  return buildRibbon({ width: bw, pieces: [{ kind: rk, len, flip, w, h }] }, [[0, -len / 2], [0, len / 2]]).geo
}

// The ribbon as it starts, about 474 m. The three CROSSING pieces lie over the streets.
const P = (kind, len) => ({ kind, len })
export const DEFAULT_PIECES = [
  // the green wedge at Parkstraße / Haydnstraße: a place to rest
  P('path', 2), P('daybed', 3), P('bench', 4), P('path', 3), P('shade', 8), P('chairs', 4.8), P('path', 5.2),
  P('crossing', 10.4), // Parkstraße
  // along Haydnstraße: sport
  P('path', 3), P('balance', 8), P('path', 2.3), P('workout', 7.2), P('path', 2), P('climb', 6), P('path', 2), P('bench', 4), P('path', 8.1),
  // the yard between R5 and R6
  P('pingpong', 4), P('path', 1.5), P('picnic', 5), P('path', 2), P('bench', 4),
  // through R5-4, R4-4, R4-3, the narrow yard, and R7-9, R8-9, R8-8
  P('passage', 19.5), P('passage', 11), P('passage', 19.5),
  // lifted: a repair ramp, a lookout over the middle of the complex, another repair ramp
  P('repair', 17), P('path', 5.5), P('lookout', 16), P('path', 2), P('repair', 17), P('path', 4),
  // the corner at Richard-Wagner-Straße: a meeting spot
  P('shade', 7), P('picnic', 5), P('bench', 4),
  // along Stollberger Straße: sit and watch the street
  P('path', 2), P('chairs', 7.2), P('path', 2), P('daybed', 3), P('path', 2), P('chairs', 4.8), P('path', 3),
  // round R8
  P('stairs', 6), P('path', 4), P('bench', 4), P('path', 3), P('picnic', 5), P('path', 10),
  // the yard between R1 and R2: a lookout
  P('lookout', 16), P('path', 2), P('wave', 6), P('path', 2), P('bench', 4), P('path', 7.8),
  P('crossing', 10), // Haydnstraße
  // the green strips
  P('path', 3), P('daybed', 3), P('path', 3), P('bench', 4), P('path', 5), P('chairs', 4.8), P('path', 2.7), P('balance', 6), P('path', 9.3),
  P('crossing', 26.8), // Stollberger Straße and the tram
  // the green under the school: play, a stage with seat steps, shade, rest
  P('path', 4), P('wave', 6), P('path', 2), P('climb', 6), P('path', 3), P('skate', 9), P('path', 3), P('stage', 6), P('seats', 6), P('path', 2),
  P('shade', 9), P('picnic', 5), P('path', 3), P('daybed', 3), P('bench', 4), P('path', 4.7),
]
export const DEFAULT_RIBBON = { v: VERSION, on: true, width: DEFAULT_WIDTH, pieces: DEFAULT_PIECES }

export function cleanRibbon(r) {
  if (!r || !Array.isArray(r.pieces) || r.v !== VERSION) return DEFAULT_RIBBON
  const pieces = r.pieces
    .filter((p) => p && RIBBON_KINDS[p.kind])
    .map((p) => ({ kind: p.kind, len: Math.max(RIBBON_KINDS[p.kind].min, Math.round((+p.len || 0) * 10) / 10), ...(p.flip ? { flip: true } : {}), ...cleanSize(p), ...(p.label ? { label: String(p.label).slice(0, 60) } : {}), ...cleanLook(p) }))
  const width = +r.width >= 0.6 && +r.width <= 8 ? +r.width : DEFAULT_WIDTH
  return { v: VERSION, on: r.on !== false, width, pieces: pieces.length ? pieces : DEFAULT_PIECES, ...cleanLook(r) }
}
// a material (see src/materials.js) and a colour (#rrggbb) you chose
export function cleanLook(p) {
  const out = {}
  if (p?.mat && MATERIALS[p.mat]) out.mat = p.mat
  if (typeof p?.col === 'string' && /^#[0-9a-f]{6}$/i.test(p.col)) out.col = p.col.toLowerCase()
  return out
}
// a width you set: 0.3–12 m; a height: 0.25–10 m
export function cleanSize(p) {
  const out = {}
  if (+p.w >= 0.3 && +p.w <= 12) out.w = Math.round(+p.w * 100) / 100
  if (+p.h >= 0.25 && +p.h <= 10 && hasHeight(p.kind ?? p.rk)) out.h = Math.round(+p.h * 100) / 100
  return out
}

// The plan curve, in three.js space (x east, z south).
export function routeCurve(route = ROUTE) {
  return new THREE.CatmullRomCurve3(route.map(([x, y]) => new THREE.Vector3(x, 0, -y)), false, 'centripetal')
}

// Where each piece starts and ends along the ribbon. Pieces past the end of the route are cut off.
export function layout(pieces, total) {
  const out = []
  let s = 0
  pieces.forEach((p, i) => {
    if (s >= total - 0.01) return
    const len = Math.min(p.len, total - s)
    out.push({ i, kind: p.kind, s0: s, s1: s + len, flip: !!p.flip, w: p.w, h: p.h })
    s += len
  })
  if (s < total - 0.01) out.push({ i: -1, kind: 'path', s0: s, s1: total }) // the rest lies flat
  return out
}

// Rounds every fold a little, so the band bends instead of cracking.
function soften(pts, r = 0.07) {
  const out = [pts[0]]
  for (let i = 1; i < pts.length - 1; i++) {
    const [a, b, c] = [out.at(-1), pts[i], pts[i + 1]]
    const l1 = Math.hypot(b[0] - a[0], b[1] - a[1])
    const l2 = Math.hypot(c[0] - b[0], c[1] - b[1])
    if (l1 < 1e-6 || l2 < 1e-6) continue
    const d1 = [(b[0] - a[0]) / l1, (b[1] - a[1]) / l1]
    const d2 = [(c[0] - b[0]) / l2, (c[1] - b[1]) / l2]
    if (d1[0] * d2[0] + d1[1] * d2[1] > 0.999) {
      out.push(b)
      continue
    }
    const t = Math.min(r, l1 * 0.45, l2 * 0.45)
    const p1 = [b[0] - d1[0] * t, b[1] - d1[1] * t]
    const p2 = [b[0] + d2[0] * t, b[1] + d2[1] * t]
    for (let k = 0; k <= 4; k++) {
      const u = k / 4
      const w = [(1 - u) ** 2, 2 * u * (1 - u), u * u]
      out.push([w[0] * p1[0] + w[1] * b[0] + w[2] * p2[0], w[0] * p1[1] + w[1] * b[1] + w[2] * p2[1]])
    }
  }
  out.push(pts.at(-1))
  return out
}

// Builds the band as one mesh. Also returns which piece each vertex belongs to (for clicking) and label points.
// `ground` (optional): the height of the ground at (east, north); the band follows it.
export function buildRibbon(ribbon, route = ROUTE, ground) {
  const curve = routeCurve(route)
  const total = curve.getLength()
  const parts = layout(ribbon.pieces, total)

  // the folded profile along the whole ribbon: [distance, height, piece]
  const prof = []
  for (const [k, p] of parts.entries()) {
    const L = p.s1 - p.s0
    const kind = RIBBON_KINDS[p.kind]
    let shape = L >= kind.min - 0.01 ? pieceShape(p.kind, L, p.h) : [[0, B], [L, B]]
    // flipped: the same piece mirrored end to end, so stairs, ramps and seats face the other way
    if (p.flip) shape = shape.map(([a, h]) => [L - a, h]).reverse()
    const pts = soften(shape)
    for (let j = 0; j < pts.length; j++) {
      const s = p.s0 + Math.min(L, Math.max(0, pts[j][0]))
      // the long flat parts get extra points, so the band follows the curve smoothly
      const prev = prof.at(-1)
      if (prev && s - prev[0] > 0.5) {
        const n = Math.ceil((s - prev[0]) / 0.5)
        for (let q = 1; q < n; q++) prof.push([prev[0] + ((s - prev[0]) * q) / n, prev[1] + ((pts[j][1] - prev[1]) * q) / n, k])
      }
      if (prev && Math.abs(prev[0] - s) < 1e-6 && Math.abs(prev[1] - pts[j][1]) < 1e-6) continue
      prof.push([s, pts[j][1], k])
    }
  }

  // width along the ribbon: shades get wider, with a soft change at their ends
  const fac = parts.map((p) => (p.w ? p.w / ribbon.width : (RIBBON_KINDS[p.kind].wide ?? 1)))
  const widthAt = (s, k) => {
    const p = parts[k]
    const ease = 0.9
    let f = fac[k]
    const a = s - p.s0
    const b = p.s1 - s
    const sm = (x) => x * x * (3 - 2 * x)
    if (a < ease && k > 0) f = (fac[k - 1] + fac[k]) / 2 + ((fac[k] - fac[k - 1]) / 2) * sm(a / ease)
    else if (b < ease && k < parts.length - 1) f = (fac[k + 1] + fac[k]) / 2 + ((fac[k] - fac[k + 1]) / 2) * sm(b / ease)
    return ribbon.width * f
  }

  // a section through the band at every profile point
  // distance along the folded band (up and over the folds too), so a wood grain runs along it
  const arc = []
  prof.forEach((q, i) => arc.push(i ? arc[i - 1] + Math.hypot(q[0] - prof[i - 1][0], q[1] - prof[i - 1][1]) : 0))
  const sec = prof.map(([s, h, k], i) => {
    const a = prof[Math.max(0, i - 1)]
    const c = prof[Math.min(prof.length - 1, i + 1)]
    const n1 = i > 0 ? norm2(s - a[0], h - a[1]) : null
    const n2 = i < prof.length - 1 ? norm2(c[0] - s, c[1] - h) : null
    let ds = (n1?.[0] ?? 0) + (n2?.[0] ?? 0)
    let dh = (n1?.[1] ?? 0) + (n2?.[1] ?? 0)
    const l = Math.hypot(ds, dh) || 1
    ;[ds, dh] = [ds / l, dh / l]
    const u = Math.min(1, Math.max(0, s / total))
    const P = curve.getPointAt(u)
    const T = curve.getTangentAt(u)
    const side = new THREE.Vector3(-T.z, 0, T.x).normalize()
    const nrm = new THREE.Vector3(T.x * -dh, ds, T.z * -dh) // the band's own "up", tipped with the fold
    const w = widthAt(s, k)
    const kind = RIBBON_KINDS[parts[k].kind]
    const pl = parts[k].s1 - parts[k].s0
    const sl = parts[k].flip ? parts[k].s1 - s : s - parts[k].s0
    const g = kind.slot ? Math.min(w - 0.3, Math.max(0, kind.slot(sl, pl, h, w, parts[k].h ?? kind.height))) : 0
    return { P: P.setY(h + (ground ? ground(P.x, -P.z) : 0)), side, nrm, w, g, k, a: arc[i] }
  })

  const pos = []
  const uv = [] // texture position: [along the band, across it], in metres
  const piece = []
  const tex = (q, v) => uv.push(q.a, v.clone().sub(q.P).dot(q.side))
  const idx = []
  // a stretch from section i to i + 1 is left out when it lies in a GAP
  const draw = (i) => !RIBBON_KINDS[parts[sec[i + 1].k].kind].gap
  const strip = (fa, fb, flip) => {
    const base = pos.length / 3
    for (const q of sec) {
      for (const f of [fa, fb]) {
        const v = f(q)
        pos.push(v.x, v.y, v.z)
        tex(q, v)
        piece.push(parts[q.k].i)
      }
    }
    for (let i = 0; i + 1 < sec.length; i++) {
      if (!draw(i)) continue
      const a = base + i * 2
      if (flip) idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
      else idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
  }
  // the band is drawn as two halves side by side, so it can open a slot down the middle (repair ramps)
  const at = (lat, sy) => (q) => q.P.clone().addScaledVector(q.side, lat(q)).addScaledVector(q.nrm, (sy * THICK) / 2)
  const halves = [
    [(q) => q.w / 2, (q) => q.g / 2],
    [(q) => -q.g / 2, (q) => -q.w / 2],
  ]
  for (const [hi, lo] of halves) {
    strip(at(hi, 1), at(lo, 1), false) // top face
    strip(at(hi, -1), at(lo, -1), true) // underside
    strip(at(hi, -1), at(hi, 1), false) // one edge
    strip(at(lo, -1), at(lo, 1), true) // other edge
    // close the ends of every stretch: the two ends of the ribbon, and both sides of each gap
    const caps = []
    for (let i = 0; i < sec.length; i++) {
      const before = i > 0 && draw(i - 1)
      const after = i < sec.length - 1 && draw(i)
      if (after && !before) caps.push([sec[i], true])
      if (before && !after) caps.push([sec[i], false])
    }
    for (const [q, flip] of caps) {
      const base = pos.length / 3
      for (const [lat, sy] of [[hi, 1], [lo, 1], [hi, -1], [lo, -1]]) {
        const v = at(lat, sy)(q)
        pos.push(v.x, v.y, v.z)
        tex(q, v)
        piece.push(parts[q.k].i)
      }
      if (flip) idx.push(base, base + 2, base + 1, base + 1, base + 2, base + 3)
      else idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2)
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  geo.setIndex(idx)
  geo.computeVertexNormals()

  // a tag point above the middle of each piece
  const tags = parts
    .filter((p) => p.i >= 0)
    .map((p) => {
      const mid = (p.s0 + p.s1) / 2
      const P = curve.getPointAt(Math.min(1, mid / total))
      let hi = 0
      for (const [s, h, k] of prof) if (parts[k] === p && h > hi) hi = h
      return { i: p.i, kind: p.kind, p: [P.x, hi + 1.2 + (ground ? ground(P.x, -P.z) : 0), P.z] }
    })

  return { geo, piece: new Int32Array(piece), total, parts, tags }
}

function norm2(a, b) {
  const l = Math.hypot(a, b)
  return l < 1e-9 ? null : [a / l, b / l]
}

// The garages the ribbon runs through, and which of their faces it opens.
// A face is 'front' (the door), 'back', 'left' (towards the garage numbered one lower) or 'right'.
let cachedPassages = null
export function passages() {
  if (cachedPassages) return cachedPassages
  const curve = routeCurve()
  const total = curve.getLength()
  const local = (g, p) => {
    const dx = p[0] - g.x
    const dy = p[1] - g.y
    return [dx * g.u[0] + dy * g.u[1], dx * g.n[0] + dy * g.n[1]]
  }
  const inside = ([a, b]) => Math.abs(a) < 1.5 && Math.abs(b) < 3
  const pts = []
  for (let s = 0; s <= total; s += 0.2) {
    const P = curve.getPointAt(Math.min(1, s / total))
    pts.push([P.x, -P.z])
  }
  const ids = new Set()
  const open = {}
  for (const g of GARAGES) {
    for (let i = 0; i + 1 < pts.length; i++) {
      const la = local(g, pts[i])
      const lb = local(g, pts[i + 1])
      if (inside(la)) ids.add(g.id)
      if (inside(la) === inside(lb)) continue
      const [a, b] = inside(la) ? lb : la // the point outside tells which face was crossed
      const face = Math.abs(b) >= 3 ? (b > 0 ? 'front' : 'back') : a > 0 ? 'right' : 'left'
      ;(open[g.id] ??= new Set()).add(face)
    }
  }
  cachedPassages = { ids, open }
  return cachedPassages
}
