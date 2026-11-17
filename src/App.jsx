import { useEffect, useMemo, useRef, useState } from 'react'
import Scene from './Scene.jsx'
import { GARAGES, BY_ID, ROW_IDS, connected, label } from './garages.js'
import { TITLES, TITLE } from './titles.js'
import { KINDS, KIND_IDS, alignRot, dims, placeByGrip, snapPoint } from './elements.js'
import { COBALT, DEFAULT_RIBBON, RIBBON_GROUPS, RIBBON_KINDS, STREETS, cleanRibbon, moduleLen, routeCurve } from './ribbon.js'

const BASE = import.meta.env.BASE_URL
const KEY = 'chemnitz-garage-blocks-v1'
const ALL = GARAGES.map((g) => g.id)
const EMPTY = { title: {}, block: {}, items: [], ribbon: DEFAULT_RIBBON }
const newId = () => 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

// Your plan is kept in this browser so it is still there next time.
function loadSaved() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY))
    if (s && s.title && s.block) return clean(s)
  } catch {}
  return EMPTY
}
function clean(s) {
  const title = {}
  const block = {}
  for (const id of ALL) {
    if (TITLE[s.title?.[id]]) title[id] = s.title[id]
    if (s.block?.[id]) block[id] = String(s.block[id])
  }
  const num = (v) => (Number.isFinite(+v) ? +v : 0)
  const items = (Array.isArray(s.items) ? s.items : [])
    .filter((it) => it && KINDS[it.kind])
    .map((it) => {
      const out = { id: String(it.id ?? newId()), kind: it.kind, x: num(it.x), y: num(it.y), z: num(it.z), rot: num(it.rot) }
      if (TITLE[it.title] && KINDS[it.kind].titled) out.title = it.title
      for (const k of ['sw', 'sd', 'sh']) if (+it[k] > 0) out[k] = +it[k]
      if (it.kind === 'rmod') {
        const rk = RIBBON_KINDS[it.rk] && !RIBBON_KINDS[it.rk].gap ? it.rk : 'bench'
        out.rk = rk
        out.len = Math.max(RIBBON_KINDS[rk].min, Math.round(num(it.len) * 10) / 10 || moduleLen(rk))
        out.bw = +it.bw >= 0.6 && +it.bw <= 8 ? +it.bw : 2.4
        if (it.flip) out.flip = true
      }
      return out
    })
  return { title, block, items, ribbon: cleanRibbon(s.ribbon) }
}
// Every change to the plan goes through here, so it can be undone and redone (up to 100 steps).
// Changes with the same key in quick succession (one drag) count as one step.
function useHistory(init) {
  const [h, setH] = useState(() => ({ past: [], present: init(), future: [] }))
  const last = useRef({ key: null, t: 0 })
  const set = (fn, key) => {
    const now = Date.now()
    const merge = !!key && last.current.key === key && now - last.current.t < 700
    last.current = { key, t: now }
    setH((st) => {
      const next = typeof fn === 'function' ? fn(st.present) : fn
      if (next === st.present) return st
      return { past: merge ? st.past : [...st.past.slice(-99), st.present], present: next, future: [] }
    })
  }
  const undo = () => {
    last.current = { key: null, t: 0 }
    setH((st) => (st.past.length ? { past: st.past.slice(0, -1), present: st.past.at(-1), future: [st.present, ...st.future] } : st))
  }
  const redo = () => {
    last.current = { key: null, t: 0 }
    setH((st) => (st.future.length ? { past: [...st.past, st.present], present: st.future[0], future: st.future.slice(1) } : st))
  }
  return [h.present, set, undo, redo, h.past.length, h.future.length]
}

function download(name, text, type) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type }))
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}

export default function App() {
  const [site, setSite] = useState(null)
  const [error, setError] = useState(null)
  const [plan, setPlan, undo, redo, undos, redos] = useHistory(loadSaved)
  const [picked, setPicked] = useState(() => new Set())
  const [multi, setMulti] = useState(false)
  const [labels, setLabels] = useState('titles')
  const [view, setView] = useState(null)
  const [note, setNote] = useState(null)
  const [snap, setSnap] = useState('grid')
  const [connect, setConnect] = useState(null) // null, or { stage: 'grip' | 'target', id, grip }
  const [chosen, setChosen] = useState(null) // the ribbon piece you clicked, by its number
  const file = useRef()
  const api = useRef(null)
  const { title, block, items, ribbon } = plan

  useEffect(() => {
    fetch(`${BASE}data/site.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`data/site.json: ${r.status}`)
        return r.json()
      })
      .then(setSite)
      .catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(plan))
    } catch {}
  }, [plan])

  useEffect(() => {
    if (!note) return
    const t = setTimeout(() => setNote(null), 3500)
    return () => clearTimeout(t)
  }, [note])

  // A garage in a block always brings its whole block with it.
  const members = (id) => (block[id] ? ALL.filter((g) => block[g] === block[id]) : [id])
  const withBlocks = (ids) => [...new Set(ids.flatMap(members))]

  const pick = (id, add) => {
    setChosen(null)
    const m = members(id)
    setPicked((old) => {
      if (!(add || multi)) return new Set(m)
      const next = new Set(old)
      if (m.every((g) => next.has(g))) m.forEach((g) => next.delete(g))
      else m.forEach((g) => next.add(g))
      return next
    })
  }

  const sel = useMemo(() => ALL.filter((id) => picked.has(id)), [picked])
  const selItems = items.filter((it) => picked.has(it.id))
  const titledItems = selItems.filter((it) => KINDS[it.kind].titled)
  const selBlocks = new Set(sel.map((id) => block[id]).filter(Boolean))
  const selTitles = new Set([...sel.map((id) => title[id] ?? null), ...titledItems.map((it) => it.title ?? null)])
  const shared = selTitles.size === 1 ? [...selTitles][0] : undefined
  const canTitle = sel.length > 0 || titledItems.length > 0

  const setTitle = (t) => {
    const ids = withBlocks(sel)
    setPlan((p) => {
      const title = { ...p.title }
      for (const id of ids) {
        if (t) title[id] = t
        else delete title[id]
      }
      const items = p.items.map((it) => {
        if (!picked.has(it.id) || !KINDS[it.kind].titled) return it
        const { title: _, ...rest } = it
        return t ? { ...rest, title: t } : rest
      })
      return { ...p, title, items }
    })
  }

  // ----- added elements -----
  const addItem = (kind, [x, y, z]) => {
    const [sx, sy] = snap === 'grid' ? snapPoint(x, y) : [x, y]
    let it = { id: newId(), kind, x: sx, y: sy, z, rot: alignRot(sx, sy) }
    if (kind.startsWith('rmod:')) {
      const rk = kind.slice(5)
      it = { ...it, kind: 'rmod', rk, len: moduleLen(rk), bw: ribbon.width }
    }
    setPlan((p) => ({ ...p, items: [...p.items, it] }))
    setPicked(new Set([it.id]))
  }
  const moveItem = (id, pos) => setPlan((p) => ({ ...p, items: p.items.map((it) => (it.id === id ? { ...it, ...pos } : it)) }), 'move:' + id)
  const changeItems = (fn) => setPlan((p) => ({ ...p, items: p.items.map((it) => (picked.has(it.id) ? fn(it) : it)) }))
  const rotate = (deg) => changeItems((it) => ({ ...it, rot: (it.rot + deg + 360) % 360 }))
  const removeItems = () => {
    setPlan((p) => ({ ...p, items: p.items.filter((it) => !picked.has(it.id)) }))
    setPicked(new Set(sel))
  }
  const duplicate = () => {
    const copies = selItems.map((it) => {
      // the copy goes one block-width along, to the right of the original
      const a = (it.rot * Math.PI) / 180
      const step = dims(it).w + 0.2
      return { ...it, id: newId(), x: it.x + Math.cos(a) * step, y: it.y + Math.sin(a) * step }
    })
    setPlan((p) => ({ ...p, items: [...p.items, ...copies] }))
    setPicked(new Set(copies.map((c) => c.id)))
  }
  // Size: what you type in W / L / H, or a scale step for every selected element.
  const resize = (key, value) => {
    const v = Math.round(+value * 100) / 100
    if (!(v > 0)) return
    changeItems((it) => ({ ...it, [key]: v }))
  }
  const scaleBy = (f) =>
    changeItems((it) => {
      const s = dims(it)
      const r = (v) => Math.round(v * f * 100) / 100
      return { ...it, sw: r(s.w), sd: r(s.d), sh: r(s.h) }
    })
  const resetSize = () =>
    changeItems((it) => {
      const { sw, sd, sh, ...rest } = it
      return rest
    })

  // Connect: hold the element by one of its points, then put that point on another point.
  const startConnect = () => {
    if (selItems.length !== 1) return setNote('Select one element to connect.')
    setConnect({ stage: 'grip', id: selItems[0].id })
  }
  const onGrip = (grip) => setConnect((c) => ({ ...c, stage: 'target', grip }))
  const onTarget = (target) => {
    const c = connect
    setPlan((p) => ({ ...p, items: p.items.map((it) => (it.id === c.id ? { ...it, ...placeByGrip(it, c.grip, target) } : it)) }))
    setPicked(new Set([c.id]))
    setConnect(null)
    setNote('Connected.')
  }

  // ----- the ribbon -----
  const setRibbon = (fn) => setPlan((p) => ({ ...p, ribbon: fn(p.ribbon) }))
  const pickPiece = (i) => {
    if (i == null || i < 0) return
    setChosen(i)
    setPicked(new Set())
  }
  const editPiece = (i, change) =>
    setRibbon((r) => ({ ...r, pieces: r.pieces.map((p, k) => (k === i ? { ...p, ...change, len: Math.max(RIBBON_KINDS[change.kind ?? p.kind].min, change.len ?? p.len) } : p)) }))
  const splitPiece = (i) =>
    setRibbon((r) => {
      const p = r.pieces[i]
      const half = Math.round((p.len / 2) * 10) / 10
      return { ...r, pieces: [...r.pieces.slice(0, i), { ...p, len: half }, { kind: 'path', len: Math.round((p.len - half) * 10) / 10 }, ...r.pieces.slice(i + 1)] }
    })
  const deletePiece = (i) => {
    setRibbon((r) => ({ ...r, pieces: r.pieces.length > 1 ? r.pieces.filter((_, k) => k !== i) : r.pieces }))
    setChosen(null)
  }
  const resetRibbon = () => {
    if (!confirm('Put the ribbon back the way it started?')) return
    setRibbon(() => DEFAULT_RIBBON)
    setChosen(null)
  }
  const ribbonLen = ribbon.pieces.reduce((a, p) => a + p.len, 0)
  const curve = useMemo(() => routeCurve(), [])
  const routeLen = useMemo(() => curve.getLength(), [curve])
  // where a point along the ribbon is on the map, and which way the ribbon runs there
  const along = (s) => {
    const u = Math.min(1, Math.max(0, s / routeLen))
    const P = curve.getPointAt(u)
    const T = curve.getTangentAt(u)
    return { x: P.x, y: -P.z, rot: (Math.atan2(-T.x, -T.z) * 180) / Math.PI }
  }
  const startOf = (i) => ribbon.pieces.slice(0, i).reduce((a, p) => a + p.len, 0)

  // Detach: the piece leaves the ribbon as a single straight module, in the same place; a gap stays behind.
  const detachPiece = (i) => {
    const p = ribbon.pieces[i]
    if (!p || RIBBON_KINDS[p.kind].gap) return
    const at = along(startOf(i) + p.len / 2)
    const it = { id: newId(), kind: 'rmod', rk: p.kind, len: p.len, bw: ribbon.width, x: at.x, y: at.y, z: 0, rot: at.rot, ...(p.flip ? { flip: true } : {}) }
    setPlan((pl) => ({
      ...pl,
      items: [...pl.items, it],
      ribbon: { ...pl.ribbon, pieces: pl.ribbon.pieces.map((q, k) => (k === i ? { kind: 'gap', len: q.len } : q)) },
    }))
    setChosen(null)
    setPicked(new Set([it.id]))
    setNote(`${RIBBON_KINDS[p.kind].name} detached. Drag it anywhere; Reattach puts it back into the nearest gap.`)
  }

  // Reattach: a module goes back into the ribbon, into the nearest gap; with no gap, at the nearest point of the ribbon.
  const reattach = (it) => {
    const piece = { kind: it.rk, len: it.len, ...(it.flip ? { flip: true } : {}) }
    const pieces = ribbon.pieces
    const dist = (s) => {
      const a = along(s)
      return Math.hypot(a.x - it.x, a.y - it.y)
    }
    let next
    let at
    const gaps = pieces.map((p, i) => i).filter((i) => RIBBON_KINDS[pieces[i].kind].gap)
    if (gaps.length) {
      const mid = (g) => dist(startOf(g) + pieces[g].len / 2)
      const i = gaps.reduce((b, g) => (mid(g) < mid(b) ? g : b))
      const left = Math.round((pieces[i].len - it.len) * 10) / 10
      // a shorter module leaves the rest of the gap as flat path, so the pieces after it stay where they are
      next = [...pieces.slice(0, i), piece, ...(left >= 0.1 ? [{ kind: 'path', len: left }] : []), ...pieces.slice(i + 1)]
      at = i
      setNote(`Reattached into the gap at piece ${i + 1}.`)
    } else {
      // the nearest point on the ribbon, every half metre
      let best = 0
      let bd = Infinity
      for (let s = 0; s <= routeLen; s += 0.5) {
        const d = dist(s)
        if (d < bd) [best, bd] = [s, d]
      }
      let i = 0
      while (i < pieces.length - 1 && startOf(i + 1) <= best) i++
      const p = pieces[i]
      if (p.kind === 'path' && p.len >= it.len) {
        // carve the module out of a path, so the pieces after it stay where they are
        const a = Math.round(Math.min(p.len - it.len, Math.max(0, best - startOf(i) - it.len / 2)) * 10) / 10
        const b = Math.round((p.len - a - it.len) * 10) / 10
        next = [...pieces.slice(0, i), ...(a >= 0.1 ? [{ kind: 'path', len: a }] : []), piece, ...(b >= 0.1 ? [{ kind: 'path', len: b }] : []), ...pieces.slice(i + 1)]
        at = i + (a >= 0.1 ? 1 : 0)
        setNote(`Reattached at ${best.toFixed(0)} m along the ribbon.`)
      } else {
        next = [...pieces.slice(0, i + 1), piece, ...pieces.slice(i + 1)]
        at = i + 1
        setNote(`Reattached after piece ${i + 1}. The pieces after it moved along by ${it.len} m.`)
      }
    }
    setPlan((pl) => ({ ...pl, items: pl.items.filter((x) => x.id !== it.id), ribbon: { ...pl.ribbon, on: true, pieces: next } }))
    setPicked(new Set())
    setChosen(at)
  }
  const selModule = selItems.length === 1 && selItems[0].kind === 'rmod' ? selItems[0] : null
  const editModule = (change) =>
    changeItems((it) => (it.kind === 'rmod' ? { ...it, ...change, len: Math.max(RIBBON_KINDS[change.rk ?? it.rk].min, change.len ?? it.len) } : it))
  const setModuleLen = (e) => +e.target.value > 0 && editModule({ len: Math.round(+e.target.value * 10) / 10 })
  const piece = chosen != null ? ribbon.pieces[chosen] : null
  const startAt = chosen != null ? ribbon.pieces.slice(0, chosen).reduce((a, p) => a + p.len, 0) : 0
  const setLen = (e) => +e.target.value > 0 && editPiece(chosen, { len: Math.round(+e.target.value * 10) / 10 })
  const setWidth = (e) => +e.target.value >= 0.6 && setRibbon((r) => ({ ...r, width: Math.min(8, Math.round(+e.target.value * 10) / 10) }))

  const addMiddle = (kind) => {
    const p = api.current?.centre()
    if (p) addItem(kind, p)
  }

  const lock = () => {
    const ids = withBlocks(sel)
    if (ids.length < 2) return setNote('Pick two or more garages to lock together.')
    if (!connected(ids)) return setNote('These garages don’t touch. Pick neighbours side by side or back to back.')
    const counts = {}
    for (const id of ids) if (title[id]) counts[title[id]] = (counts[title[id]] ?? 0) + 1
    const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1])
    const keep = ranked[0]?.[0]
    const id = 'b' + Date.now().toString(36)
    setPlan((p) => {
      const t = { ...p.title }
      const b = { ...p.block }
      for (const g of ids) {
        b[g] = id
        if (keep) t[g] = keep
      }
      return { ...p, title: t, block: b }
    })
    setPicked(new Set(ids))
    setNote(ranked.length > 1 ? `Locked ${ids.length} garages. They had different titles, so all are now ${TITLE[keep].name}.` : `Locked ${ids.length} garages into one block.`)
  }

  const unlock = () => {
    const ids = withBlocks(sel)
    setPlan((p) => {
      const b = { ...p.block }
      for (const g of ids) delete b[g]
      return { ...p, block: b }
    })
    setNote(`Unlocked ${selBlocks.size === 1 ? 'the block' : `${selBlocks.size} blocks`}. Each garage keeps its title.`)
  }

  useEffect(() => {
    if (chosen != null && chosen >= ribbon.pieces.length) setChosen(null)
  }, [chosen, ribbon.pieces.length])

  useEffect(() => {
    const key = (e) => {
      if (e.target.tagName === 'INPUT') return
      if (e.ctrlKey || e.metaKey) {
        const k = e.key.toLowerCase()
        if (k === 'z' && !e.shiftKey) undo()
        else if (k === 'y' || (k === 'z' && e.shiftKey)) redo()
        else return
        e.preventDefault()
        return
      }
      if (e.key === 'Escape') {
        if (connect) return setConnect(null)
        setPicked(new Set())
        setChosen(null)
      }
      if ((e.key === 'c' || e.key === 'C') && selItems.length === 1) startConnect()
      if ((e.key === 'f' || e.key === 'F') && piece) editPiece(chosen, { flip: !piece.flip })
      if ((e.key === 'f' || e.key === 'F') && selModule) editModule({ flip: !selModule.flip })
      if (e.key === 'l' || e.key === 'L') lock()
      if (e.key === 'u' || e.key === 'U') unlock()
      if ((e.key === 'Delete' || e.key === 'Backspace') && selItems.length) removeItems()
      if ((e.key === 'r' || e.key === 'R') && selItems.length) rotate(e.shiftKey ? -15 : 90)
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  })

  const summary = useMemo(() => {
    const out = TITLES.map((t) => ({ ...t, garages: 0, blocks: new Set() }))
    const at = Object.fromEntries(out.map((o) => [o.id, o]))
    for (const id of ALL) {
      const t = title[id]
      if (!t) continue
      at[t].garages++
      at[t].blocks.add(block[id] ?? id)
    }
    return out
  }, [title, block])
  const assigned = Object.keys(title).length
  const blockCount = new Set(Object.values(block)).size

  const exportCsv = () => {
    const rows = [['garage', 'row', 'number', 'title', 'block']]
    for (const g of GARAGES) rows.push([g.id, g.row, g.num, title[g.id] ? TITLE[title[g.id]].name : '', block[g.id] ?? ''])
    download('chemnitz-garages.csv', rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n'), 'text/csv')
  }
  // The whole 3D model, as it is on screen, as a Rhino 8 file. Titles become text dots above the garages.
  const [saving, setSaving] = useState(false)
  const exportRhino = async () => {
    const scene = api.current?.scene
    if (!scene) return
    setSaving(true)
    try {
      const dots = GARAGES.filter((g) => title[g.id]).map((g) => ({ text: TITLE[title[g.id]].name, x: g.x, y: g.y, z: 3.6 }))
      for (const it of items) if (it.title && TITLE[it.title]) dots.push({ text: TITLE[it.title].name, x: it.x, y: it.y, z: it.z + dims(it).h + 0.6 })
      const { export3dm } = await import('./export3dm.js')
      const r = await export3dm({ scene, dots, filename: 'chemnitz-garage-blocks.3dm' })
      setNote(`Rhino 8 file saved: ${r.objects} objects and ${r.dots} titles, in metres.`)
    } catch (e) {
      console.error(e)
      setNote('The Rhino file could not be made. Try again, or reload the page.')
    }
    setSaving(false)
  }

  const loadFile = (e) => {
    const f = e.target.files[0]
    if (!f) return
    f.text()
      .then((t) => {
        setPlan(clean(JSON.parse(t)))
        setPicked(new Set())
        setNote('Plan loaded.')
      })
      .catch(() => setNote('That file isn’t a garage plan.'))
    e.target.value = ''
  }
  const reset = () => {
    if (!confirm('Clear every title, block and added element, and reset the ribbon? (Undo brings it back.)')) return
    setPlan(EMPTY)
    setPicked(new Set())
    setChosen(null)
  }

  if (error) return <p className="message">The site data didn’t load ({error}).</p>
  if (!site) return <p className="message">Loading the garages…</p>

  const selText = sel.length === 0 ? null : sel.length <= 6 ? sel.map(label).join(', ') : `${label(sel[0])} … ${label(sel.at(-1))}`

  return (
    <div className="app">
      <main className="stage">
        <Scene
          site={site} title={title} block={block} picked={picked} onPick={pick} onClear={() => {
            if (connect) return
            setPicked(new Set())
            setChosen(null)
          }} labels={labels} view={view}
          items={items} onSelectItem={pick} onMoveItem={moveItem} onDropKind={addItem} snap={snap} api={api}
          connect={connect} onGrip={onGrip} onTarget={onTarget}
          ribbon={ribbon} chosen={chosen} onPickPiece={pickPiece}
        />
        {connect && (
          <div className="connect-bar" role="status">
            <b>{connect.stage === 'grip' ? 'Step 1 of 2' : 'Step 2 of 2'}</b>
            {connect.stage === 'grip'
              ? ' Click the orange point to hold the element by (a corner, edge middle or centre). Choose its bottom, deck or top:'
              : ' Click the blue point where it should go: any garage corner or edge, on the ground or the roof, or a point on another element.'}
            {connect.stage === 'grip' ? (
              <div className="seg-group small-seg" role="group" aria-label="Hold by">
                {[['bottom', 'Bottom'], ...(KINDS[items.find((i) => i.id === connect.id)?.kind]?.deck ? [['deck', 'Deck']] : []), ['top', 'Top']].map(([k, l]) => (
                  <button key={k} className={(connect.level ?? 'bottom') === k ? 'on' : ''} onClick={() => setConnect((c) => ({ ...c, level: k }))}>{l}</button>
                ))}
              </div>
            ) : (
              <label className="check nowrap">
                <input type="checkbox" checked={!!connect.ground} onChange={(e) => setConnect((c) => ({ ...c, ground: e.target.checked }))} /> Ground only
              </label>
            )}
            <button onClick={() => setConnect(null)}>Cancel</button>
          </div>
        )}
        <div className="bar top">
          <div className="seg-group" role="group" aria-label="History">
            <button disabled={!undos} onClick={undo} title="Undo (Ctrl+Z)">↶ Undo</button>
            <button disabled={!redos} onClick={redo} title="Redo (Ctrl+Y)">↷ Redo</button>
          </div>
          <div className="seg-group" role="group" aria-label="Camera">
            <button onClick={() => setView({ name: 'home', t: Date.now() })}>3D</button>
            <button onClick={() => setView({ name: 'plan', t: Date.now() })}>Plan</button>
            <button onClick={() => setView({ name: 'ribbon', t: Date.now() })}>Ribbon</button>
          </div>
          <div className="seg-group" role="group" aria-label="Labels">
            {[['titles', 'Titles'], ['numbers', 'Numbers'], ['off', 'Off']].map(([k, l]) => (
              <button key={k} className={labels === k ? 'on' : ''} onClick={() => setLabels(k)}>{l}</button>
            ))}
          </div>
        </div>
        <p className="hint">Drag to turn · scroll to zoom · right-drag to move · zoom in to see every title</p>
        {note && <div className="note" role="status">{note}</div>}
      </main>

      <aside className="panel">
        <header>
          <h1>Chemnitz Garage Blocks</h1>
          <p>Helbersdorf, Haydnstraße / Stollberger Straße. 115 single garages, each 3 m wide, 6 m deep, 3 m tall.</p>
        </header>

        <div className="body">
          <section className="selection">
            <h2>
              {sel.length || selItems.length
                ? [sel.length && `${sel.length} garage${sel.length > 1 ? 's' : ''}`, selItems.length && `${selItems.length} element${selItems.length > 1 ? 's' : ''}`].filter(Boolean).join(' + ') + ' selected'
                : 'Nothing selected'}
            </h2>
            <p className="muted">
              {sel.length
                ? `${selText}${selBlocks.size ? ` · ${selBlocks.size} locked block${selBlocks.size > 1 ? 's' : ''}` : ''}`
                : selItems.length
                  ? [...new Set(selItems.map((it) => (it.kind === 'rmod' ? `${RIBBON_KINDS[it.rk].name} module` : KINDS[it.kind].name)))].join(', ') + '. Drag it in the model to move it.'
                  : 'Click a garage or its title. Shift-click to add more, or tick the box below.'}
            </p>
            {selItems.length > 0 && !selItems.some((it) => it.kind === 'rmod') && (
              <div className="sizes">
                {[['sw', 'Width', 'w'], ['sd', 'Length', 'd'], ['sh', 'Height', 'h']].map(([key, l, dk]) => (
                  <label key={key}>
                    <span>{l}</span>
                    <input
                      key={`${selItems[0].id}-${dims(selItems[0])[dk]}`}
                      type="number" min="0.1" step="0.1"
                      defaultValue={dims(selItems[0])[dk]}
                      onBlur={(e) => resize(key, e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && resize(key, e.target.value)}
                    />
                    <small>m</small>
                  </label>
                ))}
                <div className="scale-btns">
                  <button onClick={() => scaleBy(0.9)}>−10%</button>
                  <button onClick={() => scaleBy(1.1)}>+10%</button>
                  <button onClick={resetSize}>Normal size</button>
                </div>
              </div>
            )}
            {selItems.length > 0 && (
              <div className="actions element-actions">
                <button className="primary" disabled={selItems.length !== 1} onClick={startConnect} title="Hold the element by one point and put it on another (key C)">
                  Connect a point
                </button>
                <button onClick={() => rotate(90)}>Turn 90°</button>
                <button onClick={() => rotate(15)}>Turn 15°</button>
                <button onClick={duplicate}>Copy</button>
                <button onClick={() => changeItems((it) => ({ ...it, z: 0 }))}>To ground</button>
                <button className="danger" onClick={removeItems}>Delete</button>
              </div>
            )}
            <label className="check">
              <input type="checkbox" checked={multi} onChange={(e) => setMulti(e.target.checked)} /> Add to selection on each click
            </label>
            <div className="actions">
              <button className="primary" disabled={withBlocks(sel).length < 2 || (selBlocks.size === 1 && sel.every((id) => block[id]))} onClick={lock}>
                Lock together
              </button>
              <button disabled={!selBlocks.size} onClick={unlock}>Unlock</button>
              <button disabled={!sel.length && !selItems.length} onClick={() => setPicked(new Set())}>Deselect</button>
            </div>
          </section>

          {selModule && (
            <section className="piece">
              <h2>
                <span className="dot" style={{ background: COBALT }} /> Blue module: {RIBBON_KINDS[selModule.rk].name}{selModule.flip ? ' (flipped)' : ''}
              </h2>
              <p className="muted">A single piece of ribbon on its own. {RIBBON_KINDS[selModule.rk].note ?? ''}</p>
              {RIBBON_GROUPS.map(([group, kinds]) => (
                <div key={group} className="kind-group">
                  <h3>{group}</h3>
                  <div className="titles ribbon-kinds">
                    {kinds.filter((k) => !RIBBON_KINDS[k].gap).map((k) => (
                      <button key={k} className={selModule.rk === k ? 'on' : ''} onClick={() => editModule({ rk: k })}>
                        {RIBBON_KINDS[k].name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <div className="sizes">
                <label>
                  <span>Length</span>
                  <input
                    key={selModule.id + '-' + selModule.len}
                    type="number" min={RIBBON_KINDS[selModule.rk].min} step="0.5"
                    defaultValue={selModule.len}
                    onBlur={setModuleLen}
                    onKeyDown={(e) => e.key === 'Enter' && setModuleLen(e)}
                  />
                  <small>m</small>
                </label>
              </div>
              <div className="actions">
                <button className="primary" onClick={() => reattach(selModule)} title="Put it back into the ribbon: into the nearest gap, or at the nearest point">Reattach to the ribbon</button>
                <button className={selModule.flip ? 'on' : ''} onClick={() => editModule({ flip: !selModule.flip })} title="Mirror it end to end (key F)">⇄ Flip</button>
              </div>
            </section>
          )}

          {piece && (
            <section className="piece">
              <h2>
                <span className="dot" style={{ background: COBALT }} /> Ribbon piece {chosen + 1} of {ribbon.pieces.length}: {RIBBON_KINDS[piece.kind].name}{piece.flip ? ' (flipped)' : ''}
              </h2>
              <p className="muted">
                From {startAt.toFixed(1)} m to {(startAt + piece.len).toFixed(1)} m along the ribbon. {RIBBON_KINDS[piece.kind].note ?? ''}
              </p>
              {RIBBON_GROUPS.map(([group, kinds]) => (
                <div key={group} className="kind-group">
                  <h3>{group}</h3>
                  <div className="titles ribbon-kinds">
                    {kinds.map((k) => (
                      <button key={k} className={piece.kind === k ? 'on' : ''} onClick={() => editPiece(chosen, { kind: k })}>
                        {RIBBON_KINDS[k].name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <div className="sizes">
                <label>
                  <span>Length</span>
                  <input
                    key={chosen + '-' + piece.len}
                    type="number" min={RIBBON_KINDS[piece.kind].min} step="0.5"
                    defaultValue={piece.len}
                    onBlur={setLen}
                    onKeyDown={(e) => e.key === 'Enter' && setLen(e)}
                  />
                  <small>m</small>
                </label>
              </div>
              <div className="actions">
                <button className="primary" onClick={() => setView({ name: 'piece', i: chosen, t: Date.now() })}>Zoom to it</button>
                <button disabled={chosen === 0} onClick={() => setChosen(chosen - 1)}>← Previous</button>
                <button disabled={chosen >= ribbon.pieces.length - 1} onClick={() => setChosen(chosen + 1)}>Next →</button>
                <button className={piece.flip ? 'on' : ''} onClick={() => editPiece(chosen, { flip: !piece.flip })} title="Mirror this piece end to end (key F)">⇄ Flip</button>
                <button onClick={() => splitPiece(chosen)}>Split in two</button>
                <button disabled={!!RIBBON_KINDS[piece.kind].gap} onClick={() => detachPiece(chosen)} title="Take this piece out of the ribbon as a single module you can move; a gap stays">Detach</button>
                <button className="danger" disabled={ribbon.pieces.length < 2} onClick={() => deletePiece(chosen)}>Delete piece</button>
              </div>
              <p className="muted small">
                Pieces after this one slide along when you change its length. Keep the CROSSING pieces over the streets:{' '}
                {STREETS.map(([name, a, b]) => `${name} ${a}–${b} m`).join(', ')}.
              </p>
            </section>
          )}

          <section>
            <h2><span className="dot" style={{ background: COBALT }} /> Ribbon</h2>
            <p className="muted">
              One continuous cobalt band, about {Math.round(routeLen)} m. It starts in the green at Parkstraße / Haydnstraße, winds through the garage yards and twice right through three garages
              (cleared inside), lifts into two repair ramps and two lookouts, turns at the corner of Richard-Wagner-Straße and Stollberger Straße, and ends in
              the green under the school. On the way it folds into places to rest, meet, play and do sport. Click it in the model to change a piece.
            </p>
            <label className="check">
              <input type="checkbox" checked={ribbon.on} onChange={(e) => setRibbon((r) => ({ ...r, on: e.target.checked }))} /> Show the ribbon
            </label>
            <div className="sizes">
              <label>
                <span>Width</span>
                <input key={ribbon.width} type="number" min="0.6" max="8" step="0.2" defaultValue={ribbon.width} onBlur={setWidth} onKeyDown={(e) => e.key === 'Enter' && setWidth(e)} />
                <small>m</small>
              </label>
            </div>
            <ol className="pieces">
              {ribbon.pieces.map((p, i) => (
                <li key={i}>
                  <button className={i === chosen ? 'on' : ''} onClick={() => pickPiece(i)}>
                    <span>{RIBBON_KINDS[p.kind].name}</span>
                    <small>{p.flip ? '⇄ ' : ''}{p.len} m</small>
                  </button>
                </li>
              ))}
            </ol>
            <p className="muted small">
              {ribbonLen.toFixed(1)} m of pieces on a route of {routeLen.toFixed(1)} m{ribbonLen < routeLen - 0.5 ? '; the rest lies flat as path' : ribbonLen > routeLen + 0.5 ? '; pieces past the end are cut off' : ''}.
            </p>
            <div className="actions">
              <button onClick={() => setRibbon((r) => ({ ...r, pieces: [...r.pieces, { kind: 'bench', len: 4 }] }))}>Add a piece at the end</button>
              <button onClick={resetRibbon}>Reset ribbon</button>
            </div>
            <h3 className="sub">Add a single blue module</h3>
            <p className="muted small">A piece of ribbon on its own. Drag one onto the model, or click it to drop it in the middle of the view. Select a module to change it, or reattach it to the ribbon.</p>
            {RIBBON_GROUPS.map(([group, kinds]) => (
              <div key={group} className="kind-group">
                <h3>{group}</h3>
                <div className="titles ribbon-kinds">
                  {kinds.filter((k) => !RIBBON_KINDS[k].gap).map((k) => (
                    <button
                      key={k}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/kind', 'rmod:' + k)
                        e.dataTransfer.effectAllowed = 'copy'
                      }}
                      onClick={() => addMiddle('rmod:' + k)}
                    >
                      {RIBBON_KINDS[k].name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </section>

          <section>
            <h2>Title</h2>
            {!canTitle && selItems.length > 0 && <p className="muted">Only garages and added garage or half blocks take a title.</p>}
            <div className="titles">
              {TITLES.map((t) => (
                <button key={t.id} disabled={!canTitle} className={shared === t.id ? 'on' : ''} onClick={() => setTitle(t.id)}>
                  <span className="dot" style={{ background: t.color }} />
                  {t.name}
                </button>
              ))}
              <button disabled={!canTitle} className="none" onClick={() => setTitle(null)}>No title</button>
            </div>
          </section>

          <section>
            <h2>Add elements</h2>
            <p className="muted">Drag one onto the model, or click it to drop it in the middle of the view. Drop onto a roof to stack. Add as many as you like.</p>
            <div className="palette">
              {KIND_IDS.map((k) => (
                <button
                  key={k}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/kind', k)
                    e.dataTransfer.effectAllowed = 'copy'
                  }}
                  onClick={() => addMiddle(k)}
                  title={`${KINDS[k].name}, ${KINDS[k].size} m`}
                >
                  <span className="pname">{KINDS[k].name}</span>
                  <small>{KINDS[k].size} m</small>
                </button>
              ))}
            </div>
            <div className="snaprow">
              <span>Snap when dragging</span>
              <div className="seg-group small-seg" role="group" aria-label="Snap">
                {[['grid', 'Grid 1.5 m'], ['points', 'Points'], ['off', 'Off']].map(([k, l]) => (
                  <button key={k} className={snap === k ? 'on' : ''} onClick={() => setSnap(k)}>{l}</button>
                ))}
              </div>
            </div>
            <p className="muted small">Points: corners and edges pull onto nearby garage corners and edges, or onto other elements.</p>
            <p className="muted small">{items.length} element{items.length === 1 ? '' : 's'} added. Keys: R turn 90° · Shift+R turn back 15° · Delete removes.</p>
          </section>

          <section>
            <h2>Select a whole row</h2>
            <div className="rowchips">
              {ROW_IDS.map((r) => {
                const ids = ALL.filter((id) => BY_ID[id].row === r)
                return (
                  <button key={r} onClick={(e) => {
                    const all = withBlocks(ids)
                    setPicked((old) => (e.shiftKey || multi ? new Set([...old, ...all]) : new Set(all)))
                  }}>
                    {r} <small>{ids.length}</small>
                  </button>
                )
              })}
            </div>
          </section>

          <section>
            <h2>Summary</h2>
            <p className="muted">{assigned} of 115 garages have a title · {blockCount} locked block{blockCount === 1 ? '' : 's'}. Click a line to select those garages.</p>
            <table className="summary">
              <thead><tr><th>Title</th><th>Garages</th><th>Pieces</th></tr></thead>
              <tbody>
                {summary.map((t) => (
                  <tr key={t.id} className={t.garages ? '' : 'zero'} onClick={() => t.garages && setPicked(new Set(ALL.filter((id) => title[id] === t.id)))}>
                    <td><span className="dot" style={{ background: t.color }} />{t.name}</td>
                    <td>{t.garages}</td>
                    <td>{t.blocks.size}</td>
                  </tr>
                ))}
                <tr className="zero"><td><span className="dot empty" />No title yet</td><td>{115 - assigned}</td><td></td></tr>
              </tbody>
            </table>
          </section>

          <section>
            <h2>Save</h2>
            <p className="muted">Your plan saves itself in this browser. To keep it or send it on, download it.</p>
            <div className="actions">
              <button onClick={() => download('chemnitz-garage-plan.json', JSON.stringify(plan, null, 1), 'application/json')}>Download plan</button>
              <button onClick={() => file.current.click()}>Open plan…</button>
              <button onClick={exportCsv}>Download list (CSV)</button>
              <button className="primary" disabled={saving} onClick={exportRhino}>{saving ? 'Preparing the Rhino file…' : 'Download Rhino 8 model (.3dm)'}</button>
              <button className="danger" onClick={reset}>Start over</button>
              <input ref={file} type="file" accept=".json,application/json" hidden onChange={loadFile} />
            </div>
            <p className="muted small">Keys: Ctrl+Z undo · Ctrl+Y redo · L lock · U unlock · Esc deselect</p>
          </section>
        </div>
        <footer>Map data © OpenStreetMap contributors (ODbL).</footer>
      </aside>
    </div>
  )
}
