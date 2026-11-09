// Where each of the 13 garage rows stands.
// Local metres: x = east, y = north, origin at UTM 33N 352115 / 5631440 (middle of complex G3).
// `a` and `b` are the two ends of the row's mapped centre line, from OpenStreetMap.
// Rows R2/R3, R4/R5, R7/R8 and R9/R10 are back to back, so their centre line is the shared back wall.
export const MODULE = { width: 3, depth: 6, height: 3 }
export const ORIGIN_UTM33 = [352115, 5631440]

// `door` is the direction the doors face: +1 is to the left of a→b, -1 to the right.
// `spine` true: the back wall sits on the centre line. false: the row is centred on the line.
// `shift` slides the whole row along its length, in metres (see the fit check in scripts/build-site.mjs).
// Modules are numbered from end a to end b.
const B = {
  a: { a: [7.95, 34.45], b: [27.55, 38.2], osm: 364462461 },
  b: { a: [11.3, 15.65], b: [30.9, 19.45], osm: 364462458 },
  c: { a: [14.15, -0.45], b: [33.75, 3.35], osm: 364462463 },
  d: { a: [17.2, -22.1], b: [34.5, -19.65], osm: 377797492 },
  e: { a: [3.15, -16.35], b: [-3.55, 25.75], osm: 377797489 },
  f: { a: [-18.5, -14.8], b: [-23.45, 11.15], osm: 377797490 },
  g: { a: [-10.5, -26.85], b: [16.5, -23.95], osm: 1059791311 },
  h: { a: [-38.25, -17.3], b: [-39.85, -7.05], osm: 391262800 },
  i: { a: [-39.8, -27.8], b: [-13.45, -27.6], osm: 391262801 },
}

function layoutRow(r) {
  const dx = r.b[0] - r.a[0]
  const dy = r.b[1] - r.a[1]
  const L = Math.hypot(dx, dy)
  const u = [dx / L, dy / L] // along the row, from end a to end b
  const n = [-u[1] * r.door, u[0] * r.door] // the way the doors face
  const shift = r.shift ?? 0
  const mid = [(r.a[0] + r.b[0]) / 2 + u[0] * shift, (r.a[1] + r.b[1]) / 2 + u[1] * shift]
  const len = r.n * MODULE.width
  // back wall line: on the spine, or half a module behind the centre line
  const back = r.spine ? mid : [mid[0] - (n[0] * MODULE.depth) / 2, mid[1] - (n[1] * MODULE.depth) / 2]
  const azimuth = ((Math.atan2(n[0], n[1]) * 180) / Math.PI + 360) % 360 // compass bearing of the doors
  const modules = Array.from({ length: r.n }, (_, i) => {
    const s = (i + 0.5 - r.n / 2) * MODULE.width
    return {
      row: r.id,
      index: i,
      x: back[0] + u[0] * s + (n[0] * MODULE.depth) / 2,
      y: back[1] + u[1] * s + (n[1] * MODULE.depth) / 2,
    }
  })
  return { ...r, u, nrm: n, mid, back, len, mappedLen: L, azimuth, modules }
}

export const ROWS = [
  { id: 'R1', n: 7, ...B.a, door: -1, spine: false },
  { id: 'R2', n: 7, ...B.b, door: 1, spine: true },
  { id: 'R3', n: 7, ...B.b, door: -1, spine: true },
  { id: 'R4', n: 7, ...B.c, door: 1, spine: true },
  { id: 'R5', n: 7, ...B.c, door: -1, spine: true },
  { id: 'R6', n: 6, ...B.d, door: 1, spine: false, shift: 2.7 },
  { id: 'R7', n: 15, ...B.e, door: -1, spine: true },
  { id: 'R8', n: 15, ...B.e, door: 1, spine: true },
  { id: 'R9', n: 10, ...B.f, door: -1, spine: true, shift: -0.8 },
  { id: 'R10', n: 10, ...B.f, door: 1, spine: true, shift: -0.8 },
  { id: 'R11', n: 10, ...B.g, door: 1, spine: false, shift: 1.5 },
  { id: 'R12', n: 4, ...B.h, door: -1, spine: false },
  { id: 'R13', n: 10, ...B.i, door: 1, spine: false, shift: -0.6 },
].map(layoutRow)

const NAMES = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
export const compass = (az) => NAMES[Math.round(az / 22.5) % 16]

// The four corners of a row, for the fit check.
export function rowCorners(r) {
  const h = r.len / 2
  const d = MODULE.depth
  const p = (s, t) => [r.back[0] + r.u[0] * s + r.nrm[0] * t, r.back[1] + r.u[1] * s + r.nrm[1] * t]
  return [p(-h, 0), p(h, 0), p(h, d), p(-h, d)]
}
