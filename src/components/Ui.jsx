import { useNavigate, NavLink } from 'react-router-dom'

export function Header({ title, right, backTo }) {
  const nav = useNavigate()
  return (
    <div className="header">
      {backTo !== null && (
        <button className="back" onClick={() => (backTo ? nav(backTo) : nav(-1))} aria-label="Zurück">‹</button>
      )}
      <h1>{title}</h1>
      {right}
    </div>
  )
}

export function Ampel({ farbe, lg }) {
  return <span className={'ampel ' + farbe + (lg ? ' lg' : '')} />
}

export function BottomNav() {
  const items = [
    { to: '/', icon: '🏠', label: 'Bezirk', end: true },
    { to: '/aufgaben', icon: '✓', label: 'Aufgaben' },
    { to: '/kennzahlen', icon: '📊', label: 'Kennzahlen' },
    { to: '/befristungen', icon: '⏳', label: 'Verträge' },
    { to: '/einstellungen', icon: '⚙️', label: 'Mehr' },
  ]
  return (
    <nav className="bottomnav">
      {items.map((i) => (
        <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="icon">{i.icon}</span>
          {i.label}
        </NavLink>
      ))}
    </nav>
  )
}

// Enter/„Weiter" auf dem Zahlenblock springt zum nächsten Eingabefeld
export function focusNextOnEnter(e) {
  if (e.key !== 'Enter') return
  e.preventDefault()
  const inputs = [...document.querySelectorAll('input[inputmode="decimal"], input[inputmode="numeric"], input[type="number"]')]
  const i = inputs.indexOf(e.target)
  if (i >= 0 && inputs[i + 1]) inputs[i + 1].focus()
  else e.target.blur()
}

// Datalist für lernende Vorschläge: <input list="dl-massnahmen" /> etc.
export function VorschlagListen({ data }) {
  const v = data.vorschlaege || {}
  return (
    <>
      <datalist id="dl-artikel">
        {(v.artikel || []).map((a) => <option key={a.name} value={a.name} />)}
      </datalist>
      <datalist id="dl-massnahmen">
        {(v.massnahmen || []).map((m) => <option key={m} value={m} />)}
      </datalist>
      <datalist id="dl-aufgaben">
        {(v.aufgaben || []).map((t) => <option key={t} value={t} />)}
      </datalist>
    </>
  )
}

export function Empty({ icon, text }) {
  return (
    <div className="empty">
      <div className="big">{icon}</div>
      {text}
    </div>
  )
}

// Mini-Chart: einfache SVG-Sparkline, letzte N Werte
export function MiniChart({ werte, breite = 160, hoehe = 44, farbe = '#7c6cf0', invertiert = false }) {
  const vals = werte.map((v) => parseFloat(v)).filter((v) => !isNaN(v))
  if (vals.length < 2) return <span style={{ color: 'var(--muted)', fontSize: 13 }}>–</span>
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const span = max - min || 1
  const pad = 4
  const pts = vals.map((v, i) => {
    const x = pad + (i / (vals.length - 1)) * (breite - 2 * pad)
    const y = pad + (1 - (v - min) / span) * (hoehe - 2 * pad)
    return x.toFixed(1) + ',' + y.toFixed(1)
  })
  // Trend: bei invertiert (z.B. Differenzen) ist sinkend gut
  const trendGut = invertiert ? vals[vals.length - 1] <= vals[0] : vals[vals.length - 1] >= vals[0]
  const stroke = farbe === 'auto' ? (trendGut ? 'var(--gruen)' : 'var(--rot)') : farbe
  const [lx, ly] = pts[pts.length - 1].split(',')
  return (
    <svg className="minichart" width={breite} height={hoehe} viewBox={'0 0 ' + breite + ' ' + hoehe}>
      <polyline points={pts.join(' ')} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r="3" fill={stroke} />
    </svg>
  )
}
