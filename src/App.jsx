import { useEffect, useMemo, useRef, useState } from 'react'
import Scene from './Scene.jsx'
import { GARAGES, BY_ID, ROW_IDS, connected, label } from './garages.js'
import { TITLES, TITLE } from './titles.js'

const BASE = import.meta.env.BASE_URL
const KEY = 'chemnitz-garage-blocks-v1'
const ALL = GARAGES.map((g) => g.id)

// Your plan is kept in this browser so it is still there next time.
function loadSaved() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY))
    if (s && s.title && s.block) return clean(s)
  } catch {}
  return { title: {}, block: {} }
}
function clean(s) {
  const title = {}
  const block = {}
  for (const id of ALL) {
    if (TITLE[s.title?.[id]]) title[id] = s.title[id]
    if (s.block?.[id]) block[id] = String(s.block[id])
  }
  return { title, block }
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
  const [plan, setPlan] = useState(loadSaved)
  const [picked, setPicked] = useState(() => new Set())
  const [multi, setMulti] = useState(false)
  const [labels, setLabels] = useState('titles')
  const [view, setView] = useState(null)
  const [note, setNote] = useState(null)
  const file = useRef()
  const { title, block } = plan

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
  const selBlocks = new Set(sel.map((id) => block[id]).filter(Boolean))
  const selTitles = new Set(sel.map((id) => title[id] ?? null))
  const shared = selTitles.size === 1 ? [...selTitles][0] : undefined

  const setTitle = (t) => {
    const ids = withBlocks(sel)
    setPlan((p) => {
      const title = { ...p.title }
      for (const id of ids) {
        if (t) title[id] = t
        else delete title[id]
      }
      return { ...p, title }
    })
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
      return { title: t, block: b }
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
    const key = (e) => {
      if (e.target.tagName === 'INPUT') return
      if (e.key === 'Escape') setPicked(new Set())
      if (e.key === 'l' || e.key === 'L') lock()
      if (e.key === 'u' || e.key === 'U') unlock()
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
    if (!confirm('Clear every title and block?')) return
    setPlan({ title: {}, block: {} })
    setPicked(new Set())
  }

  if (error) return <p className="message">The site data didn’t load ({error}).</p>
  if (!site) return <p className="message">Loading the garages…</p>

  const selText = sel.length === 0 ? null : sel.length <= 6 ? sel.map(label).join(', ') : `${label(sel[0])} … ${label(sel.at(-1))}`

  return (
    <div className="app">
      <main className="stage">
        <Scene site={site} title={title} block={block} picked={picked} onPick={pick} onClear={() => setPicked(new Set())} labels={labels} view={view} />
        <div className="bar top">
          <div className="seg-group" role="group" aria-label="Camera">
            <button onClick={() => setView({ name: 'home', t: Date.now() })}>3D</button>
            <button onClick={() => setView({ name: 'plan', t: Date.now() })}>Plan</button>
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
            <h2>{sel.length ? `${sel.length} garage${sel.length > 1 ? 's' : ''} selected` : 'Nothing selected'}</h2>
            <p className="muted">
              {sel.length
                ? `${selText}${selBlocks.size ? ` · ${selBlocks.size} locked block${selBlocks.size > 1 ? 's' : ''}` : ''}`
                : 'Click a garage or its title. Shift-click to add more, or tick the box below.'}
            </p>
            <label className="check">
              <input type="checkbox" checked={multi} onChange={(e) => setMulti(e.target.checked)} /> Add to selection on each click
            </label>
            <div className="actions">
              <button className="primary" disabled={withBlocks(sel).length < 2 || (selBlocks.size === 1 && sel.every((id) => block[id]))} onClick={lock}>
                Lock together
              </button>
              <button disabled={!selBlocks.size} onClick={unlock}>Unlock</button>
              <button disabled={!sel.length} onClick={() => setPicked(new Set())}>Deselect</button>
            </div>
          </section>

          <section>
            <h2>Title</h2>
            <div className="titles">
              {TITLES.map((t) => (
                <button key={t.id} disabled={!sel.length} className={shared === t.id ? 'on' : ''} onClick={() => setTitle(t.id)}>
                  <span className="dot" style={{ background: t.color }} />
                  {t.name}
                </button>
              ))}
              <button disabled={!sel.length} className="none" onClick={() => setTitle(null)}>No title</button>
            </div>
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
              <button className="danger" onClick={reset}>Start over</button>
              <input ref={file} type="file" accept=".json,application/json" hidden onChange={loadFile} />
            </div>
            <p className="muted small">Keys: L lock · U unlock · Esc deselect</p>
          </section>
        </div>
        <footer>Map data © OpenStreetMap contributors (ODbL).</footer>
      </aside>
    </div>
  )
}
