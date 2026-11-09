import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { GARAGES, BY_ID, MODULE } from './garages.js'
import { TITLE, EMPTY_COLOR } from './titles.js'

// Map metres (east, north) become three.js (x = east, y = up, z = south).
const HOME = [-92, 80, -104]
const TARGET = [-3, 0, -5]
const GAP = 0.18 // the seam between two separate garages, in metres
const box = new THREE.BoxGeometry(1, 1, 1)
const dummy = new THREE.Object3D()
const tint = new THREE.Color()
const PICK = new THREE.Color('#ff7a1a')

function inside([x, y], ring) {
  let hit = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit
  }
  return hit
}
const centre = (ring) => ring.reduce((a, p) => [a[0] + p[0] / ring.length, a[1] + p[1] / ring.length], [0, 0])

function prism(ring, h) {
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(ring.map(([x, y]) => new THREE.Vector2(x, y))), { depth: h, bevelEnabled: false })
  g.rotateX(-Math.PI / 2)
  return g
}
function flat(ring, y) {
  const g = new THREE.ShapeGeometry(new THREE.Shape(ring.map(([a, b]) => new THREE.Vector2(a, b))))
  g.rotateX(-Math.PI / 2)
  g.translate(0, y, 0)
  return g
}
function ribbon(lines, width, y) {
  const pos = []
  for (const line of lines)
    for (let i = 0; i + 1 < line.length; i++) {
      const [ax, ay] = line[i]
      const [bx, by] = line[i + 1]
      const L = Math.hypot(bx - ax, by - ay) || 1
      const nx = (-(by - ay) / L) * (width / 2)
      const ny = ((bx - ax) / L) * (width / 2)
      const P = [[ax + nx, ay + ny], [ax - nx, ay - ny], [bx - nx, by - ny], [bx + nx, by + ny]].map(([x, n]) => [x, y, -n])
      pos.push(...P[0], ...P[1], ...P[2], ...P[0], ...P[2], ...P[3])
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.computeVertexNormals()
  return g
}

// Streets, paths, green and the surrounding buildings. The mapped garages of the site are left out: our boxes replace them.
function Context({ site }) {
  const geo = useMemo(() => {
    const build = (test) => {
      const list = site.buildings.filter(test).map((b) => prism(b.p, b.h))
      return list.length ? mergeGeometries(list) : null
    }
    const area = (kind, y) => {
      const list = site.areas.filter((a) => a.kind === kind).map((a) => flat(a.p, y))
      return list.length ? mergeGeometries(list) : null
    }
    const by = (k) => site.lines.filter((l) => l.kind === k).map((l) => l.p)
    return {
      home: build((b) => b.kind === 'home'),
      other: build((b) => b.kind === 'other'),
      garage: build((b) => b.kind === 'garage' && !inside(centre(b.p), site.site)),
      green: area('green', -0.16),
      parking: area('parking', -0.14),
      site: flat(site.site, -0.1),
      road: ribbon(by('road'), 7, -0.08),
      lane: ribbon(by('lane'), 3.2, -0.09),
      path: ribbon(by('path'), 1.6, -0.07),
      tram: ribbon(by('tram'), 1.6, -0.06),
    }
  }, [site])
  const m = (g, color, double) =>
    g && (
      <mesh geometry={g} receiveShadow castShadow={double === 'cast'}>
        <meshStandardMaterial color={color} side={double === true ? THREE.DoubleSide : THREE.FrontSide} />
      </mesh>
    )
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]} receiveShadow>
        <planeGeometry args={[1400, 1400]} />
        <meshStandardMaterial color="#e8e5dc" />
      </mesh>
      {m(geo.green, '#c4d4a8')}
      {m(geo.parking, '#d2d0ca')}
      {m(geo.site, '#d9d3c3')}
      {m(geo.road, '#b1b0ac', true)}
      {m(geo.lane, '#c6c3ba', true)}
      {m(geo.path, '#f1eee6', true)}
      {m(geo.tram, '#b5484a', true)}
      {m(geo.home, '#f3f1ec', 'cast')}
      {m(geo.other, '#dfe2e5', 'cast')}
      {m(geo.garage, '#cfccc4', 'cast')}
    </group>
  )
}

// Where each garage box sits. Seams are left out where a garage is locked to its neighbour, so a block reads as one piece.
function shapes(block) {
  const same = (a, b) => b && block[a] && block[a] === block[b]
  return GARAGES.map((g) => {
    const gl = same(g.id, g.prev) ? 0 : GAP / 2
    const gr = same(g.id, g.next) ? 0 : GAP / 2
    const gb = same(g.id, g.back) ? 0 : GAP / 2
    const along = (gl - gr) / 2
    const out = gb / 2
    return {
      x: g.x + g.u[0] * along + g.n[0] * out,
      y: g.y + g.u[1] * along + g.n[1] * out,
      w: MODULE.width - gl - gr,
      d: MODULE.depth - gb,
    }
  })
}

function Garages({ title, block, picked, onPick }) {
  const body = useRef()
  const door = useRef()
  const placed = useMemo(() => shapes(block), [block])
  useLayoutEffect(() => {
    GARAGES.forEach((g, i) => {
      const s = placed[i]
      const t = title[g.id]
      tint.set(t ? TITLE[t].color : EMPTY_COLOR)
      if (picked.has(g.id)) tint.lerp(PICK, 0.55)
      dummy.position.set(s.x, MODULE.height / 2, -s.y)
      dummy.rotation.set(0, g.angle, 0)
      dummy.scale.set(s.w, MODULE.height, s.d)
      dummy.updateMatrix()
      body.current.setMatrixAt(i, dummy.matrix)
      body.current.setColorAt(i, tint)
      // the door: a darker panel on the front face
      const f = MODULE.depth / 2 + 0.03
      dummy.position.set(g.x + g.n[0] * f, 1.2, -(g.y + g.n[1] * f))
      dummy.scale.set(2.5, 2.4, 0.06)
      dummy.updateMatrix()
      door.current.setMatrixAt(i, dummy.matrix)
      door.current.setColorAt(i, tint.multiplyScalar(0.72))
    })
    for (const m of [body.current, door.current]) {
      m.instanceMatrix.needsUpdate = true
      m.instanceColor.needsUpdate = true
      m.computeBoundingSphere()
    }
  }, [placed, title, picked])
  const click = (e) => {
    e.stopPropagation()
    if (e.delta > 6) return // that was a drag to turn the view, not a click
    onPick(GARAGES[e.instanceId].id, e.shiftKey || e.ctrlKey || e.metaKey)
  }
  const over = () => (document.body.style.cursor = 'pointer')
  const out = () => (document.body.style.cursor = '')
  return (
    <>
      <instancedMesh ref={body} args={[box, null, GARAGES.length]} castShadow receiveShadow onClick={click} onPointerOver={over} onPointerOut={out}>
        <meshStandardMaterial roughness={0.8} />
      </instancedMesh>
      <instancedMesh ref={door} args={[box, null, GARAGES.length]} onClick={click}>
        <meshStandardMaterial roughness={0.6} />
      </instancedMesh>
    </>
  )
}

// Moves the titles (ordinary page elements over the 3D view) to follow the camera,
// and hides any that would overlap one already shown. Zoom in to see them all.
function LabelTracker({ items, refs }) {
  const { camera, size } = useThree()
  const v = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    const placed = []
    items.forEach((item, i) => {
      const el = refs.current[i]
      if (!el) return
      v.set(item.p[0], item.p[1], item.p[2]).project(camera)
      const x = ((v.x + 1) / 2) * size.width
      const y = ((1 - v.y) / 2) * size.height
      if (!el._w) {
        el.style.visibility = 'hidden'
        el.style.display = ''
        el._w = el.offsetWidth
        el._h = el.offsetHeight
        el.style.visibility = ''
      }
      const r = [x - el._w / 2 - 2, y - el._h / 2 - 1, x + el._w / 2 + 2, y + el._h / 2 + 1]
      const clash = v.z > 1 || placed.some((q) => r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1])
      if (clash) {
        el.style.display = 'none'
        return
      }
      placed.push(r)
      el.style.display = ''
      el.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`
    })
  })
  return null
}

function Camera({ view }) {
  const { camera, controls } = useThree()
  useEffect(() => {
    if (!controls || !view) return
    camera.position.set(...(view.name === 'plan' ? [-3, 165, -4.99] : HOME))
    controls.target.set(...TARGET)
    controls.update()
  }, [view, camera, controls])
  return null
}

// One title per locked block, or per single garage. Selected ones first, so they are never hidden.
function useItems({ title, block, picked, labels }) {
  return useMemo(() => {
    if (labels === 'off') return []
    const groups = new Map()
    for (const g of GARAGES) {
      const k = block[g.id] ?? g.id
      if (!groups.has(k)) groups.set(k, [])
      groups.get(k).push(g)
    }
    const list = []
    for (const [k, gs] of groups) {
      // in front of the doors, just above the roof
      const p = gs.reduce((a, g) => [a[0] + (g.x + g.n[0] * 3.6) / gs.length, a[1] + (g.y + g.n[1] * 3.6) / gs.length], [0, 0])
      const t = title[gs[0].id]
      const ids = gs.map((g) => g.id)
      const isBlock = gs.length > 1
      const name = labels === 'numbers' ? (isBlock ? `${ids[0]} … ${ids.at(-1)}` : gs[0].id) : t ? TITLE[t].name : isBlock ? 'NO TITLE' : gs[0].id
      list.push({
        key: `${k}|${name}|${gs.length}`,
        first: ids[0],
        p: [p[0], MODULE.height + 1.1, -p[1]],
        text: isBlock ? `${name} ×${gs.length}` : name,
        color: t ? TITLE[t].color : null,
        empty: !t || labels === 'numbers',
        block: isBlock,
        sel: ids.some((id) => picked.has(id)),
        rank: (ids.some((id) => picked.has(id)) ? 0 : 3) + (isBlock ? 0 : 1) + (t ? 0 : 1),
      })
    }
    return list.sort((a, b) => a.rank - b.rank || BY_ID[a.first].i - BY_ID[b.first].i)
  }, [title, block, picked, labels])
}

export default function Scene({ site, title, block, picked, onPick, onClear, labels, view }) {
  const items = useItems({ title, block, picked, labels })
  const refs = useRef([])
  const down = useRef([0, 0])
  return (
    <div
      className="canvas-wrap"
      onPointerDown={(e) => (down.current = [e.clientX, e.clientY])}
    >
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: HOME, fov: 36, near: 1, far: 3000 }}
        gl={{ preserveDrawingBuffer: true }}
        onPointerMissed={(e) => {
          if (Math.hypot(e.clientX - down.current[0], e.clientY - down.current[1]) < 6) onClear()
        }}
      >
        <color attach="background" args={['#eef3f5']} />
        <hemisphereLight args={['#ffffff', '#c9c3b5', 1.15]} />
        <directionalLight
          position={[180, 260, 160]}
          intensity={2.4}
          color="#fff6e6"
          castShadow
          shadow-mapSize={[4096, 4096]}
          shadow-camera-left={-150}
          shadow-camera-right={150}
          shadow-camera-top={150}
          shadow-camera-bottom={-150}
          shadow-camera-far={900}
          shadow-bias={-0.0006}
          shadow-normalBias={0.05}
        />
        <Context site={site} />
        <Garages title={title} block={block} picked={picked} onPick={onPick} />
        <OrbitControls makeDefault target={TARGET} maxPolarAngle={Math.PI / 2.05} minDistance={6} maxDistance={600} />
        <Camera view={view} />
        <LabelTracker items={items} refs={refs} />
      </Canvas>
      <div className="labels">
        {items.map((it, i) => (
          <button
            key={it.key}
            ref={(el) => (refs.current[i] = el)}
            className={['tag', it.empty && 'empty', it.block && 'block', it.sel && 'sel'].filter(Boolean).join(' ')}
            style={{ '--c': it.color ?? '#b9b4a9' }}
            onClick={(e) => onPick(it.first, e.shiftKey || e.ctrlKey || e.metaKey)}
          >
            {it.text}
          </button>
        ))}
      </div>
    </div>
  )
}
