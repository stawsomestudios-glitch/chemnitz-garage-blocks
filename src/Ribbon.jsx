import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { RIBBON_KINDS } from './ribbon.js'
import { MATERIALS, lookOf, makeMaterial } from './materials.js'

const PICKED = '#5b9bff' // a lighter, brighter blue for the pieces you picked

// A ribbon. Each piece is drawn in its material and colour (its own, or the ribbon's). Click it to pick the piece under the pointer.
export default function Ribbon({ built, rib, chosen, onPickPiece, connecting, layer = 'Ribbon' }) {
  const { geo, piece, parts } = built
  // the look of every piece; the flat rest after the last piece looks like the ribbon
  const looks = useMemo(() => {
    const out = { [-1]: lookOf(null, rib) }
    rib.pieces.forEach((p, i) => (out[i] = lookOf(p, rib)))
    return out
  }, [rib])
  // names for the Rhino file: each piece is saved as its own object, e.g. "26 LOOKOUT, light wood"
  const names = useMemo(
    () =>
      Object.fromEntries(
        parts.filter((p) => p.i >= 0).map((p) => [p.i, `${p.i + 1} ${RIBBON_KINDS[p.kind].name}${p.flip ? ' (flipped)' : ''}${looks[p.i].mat !== 'painted' ? ', ' + MATERIALS[looks[p.i].mat].name.toLowerCase() : ''}`]),
      ),
    [parts, looks],
  )
  // The triangles are sorted by look, so the mesh can carry one material per look (picked pieces get the light blue).
  const materials = useMemo(() => {
    const on = new Set(chosen)
    const keyOf = (i) => (on.has(i) ? 'picked' : `${looks[i]?.mat ?? 'painted'}|${looks[i]?.colour ?? ''}`)
    const src = geo.index.array
    const groups = new Map()
    for (let t = 0; t < src.length; t += 3) {
      const k = keyOf(piece[src[t]])
      if (!groups.has(k)) groups.set(k, [])
      groups.get(k).push(t)
    }
    const index = new Uint32Array(src.length)
    let n = 0
    geo.clearGroups()
    const mats = []
    for (const [k, tris] of groups) {
      geo.addGroup(n, tris.length * 3, mats.length)
      for (const t of tris) {
        index[n++] = src[t]
        index[n++] = src[t + 1]
        index[n++] = src[t + 2]
      }
      const [mat, colour] = k === 'picked' ? ['painted', PICKED] : k.split('|')
      mats.push(makeMaterial(mat, colour))
    }
    geo.setIndex(new THREE.BufferAttribute(index, 1))
    return mats
  }, [geo, piece, chosen, looks])
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials])
  useEffect(() => () => geo.dispose(), [geo])
  // for the Rhino file: the colour of each piece
  const colours = useMemo(() => Object.fromEntries(Object.entries(looks).map(([i, l]) => [i, l.colour])), [looks])
  return (
    <mesh
      geometry={geo}
      material={materials}
      castShadow
      receiveShadow
      userData={{ stack: true, layer, pieces: { piece, names, colours, colour: looks[-1].colour } }}
      onClick={(e) => {
        if (connecting) return
        e.stopPropagation()
        if (e.delta > 6 || !e.face) return
        onPickPiece(piece[e.face.a], e.shiftKey || e.ctrlKey || e.metaKey)
      }}
      onPointerOver={() => (document.body.style.cursor = connecting ? '' : 'pointer')}
      onPointerOut={() => (document.body.style.cursor = '')}
    />
  )
}
