// The elevated walkway: a 5 m wide bridge between the city streets and the garages.
// Points are local metres [east, north, height of the walking surface].
// To move a route, change its points; to change the height, change DECK (the ramps are recalculated).
// Garage roofs are at 3 m. Street points come from the OpenStreetMap data in public/data/site.json.

export const DECK = 3.5 // walking level of the bridge, m (0.5 m above the garage roofs)
export const WIDTH = 5 // main walkway width, m
export const RAMP_WIDTH = 3 // entrance slope width, m
export const THICK = 0.3 // deck thickness, m

const lane = [-0.181, 0.983] // direction of the central lane between R8 and R9 (south → north)
const across = [lane[1], -lane[0]] // pointing east, across the lane
const at = (p, a, b = 0) => [p[0] + lane[0] * a + across[0] * b, p[1] + lane[1] * a + across[1] * b]

// Main exit: a plaza over the central lane, with a stair and a lift down into the garages.
const P0 = [-9.3, -6] // south end of the plaza
export const PLAZA = { from: [...P0, DECK], to: [...at(P0, 14), DECK], width: 8.4 }
const top = at(P0, 14)
export const STAIR = { from: [...at(top, 0, 1.8), DECK], to: [...at(top, 7, 1.8), 0], width: 4, steps: 20 }
export const LIFT = { at: at(top, 1.6, -2.6), size: 2.4, height: DECK + 3.2 }

// Each entrance: a slope from the street up to deck level, then a 5 m arm to the plaza.
export const ROUTES = [
  {
    id: 'rws',
    name: 'Richard-Wagner-Straße',
    // starts beside the end of Richard-Wagner-Straße and climbs along Stollberger Straße
    ramp: [[-41, 2.9], [2, 40.9]],
    arm: [[2, 40.9], [-8, 6]],
  },
  {
    id: 'haydn',
    name: 'Haydnstraße / Stollberger Straße',
    // starts at the Haydnstraße / Stollberger Straße junction and runs down beside Haydnstraße
    ramp: [[29, 68], [40, 12.9]],
    arm: [[40, 12.9], [9, 6.9], [-8, 3.5]],
  },
  {
    id: 'park',
    name: 'Parkstraße',
    // starts at the Parkstraße junction and runs along the south edge of the garages
    ramp: [[50, -39], [-7, -37.5]],
    arm: [[-7, -37.5], [...P0]],
  },
]

const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1])

// Every piece as a straight run [from, to] with heights, ready to draw.
export function pieces() {
  const out = []
  for (const r of ROUTES) {
    const [g, t] = r.ramp
    out.push({ kind: 'ramp', route: r.id, a: [...g, 0], b: [...t, DECK], w: RAMP_WIDTH })
    for (let i = 0; i + 1 < r.arm.length; i++) out.push({ kind: 'arm', route: r.id, a: [...r.arm[i], DECK], b: [...r.arm[i + 1], DECK], w: WIDTH })
  }
  return out
}

export function rampSlope(r) {
  return DECK / dist(r.ramp[0], r.ramp[1])
}

// Tags shown in the model.
export function skywalkTags() {
  return [
    ...ROUTES.map((r) => ({ key: `sky-${r.id}`, at: [...r.ramp[0], 2.6], text: `ENTRANCE · ${r.name}` })),
    { key: 'sky-exit', at: [...STAIR.to.slice(0, 2), 2.6], text: 'MAIN EXIT · garages' },
  ]
}
