import * as THREE from 'three'

// The real ground of the site (public/data/terrain.json, made by scripts/terrain.mjs).
// ground(east, north) gives the height of the ground in model metres, measured from the middle of complex G3,
// so the garage site stays near 0. Flat mode gives 0 everywhere, so the model is as it always was.
// Heights of garages, the ribbon and elements are kept "above the ground", and the ground is added when drawing.
let data = null
let scale = 0 // 0 flat, 1 real, 2 twice as steep (to read the slope better)

export const TOPO_MODES = [
  ['flat', 'Flat', 0],
  ['real', 'Real', 1],
  ['x2', 'Real ×2', 2],
]
export function setTerrain(d) {
  data = d
}
export function setTopo(mode) {
  scale = TOPO_MODES.find((m) => m[0] === mode)?.[2] ?? 0
}
export const topoOn = () => !!(data && scale)

// the raw height (metres above the lowest point of the grid), between the four nearest grid points
function raw(x, y) {
  const { half, step, n, dm } = data
  const c = Math.min(n - 1.001, Math.max(0, (x + half) / step))
  const r = Math.min(n - 1.001, Math.max(0, (half - y) / step))
  const c0 = Math.floor(c)
  const r0 = Math.floor(r)
  const fx = c - c0
  const fy = r - r0
  const v = (rr, cc) => dm[rr * n + cc] / 10
  return (v(r0, c0) * (1 - fx) + v(r0, c0 + 1) * fx) * (1 - fy) + (v(r0 + 1, c0) * (1 - fx) + v(r0 + 1, c0 + 1) * fx) * fy
}
export function ground(x, y) {
  if (!data || !scale) return 0
  return (raw(x, y) - (data.site - data.low)) * scale
}

// The ground as a mesh, with the map (green, streets, paths, tram…) painted on it.
export function terrainMesh(site, look) {
  const { half, n } = data
  const geo = new THREE.PlaneGeometry(half * 2, half * 2, n - 1, n - 1)
  geo.rotateX(-Math.PI / 2)
  const p = geo.attributes.position
  for (let i = 0; i < p.count; i++) p.setY(i, ground(p.getX(i), -p.getZ(i)) - 0.03)
  geo.computeVertexNormals()

  // the map, drawn from above: north at the top, 1400 m across 4096 pixels
  const S = 4096
  const cv = document.createElement('canvas')
  cv.width = cv.height = S
  const g = cv.getContext('2d')
  const px = (x, y) => [((x + half) / (2 * half)) * S, ((half - y) / (2 * half)) * S]
  const k = S / (2 * half)
  g.fillStyle = look.ground
  g.fillRect(0, 0, S, S)
  const fill = (ring, colour) => {
    g.fillStyle = colour
    g.beginPath()
    ring.forEach((q, i) => (i ? g.lineTo(...px(...q)) : g.moveTo(...px(...q))))
    g.closePath()
    g.fill()
  }
  const stroke = (kind, width, colour) => {
    g.strokeStyle = colour
    g.lineWidth = width * k
    g.lineCap = 'round'
    g.lineJoin = 'round'
    for (const l of site.lines.filter((l) => l.kind === kind)) {
      g.beginPath()
      l.p.forEach((q, i) => (i ? g.lineTo(...px(...q)) : g.moveTo(...px(...q))))
      g.stroke()
    }
  }
  for (const a of site.areas.filter((a) => a.kind === 'green')) fill(a.p, look.green)
  for (const a of site.areas.filter((a) => a.kind === 'parking')) fill(a.p, look.parking)
  fill(site.site, look.site)
  stroke('lane', 3.2, look.lane)
  stroke('road', 7, look.road)
  stroke('path', 1.6, look.path)
  stroke('tram', 1.6, look.tram)
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return { geo, tex }
}

// A building on the slope: its floor at the lowest ground under it, its roof as high above the ground as on flat land.
export function seatBuilding(geo, ring, h) {
  if (!topoOn()) return geo
  let low = Infinity
  for (const [x, y] of ring) low = Math.min(low, ground(x, y))
  const [cx, cy] = ring.reduce((a, q) => [a[0] + q[0] / ring.length, a[1] + q[1] / ring.length], [0, 0])
  const top = ground(cx, cy) + h
  const p = geo.attributes.position
  for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) < h / 2 ? low - 0.3 : top)
  geo.computeVertexNormals()
  return geo
}
