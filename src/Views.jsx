import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import * as THREE from 'three'
import { ground } from './terrain.js'

// Drawing views: top, side (elevations), isometric and section, in a parallel (orthographic) camera,
// plus the 3D views in perspective. All of them are set by `view` and carried out by CameraRig.

// In a section, the inside of anything that is cut shows as solid dark fill (poché):
// where the cut lets you see the back of a surface, it is drawn dark instead.
if (!THREE.ShaderChunk.opaque_fragment.includes('POCHE')) {
  THREE.ShaderChunk.opaque_fragment += `
// POCHE
#if NUM_CLIPPING_PLANES > 0 && defined( OPAQUE )
if ( ! gl_FrontFacing ) gl_FragColor = vec4( vec3( 0.13 ), 1.0 );
#endif
`
}
export const POCHE = '#222222'

// the cut, shared with the labels so labels in front of it are hidden
export const CLIP = { plane: null }

const HOME = [-92, 80, -104]
const TARGET = [-3, 0, -5]
const FOV = 36
const FAR = 1500 // how far back a parallel camera stands (it sees the same at any distance)
const tanHalf = Math.tan(((FOV / 2) * Math.PI) / 180)

// A section: { angle (degrees: 0 = the cut runs west–east and you look north), offset (metres from the middle of the site), flip (look the other way) }
export function sectionGeom(sec) {
  const a = (sec.angle * Math.PI) / 180
  const d = [Math.cos(a), Math.sin(a)] // along the cut, (east, north)
  const nb = [-Math.sin(a), Math.cos(a)] // across it
  const n = sec.flip ? [-nb[0], -nb[1]] : nb // the way you look
  const P0 = [nb[0] * sec.offset, nb[1] * sec.offset]
  return { d, n, P0 }
}
export const sideName = { n: 'North', e: 'East', s: 'South', w: 'West' }
const SIDE = { n: [0, 0, -1], e: [1, 0, 0], s: [0, 0, 1], w: [-1, 0, 0] } // where the camera stands, seen from the middle

export function CameraRig({ view, ortho, pieces, section }) {
  const { camera, controls, size } = useThree()
  const applied = useRef(null)
  const pose = useRef(null)
  useFrame(() => {
    if (controls && controls.object === camera) pose.current = { pos: camera.position.clone(), target: controls.target.clone(), zoom: camera.zoom, ortho: !!camera.isOrthographicCamera }
  })
  useEffect(() => {
    if (!controls || controls.object !== camera || !!camera.isOrthographicCamera !== ortho) return // wait for the right camera
    const p = pose.current
    // the scale now on screen, as a parallel camera's zoom (pixels per metre)
    const zoomNow = () => (p ? (p.ortho ? p.zoom : size.height / (2 * p.pos.distanceTo(p.target) * tanHalf)) : size.width / 400)
    const put = (pos, target, zoom) => {
      camera.position.set(...pos)
      controls.target.set(...target)
      if (camera.isOrthographicCamera && zoom) camera.zoom = zoom
      camera.updateProjectionMatrix()
      controls.update()
    }
    // look from a direction, at the point you were looking at, keeping the scale
    const from = (dir, target, zoom) => {
      const t = target ?? (p ? [p.target.x, p.target.y, p.target.z] : TARGET)
      const v = new THREE.Vector3(...dir).normalize()
      if (camera.isOrthographicCamera) put([t[0] + v.x * FAR, t[1] + v.y * FAR, t[2] + v.z * FAR], t, zoom ?? zoomNow())
      else {
        const dist = size.height / (2 * (zoom ?? zoomNow()) * tanHalf)
        put([t[0] + v.x * dist, t[1] + v.y * dist, t[2] + v.z * dist], t)
      }
    }

    if (view && applied.current !== view) {
      applied.current = view
      if (view.name === 'saved') {
        // glide back to a saved view in half a second
        const a = [camera.position.clone(), controls.target.clone(), camera.zoom]
        const b = [new THREE.Vector3(...view.pos), new THREE.Vector3(...view.target), view.zoom ?? camera.zoom]
        const t0 = performance.now()
        let raf
        const step = () => {
          const k = Math.min(1, (performance.now() - t0) / 500)
          const e = k * k * (3 - 2 * k)
          camera.position.lerpVectors(a[0], b[0], e)
          controls.target.lerpVectors(a[1], b[1], e)
          if (camera.isOrthographicCamera) camera.zoom = a[2] + (b[2] - a[2]) * e
          camera.updateProjectionMatrix()
          controls.update()
          if (k < 1) raf = requestAnimationFrame(step)
        }
        step()
        return () => cancelAnimationFrame(raf)
      }
      if (view.name === 'piece') {
        const at = pieces?.find((t) => t.i === view.i && t.rid === (view.rid ?? 'main'))?.p
        if (at) return camera.isOrthographicCamera ? from([-1, 0.7, 1], [at[0], Math.max(0.5, at[1] - 1.6), at[2]], size.height / 30) : put([at[0] - 13, at[1] + 9, at[2] + 13], [at[0], Math.max(0.5, at[1] - 1.6), at[2]])
      }
      if (view.name === 'top') return from([0, 1, 0.0001])
      if (view.name === 'side') return from(SIDE[view.dir] ?? SIDE.s)
      if (view.name === 'iso') return from([-1, Math.SQRT2 * Math.tan((35.264 * Math.PI) / 180), 1]) // true isometric, from the south-west
      if (view.name === 'section' && section) {
        const { n, P0 } = sectionGeom(section)
        const t = [P0[0], ground(P0[0], P0[1]) + 3, -P0[1]]
        return from([-n[0], 0, n[1]], t, view.keepZoom ? undefined : p && p.ortho ? p.zoom : size.width / 260)
      }
      // the Ribbon view looks from the south, high up, so the whole ribbon is in view
      const [pos, target] = view.name === 'plan' ? [[-3, 165, -4.99], TARGET] : view.name === 'ribbon' ? [[18, 300, 190], [18, 0, -30]] : [HOME, TARGET]
      if (camera.isOrthographicCamera) return from([pos[0] - target[0], pos[1] - target[1], pos[2] - target[2]], target, size.height / (2 * Math.hypot(pos[0] - target[0], pos[1] - target[1], pos[2] - target[2]) * tanHalf))
      return put(pos, target)
    }
    // the projection changed (Parallel on or off) but not the view: stay where you were, at the same scale
    if (p && p.ortho !== !!camera.isOrthographicCamera) from([p.pos.x - p.target.x, p.pos.y - p.target.y, p.pos.z - p.target.z], [p.target.x, p.target.y, p.target.z], zoomNow())
  }, [view, ortho, camera, controls, section]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

// The section: a vertical cut. Everything in front of it is taken away, the cut is filled dark,
// and the ground is cut along its real line. A red line marks the cut when you turn around it.
export function SectionCut({ section, topo }) {
  const { gl, scene } = useThree()
  const plane = useMemo(() => new THREE.Plane(), [])
  useEffect(() => {
    if (!section) {
      gl.clippingPlanes = []
      CLIP.plane = null
      // surfaces go back to one-sided
      scene.traverse((o) => {
        for (const m of [o.material].flat())
          if (m?.userData.wasFront) {
            m.side = THREE.FrontSide
            delete m.userData.wasFront
            m.needsUpdate = true
          }
      })
      return
    }
    const { n, P0 } = sectionGeom(section)
    plane.normal.set(n[0], 0, -n[1])
    plane.constant = -(n[0] * P0[0] + n[1] * P0[1])
    gl.clippingPlanes = [plane]
    CLIP.plane = plane
  }, [section, gl, scene, plane])
  // one-sided surfaces become two-sided while cut, so their insides can show as fill (checked now and then for new ones)
  const tick = useRef(0)
  useFrame(() => {
    if (!section || tick.current++ % 20) return
    scene.traverse((o) => {
      for (const m of [o.material].flat())
        if (m && m.side === THREE.FrontSide && !m.transparent) {
          m.userData.wasFront = true
          m.side = THREE.DoubleSide
          m.needsUpdate = true
        }
    })
  })
  const cut = useMemo(() => {
    if (!section) return null
    const { d, n, P0 } = sectionGeom(section)
    const pts = []
    for (let t = -700; t <= 700; t += 2.5) pts.push([t, ground(P0[0] + d[0] * t, P0[1] + d[1] * t)])
    // the ground cut as a 2.5 m band under the real ground line
    const shape = new THREE.Shape([...pts.map(([t, h]) => new THREE.Vector2(t, h - 0.03)), ...[...pts].reverse().map(([t, h]) => new THREE.Vector2(t, h - 2.5))])
    const geo = new THREE.ShapeGeometry(shape)
    const X = new THREE.Vector3(d[0], 0, -d[1])
    const Y = new THREE.Vector3(0, 1, 0)
    const Z = new THREE.Vector3().crossVectors(X, Y)
    geo.applyMatrix4(new THREE.Matrix4().makeBasis(X, Y, Z).setPosition(P0[0] + n[0] * 0.02, 0, -(P0[1] + n[1] * 0.02)))
    const line = pts.map(([t, h]) => [P0[0] + d[0] * t + n[0] * 0.06, h + 0.05, -(P0[1] + d[1] * t + n[1] * 0.06)])
    return { geo, line }
  }, [section, topo])
  useEffect(() => () => cut?.geo.dispose(), [cut])
  if (!cut) return null
  return (
    <group userData={{ noExport: true }}>
      <mesh geometry={cut.geo} raycast={() => null} userData={{ noExport: true }}>
        <meshBasicMaterial color={POCHE} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <Line points={cut.line} color="#e30613" lineWidth={2} raycast={() => null} />
    </group>
  )
}
