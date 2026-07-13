import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../useData.js'
import { uid, currentMonth, fmtMonat, num, normNum, fmtEuro, fmtPP, abwEuro } from '../store.js'
import { Header, Empty } from '../components/Ui.jsx'

// Personalkosten pro Monat, alle Filialen: Plan/Ist in € und %, Abweichung auto.
export default function PersonalkostenEingabe() {
  const [data, update] = useData()
  const nav = useNavigate()
  const [monat, setMonat] = useState(currentMonth())
  const [werte, setWerte] = useState(() => init(data, currentMonth()))

  function init(d, m) {
    const w = {}
    for (const f of d.filialen) {
      const e = (d.personalkosten || []).find((p) => p.filialeId === f.id && p.monat === m)
      w[f.id] = { planEuro: e?.planEuro ?? '', planProzent: e?.planProzent ?? '', istEuro: e?.istEuro ?? '', istProzent: e?.istProzent ?? '' }
    }
    return w
  }
  const wechsle = (m) => { setMonat(m); setWerte(init(data, m)) }
  const set = (fid, key, val) => setWerte({ ...werte, [fid]: { ...werte[fid], [key]: normNum(val) } })

  const speichern = () => {
    update((d) => {
      const arr = (d.personalkosten ||= [])
      for (const f of d.filialen) {
        const w = werte[f.id]
        const leer = !w || Object.values(w).every((x) => x === '')
        const idx = arr.findIndex((p) => p.filialeId === f.id && p.monat === monat)
        if (leer) { if (idx >= 0) arr.splice(idx, 1); continue }
        const rec = { id: idx >= 0 ? arr[idx].id : uid(), filialeId: f.id, monat, ...w }
        if (idx >= 0) arr[idx] = rec; else arr.push(rec)
      }
    })
    nav('/kennzahlen', { replace: true })
  }

  return (
    <>
      <Header title="Personalkosten" />
      <div className="page">
        <div className="field">
          <label>Monat</label>
          <input type="month" value={monat} onChange={(e) => wechsle(e.target.value)} />
        </div>
        {data.filialen.length === 0 && <Empty icon="🏪" text="Erst Filialen anlegen." />}
        <div className="section-title">{fmtMonat(monat)}</div>
        {data.filialen.map((f) => {
          const w = werte[f.id] || {}
          const abwE = abwEuro(w.istEuro, w.planEuro)
          const abwP = num(w.istProzent) - num(w.planProzent)
          return (
            <div key={f.id} className="card">
              <div style={{ fontWeight: 600, marginBottom: 9 }}>{f.name}</div>
              <div className="row2" style={{ marginBottom: 8 }}>
                <div>
                  <label style={lbl}>Plankosten (€)</label>
                  <input style={inp} inputMode="decimal" value={dv(w.planEuro)} onChange={(e) => set(f.id, 'planEuro', e.target.value)} />
                </div>
                <div>
                  <label style={lbl}>Plan (%)</label>
                  <input style={inp} inputMode="decimal" value={dv(w.planProzent)} onChange={(e) => set(f.id, 'planProzent', e.target.value)} />
                </div>
              </div>
              <div className="row2">
                <div>
                  <label style={lbl}>Ist Monat (€)</label>
                  <input style={inp} inputMode="decimal" value={dv(w.istEuro)} onChange={(e) => set(f.id, 'istEuro', e.target.value)} />
                </div>
                <div>
                  <label style={lbl}>Ist (%)</label>
                  <input style={inp} inputMode="decimal" value={dv(w.istProzent)} onChange={(e) => set(f.id, 'istProzent', e.target.value)} />
                </div>
              </div>
              {(!isNaN(abwE) || !isNaN(abwP)) && (
                <div style={{ marginTop: 9, fontSize: 13.5, color: (abwE > 0 || abwP > 0) ? 'var(--rot)' : 'var(--gruen)' }}>
                  Abweichung zu Plan: {isNaN(abwE) ? '–' : fmtEuro(abwE)} · {isNaN(abwP) ? '–' : fmtPP(abwP)}
                </div>
              )}
            </div>
          )
        })}
        {data.filialen.length > 0 && <button className="btn" onClick={speichern}>Speichern</button>}
      </div>
    </>
  )
}

const dv = (x) => (x === '' || x == null ? '' : String(x).replace('.', ','))
const lbl = { fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }
const inp = { width: '100%', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 11px', fontSize: 15, outline: 'none' }
