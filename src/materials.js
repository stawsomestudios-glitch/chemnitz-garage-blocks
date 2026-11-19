import * as THREE from 'three'

// What the ribbon can be made of. `colour` is the usual colour; you can change it for any material.
// rough: 0 shiny – 1 matt · metal: 0 not metal – 1 metal · tex: a surface pattern, drawn once and tinted by the colour.
export const MATERIALS = {
  painted: { name: 'Painted', colour: '#0047ab', rough: 0.75, metal: 0 },
  lightwood: { name: 'Light wood', colour: '#dcbf93', rough: 0.72, metal: 0, tex: 'wood' },
  darkwood: { name: 'Dark wood', colour: '#8f5c37', rough: 0.66, metal: 0, tex: 'wood' },
  concrete: { name: 'Concrete', colour: '#bfbcb5', rough: 0.95, metal: 0, tex: 'speckle' },
  corten: { name: 'Corten steel', colour: '#9b4b24', rough: 0.85, metal: 0.25, tex: 'rust' },
  steel: { name: 'Brushed steel', colour: '#c6cacd', rough: 0.35, metal: 0.85, tex: 'brushed' },
  rubber: { name: 'Play rubber', colour: '#c84a3c', rough: 1, metal: 0, tex: 'speckle' },
  terrazzo: { name: 'Terrazzo', colour: '#ebe5d9', rough: 0.4, metal: 0, tex: 'terrazzo' },
}
export const MATERIAL_IDS = Object.keys(MATERIALS)

// The material and colour of one piece: its own, or else the ribbon's.
// A piece with its own material but no colour of its own takes that material's usual colour.
export function lookOf(p, rib) {
  const mat = MATERIALS[p?.mat] ? p.mat : MATERIALS[rib?.mat] ? rib.mat : 'painted'
  const colour = p?.col ?? (p?.mat ? null : rib?.col) ?? MATERIALS[mat].colour
  return { mat, colour }
}

// ----- surface patterns, drawn on a canvas once: light (near white) so the colour shows through -----
const rand = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
const patterns = {}
function pattern(kind) {
  if (patterns[kind]) return patterns[kind]
  const S = 512
  const cv = document.createElement('canvas')
  cv.width = cv.height = S
  const g = cv.getContext('2d')
  const r = rand(kind.length * 7919 + 13)
  g.fillStyle = '#fff'
  g.fillRect(0, 0, S, S)
  if (kind === 'wood') {
    // 14 planks across (14 cm each over 2 m), grain running along the ribbon, joints between planks
    const n = 14
    const h = S / n
    for (let k = 0; k < n; k++) {
      const tone = 0.86 + r() * 0.14
      g.fillStyle = `rgb(${255 * tone},${250 * tone},${242 * tone})`
      g.fillRect(0, k * h, S, h)
      for (let l = 0; l < 9; l++) {
        g.strokeStyle = `rgba(110,70,35,${0.05 + r() * 0.1})`
        g.lineWidth = 0.6 + r() * 1.4
        g.beginPath()
        const y0 = k * h + r() * h
        for (let x = 0; x <= S; x += 16) g.lineTo(x, y0 + Math.sin(x / (40 + r() * 30) + l) * (1 + r() * 2))
        g.stroke()
      }
      if (r() < 0.6) {
        // a knot
        g.fillStyle = 'rgba(90,55,25,0.18)'
        g.beginPath()
        g.ellipse(r() * S, k * h + h / 2, 6 + r() * 6, 2 + r() * 2, 0, 0, Math.PI * 2)
        g.fill()
      }
      g.fillStyle = 'rgba(60,35,15,0.45)'
      g.fillRect(0, k * h, S, 1.5) // joint
      g.fillRect(((k * 137) % 5) * (S / 5) + 30, k * h, 1.5, h) // butt joint
    }
  } else if (kind === 'speckle' || kind === 'rust' || kind === 'terrazzo') {
    const dots = kind === 'terrazzo' ? 900 : 6000
    for (let i = 0; i < dots; i++) {
      const a = kind === 'terrazzo' ? 0.25 + r() * 0.35 : 0.04 + r() * 0.12
      const c = kind === 'rust' ? `rgba(70,25,5,${a * 1.6})` : kind === 'terrazzo' ? [`rgba(120,120,120,${a})`, `rgba(180,110,80,${a})`, `rgba(90,110,130,${a})`, `rgba(40,40,40,${a})`][i % 4] : `rgba(60,60,60,${a})`
      g.fillStyle = c
      const s = kind === 'terrazzo' ? 2 + r() * 7 : 0.6 + r() * 2
      g.beginPath()
      g.ellipse(r() * S, r() * S, s, s * (0.6 + r() * 0.4), r() * 3, 0, Math.PI * 2)
      g.fill()
    }
    if (kind === 'rust')
      for (let i = 0; i < 40; i++) {
        g.fillStyle = `rgba(${120 + r() * 60},${50 + r() * 30},20,${0.06 + r() * 0.08})`
        g.beginPath()
        g.ellipse(r() * S, r() * S, 20 + r() * 50, 10 + r() * 30, r() * 3, 0, Math.PI * 2)
        g.fill()
      }
  } else if (kind === 'brushed') {
    for (let y = 0; y < S; y++) {
      g.fillStyle = `rgba(0,0,0,${r() * 0.07})`
      g.fillRect(0, y, S, 1)
    }
  }
  const t = new THREE.CanvasTexture(cv)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(0.5, 0.5) // the pattern covers 2 × 2 m
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  patterns[kind] = t
  return t
}

// A three.js material for a material and colour.
export function makeMaterial(mat, colour) {
  const M = MATERIALS[mat] ?? MATERIALS.painted
  return new THREE.MeshStandardMaterial({
    color: colour ?? M.colour,
    roughness: M.rough,
    metalness: M.metal,
    map: M.tex ? pattern(M.tex) : null,
    side: THREE.DoubleSide,
  })
}

// a small preview of each material for the buttons: its colour with a hint of the pattern
export const swatchOf = (mat, colour) => {
  const c = colour ?? MATERIALS[mat].colour
  const tex = MATERIALS[mat].tex
  if (tex === 'wood') return `repeating-linear-gradient(0deg, ${c} 0 4px, rgba(0,0,0,.25) 4px 5px), ${c}`
  if (tex === 'brushed') return `repeating-linear-gradient(0deg, ${c} 0 1px, rgba(0,0,0,.08) 1px 2px), ${c}`
  if (tex) return `radial-gradient(rgba(0,0,0,.25) 1px, transparent 1.5px) 0 0 / 5px 5px, ${c}`
  return c
}
