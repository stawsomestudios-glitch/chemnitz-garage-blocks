import { GARAGES } from './garages.js'

// The elements you can drag into the model. All sizes in metres.
// Each element is built from simple parts: box, cyl (cylinder), ball or cone.
// p = centre [across, up, front-back], s = size, c = colour, o = see-through (0–1), stack = other things can sit on top.
// The front of every element is its +z side, which faces the same way as the nearest garage doors.
const PI = Math.PI
const box = (p, s, c, more = {}) => ({ g: 'box', p, s, c, ...more })
const cyl = (p, s, c, more = {}) => ({ g: 'cyl', p, s, c, ...more })

export const CAR_COLOURS = ['#b8322f', '#2f5fa8', '#ecebe6', '#26292c', '#8a9399', '#d6a531', '#3f7a52']
export const carColour = (key) => CAR_COLOURS[[...String(key)].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7) % CAR_COLOURS.length]

export function carParts(c) {
  const wheels = [[-0.82, 1.35], [0.82, 1.35], [-0.82, -1.35], [0.82, -1.35]].map(([x, z]) => cyl([x, 0.33, z], [0.66, 0.24, 0.66], '#1d1f22', { r: [0, 0, PI / 2] }))
  return [
    box([0, 0.6, 0], [1.76, 0.62, 4.3], c),
    box([0, 1.12, -0.25], [1.56, 0.5, 2.3], '#2c3742', { rough: 0.2 }),
    box([0, 0.68, 2.16], [1.5, 0.14, 0.03], '#f5f1d0'),
    box([0, 0.68, -2.16], [1.5, 0.14, 0.03], '#a3201c'),
    ...wheels,
  ]
}

const door = (w, d) => box([0, 1.2, d / 2 + 0.025], [w - 0.5, 2.4, 0.05], 'door')

export const KINDS = {
  module: { name: 'Garage block', size: '3 × 6 × 3', w: 3, d: 6, titled: true, colour: '#e3ded3', parts: (c) => [box([0, 1.5, 0], [3, 3, 6], c, { stack: true }), door(3, 6)] },
  half: { name: 'Half block', size: '3 × 3 × 3', w: 3, d: 3, titled: true, colour: '#e3ded3', parts: (c) => [box([0, 1.5, 0], [3, 3, 3], c, { stack: true }), door(3, 3)] },
  deck: { name: 'Deck / platform', size: '3 × 6 × 0.3', w: 3, d: 6, colour: '#b58b5a', parts: (c) => [box([0, 0.15, 0], [3, 0.3, 6], c, { stack: true })] },
  stairs: {
    name: 'Stairs to roof', size: '1.2 × 4.5, 3 up', w: 1.2, d: 4.5, colour: '#b9b2a6',
    parts: (c) => Array.from({ length: 12 }, (_, i) => box([0, ((i + 1) * 0.25) / 2, 2.25 - 0.1875 - i * 0.375], [1.2, (i + 1) * 0.25, 0.375], c)),
  },
  shade: {
    name: 'Shade sail', size: '6 × 6', w: 6, d: 6, colour: '#f4eee2',
    parts: (c) => [
      ...[[-2.9, -2.9, 3.4], [2.9, -2.9, 2.6], [2.9, 2.9, 3.4], [-2.9, 2.9, 2.6]].map(([x, z, h]) => cyl([x, h / 2, z], [0.1, h, 0.1], '#4a4d52')),
      box([0, 3.0, 0], [5.9, 0.03, 5.9], c, { o: 0.88, r: [0.12, 0, 0.12] }),
    ],
  },
  pergola: {
    name: 'Pergola', size: '3 × 6', w: 3, d: 6, colour: '#8a6a45',
    parts: (c) => [
      ...[[-1.4, -2.9], [1.4, -2.9], [-1.4, 2.9], [1.4, 2.9]].map(([x, z]) => box([x, 1.4, z], [0.15, 2.8, 0.15], c)),
      box([-1.4, 2.88, 0], [0.15, 0.2, 6.2], c),
      box([1.4, 2.88, 0], [0.15, 0.2, 6.2], c),
      ...Array.from({ length: 12 }, (_, i) => box([0, 3.03, -2.75 + i * 0.5], [3.3, 0.1, 0.08], c)),
    ],
  },
  parasol: {
    name: 'Parasol', size: 'Ø 2.6', w: 2.6, d: 2.6, colour: '#e9d6a8',
    parts: (c) => [cyl([0, 1.2, 0], [0.06, 2.4, 0.06], '#4a4d52'), { g: 'cone', p: [0, 2.45, 0], s: [2.6, 0.55, 2.6], c }, cyl([0, 0.05, 0], [0.5, 0.1, 0.5], '#4a4d52')],
  },
  tree: {
    name: 'Tree', size: 'Ø 4.5', w: 4.5, d: 4.5, colour: '#7fa65a',
    parts: (c) => [cyl([0, 1.4, 0], [0.3, 2.8, 0.3], '#7a5b3e'), { g: 'ball', p: [0, 4, 0], s: [4.2, 3.8, 4.2], c }, { g: 'ball', p: [0.7, 4.9, 0.3], s: [2.6, 2.4, 2.6], c: '#8db866' }],
  },
  planter: { name: 'Planter', size: '3 × 1', w: 3, d: 1, colour: '#9a948a', parts: (c) => [box([0, 0.3, 0], [3, 0.6, 1], c), box([0, 0.66, 0], [2.8, 0.16, 0.8], '#6f9a4c')] },
  bench: {
    name: 'Bench', size: '1.8 long', w: 1.8, d: 0.5, colour: '#a07a52',
    parts: (c) => [box([0, 0.45, 0], [1.8, 0.06, 0.45], c), box([0, 0.75, -0.2], [1.8, 0.35, 0.04], c), box([-0.75, 0.22, 0], [0.06, 0.44, 0.4], '#3b3d40'), box([0.75, 0.22, 0], [0.06, 0.44, 0.4], '#3b3d40')],
  },
  table: {
    name: 'Picnic table', size: '1.8 × 1.8', w: 1.8, d: 1.8, colour: '#a07a52',
    parts: (c) => [box([0, 0.75, 0], [1.8, 0.05, 0.8], c), box([0, 0.45, 0.65], [1.8, 0.05, 0.3], c), box([0, 0.45, -0.65], [1.8, 0.05, 0.3], c), box([-0.7, 0.37, 0], [0.06, 0.74, 1.6], '#3b3d40'), box([0.7, 0.37, 0], [0.06, 0.74, 1.6], '#3b3d40')],
  },
  wall: { name: 'Screen wall', size: '3 × 2.4', w: 3, d: 0.15, colour: '#cfc6b6', parts: (c) => [box([0, 1.2, 0], [3, 2.4, 0.15], c)] },
  lamp: {
    name: 'Street lamp', size: '4 high', w: 0.5, d: 0.8, colour: '#3b3d40',
    parts: (c) => [cyl([0, 2, 0], [0.1, 4, 0.1], c), box([0, 4, 0.25], [0.22, 0.1, 0.7], c), box([0, 3.94, 0.35], [0.16, 0.02, 0.4], '#fff3c4')],
  },
  person: {
    name: 'Person', size: '1.75 tall', w: 0.6, d: 0.6, colour: '#5a6270',
    parts: (c) => [cyl([0, 0.72, 0], [0.42, 1.44, 0.3], c), { g: 'ball', p: [0, 1.58, 0], s: [0.24, 0.27, 0.24], c: '#d9b89a' }],
  },
  car: { name: 'Car', size: '4.3 long', w: 1.8, d: 4.3, colour: null, parts: (c) => carParts(c) },
}
export const KIND_IDS = Object.keys(KINDS)

function nearest(x, y) {
  let best = GARAGES[0]
  let bd = Infinity
  for (const g of GARAGES) {
    const d = (g.x - x) ** 2 + (g.y - y) ** 2
    if (d < bd) [best, bd] = [g, d]
  }
  return best
}

// Turns an element so its front faces the same way as the nearest garage doors (in degrees).
export function alignRot(x, y) {
  const g = nearest(x, y)
  return (Math.atan2(g.n[0], -g.n[1]) * 180) / PI
}

// Snaps a point to a 1.5 m grid that runs along the nearest garage row, so blocks line up with the garages.
export function snapPoint(x, y) {
  const g = nearest(x, y)
  const a = Math.round(((x - g.x) * g.u[0] + (y - g.y) * g.u[1]) / 1.5) * 1.5
  const b = Math.round(((x - g.x) * g.n[0] + (y - g.y) * g.n[1]) / 1.5) * 1.5
  return [g.x + g.u[0] * a + g.n[0] * b, g.y + g.u[1] * a + g.n[1] * b]
}
