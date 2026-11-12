import { useLayoutEffect, useMemo, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { GARAGE_POINTS, KINDS, carColour, carParts, dims, localAnchors, magnet, snapPoint, toWorld } from './elements.js'
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
export function CarGarage({ g, s, colour, sel, onPick, connecting }) {
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
        if (connecting) return // let the click reach the connect dots
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
export function Elements({ items, picked, onSelect, onMove, snap, connecting }) {
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
    const size = dims(it)
    return (
      <group
        key={it.id}
        position={[it.x, it.z, -it.y]}
        rotation={[0, (it.rot * PI) / 180, 0]}
        onClick={(e) => !connecting && e.stopPropagation()}
        onPointerDown={(e) => {
          if (connecting) return // let the click reach the connect dots
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
          let z = p[2]
          if (snap === 'grid') [x, y] = snapPoint(x, y)
          if (snap === 'points') {
            const others = items.filter((o) => o.id !== it.id).flatMap((o) => localAnchors(o).map((a) => toWorld(o, a)))
            const m = magnet({ ...it, x, y, z }, [...GARAGE_POINTS, ...others])
            if (m) ({ x, y, z } = m)
          }
          onMove(it.id, { x, y, z })
        }}
        onPointerUp={end}
        onPointerCancel={end}
        onPointerOver={() => (document.body.style.cursor = connecting ? '' : 'grab')}
        onPointerOut={() => (document.body.style.cursor = '')}
      >
        {/* stretched to the size you set */}
        <group scale={[size.w / k.w, size.h / k.h, size.d / k.d]}>
          <Parts parts={partsOf(it)} item={it.id} />
        </group>
        {picked.has(it.id) && (
          <mesh position={[0, 0.04, 0]} rotation={[-PI / 2, 0, 0]} renderOrder={3}>
            <planeGeometry args={[size.w + 0.6, size.d + 0.6]} />
            <meshBasicMaterial color="#ff7a1a" transparent opacity={0.45} depthWrite={false} />
          </mesh>
        )}
      </group>
    )
  })
}

// Small balls you click to connect one point to another.
const DOT = new THREE.SphereGeometry(1, 12, 8)
const dotDummy = new THREE.Object3D()
function Dots({ points, color, size, onTop, onPick }) {
  const ref = useRef()
  useLayoutEffect(() => {
    const m = ref.current
    points.forEach((p, i) => {
      dotDummy.position.set(p[0], p[2], -p[1])
      dotDummy.scale.setScalar(size)
      dotDummy.updateMatrix()
      m.setMatrixAt(i, dotDummy.matrix)
    })
    m.count = points.length
    m.instanceMatrix.needsUpdate = true
    m.computeBoundingSphere()
  }, [points, size])
  return (
    <instancedMesh
      key={points.length}
      ref={ref}
      args={[DOT, null, Math.max(points.length, 1)]}
      renderOrder={6}
      onClick={(e) => {
        e.stopPropagation()
        if (e.delta <= 6) onPick(e.instanceId)
      }}
      onPointerOver={() => (document.body.style.cursor = 'crosshair')}
      onPointerOut={() => (document.body.style.cursor = '')}
    >
      <meshBasicMaterial color={color} depthTest={!onTop} transparent opacity={0.95} />
    </instancedMesh>
  )
}

// Step 1: orange dots on the selected element; click the one to hold it by.
// Step 2: blue dots on every garage and other element; click where that point should go.
export function ConnectDots({ connect, items, onGrip, onTarget }) {
  const it = items.find((i) => i.id === connect?.id)
  const level = connect?.level ?? 'bottom'
  const grips = useMemo(() => {
    if (!it) return []
    const h = dims(it).h
    return localAnchors(it).filter(([, y]) => (level === 'bottom' ? y === 0 : level === 'top' ? y === h : y !== 0 && y !== h))
  }, [it, level])
  const gripWorld = useMemo(() => grips.map((g) => toWorld(it, g)), [grips, it])
  const targets = useMemo(() => {
    if (!it || connect.stage !== 'target') return []
    const others = items.filter((o) => o.id !== it.id).flatMap((o) => localAnchors(o).map((a) => toWorld(o, a)))
    const all = [...GARAGE_POINTS, ...others]
    return connect.ground ? all.filter((t) => t[2] < 0.05) : all
  }, [items, it, connect])
  if (!it) return null
  if (connect.stage === 'grip') return <Dots points={gripWorld} color="#ff7a1a" size={0.3} onTop onPick={(i) => onGrip(grips[i])} />
  const held = toWorld(it, connect.grip)
  return (
    <>
      <Dots points={[held]} color="#ff7a1a" size={0.38} onTop onPick={() => {}} />
      <Dots points={targets} color="#1f6fd1" size={0.26} onPick={(i) => onTarget(targets[i])} />
    </>
  )
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
