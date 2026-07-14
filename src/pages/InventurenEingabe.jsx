import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../useData.js'
import { BEREICHE, uid, todayISO, normNum, num, addHistorie, fmtNum } from '../store.js'
import { Header, Empty, focusNextOnEnter } from '../components/Ui.jsx'

// Monats-Schnellerfassung: EIN Bereich (z. B. O&G-Inventur) → alle Filialen
// untereinander durchtippen. Trocken läuft separat über die TS-Inventur.
// Details (Verlustbringer, Maßnahmen) danach per Tap auf den Eintrag in der Filialakte.
const EINGABE_BEREICHE = BEREICHE.filter((b) => b !== 'Trocken')

export default function InventurenEingabe() {
  const [data, update] = useData()
  const nav = useNavigate()
  const [bereich, setBereich] = useState(EINGABE_BEREICHE[0])
  const [datum, setDatum] = useState(todayISO())
  const [werte, setWerte] = useState(() => init(data, EINGABE_BEREICHE[0], todayISO()))

  // Bestehenden Eintrag der Filiale für Bereich + Monat finden (upsert-Ziel)
  function findEintrag(d, fid, b, dat) {
    const monat = (dat || '').slice(0, 7)
    return d.inventuren.find((i) => i.filialeId === fid && i.bereich === b && (i.datum || '').slice(0, 7) === monat)
  }

  function init(d, b, dat) {
    const w = {}
    for (const f of d.filialen) {
      const e = findEintrag(d, f.id, b, dat)
      w[f.id] = { diffEuro: e?.diffEuro ?? '', diffProzent: e?.diffProzent ?? '', vjProzent: e?.vjProzent ?? '' }
    }
    return w
  }

  const neuLaden = (b, dat) => setWerte(init(data, b, dat))
  const set = (fid, key, val) => setWerte({ ...werte, [fid]: { ...werte[fid], [key]: normNum(val) } })

  const speichern = () => {
    update((d) => {
      for (const f of d.filialen) {
        const w = werte[f.id]
        if (!w) continue
        const leer = w.diffEuro === '' && w.diffProzent === '' && w.vjProzent === ''
        const bestehend = findEintrag(d, f.id, bereich, datum)
        if (leer) continue // nichts eingegeben → Filiale überspringen (bestehendes bleibt)
        if (bestehend) {
          Object.assign(bestehend, { datum, diffEuro: w.diffEuro, diffProzent: w.diffProzent, vjProzent: w.vjProzent })
        } else {
          d.inventuren.unshift({
            id: uid(), filialeId: f.id, datum, bereich,
            diffEuro: w.diffEuro, diffProzent: w.diffProzent, vjEuro: '', vjProzent: w.vjProzent,
            verlustbringer: [], notizen: '',
          })
          addHistorie(d, f.id, 'Inventur ' + bereich + ' erfasst: ' + (w.diffProzent !== '' ? fmtNum(w.diffProzent, 2) + ' %' : fmtNum(w.diffEuro, 0) + ' €'))
        }
      }
    })
    nav('/kennzahlen', { replace: true })
  }

  const befuellt = Object.values(werte).filter((w) => w.diffEuro !== '' || w.diffProzent !== '').length

  return (
    <>
      <Header title="Inventur-Eingabe" />
      <div className="page">
        <div className="field">
          <label>Bereich (Trocken → über TS-Inventur in der Filialakte)</label>
          <div className="chip-row">
            {EINGABE_BEREICHE.map((b) => (
              <span key={b} className={'chip' + (bereich === b ? ' active' : '')} onClick={() => { setBereich(b); neuLaden(b, datum) }}>{b}</span>
            ))}
          </div>
        </div>
        <div className="field">
          <label>Inventur-Datum</label>
          <input type="date" value={datum} onChange={(e) => { setDatum(e.target.value); neuLaden(bereich, e.target.value) }} />
        </div>

        {data.filialen.length === 0 && <Empty icon="🏪" text="Erst Filialen anlegen." />}

        {data.filialen.length > 0 && (
          <>
            <div className="section-title">
              <span>{bereich} — alle Filialen</span>
              <span className="badge accent">{befuellt}/{data.filialen.length}</span>
            </div>
            <div className="card" style={{ padding: '6px 10px' }}>
              <div style={{ display: 'flex', gap: 8, padding: '4px 4px 8px', fontSize: 12, color: 'var(--muted)' }}>
                <span style={{ flex: 1 }}>Filiale</span>
                <span style={{ width: 86, textAlign: 'center' }}>Diff €</span>
                <span style={{ width: 70, textAlign: 'center' }}>Diff %</span>
                <span style={{ width: 70, textAlign: 'center' }}>VJ %</span>
              </div>
              {data.filialen.map((f) => {
                const w = werte[f.id] || {}
                const p = num(w.diffProzent), vj = num(w.vjProzent)
                const schlechter = !isNaN(p) && !isNaN(vj) ? Math.abs(p) > Math.abs(vj) : null
                return (
                  <div key={f.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 4px' }}>
                    <span style={{ flex: 1, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {f.name}{schlechter != null && <span style={{ color: schlechter ? 'var(--rot)' : 'var(--gruen)' }}> {schlechter ? '▲' : '▼'}</span>}
                    </span>
                    <input style={{ ...inp, width: 86, textAlign: 'center' }} inputMode="decimal" enterKeyHint="next" onKeyDown={focusNextOnEnter}
                      value={String(w.diffEuro ?? '').replace('.', ',')} onChange={(e) => set(f.id, 'diffEuro', e.target.value)} />
                    <input style={{ ...inp, width: 70, textAlign: 'center' }} inputMode="decimal" enterKeyHint="next" onKeyDown={focusNextOnEnter}
                      value={String(w.diffProzent ?? '').replace('.', ',')} onChange={(e) => set(f.id, 'diffProzent', e.target.value)} />
                    <input style={{ ...inp, width: 70, textAlign: 'center' }} inputMode="decimal" enterKeyHint="next" onKeyDown={focusNextOnEnter}
                      value={String(w.vjProzent ?? '').replace('.', ',')} onChange={(e) => set(f.id, 'vjProzent', e.target.value)} />
                  </div>
                )
              })}
            </div>
            <div style={{ color: 'var(--muted)', fontSize: 12.5, margin: '4px 2px 0' }}>
              ▲/▼ = schlechter/besser als VJ · leere Filialen werden übersprungen · Verlustbringer & Maßnahmen danach per Tap auf den Eintrag in der Filialakte.
            </div>
            <button className="btn" onClick={speichern}>Alle speichern</button>
          </>
        )}
      </div>
    </>
  )
}

const inp = {
  background: 'var(--bg2)', border: '1px solid var(--border)',
  borderRadius: 10, padding: '9px 8px', fontSize: 15, outline: 'none',
}
