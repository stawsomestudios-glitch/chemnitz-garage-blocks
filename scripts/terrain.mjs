// Fetches the real ground heights around the site and saves them for the model as public/data/terrain.json.
// Source: AWS Terrain Tiles (Terrarium format; in Germany from the EU-DEM, about 25–30 m detail, and SRTM).
// Run: node scripts/terrain.mjs
//
// The grid covers 1400 × 1400 m around the middle of complex G3 (UTM 33N 352115 / 5631440), one height every 5 m.
// Heights are saved in decimetres above the lowest point, row by row from the north-west corner.
import fs from 'node:fs'
import zlib from 'node:zlib'

const ORIGIN = [352115, 5631440]
const HALF = 700
const STEP = 5
const Z = 15 // tile zoom: about 3 m per pixel here
const CACHE = new URL('./terrain-tiles/', import.meta.url)
fs.mkdirSync(CACHE, { recursive: true })

// UTM zone 33 north to latitude / longitude (WGS84)
function utmToLatLon(E, N, zone = 33) {
  const a = 6378137
  const f = 1 / 298.257223563
  const e2 = f * (2 - f)
  const k0 = 0.9996
  const x = E - 500000
  const M = N / k0
  const mu = M / (a * (1 - e2 / 4 - (3 * e2 * e2) / 64 - (5 * e2 ** 3) / 256))
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2))
  const p1 = mu + ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) + ((21 * e1 * e1) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) + ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) + ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu)
  const ep2 = e2 / (1 - e2)
  const C1 = ep2 * Math.cos(p1) ** 2
  const T1 = Math.tan(p1) ** 2
  const N1 = a / Math.sqrt(1 - e2 * Math.sin(p1) ** 2)
  const R1 = (a * (1 - e2)) / (1 - e2 * Math.sin(p1) ** 2) ** 1.5
  const D = x / (N1 * k0)
  const lat = p1 - ((N1 * Math.tan(p1)) / R1) * (D * D / 2 - ((5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ep2) * D ** 4) / 24 + ((61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ep2 - 3 * C1 * C1) * D ** 6) / 720)
  const lon = (D - ((1 + 2 * T1 + C1) * D ** 3) / 6 + ((5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ep2 + 24 * T1 * T1) * D ** 5) / 120) / Math.cos(p1)
  return [(lat * 180) / Math.PI, (zone - 1) * 6 - 180 + 3 + (lon * 180) / Math.PI]
}
// latitude / longitude to a pixel in the world of web map tiles at zoom Z
const pixel = (lat, lon) => {
  const n = 2 ** Z * 256
  const r = (lat * Math.PI) / 180
  return [((lon + 180) / 360) * n, ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n]
}

// a small PNG reader (8-bit RGB or RGBA, no interlace), enough for these tiles
function readPng(buf) {
  let p = 8
  let w = 0
  let h = 0
  let type = 0
  const idat = []
  while (p < buf.length) {
    const len = buf.readUInt32BE(p)
    const name = buf.toString('ascii', p + 4, p + 8)
    const data = buf.subarray(p + 8, p + 8 + len)
    if (name === 'IHDR') {
      w = data.readUInt32BE(0)
      h = data.readUInt32BE(4)
      if (data[8] !== 8 || data[12] !== 0) throw new Error('unexpected PNG')
      type = data[9]
    }
    if (name === 'IDAT') idat.push(data)
    p += 12 + len
  }
  const bpp = type === 6 ? 4 : type === 2 ? 3 : 0
  if (!bpp) throw new Error('PNG colour type ' + type)
  const raw = zlib.inflateSync(Buffer.concat(idat))
  const out = Buffer.alloc(w * h * bpp)
  const stride = w * bpp
  for (let y = 0; y < h; y++) {
    const ft = raw[y * (stride + 1)]
    const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[y * stride + x - bpp] : 0
      const b = y ? out[(y - 1) * stride + x] : 0
      const c = x >= bpp && y ? out[(y - 1) * stride + x - bpp] : 0
      let v = src[x]
      if (ft === 1) v += a
      else if (ft === 2) v += b
      else if (ft === 3) v += (a + b) >> 1
      else if (ft === 4) {
        const pa = Math.abs(b - c)
        const pb = Math.abs(a - c)
        const pc = Math.abs(a + b - 2 * c)
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      }
      out[y * stride + x] = v & 255
    }
  }
  return { w, h, bpp, px: out }
}

const tiles = new Map()
async function tile(tx, ty) {
  const key = `${tx}_${ty}`
  if (tiles.has(key)) return tiles.get(key)
  const file = new URL(`${Z}_${key}.png`, CACHE)
  if (!fs.existsSync(file)) {
    const r = await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${Z}/${tx}/${ty}.png`)
    if (!r.ok) throw new Error(`tile ${key}: ${r.status}`)
    fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()))
  }
  const t = readPng(fs.readFileSync(file))
  tiles.set(key, t)
  return t
}
// height in metres at a world pixel, read between the four nearest pixels
async function heightAt(X, Y) {
  const get = async (x, y) => {
    const t = await tile(Math.floor(x / 256), Math.floor(y / 256))
    const i = ((y % 256) * 256 + (x % 256)) * t.bpp
    return t.px[i] * 256 + t.px[i + 1] + t.px[i + 2] / 256 - 32768
  }
  const x0 = Math.floor(X - 0.5)
  const y0 = Math.floor(Y - 0.5)
  const fx = X - 0.5 - x0
  const fy = Y - 0.5 - y0
  const [a, b, c, d] = [await get(x0, y0), await get(x0 + 1, y0), await get(x0, y0 + 1), await get(x0 + 1, y0 + 1)]
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy
}

const n = (2 * HALF) / STEP + 1
const heights = []
for (let r = 0; r < n; r++) {
  const north = HALF - r * STEP
  for (let c = 0; c < n; c++) {
    const east = -HALF + c * STEP
    const [lat, lon] = utmToLatLon(ORIGIN[0] + east, ORIGIN[1] + north)
    heights.push(await heightAt(...pixel(lat, lon)))
  }
}
const low = Math.min(...heights)
const high = Math.max(...heights)
const atSite = heights[((n - 1) / 2) * n + (n - 1) / 2]
const out = {
  source: 'AWS Terrain Tiles (Terrarium), from EU-DEM and SRTM; about 25–30 m detail',
  origin: ORIGIN,
  half: HALF,
  step: STEP,
  n,
  low: Math.round(low * 10) / 10, // metres above sea level of the lowest point
  site: Math.round(atSite * 10) / 10, // metres above sea level at the middle of complex G3
  dm: heights.map((h) => Math.round((h - low) * 10)), // decimetres above the lowest point
}
fs.writeFileSync(new URL('../public/data/terrain.json', import.meta.url), JSON.stringify(out))
console.log(`${n} × ${n} heights, ${low.toFixed(1)}–${high.toFixed(1)} m above sea level; the site middle is at ${atSite.toFixed(1)} m; ${tiles.size} tiles`)
