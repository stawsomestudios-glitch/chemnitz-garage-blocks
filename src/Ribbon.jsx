import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { COBALT } from './ribbon.js'

const BASE = new THREE.Color(COBALT)
const PICKED = new THREE.Color(COBALT).lerp(new THREE.Color('#ffffff'), 0.45)

// The cobalt ribbon. Click it to pick the piece under the pointer.
export default function Ribbon({ built, chosen, onPickPiece, connecting }) {
  const { geo, piece } = built
  // colour every vertex: cobalt, and lighter for the piece you picked
  const colours = useMemo(() => {
    const c = new Float32Array(piece.length * 3)
    for (let v = 0; v < piece.length; v++) {
      const col = piece[v] === chosen ? PICKED : BASE
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
      userData={{ stack: true }}
      onClick={(e) => {
        if (connecting) return
        e.stopPropagation()
        if (e.delta > 6 || !e.face) return
        onPickPiece(piece[e.face.a])
      }}
      onPointerOver={() => (document.body.style.cursor = connecting ? '' : 'pointer')}
      onPointerOut={() => (document.body.style.cursor = '')}
    >
      <meshStandardMaterial vertexColors roughness={0.75} side={THREE.DoubleSide} />
    </mesh>
  )
}
