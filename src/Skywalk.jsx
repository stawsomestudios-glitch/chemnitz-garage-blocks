import { useMemo } from 'react'
import * as THREE from 'three'
import { ROWS } from './geometry.js'
import { rowCorners } from './geometry.js'
import { DECK, LIFT, PLAZA, STAIR, THICK, pieces } from './skywalk.js'

const BOX = new THREE.BoxGeometry(1, 1, 1)
const COL = new THREE.CylinderGeometry(0.22, 0.22, 1, 14)
const DECK_C = '#a9b6c2'
const STEEL = '#565c63'
const GLASS = '#bcd3df'

// True when a point stands on a garage, where no column may go.
const FOOT = ROWS.map(rowCorners)
function onGarage([x, y]) {
  return FOOT.some((poly) => {
    let hit = false
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i]
      const [xj, yj] = poly[j]
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit
    }
    return hit
  })
}

// One straight run of deck between two points [east, north, height], with glass rails and columns.
function Run({ a, b, w, rails = [true, true], colour = DECK_C, columns = true }) {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const L = Math.hypot(dx, dy)
  const dh = b[2] - a[2]
  const len = Math.hypot(L, dh)
  const heading = Math.atan2(dx, -dy) // turns the run's local z to point from a to b
  const pitch = -Math.atan2(dh, L)
  const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]
  const cols = useMemo(() => {
    if (!columns) return []
    const n = Math.max(1, Math.round(L / 9))
    const out = []
    for (let i = 0; i <= n; i++) {
      const t = i / n
      const p = [a[0] + dx * t, a[1] + dy * t, a[2] + dh * t]
      if (p[2] - THICK > 0.9 && !onGarage(p)) out.push(p)
    }
    return out
  }, [a, b, L, columns])
  return (
    <>
      <group position={[mid[0], mid[2], -mid[1]]} rotation={[0, heading, 0]}>
        <group rotation={[pitch, 0, 0]}>
          <mesh geometry={BOX} position={[0, -THICK / 2, 0]} scale={[w, THICK, len]} castShadow receiveShadow userData={{ stack: true }}>
            <meshStandardMaterial color={colour} roughness={0.7} />
          </mesh>
          {[-1, 1].map((s, i) =>
            rails[i] ? (
              <group key={s}>
                <mesh geometry={BOX} position={[s * (w / 2 - 0.04), 0.55, 0]} scale={[0.04, 1.0, len]}>
                  <meshStandardMaterial color={GLASS} transparent opacity={0.4} depthWrite={false} side={THREE.DoubleSide} />
                </mesh>
                <mesh geometry={BOX} position={[s * (w / 2 - 0.04), 1.08, 0]} scale={[0.08, 0.06, len]}>
                  <meshStandardMaterial color={STEEL} />
                </mesh>
              </group>
            ) : null,
          )}
        </group>
      </group>
      {cols.map((p, i) => (
        <mesh key={i} geometry={COL} position={[p[0], (p[2] - THICK) / 2, -p[1]]} scale={[1, p[2] - THICK, 1]} castShadow>
          <meshStandardMaterial color={STEEL} />
        </mesh>
      ))}
    </>
  )
}

// A square pad where two runs meet, so corners are closed.
function Joint({ p, w }) {
  return (
    <mesh geometry={BOX} position={[p[0], p[2] - THICK / 2, -p[1]]} scale={[w, THICK, w]} receiveShadow userData={{ stack: true }}>
      <meshStandardMaterial color={DECK_C} roughness={0.7} />
    </mesh>
  )
}

function Stair() {
  const { from, to, width, steps } = STAIR
  const dx = to[0] - from[0]
  const dy = to[1] - from[1]
  const run = Math.hypot(dx, dy)
  const heading = Math.atan2(dx, -dy)
  const tread = run / steps
  return (
    <group position={[from[0], 0, -from[1]]} rotation={[0, heading, 0]}>
      {Array.from({ length: steps }, (_, i) => {
        const h = DECK - ((i + 1) * DECK) / steps
        return h > 0.01 ? (
          <mesh key={i} geometry={BOX} position={[0, h / 2, (i + 0.5) * tread]} scale={[width, h, tread]} castShadow receiveShadow>
            <meshStandardMaterial color={DECK_C} roughness={0.75} />
          </mesh>
        ) : null
      })}
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={BOX} position={[s * (width / 2), DECK / 2 + 0.55, run / 2]} rotation={[Math.atan2(DECK, run), 0, 0]} scale={[0.06, 0.06, Math.hypot(run, DECK)]}>
          <meshStandardMaterial color={STEEL} />
        </mesh>
      ))}
    </group>
  )
}

function Lift() {
  const { at, size, height } = LIFT
  return (
    <group position={[at[0], 0, -at[1]]}>
      <mesh geometry={BOX} position={[0, height / 2, 0]} scale={[size, height, size]} castShadow>
        <meshStandardMaterial color={GLASS} transparent opacity={0.45} roughness={0.1} />
      </mesh>
      <mesh geometry={BOX} position={[0, height + 0.1, 0]} scale={[size + 0.2, 0.2, size + 0.2]}>
        <meshStandardMaterial color={STEEL} />
      </mesh>
    </group>
  )
}

export default function Skywalk() {
  const runs = useMemo(pieces, [])
  // joints: where an arm bends, and where a slope meets its arm
  const joints = useMemo(() => {
    const out = []
    for (const r of runs) if (r.kind === 'arm') out.push({ p: r.a, w: r.w })
    return out
  }, [runs])
  return (
    <group>
      <Run a={PLAZA.from} b={PLAZA.to} w={PLAZA.width} rails={[false, true]} colour="#b7c2cc" />
      {runs.map((r, i) => (
        <Run key={i} a={r.a} b={r.b} w={r.w} />
      ))}
      {joints.map((j, i) => (
        <Joint key={i} p={j.p} w={j.w} />
      ))}
      <Stair />
      <Lift />
    </group>
  )
}
