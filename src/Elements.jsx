import { useMemo, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { KINDS, carColour, carParts, snapPoint } from './elements.js'
import { TITLE } from './titles.js'

const PI = Math.PI
const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 20),
  ball: new THREE.SphereGeometry(0.5, 20, 14),
  cone: new THREE.ConeGeometry(0.5, 1, 24),
}
const GROUND = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
const up = new THREE.Vector3()
const darker = (hex) => '#' + new THREE.Color(hex).multiplyScalar(0.72).getHexString()

// Finds where a ray from the pointer lands: on a roof or block top if there is one under it, otherwise on the ground.
// Returns [east, north, height] in metres, or null.
export function landing(scene, raycaster, skip) {
  const targets = []
  scene.traverse((o) => {
    if (o.userData.stack && o.visible && (!skip || o.userData.item !== skip)) targets.push(o)
  })
  const hit = raycaster.intersectObjects(targets, false).find((h) => h.face && up.copy(h.face.normal).transformDirection(h.object.matrixWorld).y > 0.7)
  if (hit) return [hit.point.x, -hit.point.z, Math.round(hit.point.y * 100) / 100]
  const p = new THREE.Vector3()
  return raycaster.ray.intersectPlane(GROUND, p) ? [p.x, -p.z, 0] : null
}

export function Parts({ parts, item }) {
  return parts.map((p, i) => (
    <mesh key={i} geometry={GEO[p.g]} position={p.p} scale={p.s} rotation={p.r ?? [0, 0, 0]} castShadow={!p.o} receiveShadow userData={{ stack: !!p.stack, item }}>
      <meshStandardMaterial color={p.c} roughness={p.rough ?? 0.8} transparent={!!p.o} opacity={p.o ?? 1} side={p.o ? THREE.DoubleSide : THREE.FrontSide} />
    </mesh>
  ))
}

export function colourOf(it) {
  if (it.title && TITLE[it.title]) return TITLE[it.title].color
  return KINDS[it.kind].colour ?? carColour(it.id)
}

function partsOf(it) {
  const c = colourOf(it)
  return KINDS[it.kind].parts(c).map((p) => (p.c === 'door' ? { ...p, c: darker(c) } : p))
}

// A garage set to CAR GARAGE: walls and roof with the door open, and a car parked inside.
export function CarGarage({ g, s, colour, sel, onPick }) {
  const w = s.w
  const d = s.d
  const t = 0.12
  const c = sel ? '#' + new THREE.Color(colour).lerp(new THREE.Color('#ff7a1a'), 0.55).getHexString() : colour
  const parts = useMemo(
    () => [
      { g: 'box', p: [0, 3 - t / 2, 0], s: [w, t, d], c, stack: true },
      { g: 'box', p: [-(w / 2 - t / 2), 1.5, 0], s: [t, 3, d], c },
      { g: 'box', p: [w / 2 - t / 2, 1.5, 0], s: [t, 3, d], c },
      { g: 'box', p: [0, 1.5, -(d / 2 - t / 2)], s: [w, 3, t], c },
      { g: 'box', p: [0, 0.02, 0], s: [w - 0.1, 0.04, d - 0.1], c: '#a7a39a' },
    ],
    [w, d, c],
  )
  const car = useMemo(() => carParts(carColour(g.id)), [g.id])
  return (
    <group
      position={[s.x, 0, -s.y]}
      rotation={[0, Math.atan2(g.n[0], -g.n[1]), 0]}
      onClick={(e) => {
        e.stopPropagation()
        if (e.delta <= 6) onPick(g.id, e.shiftKey || e.ctrlKey || e.metaKey)
      }}
    >
      <Parts parts={parts} />
      <group position={[0, 0.04, -0.4]}>
        <Parts parts={car} />
      </group>
    </group>
  )
}

// All the elements you have added. Press on one to select it, then drag to move it.
export function Elements({ items, picked, onSelect, onMove, snap }) {
  const { controls, scene, camera } = useThree()
  const rc = useMemo(() => new THREE.Raycaster(), [])
  const drag = useRef(null)
  const end = (e) => {
    if (!drag.current) return
    drag.current = null
    e.target.releasePointerCapture?.(e.pointerId)
    if (controls) controls.enabled = true
  }
  return items.map((it) => {
    const k = KINDS[it.kind]
    return (
      <group
        key={it.id}
        position={[it.x, it.z, -it.y]}
        rotation={[0, (it.rot * PI) / 180, 0]}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => {
          e.stopPropagation()
          onSelect(it.id, e.shiftKey || e.ctrlKey || e.metaKey)
          if (e.button !== 0) return
          rc.ray.copy(e.ray)
          rc.camera = camera
          const p = landing(scene, rc, it.id) ?? [it.x, it.y, it.z]
          drag.current = { id: it.id, dx: it.x - p[0], dy: it.y - p[1] }
          e.target.setPointerCapture(e.pointerId)
          if (controls) controls.enabled = false
        }}
        onPointerMove={(e) => {
          if (drag.current?.id !== it.id) return
          e.stopPropagation()
          rc.ray.copy(e.ray)
          rc.camera = camera
          const p = landing(scene, rc, it.id)
          if (!p) return
          let x = p[0] + drag.current.dx
          let y = p[1] + drag.current.dy
          if (snap) [x, y] = snapPoint(x, y)
          onMove(it.id, { x, y, z: p[2] })
        }}
        onPointerUp={end}
        onPointerCancel={end}
        onPointerOver={() => (document.body.style.cursor = 'grab')}
        onPointerOut={() => (document.body.style.cursor = '')}
      >
        <Parts parts={partsOf(it)} item={it.id} />
        {picked.has(it.id) && (
          <mesh position={[0, 0.04, 0]} rotation={[-PI / 2, 0, 0]} renderOrder={3}>
            <planeGeometry args={[k.w + 0.6, k.d + 0.6]} />
            <meshBasicMaterial color="#ff7a1a" transparent opacity={0.45} depthWrite={false} />
          </mesh>
        )}
      </group>
    )
  })
}

// Lets the page outside the 3D view ask where a screen point lands, and where the middle of the view is.
export function ViewApi({ api }) {
  const { camera, gl, controls, scene } = useThree()
  const rc = useMemo(() => new THREE.Raycaster(), [])
  api.current = {
    landAt(clientX, clientY) {
      const r = gl.domElement.getBoundingClientRect()
      rc.setFromCamera(new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1), camera)
      return landing(scene, rc)
    },
    centre() {
      return controls ? [controls.target.x, -controls.target.z, 0] : [0, 0, 0]
    },
  }
  return null
}
