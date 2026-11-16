import * as THREE from 'three'

// The ribbon: one continuous cobalt band that winds through the garages and links three places:
//   start: the green wedge at the Parkstraße / Haydnstraße junction,
//   middle: the corner where Richard-Wagner-Straße ends at Stollberger Straße,
//   end: the green above the Haydnstraße / Stollberger Straße junction, just under the school (Haydnstraße 21).
// Along the way it folds up and down into places to rest, meet, play and do sport, but it never breaks.

export const COBALT = '#0047ab'
export const THICK = 0.1 // thickness of the band, metres
export const DEFAULT_WIDTH = 2.4 // metres
export const VERSION = 2 // plans saved with an older ribbon start again from the new one

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
  [22, -12],
  [14.5, -15],
  [11.5, -19.2], // past the end of R7, along R11
  [6, -19.7],
  [-6, -20.6], // the south lane, along R13
  [-18, -21],
  [-26, -21.4],
  [-30.3, -15], // up the yard between R10 and R12
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
  [12, 26.8], // the yard between R1 and R2
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
  ['Parkstraße', 30, 41],
  ['Haydnstraße', 286, 296],
  ['Stollberger Straße and the tram', 337, 364],
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

// The groups the panel shows the kinds in.
export const RIBBON_GROUPS = [
  ['Move', ['path', 'crossing', 'stairs']],
  ['Rest', ['bench', 'chairs', 'daybed', 'shade']],
  ['Meet', ['table', 'picnic', 'stage', 'seats']],
  ['Sport and play', ['pingpong', 'workout', 'balance', 'skate', 'climb', 'wave']],
]

export const RIBBON_KINDS = {
  path: { name: 'PATH', min: 1, shape: (L) => [[0, B], [L, B]] },
  crossing: { name: 'CROSSING', min: 1, shape: (L) => [[0, B], [L, B]], note: 'Lies flat on the street.' },
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

// The ribbon as it starts, about 440 m. The three CROSSING pieces lie over the streets.
const P = (kind, len) => ({ kind, len })
export const DEFAULT_PIECES = [
  // the green wedge at Parkstraße / Haydnstraße: a place to rest
  P('path', 2), P('daybed', 3), P('bench', 4), P('path', 3), P('shade', 8), P('chairs', 4.8), P('path', 4.7),
  P('crossing', 11.2), // Parkstraße
  // along Haydnstraße: sport
  P('path', 3), P('balance', 8), P('path', 2.3), P('workout', 7.2), P('path', 2), P('climb', 6), P('path', 2), P('bench', 4), P('path', 7.8),
  // the yard between R5 and R6: shade, a long table, ping pong
  P('shade', 7), P('picnic', 5), P('path', 2), P('pingpong', 4), P('path', 2), P('pingpong', 4), P('bench', 4),
  // past R7 and along the south lane: skate and play
  P('path', 22), P('skate', 10), P('path', 2), P('wave', 6), P('path', 7),
  // the yard between R10 and R12: a stage with seat steps facing it
  P('stage', 6), P('seats', 6), P('path', 6),
  // the corner at Richard-Wagner-Straße: a meeting spot
  P('shade', 7), P('picnic', 5), P('bench', 4), P('path', 6),
  // along Stollberger Straße: sit and watch the street
  P('chairs', 7.2), P('path', 2), P('daybed', 3), P('path', 2), P('chairs', 4.8), P('path', 6),
  // round R8 and through the yard between R1 and R2
  P('stairs', 6), P('path', 4), P('bench', 4), P('path', 12), P('picnic', 5), P('shade', 8), P('wave', 6), P('path', 6), P('bench', 4), P('path', 8),
  P('crossing', 10.5), // Haydnstraße
  // the green strips
  P('path', 3), P('daybed', 3), P('path', 3), P('bench', 4), P('path', 5), P('chairs', 4.8), P('path', 2.7), P('balance', 6), P('path', 9),
  P('crossing', 27.2), // Stollberger Straße and the tram
  // the green under the school: play, an outdoor classroom, shade, rest
  P('path', 4), P('wave', 6), P('path', 2), P('climb', 6), P('path', 3), P('skate', 9), P('path', 3), P('seats', 6), P('path', 2),
  P('shade', 9), P('picnic', 5), P('path', 3), P('daybed', 3), P('bench', 4), P('path', 10.5),
]
export const DEFAULT_RIBBON = { v: VERSION, on: true, width: DEFAULT_WIDTH, pieces: DEFAULT_PIECES }

export function cleanRibbon(r) {
  if (!r || !Array.isArray(r.pieces) || r.v !== VERSION) return DEFAULT_RIBBON
  const pieces = r.pieces
    .filter((p) => p && RIBBON_KINDS[p.kind])
    .map((p) => ({ kind: p.kind, len: Math.max(RIBBON_KINDS[p.kind].min, Math.round((+p.len || 0) * 10) / 10) }))
  const width = +r.width >= 0.6 && +r.width <= 8 ? +r.width : DEFAULT_WIDTH
  return { v: VERSION, on: r.on !== false, width, pieces: pieces.length ? pieces : DEFAULT_PIECES }
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
    out.push({ i, kind: p.kind, s0: s, s1: s + len })
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
export function buildRibbon(ribbon, route = ROUTE) {
  const curve = routeCurve(route)
  const total = curve.getLength()
  const parts = layout(ribbon.pieces, total)

  // the folded profile along the whole ribbon: [distance, height, piece]
  const prof = []
  for (const [k, p] of parts.entries()) {
    const L = p.s1 - p.s0
    const kind = RIBBON_KINDS[p.kind]
    const shape = L >= kind.min - 0.01 ? kind.shape(L) : [[0, B], [L, B]]
    const pts = soften(shape)
    for (let j = 0; j < pts.length; j++) {
      const s = p.s0 + Math.min(L, Math.max(0, pts[j][0]))
      // the long flat parts get extra points, so the band follows the curve smoothly
      const prev = prof.at(-1)
      if (prev && s - prev[0] > 0.5 && Math.abs(pts[j][1] - prev[1]) < 1e-6) {
        const n = Math.ceil((s - prev[0]) / 0.5)
        for (let q = 1; q < n; q++) prof.push([prev[0] + ((s - prev[0]) * q) / n, prev[1], k])
      }
      if (prev && Math.abs(prev[0] - s) < 1e-6 && Math.abs(prev[1] - pts[j][1]) < 1e-6) continue
      prof.push([s, pts[j][1], k])
    }
  }

  // width along the ribbon: shades get wider, with a soft change at their ends
  const fac = parts.map((p) => RIBBON_KINDS[p.kind].wide ?? 1)
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
    return { P: P.setY(h), side, nrm, w: widthAt(s, k), k }
  })

  const pos = []
  const piece = []
  const idx = []
  const strip = (fa, fb, flip) => {
    const base = pos.length / 3
    for (const q of sec) {
      for (const f of [fa, fb]) {
        const v = f(q)
        pos.push(v.x, v.y, v.z)
        piece.push(parts[q.k].i)
      }
    }
    for (let i = 0; i + 1 < sec.length; i++) {
      const a = base + i * 2
      if (flip) idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
      else idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
  }
  const corner = (sx, sy) => (q) => q.P.clone().addScaledVector(q.side, (sx * q.w) / 2).addScaledVector(q.nrm, (sy * THICK) / 2)
  strip(corner(1, 1), corner(-1, 1), false) // top face
  strip(corner(1, -1), corner(-1, -1), true) // underside
  strip(corner(1, -1), corner(1, 1), false) // one edge
  strip(corner(-1, -1), corner(-1, 1), true) // other edge
  // close the two ends
  for (const [q, flip] of [[sec[0], true], [sec.at(-1), false]]) {
    const base = pos.length / 3
    for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const v = corner(sx, sy)(q)
      pos.push(v.x, v.y, v.z)
      piece.push(parts[q.k].i)
    }
    if (flip) idx.push(base, base + 2, base + 1, base + 1, base + 2, base + 3)
    else idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2)
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
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
      return { i: p.i, kind: p.kind, p: [P.x, hi + 1.2, P.z] }
    })

  return { geo, piece: new Int16Array(piece), total, parts, tags }
}

function norm2(a, b) {
  const l = Math.hypot(a, b)
  return l < 1e-9 ? null : [a / l, b / l]
}
