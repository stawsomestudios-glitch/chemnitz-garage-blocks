import { useEffect, useState } from 'react'

// Ready colours to click: whites and greys, warm sand tones, greens, blues, reds and yellows, black.
export const PALETTE = [
  '#ffffff', '#f3f1ec', '#e8e5dc', '#d2d0ca', '#b1b0ac', '#8a8b8d', '#5d6166', '#3b3d40', '#1d1f22', '#000000',
  '#f6efe2', '#ece2cf', '#dccfb2', '#c8b48f', '#a88d64', '#8a6a45', '#6b4f33', '#e9d6a8', '#d6a531', '#f2c200',
  '#eef1e9', '#c4d4a8', '#93b56a', '#6f9a4c', '#4f7a4a', '#2f5a35', '#bcd3df', '#7fb0d8', '#2f5fa8', '#0047ab',
  '#1b2a4a', '#f2c9c9', '#e2738a', '#e30613', '#b5484a', '#8c3a3d', '#9b6fd0', '#5b3f8a', '#f29f4c', '#ff7a1a',
]

// Reads a colour code: #0047AB, 0047ab, #04a, or true colour as R,G,B (0–255) like "0,71,171", "0 71 171" or "rgb(0, 71, 171)".
export function parseColour(text) {
  const t = String(text).trim().toLowerCase()
  let m = t.match(/^#?([0-9a-f]{6})$/)
  if (m) return '#' + m[1]
  m = t.match(/^#?([0-9a-f])([0-9a-f])([0-9a-f])$/)
  if (m) return '#' + m[1] + m[1] + m[2] + m[2] + m[3] + m[3]
  m = t.replace(/^rgb\s*\(|\)$/g, '').match(/^(\d{1,3})\s*[,;\s]\s*(\d{1,3})\s*[,;\s]\s*(\d{1,3})$/)
  if (m && m.slice(1).every((v) => +v <= 255)) return '#' + m.slice(1).map((v) => (+v).toString(16).padStart(2, '0')).join('')
  return null
}
export const toRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')

// One colour: the swatch opens the colour picker; or type a code; or choose from the palette; or pick from the screen.
export default function ColourField({ label, value, onChange, onReset, changed }) {
  const [text, setText] = useState(value.toUpperCase())
  const [open, setOpen] = useState(false)
  const [bad, setBad] = useState(false)
  useEffect(() => {
    setText(value.toUpperCase())
    setBad(false)
  }, [value])
  const commit = () => {
    const c = parseColour(text)
    if (!c) return setBad(true)
    setBad(false)
    if (c !== value) onChange(c)
    else setText(c.toUpperCase())
  }
  const eyedropper = typeof window !== 'undefined' && 'EyeDropper' in window
  return (
    <div className="colour-field">
      <div className="cf-row">
        <span className="cf-label">{label}</span>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} title="Open the colour picker" aria-label={`${label}: colour picker`} />
        <input
          className={bad ? 'cf-code bad' : 'cf-code'}
          value={text}
          spellCheck={false}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
          title={`Type a colour code: #RRGGBB or true colour R,G,B. Now: RGB ${toRgb(value)}`}
          aria-label={`${label}: colour code`}
        />
        <button className={open ? 'cf-btn on' : 'cf-btn'} onClick={() => setOpen(!open)} title="Choose from the palette" aria-label="Palette">
          <span className="cf-grid" />
        </button>
        {eyedropper && (
          <button
            className="cf-btn"
            title="Pick a colour from anywhere on the screen"
            aria-label="Pick from the screen"
            onClick={async () => {
              try {
                const r = await new window.EyeDropper().open()
                onChange(r.sRGBHex.toLowerCase())
              } catch {}
            }}
          >
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <path d="M11.3 1.6a1.9 1.9 0 0 1 2.7 2.7l-1.7 1.7.7.7-1.1 1.1-.7-.7-5.6 5.6H3.2v-2.4l5.6-5.6-.7-.7 1.1-1.1.7.7z" fill="currentColor" />
            </svg>
          </button>
        )}
        {changed && onReset ? (
          <button className="cf-btn" onClick={onReset} title="Back to the usual colour" aria-label="Reset colour">↺</button>
        ) : (
          <span className="cf-btn ghost" />
        )}
      </div>
      {bad && <p className="cf-bad">Type a code like #0047AB or 0,71,171.</p>}
      {open && (
        <div className="cf-palette">
          {PALETTE.map((c) => (
            <button key={c} className={c === value ? 'on' : ''} style={{ background: c }} title={`${c.toUpperCase()} · RGB ${toRgb(c)}`} aria-label={c} onClick={() => onChange(c)} />
          ))}
        </div>
      )}
    </div>
  )
}
