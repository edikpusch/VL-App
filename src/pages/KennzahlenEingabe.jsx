import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../useData.js'
import { uid, currentMonth, fmtMonat } from '../store.js'
import { Header, Empty } from '../components/Ui.jsx'

// Eingabemaske: Monat wählen → alle Filialen nacheinander durchtippen
export default function KennzahlenEingabe() {
  const [data, update] = useData()
  const nav = useNavigate()
  const [monat, setMonat] = useState(currentMonth())

  const [werte, setWerte] = useState(() => init(data, currentMonth()))

  function init(d, m) {
    const w = {}
    for (const f of d.filialen) {
      const kz = d.kennzahlen.find((k) => k.filialeId === f.id && k.monat === m)
      w[f.id] = { kassierleistung: kz?.kassierleistung ?? '', personalkosten: kz?.personalkosten ?? '' }
    }
    return w
  }

  const wechsleMonat = (m) => {
    setMonat(m)
    setWerte(init(data, m))
  }

  const set = (fid, key, val) => {
    setWerte({ ...werte, [fid]: { ...werte[fid], [key]: val.replace(',', '.') } })
  }

  const speichern = () => {
    update((d) => {
      for (const f of d.filialen) {
        const w = werte[f.id]
        if (!w || (w.kassierleistung === '' && w.personalkosten === '')) continue
        const idx = d.kennzahlen.findIndex((k) => k.filialeId === f.id && k.monat === monat)
        const eintrag = { id: idx >= 0 ? d.kennzahlen[idx].id : uid(), filialeId: f.id, monat, kassierleistung: w.kassierleistung, personalkosten: w.personalkosten }
        if (idx >= 0) d.kennzahlen[idx] = eintrag
        else d.kennzahlen.push(eintrag)
      }
    })
    nav('/kennzahlen', { replace: true })
  }

  return (
    <>
      <Header title="Kennzahlen eingeben" />
      <div className="page">
        <div className="field">
          <label>Monat</label>
          <input type="month" value={monat} onChange={(e) => wechsleMonat(e.target.value)} />
        </div>

        {data.filialen.length === 0 && <Empty icon="🏪" text="Erst Filialen anlegen." />}

        <div className="section-title">{fmtMonat(monat)} — alle Filialen</div>
        {data.filialen.map((f) => (
          <div key={f.id} className="card">
            <div style={{ fontWeight: 600, marginBottom: 9 }}>{f.name}</div>
            <div className="row2">
              <div>
                <label style={{ fontSize: 12.5, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Kassierleistung</label>
                <input
                  style={inp} inputMode="decimal" placeholder="Art./Min"
                  value={String(werte[f.id]?.kassierleistung ?? '').replace('.', ',')}
                  onChange={(e) => set(f.id, 'kassierleistung', e.target.value)}
                />
              </div>
              <div>
                <label style={{ fontSize: 12.5, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Personalkosten %</label>
                <input
                  style={inp} inputMode="decimal" placeholder="%"
                  value={String(werte[f.id]?.personalkosten ?? '').replace('.', ',')}
                  onChange={(e) => set(f.id, 'personalkosten', e.target.value)}
                />
              </div>
            </div>
          </div>
        ))}

        {data.filialen.length > 0 && <button className="btn" onClick={speichern}>Alle speichern</button>}
      </div>
    </>
  )
}

const inp = {
  width: '100%', background: 'var(--bg2)', border: '1px solid var(--border)',
  borderRadius: 10, padding: '10px 12px', fontSize: 16, outline: 'none',
}
