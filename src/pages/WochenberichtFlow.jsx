import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useData } from '../useData.js'
import { uid, isoWeek, num, normNum, abwEuro, abwProzent, anteilProzent } from '../store.js'
import { focusNextOnEnter } from '../components/Ui.jsx'

const BASE = ['umsatzVj', 'umsatzPlan', 'umsatzIst', 'ogVj', 'ogIst', 'sbVj', 'sbIst', 'boUmsatz', 'boVj', 'stundenIst', 'stundenSoll', 'kunden', 'payback', 'kassierIst', 'kassierVj']
const DERIV = ['umsatzAbwPlanE', 'umsatzAbwPlanP', 'umsatzAbwVjE', 'umsatzAbwVjP', 'ogAbwVjE', 'ogAbwVjP', 'ogAnteil', 'sbAbwVjE', 'sbAbwVjP', 'sbAnteil', 'boAbwVjP', 'boAnteil', 'stundenDiff', 'kassierAbw', 'kassierAbwP']

const round = (v) => (isNaN(v) ? '' : Math.round(v * 100) / 100)

function recompute(d, manual) {
  const out = { ...d }
  const set = (k, v) => { if (!manual.has(k)) out[k] = round(v) }
  set('umsatzAbwPlanE', abwEuro(d.umsatzIst, d.umsatzPlan))
  set('umsatzAbwPlanP', abwProzent(d.umsatzIst, d.umsatzPlan))
  set('umsatzAbwVjE', abwEuro(d.umsatzIst, d.umsatzVj))
  set('umsatzAbwVjP', abwProzent(d.umsatzIst, d.umsatzVj))
  set('ogAbwVjE', abwEuro(d.ogIst, d.ogVj))
  set('ogAbwVjP', abwProzent(d.ogIst, d.ogVj))
  set('ogAnteil', anteilProzent(d.ogIst, d.umsatzIst))
  set('sbAbwVjE', abwEuro(d.sbIst, d.sbVj))
  set('sbAbwVjP', abwProzent(d.sbIst, d.sbVj))
  set('sbAnteil', anteilProzent(d.sbIst, d.umsatzIst))
  set('boAbwVjP', abwProzent(d.boUmsatz, d.boVj))
  set('boAnteil', anteilProzent(d.boUmsatz, d.umsatzIst))
  set('stundenDiff', abwEuro(d.stundenIst, d.stundenSoll))
  set('kassierAbw', abwEuro(d.kassierIst, d.kassierVj))
  set('kassierAbwP', abwProzent(d.kassierIst, d.kassierVj))
  return out
}

const dv = (x) => (x === '' || x == null ? '' : String(x).replace('.', ','))

export default function WochenberichtFlow() {
  const [data, update] = useData()
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const { kw: cKw, jahr: cJahr } = isoWeek()

  const [filialeId, setFilialeId] = useState(sp.get('filiale') || (data.filialen[0]?.id ?? ''))
  const [jahr, setJahr] = useState(cJahr)
  const [kw, setKw] = useState(cKw)
  const [step, setStep] = useState(0)
  const [manual, setManual] = useState(new Set())
  const [b, setB] = useState(() => load(data, filialeId, cJahr, cKw))

  function load(d, fid, j, k) {
    const found = (d.wochenberichte || []).find((w) => w.filialeId === fid && w.jahr === j && w.kw === k)
    const base = {}
    for (const f of [...BASE, ...DERIV]) base[f] = found ? (found[f] ?? '') : ''
    return base
  }
  const neuLaden = (fid, j, k) => { setManual(new Set()); setB(load(data, fid, j, k)) }

  const setBase = (key, val) => setB(recompute({ ...b, [key]: normNum(val) }, manual))
  const setDeriv = (key, val) => { const m = new Set(manual); m.add(key); setManual(m); setB({ ...b, [key]: normNum(val) }) }
  const resetDeriv = (key) => { const m = new Set(manual); m.delete(key); setManual(m); setB(recompute(b, m)) }

  const speichern = () => {
    if (!filialeId) return alert('Bitte eine Filiale wählen.')
    update((d) => {
      const idx = (d.wochenberichte ||= []).findIndex((w) => w.filialeId === filialeId && w.jahr === jahr && w.kw === kw)
      const rec = { id: idx >= 0 ? d.wochenberichte[idx].id : uid(), filialeId, jahr, kw, ...b }
      if (idx >= 0) d.wochenberichte[idx] = rec
      else d.wochenberichte.push(rec)
    })
    nav('/filiale/' + filialeId + '/kennzahlen', { replace: true })
  }

  // Kernfelder zuerst (Schritt 1–3), Detail-Aufschlüsselung optional (4–5).
  // Berechnete Werte sind je Schritt einklappbar.
  const steps = [
    { t: 'Gesamtumsatz', node: (
      <>
        <Feld label="Umsatz Vorjahr (€)" v={b.umsatzVj} on={(x) => setBase('umsatzVj', x)} />
        <Feld label="Umsatz Plan (€)" v={b.umsatzPlan} on={(x) => setBase('umsatzPlan', x)} />
        <Feld label="Umsatz Ist (€)" v={b.umsatzIst} on={(x) => setBase('umsatzIst', x)} />
        <Berechnet manual={manual} felder={['umsatzAbwPlanE', 'umsatzAbwPlanP', 'umsatzAbwVjE', 'umsatzAbwVjP']}>
          <Deriv label="Abw. zu Plan (€)" v={b.umsatzAbwPlanE} on={(x) => setDeriv('umsatzAbwPlanE', x)} reset={() => resetDeriv('umsatzAbwPlanE')} auto={!manual.has('umsatzAbwPlanE')} />
          <Deriv label="Abw. zu Plan (%)" v={b.umsatzAbwPlanP} on={(x) => setDeriv('umsatzAbwPlanP', x)} reset={() => resetDeriv('umsatzAbwPlanP')} auto={!manual.has('umsatzAbwPlanP')} />
          <Deriv label="Abw. zu VJ (€)" v={b.umsatzAbwVjE} on={(x) => setDeriv('umsatzAbwVjE', x)} reset={() => resetDeriv('umsatzAbwVjE')} auto={!manual.has('umsatzAbwVjE')} />
          <Deriv label="Abw. zu VJ (%)" v={b.umsatzAbwVjP} on={(x) => setDeriv('umsatzAbwVjP', x)} reset={() => resetDeriv('umsatzAbwVjP')} auto={!manual.has('umsatzAbwVjP')} />
        </Berechnet>
      </>
    ) },
    { t: 'Stunden · Kunden · Payback', node: (
      <>
        <Feld label="Stunden Ist" v={b.stundenIst} on={(x) => setBase('stundenIst', x)} />
        <Feld label="Stunden Soll" v={b.stundenSoll} on={(x) => setBase('stundenSoll', x)} />
        <Feld label="Kunden (Anzahl)" v={b.kunden} on={(x) => setBase('kunden', x)} />
        <Feld label="Payback-Anteil (%)" v={b.payback} on={(x) => setBase('payback', x)} />
        <Berechnet manual={manual} felder={['stundenDiff']}>
          <Deriv label="Stunden-Differenz" v={b.stundenDiff} on={(x) => setDeriv('stundenDiff', x)} reset={() => resetDeriv('stundenDiff')} auto={!manual.has('stundenDiff')} />
        </Berechnet>
      </>
    ) },
    { t: 'Kassierstatistik', node: (
      <>
        <Feld label="Kassierleistung Ist (Pos./Min)" v={b.kassierIst} on={(x) => setBase('kassierIst', x)} />
        <Feld label="Kassierleistung VJ (Pos./Min)" v={b.kassierVj} on={(x) => setBase('kassierVj', x)} />
        <Berechnet manual={manual} felder={['kassierAbw', 'kassierAbwP']}>
          <Deriv label="Abweichung (Pos./Min)" v={b.kassierAbw} on={(x) => setDeriv('kassierAbw', x)} reset={() => resetDeriv('kassierAbw')} auto={!manual.has('kassierAbw')} />
          <Deriv label="Abweichung zum VJ (%)" v={b.kassierAbwP} on={(x) => setDeriv('kassierAbwP', x)} reset={() => resetDeriv('kassierAbwP')} auto={!manual.has('kassierAbwP')} />
        </Berechnet>
      </>
    ) },
    { t: 'O&G + SB Umsatz', optional: true, node: (
      <>
        <div className="section-title" style={{ marginTop: 0 }}>O&G</div>
        <Feld label="O&G Vorjahr (€)" v={b.ogVj} on={(x) => setBase('ogVj', x)} />
        <Feld label="O&G Ist (€)" v={b.ogIst} on={(x) => setBase('ogIst', x)} />
        <Berechnet manual={manual} felder={['ogAbwVjE', 'ogAbwVjP', 'ogAnteil']}>
          <Deriv label="Abw. zu VJ (€)" v={b.ogAbwVjE} on={(x) => setDeriv('ogAbwVjE', x)} reset={() => resetDeriv('ogAbwVjE')} auto={!manual.has('ogAbwVjE')} />
          <Deriv label="Abw. zu VJ (%)" v={b.ogAbwVjP} on={(x) => setDeriv('ogAbwVjP', x)} reset={() => resetDeriv('ogAbwVjP')} auto={!manual.has('ogAbwVjP')} />
          <Deriv label="Anteil am Gesamt (%)" v={b.ogAnteil} on={(x) => setDeriv('ogAnteil', x)} reset={() => resetDeriv('ogAnteil')} auto={!manual.has('ogAnteil')} />
        </Berechnet>
        <div className="section-title">SB</div>
        <Feld label="SB Vorjahr (€)" v={b.sbVj} on={(x) => setBase('sbVj', x)} />
        <Feld label="SB Ist (€)" v={b.sbIst} on={(x) => setBase('sbIst', x)} />
        <Berechnet manual={manual} felder={['sbAbwVjE', 'sbAbwVjP', 'sbAnteil']}>
          <Deriv label="Abw. zu VJ (€)" v={b.sbAbwVjE} on={(x) => setDeriv('sbAbwVjE', x)} reset={() => resetDeriv('sbAbwVjE')} auto={!manual.has('sbAbwVjE')} />
          <Deriv label="Abw. zu VJ (%)" v={b.sbAbwVjP} on={(x) => setDeriv('sbAbwVjP', x)} reset={() => resetDeriv('sbAbwVjP')} auto={!manual.has('sbAbwVjP')} />
          <Deriv label="Anteil am Gesamt (%)" v={b.sbAnteil} on={(x) => setDeriv('sbAnteil', x)} reset={() => resetDeriv('sbAnteil')} auto={!manual.has('sbAnteil')} />
        </Berechnet>
      </>
    ) },
    { t: 'Bake-Off', optional: true, node: (
      <>
        <Feld label="Bake-Off Umsatz/Woche (€)" v={b.boUmsatz} on={(x) => setBase('boUmsatz', x)} />
        <Feld label="Bake-Off Vorjahr (€)" v={b.boVj} on={(x) => setBase('boVj', x)} />
        <Berechnet manual={manual} felder={['boAbwVjP', 'boAnteil']}>
          <Deriv label="Abw. zu VJ (%)" v={b.boAbwVjP} on={(x) => setDeriv('boAbwVjP', x)} reset={() => resetDeriv('boAbwVjP')} auto={!manual.has('boAbwVjP')} />
          <Deriv label="Anteil am Gesamt (%)" v={b.boAnteil} on={(x) => setDeriv('boAnteil', x)} reset={() => resetDeriv('boAnteil')} auto={!manual.has('boAnteil')} />
        </Berechnet>
      </>
    ) },
  ]

  const letzter = step === steps.length - 1
  const letzterKern = step === 2 // ab hier sind alle weiteren Schritte optional

  return (
    <>
      <div className="header">
        <button className="back" onClick={() => nav(-1)}>‹</button>
        <h1>Wochenbericht</h1>
      </div>
      <div className="page">
        {step === 0 && (
          <div className="card">
            <div className="field" style={{ marginBottom: 10 }}>
              <label>Filiale</label>
              <select value={filialeId} onChange={(e) => { setFilialeId(e.target.value); neuLaden(e.target.value, jahr, kw) }}>
                {data.filialen.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <div className="row2">
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Jahr</label>
                <input type="number" value={jahr} onChange={(e) => { const j = Number(e.target.value); setJahr(j); neuLaden(filialeId, j, kw) }} />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>KW</label>
                <input type="number" min="1" max="53" value={kw} onChange={(e) => { const k = Number(e.target.value); setKw(k); neuLaden(filialeId, jahr, k) }} />
              </div>
            </div>
          </div>
        )}

        {/* Fortschritt */}
        <div style={{ display: 'flex', gap: 6, margin: '4px 0 14px' }}>
          {steps.map((s, i) => (
            <div key={i} onClick={() => setStep(i)} style={{ flex: 1, height: 5, borderRadius: 3, cursor: 'pointer', background: i <= step ? 'var(--accent)' : 'var(--border)' }} />
          ))}
        </div>

        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>Schritt {step + 1}/{steps.length}</div>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>
          {steps[step].t}
          {steps[step].optional && <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 400 }}> (optional)</span>}
        </h2>

        {steps[step].node}

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          {step > 0 && <button className="btn secondary" style={{ flex: 1 }} onClick={() => setStep(step - 1)}>‹ Zurück</button>}
          {!letzter
            ? <button className="btn" style={{ flex: 2 }} onClick={() => setStep(step + 1)}>Weiter ›</button>
            : <button className="btn" style={{ flex: 2 }} onClick={speichern}>Speichern</button>}
        </div>
        {letzterKern && (
          <button className="btn secondary" onClick={speichern}>✓ Speichern ohne Details (O&G/SB/BO)</button>
        )}
      </div>
    </>
  )
}

function Feld({ label, v, on }) {
  return (
    <div className="field">
      <label>{label}</label>
      <input inputMode="decimal" enterKeyHint="next" onKeyDown={focusNextOnEnter} value={dv(v)} onChange={(e) => on(e.target.value)} />
    </div>
  )
}

// Einklappbarer Block für berechnete Werte — Kernfelder bleiben im Fokus
function Berechnet({ manual, felder, children }) {
  const hatManuell = felder.some((f) => manual.has(f))
  const [offen, setOffen] = useState(hatManuell)
  return (
    <div style={{ margin: '2px 0 14px' }}>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: 'var(--muted)', fontSize: 13.5, padding: '6px 2px' }}
        onClick={() => setOffen(!offen)}
      >
        <span style={{ color: 'var(--accent)' }}>ƒ</span>
        <span style={{ flex: 1 }}>Berechnete Werte ({felder.length}){hatManuell ? ' · manuell angepasst' : ' · auto'}</span>
        <span>{offen ? '▲' : '▼'}</span>
      </div>
      {offen && <div style={{ paddingTop: 4 }}>{children}</div>}
    </div>
  )
}

function Deriv({ label, v, on, reset, auto }) {
  return (
    <div className="field">
      <label style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>{label}</span>
        <span style={{ color: auto ? 'var(--accent)' : 'var(--muted)', fontSize: 11.5 }}>
          {auto ? 'auto' : <span onClick={reset} style={{ cursor: 'pointer' }}>manuell · zurücksetzen ↺</span>}
        </span>
      </label>
      <input inputMode="decimal" enterKeyHint="next" onKeyDown={focusNextOnEnter} value={dv(v)} onChange={(e) => on(e.target.value)}
        style={{ width: '100%', background: 'var(--card)', border: '1px solid ' + (auto ? 'var(--border)' : 'var(--accent)'), borderRadius: 10, padding: '11px 13px', fontSize: 16, outline: 'none', color: auto ? 'var(--muted)' : 'var(--text)' }} />
    </div>
  )
}
