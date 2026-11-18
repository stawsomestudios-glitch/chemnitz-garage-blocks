import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { COBALT, RIBBON_KINDS } from './ribbon.js'

const BASE = new THREE.Color(COBALT)
const PICKED = new THREE.Color('#5b9bff') // a lighter, brighter blue for the piece you picked

// The cobalt ribbon. Click it to pick the piece under the pointer.
export default function Ribbon({ built, chosen, onPickPiece, connecting }) {
  const { geo, piece, parts } = built
  // names for the Rhino file: each piece is saved as its own object, e.g. "26 LOOKOUT"
  const names = useMemo(() => Object.fromEntries(parts.filter((p) => p.i >= 0).map((p) => [p.i, `${p.i + 1} ${RIBBON_KINDS[p.kind].name}${p.flip ? ' (flipped)' : ''}`])), [parts])
  // colour every vertex: cobalt, and lighter for the pieces you picked
  const colours = useMemo(() => {
    const on = new Set(chosen)
    const c = new Float32Array(piece.length * 3)
    for (let v = 0; v < piece.length; v++) {
      const col = on.has(piece[v]) ? PICKED : BASE
      c[v * 3] = col.r
      c[v * 3 + 1] = col.g
      c[v * 3 + 2] = col.b
    }
    return new THREE.BufferAttribute(c, 3)
  }, [piece, chosen])
  geo.setAttribute('color', colours)
  useEffect(() => () => geo.dispose(), [geo])
  return (
    <mesh
      geometry={geo}
      castShadow
      receiveShadow
      userData={{ stack: true, layer: 'Ribbon', pieces: { piece, names, colour: COBALT } }}
      onClick={(e) => {
        if (connecting) return
        e.stopPropagation()
        if (e.delta > 6 || !e.face) return
        onPickPiece(piece[e.face.a], e.shiftKey || e.ctrlKey || e.metaKey)
      }}
      onPointerOver={() => (document.body.style.cursor = connecting ? '' : 'pointer')}
      onPointerOut={() => (document.body.style.cursor = '')}
    >
      <meshStandardMaterial vertexColors roughness={0.75} side={THREE.DoubleSide} />
    </mesh>
  )
}
