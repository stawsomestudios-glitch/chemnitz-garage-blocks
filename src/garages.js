import { ROWS, MODULE } from './geometry.js'

// Back-to-back rows share a back wall, so a garage touches the one behind it.
const BEHIND = { R2: 'R3', R3: 'R2', R4: 'R5', R5: 'R4', R7: 'R8', R8: 'R7', R9: 'R10', R10: 'R9' }

// One entry per garage: its id (row-number), where it stands, and which way it faces.
export const GARAGES = ROWS.flatMap((r) =>
  r.modules.map((m) => ({
    id: `${r.id}-${m.index + 1}`,
    row: r.id,
    num: m.index + 1,
    x: m.x,
    y: m.y,
    u: r.u, // along the row
    n: r.nrm, // out of the doors
    angle: Math.atan2(r.u[1], r.u[0]),
    prev: m.index > 0 ? `${r.id}-${m.index}` : null,
    next: m.index < r.n - 1 ? `${r.id}-${m.index + 2}` : null,
    back: BEHIND[r.id] ? `${BEHIND[r.id]}-${m.index + 1}` : null,
  })),
)
export const BY_ID = Object.fromEntries(GARAGES.map((g, i) => [g.id, { ...g, i }]))
export const ROW_IDS = ROWS.map((r) => r.id)
export { MODULE }

export const touching = (id) => {
  const g = BY_ID[id]
  return [g.prev, g.next, g.back].filter(Boolean)
}

// True when the garages form one connected piece.
export function connected(ids) {
  if (ids.length < 2) return true
  const want = new Set(ids)
  const seen = new Set([ids[0]])
  const todo = [ids[0]]
  while (todo.length) {
    for (const t of touching(todo.pop()))
      if (want.has(t) && !seen.has(t)) {
        seen.add(t)
        todo.push(t)
      }
  }
  return seen.size === want.size
}

export const label = (id) => id.replace('-', '·')
