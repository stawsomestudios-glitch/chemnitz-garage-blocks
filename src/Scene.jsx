import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Line, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { GARAGES, BY_ID, MODULE } from './garages.js'
import { TITLE } from './titles.js'
import { CarGarage, ConnectDots, Elements, ViewApi } from './Elements.jsx'
import { KINDS, dims } from './elements.js'
import Ribbon from './Ribbon.jsx'
import { ground, seatBuilding, terrainMesh, topoOn } from './terrain.js'
import { COBALT, RIBBON_KINDS, buildRibbon, passages } from './ribbon.js'

// is this label on an added element (not a garage)?
const KINDS_BY_ITEM = (items, id) => items.some((it) => it.id === id)

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
function Context({ site, look, topo }) {
  const geo = useMemo(() => {
    const build = (test) => {
      const list = site.buildings.filter(test).map((b) => seatBuilding(prism(b.p, b.h), b.p, b.h))
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
  }, [site, topo]) // eslint-disable-line react-hooks/exhaustive-deps
  // the real ground, with the map painted on it (redrawn when the colours change)
  const land = useMemo(() => (topoOn() ? terrainMesh(site, look) : null), [site, look, topo]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => {
    land?.geo.dispose()
    land?.tex.dispose()
  }, [land])
  // flat styles (Nolli) show the map as a printed plan: pure colours, no light and shade
  const m = (g, color, double, layer) =>
    g && (
      <mesh geometry={g} receiveShadow castShadow={double === 'cast' && look.shadows} userData={{ layer: `Context - ${layer}` }}>
        {look.flat ? (
          <meshBasicMaterial color={color} toneMapped={false} side={double === true ? THREE.DoubleSide : THREE.FrontSide} />
        ) : (
          <meshStandardMaterial color={color} side={double === true ? THREE.DoubleSide : THREE.FrontSide} />
        )}
      </mesh>
    )
  return (
    <group>
      {land && (
        <mesh geometry={land.geo} receiveShadow userData={{ stack: true, layer: 'Context - terrain' }}>
          {look.flat ? <meshBasicMaterial map={land.tex} toneMapped={false} /> : <meshStandardMaterial map={land.tex} roughness={0.95} />}
        </mesh>
      )}
      {!land && <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]} receiveShadow userData={{ layer: 'Context - ground' }}>
        <planeGeometry args={[1400, 1400]} />
        {look.flat ? <meshBasicMaterial color={look.ground} toneMapped={false} /> : <meshStandardMaterial color={look.ground} />}
      </mesh>
      {m(geo.green, look.green, false, 'green')}
      {m(geo.parking, look.parking, false, 'parking')}
      {m(geo.site, look.site, false, 'garage site')}
      {m(geo.road, look.road, true, 'streets')}
      {m(geo.lane, look.lane, true, 'lanes')}
      {m(geo.path, look.path, true, 'footpaths')}
      {m(geo.tram, look.tram, true, 'tram')}
      </>}
      {m(geo.home, look.home, 'cast', 'homes')}
      {m(geo.other, look.other, 'cast', 'other buildings')}
      {m(geo.garage, look.garage, 'cast', 'other garages')}
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

// Solid garages, their doors, and see-through garages (titles marked `clear`) are three separate sets.
// A garage the ribbon runs through: cleared inside, so only its roof and the outer walls the ribbon doesn't pass stay.
function Passages({ pass, look, topo }) {
  const parts = useMemo(() => {
    const out = []
    const t = 0.15
    const H = MODULE.height
    for (const id of pass.ids) {
      const g = BY_ID[id]
      const open = pass.open[id] ?? new Set()
      const at = (a, b) => [g.x + g.u[0] * a + g.n[0] * b, g.y + g.u[1] * a + g.n[1] * b]
      const add = (a, b, y, size) => out.push({ p: at(a, b), y, size, angle: g.angle, id })
      out.push({ p: at(0, 0), y: H - 0.06, size: [MODULE.width, 0.12, MODULE.depth], angle: g.angle, roof: true, id }) // see-through roof, so the ribbon inside shows
      const keep = (face, nb) => !open.has(face) && !(nb && pass.ids.has(nb))
      if (keep('front')) add(0, 3 - t / 2, H / 2, [MODULE.width, H, t])
      if (keep('back', g.back)) add(0, -3 + t / 2, H / 2, [MODULE.width, H, t])
      if (keep('left', g.prev)) add(-1.5 + t / 2, 0, H / 2, [t, H, MODULE.depth])
      if (keep('right', g.next)) add(1.5 - t / 2, 0, H / 2, [t, H, MODULE.depth])
    }
    return out
  }, [pass])
  return parts.map((q, i) => (
    <mesh key={i} position={[q.p[0], q.y + ground(BY_ID[q.id].x, BY_ID[q.id].y), -q.p[1]]} rotation={[0, q.angle, 0]} scale={q.size} geometry={box} castShadow={!q.roof} receiveShadow userData={{ stack: true, layer: q.roof ? 'Garages - cleared, roofs' : 'Garages - cleared for the ribbon', name: q.id }} renderOrder={q.roof ? 2 : 0}>
      {q.roof ? (
        <meshStandardMaterial color="#cfe0f0" transparent opacity={0.35} depthWrite={false} roughness={0.1} />
      ) : (
        <meshStandardMaterial color={look.shell} roughness={0.85} />
      )}
    </mesh>
  ))
}

function Garages({ title, block, picked, onPick, connecting, pass, look, topo }) {
  const body = useRef()
  const door = useRef()
  const glass = useRef()
  const placed = useMemo(() => shapes(block), [block])
  const lists = useMemo(() => {
    const solid = []
    const clear = []
    const car = []
    GARAGES.forEach((g, i) => {
      if (pass?.ids.has(g.id)) return // cleared for the ribbon, drawn as a shell instead
      const t = TITLE[title[g.id]]
      ;(t?.clear ? clear : t?.car ? car : solid).push(i)
    })
    return { solid, clear, car }
  }, [title, pass])
  useLayoutEffect(() => {
    const put = (mesh, list, fn) => {
      list.forEach((i, k) => {
        fn(GARAGES[i], placed[i])
        dummy.updateMatrix()
        mesh.setMatrixAt(k, dummy.matrix)
        mesh.setColorAt(k, tint)
      })
      mesh.count = list.length
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      mesh.computeBoundingSphere()
    }
    const colour = (g) => {
      const t = title[g.id]
      tint.set(t ? TITLE[t].color : look.empty)
      if (picked.has(g.id)) tint.lerp(PICK, 0.55)
    }
    const shape = (g, s) => {
      colour(g)
      dummy.position.set(s.x, MODULE.height / 2 + ground(s.x, s.y), -s.y)
      dummy.rotation.set(0, g.angle, 0)
      dummy.scale.set(s.w, MODULE.height, s.d)
    }
    put(body.current, lists.solid, shape)
    put(glass.current, lists.clear, shape)
    // the door: a darker panel on the front face (see-through garages have none)
    const f = MODULE.depth / 2 + 0.03
    put(door.current, lists.solid, (g) => {
      colour(g)
      tint.multiplyScalar(0.72)
      dummy.position.set(g.x + g.n[0] * f, 1.2 + ground(g.x, g.y), -(g.y + g.n[1] * f))
      dummy.rotation.set(0, g.angle, 0)
      dummy.scale.set(2.5, 2.4, 0.06)
    })
  }, [placed, title, picked, lists, look, topo])
  const click = (list) => (e) => {
    if (connecting) return // let the click reach the connect dots
    e.stopPropagation()
    if (e.delta > 6) return // that was a drag to turn the view, not a click
    onPick(GARAGES[list[e.instanceId]].id, e.shiftKey || e.ctrlKey || e.metaKey)
  }
  // names for the Rhino file: garage number and title
  const names = (list, suffix = '') => list.map((i) => `${GARAGES[i].id}${title[GARAGES[i].id] ? ' ' + TITLE[title[GARAGES[i].id]].name : ''}${suffix}`)
  const over = () => (document.body.style.cursor = 'pointer')
  const out = () => (document.body.style.cursor = '')
  return (
    <>
      {lists.car.map((i) => (
        <CarGarage key={GARAGES[i].id} g={GARAGES[i]} s={placed[i]} colour={TITLE.car.color} sel={picked.has(GARAGES[i].id)} onPick={onPick} connecting={connecting} />
      ))}
      <instancedMesh ref={body} args={[box, null, GARAGES.length]} userData={{ stack: true, layer: 'Garages', names: names(lists.solid) }} castShadow receiveShadow onClick={click(lists.solid)} onPointerOver={over} onPointerOut={out}>
        <meshStandardMaterial roughness={0.8} />
      </instancedMesh>
      <instancedMesh ref={door} args={[box, null, GARAGES.length]} userData={{ layer: 'Garages - doors', names: names(lists.solid, ' door') }} onClick={click(lists.solid)}>
        <meshStandardMaterial roughness={0.6} />
      </instancedMesh>
      <instancedMesh ref={glass} args={[box, null, GARAGES.length]} userData={{ stack: true, layer: 'Garages - see-through', names: names(lists.clear) }} renderOrder={2} onClick={click(lists.clear)} onPointerOver={over} onPointerOut={out}>
        <meshStandardMaterial transparent opacity={0.22} depthWrite={false} side={THREE.DoubleSide} roughness={0.1} />
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

function Camera({ view, pieces }) {
  const { camera, controls } = useThree()
  useEffect(() => {
    if (!controls || !view) return
    // a saved view: back to exactly where the camera was and what it looked at
    if (view.name === 'saved') {
      const from = [camera.position.clone(), controls.target.clone()]
      const to = [new THREE.Vector3(...view.pos), new THREE.Vector3(...view.target)]
      const t0 = performance.now()
      let raf
      const step = () => {
        const k = Math.min(1, (performance.now() - t0) / 500)
        const e = k * k * (3 - 2 * k)
        camera.position.lerpVectors(from[0], to[0], e)
        controls.target.lerpVectors(from[1], to[1], e)
        controls.update()
        if (k < 1) raf = requestAnimationFrame(step)
      }
      step()
      return () => cancelAnimationFrame(raf)
    }
    // "Zoom to it": look at one ribbon piece from the south-west, close up
    const at = view.name === 'piece' ? pieces?.find((t) => t.i === view.i && t.rid === (view.rid ?? 'main'))?.p : null
    if (at) {
      camera.position.set(at[0] - 13, at[1] + 9, at[2] + 13)
      controls.target.set(at[0], Math.max(0.5, at[1] - 1.6), at[2])
      controls.update()
      return
    }
    // the Ribbon view looks from the south, high up, so the whole ribbon is in view
    const [pos, target] = view.name === 'plan' ? [[-3, 165, -4.99], TARGET] : view.name === 'ribbon' ? [[18, 300, 190], [18, 0, -30]] : [HOME, TARGET]
    camera.position.set(...pos)
    controls.target.set(...target)
    controls.update()
  }, [view, camera, controls]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

// One label per locked block, or per single garage, per ribbon piece and per labelled element. Selected ones first, so they are never hidden.
// show = { garages: 'titles' | 'numbers' | 'both' | 'off', ribbon: 'names' | 'numbers' | 'both' | 'off', elements: true | false }
// Your own texts: glabel (garage id -> text), piece.label on ribbon pieces, it.label on elements. `edit` says what a double-click changes.
function useItems({ title, block, picked, show, glabel, items, tags, chosen, active, pass, topo }) {
  return useMemo(() => {
    const list = []
    if (show.garages !== 'off') {
      const groups = new Map()
      for (const g of GARAGES) {
        if (pass?.ids.has(g.id)) continue // the ribbon's own tag names these
        const k = block[g.id] ?? g.id
        if (!groups.has(k)) groups.set(k, [])
        groups.get(k).push(g)
      }
      for (const [k, gs] of groups) {
        // in front of the doors, just above the roof
        const p = gs.reduce((a, g) => [a[0] + (g.x + g.n[0] * 3.6) / gs.length, a[1] + (g.y + g.n[1] * 3.6) / gs.length], [0, 0])
        const t = title[gs[0].id]
        const ids = gs.map((g) => g.id)
        const isBlock = gs.length > 1
        const own = glabel[ids[0]]
        const named = own || (t ? TITLE[t].name : null)
        const num = isBlock ? `${ids[0]} … ${ids.at(-1)}` : gs[0].id
        const mode = show.garages
        let text = mode === 'numbers' ? num : mode === 'both' ? (named ? `${num} · ${named}` : num) : (named ?? (isBlock ? 'NO TITLE' : num))
        if (isBlock && mode !== 'numbers') text += ` ×${gs.length}`
        list.push({
          key: `${k}|${text}`,
          first: ids[0],
          p: [p[0], MODULE.height + 1.1 + ground(p[0], p[1]), -p[1]],
          text,
          color: t ? TITLE[t].color : null,
          empty: (!t && !own) || mode === 'numbers',
          block: isBlock,
          sel: ids.some((id) => picked.has(id)),
          rank: (ids.some((id) => picked.has(id)) ? 0 : 3) + (isBlock ? 0 : 1) + (t || own ? 0 : 1),
          edit: { type: 'g', id: ids[0], text: own ?? '', usual: t ? TITLE[t].name : num },
        })
      }
    }
    // added elements with a title or a label of your own
    if (show.elements)
      for (const it of items) {
        const named = it.label || (it.title && TITLE[it.title] ? TITLE[it.title].name : null)
        if (!named) continue
        const sel = picked.has(it.id)
        const color = it.title && TITLE[it.title] ? TITLE[it.title].color : it.kind === 'rmod' ? COBALT : '#b9b4a9'
        list.push({ key: `${it.id}|${named}`, first: it.id, p: [it.x, it.z + dims(it).h + 1.1 + ground(it.x, it.y), -it.y], text: named, color, block: true, sel, rank: sel ? 0 : 2, order: 999, edit: { type: 'e', id: it.id, text: it.label ?? '', usual: it.title && TITLE[it.title] ? TITLE[it.title].name : KINDS[it.kind]?.name ?? '' } })
      }
    // the ribbons' pieces (flat path pieces stay unlabelled unless picked or named by you)
    if (show.ribbon !== 'off')
      for (const t of tags) {
        const sel = t.rid === active && chosen.includes(t.i)
        if (t.kind === 'gap' && !sel) continue
        const name = t.label || RIBBON_KINDS[t.kind].name
        const num = `${t.prefix ?? ''}${t.i + 1}`
        if (show.ribbon === 'names' && t.kind === 'path' && !t.label && !sel) continue
        const text = show.ribbon === 'numbers' ? num : show.ribbon === 'both' ? `${num} ${name}` : name
        list.push({ key: `rb${t.rid}|${t.i}|${text}`, piece: t.i, rid: t.rid, p: t.p, text, color: COBALT, ribbon: true, sel, rank: sel ? 0 : 2, order: 2000 + t.i, edit: { type: 'r', rid: t.rid, i: t.i, text: t.label ?? '', usual: RIBBON_KINDS[t.kind].name } })
      }
    const order = (x) => x.order ?? BY_ID[x.first].i
    return list.sort((a, b) => a.rank - b.rank || order(a) - order(b))
  }, [title, block, picked, show, glabel, items, tags, chosen, active, pass, topo])
}

// The magic wand: click the ground to add a point (Ctrl-click puts it into the nearest part of the line),
// drag a point to move it, Shift-click a point to take it out. The cobalt band shows the ribbon it will make.
const WAND_DOT = new THREE.SphereGeometry(1, 16, 10)
function Wand({ wand, onWand }) {
  const { controls, camera } = useThree()
  const dots = useRef([])
  // the points stay the same size on screen however far you zoom out, so they are easy to grab
  useFrame(() => {
    for (const [i, m] of dots.current.entries()) if (m) m.scale.setScalar(camera.position.distanceTo(m.position) * (i === 0 || i === wand.pts.length - 1 ? 0.011 : 0.0085))
  })
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), [])
  const hit = useMemo(() => new THREE.Vector3(), [])
  const drag = useRef(null)
  const pts = wand.pts
  const preview = useMemo(() => (pts.length >= 2 ? buildRibbon({ width: wand.width, pieces: [] }, pts, ground).geo : null), [pts, wand.width])
  useEffect(() => () => preview?.dispose(), [preview])
  // where the pointer meets the ground: on a slope, found in a few steps
  const onGround = (e) => {
    plane.constant = 0
    let p = null
    for (let k = 0; k < 4; k++) {
      if (!e.ray.intersectPlane(plane, hit)) return p
      p = [Math.round(hit.x * 100) / 100, Math.round(-hit.z * 100) / 100]
      plane.constant = -ground(p[0], p[1])
    }
    return p
  }
  const add = (e) => {
    if (e.delta > 6) return
    e.stopPropagation()
    const p = onGround(e)
    if (!p) return
    onWand((w) => {
      if (!(e.ctrlKey || e.metaKey || e.altKey) || w.pts.length < 2) return { ...w, pts: [...w.pts, p] }
      // into the nearest part of the line
      let best = 0
      let bd = Infinity
      for (let i = 0; i + 1 < w.pts.length; i++) {
        const [a, b] = [w.pts[i], w.pts[i + 1]]
        const dx = b[0] - a[0]
        const dy = b[1] - a[1]
        const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)))
        const d = Math.hypot(a[0] + dx * t - p[0], a[1] + dy * t - p[1])
        if (d < bd) [best, bd] = [i, d]
      }
      return { ...w, pts: [...w.pts.slice(0, best + 1), p, ...w.pts.slice(best + 1)] }
    })
  }
  const end = (e) => {
    if (drag.current == null) return
    drag.current = null
    e.target.releasePointerCapture?.(e.pointerId)
    if (controls) controls.enabled = true
  }
  return (
    <group userData={{ noExport: true }}>
      {/* catches clicks on the ground, also behind garages and roofs */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} onClick={add} userData={{ noExport: true }}>
        <planeGeometry args={[2000, 2000]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {preview && (
        <mesh geometry={preview} raycast={() => null} userData={{ noExport: true }}>
          <meshStandardMaterial color={COBALT} transparent opacity={0.55} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      )}
      {pts.length >= 2 && <Line points={pts.map(([x, y]) => [x, 0.25 + ground(x, y), -y])} color="#ff7a1a" lineWidth={2} dashed dashSize={0.8} gapSize={0.5} raycast={() => null} />}
      {(dots.current.length = pts.length, pts.map(([x, y], i) => (
        <mesh
          key={i}
          geometry={WAND_DOT}
          position={[x, 0.3 + ground(x, y), -y]}
          ref={(m) => (dots.current[i] = m)}
          renderOrder={5}
          userData={{ noExport: true }}
          onClick={(e) => {
            e.stopPropagation()
            // on the click, not the press: otherwise the click would land on the ground and add the point again
            if (e.shiftKey) onWand((w) => ({ ...w, pts: w.pts.filter((_, k) => k !== i) }))
          }}
          onPointerDown={(e) => {
            e.stopPropagation()
            if (e.shiftKey) return
            drag.current = i
            e.target.setPointerCapture(e.pointerId)
            if (controls) controls.enabled = false
          }}
          onPointerMove={(e) => {
            if (drag.current !== i) return
            e.stopPropagation()
            const p = onGround(e)
            if (p) onWand((w) => ({ ...w, pts: w.pts.map((q, k) => (k === i ? p : q)) }), true)
          }}
          onPointerUp={end}
          onPointerCancel={end}
          onPointerOver={() => (document.body.style.cursor = 'move')}
          onPointerOut={() => (document.body.style.cursor = '')}
        >
          <meshBasicMaterial color={i === 0 ? '#1f8a3c' : '#ff7a1a'} depthTest={false} />
        </mesh>
      )))}
    </group>
  )
}

export default function Scene({ site, title, block, picked, onPick, onClear, labels, view, items, onSelectItem, onMoveItem, onDropKind, snap, api, connect, onGrip, onTarget, ribbon, chosen, onPickPiece, look, drawn = [], active = 'main', wand, onWand, show, glabel = {}, onEditLabel, topo = 'flat' }) {
  const built = useMemo(() => (ribbon.on ? buildRibbon(ribbon, undefined, ground) : null), [ribbon, topo]) // eslint-disable-line react-hooks/exhaustive-deps
  // the ribbons you drew with the magic wand, each along its own line
  const builtDrawn = useMemo(() => drawn.map((d) => ({ d, built: buildRibbon(d, d.route, ground) })), [drawn, topo]) // eslint-disable-line react-hooks/exhaustive-deps
  const pass = ribbon.on ? passages() : null
  const allTags = useMemo(() => {
    const out = (built?.tags ?? []).map((t) => ({ ...t, rid: 'main', label: ribbon.pieces[t.i]?.label }))
    builtDrawn.forEach(({ d, built: b }, n) => b.tags.forEach((t) => out.push({ ...t, rid: d.id, label: d.pieces[t.i]?.label, prefix: `D${n + 1}.` })))
    return out
  }, [built, builtDrawn, ribbon.pieces])
  const tags = useItems({ title, block, picked, show, glabel, items, tags: allTags, chosen, active, pass, topo })
  const passive = !!connect || !!wand
  const refs = useRef([])
  const down = useRef([0, 0])
  return (
    <div
      className="canvas-wrap"
      onPointerDown={(e) => (down.current = [e.clientX, e.clientY])}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('text/kind')) e.preventDefault()
      }}
      onDrop={(e) => {
        const kind = e.dataTransfer.getData('text/kind')
        if (!KINDS[kind.split(':')[0]]) return
        e.preventDefault()
        const p = api.current?.landAt(e.clientX, e.clientY)
        if (p) onDropKind(kind, p)
      }}
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
        <color attach="background" args={[look.bg]} />
        <hemisphereLight args={look.hemi} />
        <directionalLight
          position={[180, 260, 160]}
          intensity={look.sun[1]}
          color={look.sun[0]}
          castShadow={look.shadows}
          shadow-mapSize={[4096, 4096]}
          shadow-camera-left={-150}
          shadow-camera-right={150}
          shadow-camera-top={150}
          shadow-camera-bottom={-150}
          shadow-camera-far={900}
          shadow-bias={-0.0006}
          shadow-normalBias={0.05}
        />
        <Context site={site} look={look} topo={topo} />
        <Garages title={title} block={block} picked={picked} onPick={onPick} connecting={passive} pass={pass} look={look} topo={topo} />
        {pass && <Passages pass={pass} look={look} topo={topo} />}
        {built && <Ribbon built={built} rib={ribbon} chosen={active === 'main' ? chosen : []} onPickPiece={(i, add) => onPickPiece(i, add, 'main')} connecting={passive} />}
        {builtDrawn.map(({ d, built: b }) => (
          <Ribbon key={d.id} built={b} rib={d} layer={`Ribbon - ${d.name}`} chosen={active === d.id ? chosen : []} onPickPiece={(i, add) => onPickPiece(i, add, d.id)} connecting={passive} />
        ))}
        {wand && <Wand wand={wand} onWand={onWand} />}
        <Elements items={items} picked={picked} onSelect={onSelectItem} onMove={onMoveItem} snap={snap} connecting={passive} />
        <ConnectDots connect={connect} items={items} onGrip={onGrip} onTarget={onTarget} />
        <ViewApi api={api} />
        <OrbitControls makeDefault target={TARGET} maxPolarAngle={Math.PI / 2.05} minDistance={6} maxDistance={600} />
        <Camera view={view} pieces={allTags} />
        <LabelTracker items={tags} refs={refs} />
      </Canvas>
      <div className={passive ? "labels passive" : "labels"}>
        {tags.map((it, i) => (
          <button
            key={it.key}
            ref={(el) => (refs.current[i] = el)}
            className={['tag', it.empty && 'empty', it.block && 'block', it.ribbon && 'ribbon', it.sel && 'sel'].filter(Boolean).join(' ')}
            style={{ '--c': it.color ?? '#b9b4a9' }}
            onClick={(e) => (it.ribbon ? onPickPiece(it.piece, e.shiftKey || e.ctrlKey || e.metaKey, it.rid) : it.first && (KINDS_BY_ITEM(items, it.first) ? onSelectItem(it.first, e.shiftKey || e.ctrlKey || e.metaKey) : onPick(it.first, e.shiftKey || e.ctrlKey || e.metaKey)))}
            onDoubleClick={() => it.edit && onEditLabel?.(it.edit)}
            title={it.edit ? 'Double-click to change this label' : undefined}
          >
            {it.text}
          </button>
        ))}
      </div>
    </div>
  )
}
