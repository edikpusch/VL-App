import { useState, useMemo } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useData } from '../useData.js'
import { uid, todayISO, addHistorie, normNum } from '../store.js'
import { Header } from '../components/Ui.jsx'

// TS-Inventur: Gesamtverlust + die 5 schwächsten Bereiche (Freitext).
// Bereichsnamen werden filialübergreifend als Vorschläge angeboten (datalist).
export default function TsInventurEdit() {
  const { id } = useParams()
  const [sp] = useSearchParams()
  const nav = useNavigate()
  const [data, update] = useData()
  const bestehend = data.tsInventuren?.find((t) => t.id === id)
  const neu = !bestehend

  const [t, setT] = useState(
    bestehend
      ? { ...bestehend, bereiche: bestehend.bereiche.map((b) => ({ ...b })) }
      : {
          id: uid(), filialeId: sp.get('filiale') || (data.filialen[0]?.id ?? ''),
          datum: todayISO(), gesamtVerlustEuro: '', gesamtVerlustProzent: '',
          bereiche: Array.from({ length: 5 }, () => ({ name: '', diffEuro: '', diffProzent: '', kumEuro: '', kumProzent: '' })),
        }
  )

  // Alle je erfassten TS-Bereichsnamen (bezirksweit) für Autovervollständigung
  const namensVorschlaege = useMemo(() => {
    const s = new Set()
    for (const ti of data.tsInventuren || []) for (const b of ti.bereiche || []) if (b.name?.trim()) s.add(b.name.trim())
    return [...s].sort()
  }, [data])

  const set = (key, val) => setT({ ...t, [key]: val })
  const setB = (i, key, val) => {
    const bs = t.bereiche.map((b) => ({ ...b }))
    bs[i][key] = key === 'name' ? val : normNum(val)
    setT({ ...t, bereiche: bs })
  }

  const speichern = () => {
    if (!t.filialeId) return alert('Bitte eine Filiale wählen.')
    const rec = { ...t, bereiche: t.bereiche.filter((b) => b.name.trim() || b.diffEuro !== '' || b.diffProzent !== '') }
    update((d) => {
      const arr = (d.tsInventuren ||= [])
      const idx = arr.findIndex((x) => x.id === t.id)
      if (idx >= 0) arr[idx] = rec
      else { arr.unshift(rec); addHistorie(d, t.filialeId, 'TS-Inventur erfasst: Verlust ' + String(t.gesamtVerlustProzent || '–').replace('.', ',') + ' %') }
    })
    nav('/filiale/' + t.filialeId + '/inventuren', { replace: true })
  }

  return (
    <>
      <Header title={neu ? 'TS-Inventur' : 'TS-Inventur bearbeiten'} />
      <datalist id="ts-namen">
        {namensVorschlaege.map((n) => <option key={n} value={n} />)}
      </datalist>
      <div className="page">
        <div className="row2">
          <div className="field">
            <label>Filiale</label>
            <select value={t.filialeId} onChange={(e) => set('filialeId', e.target.value)}>
              {data.filialen.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Datum</label>
            <input type="date" value={t.datum} onChange={(e) => set('datum', e.target.value)} />
          </div>
        </div>

        <div className="section-title">Gesamtverlust TS</div>
        <div className="row2">
          <div className="field">
            <label>Gesamtverlust (€)</label>
            <input inputMode="decimal" value={String(t.gesamtVerlustEuro ?? '').replace('.', ',')} onChange={(e) => set('gesamtVerlustEuro', normNum(e.target.value))} />
          </div>
          <div className="field">
            <label>Gesamtverlust (%)</label>
            <input inputMode="decimal" value={String(t.gesamtVerlustProzent ?? '').replace('.', ',')} onChange={(e) => set('gesamtVerlustProzent', normNum(e.target.value))} />
          </div>
        </div>

        <div className="section-title">5 schwächste Bereiche</div>
        {t.bereiche.map((b, i) => (
          <div key={i} className="card" style={{ padding: 12 }}>
            <input list="ts-namen" style={{ ...inp, width: '100%', marginBottom: 8 }} value={b.name} onChange={(e) => setB(i, 'name', e.target.value)} placeholder={'Bereich ' + (i + 1) + ' (z. B. Tiernahrung)'} />
            <div className="row2" style={{ marginBottom: 8 }}>
              <div>
                <label style={lbl}>Diff. letzte Inv. (€)</label>
                <input style={inp} inputMode="decimal" value={String(b.diffEuro ?? '').replace('.', ',')} onChange={(e) => setB(i, 'diffEuro', e.target.value)} />
              </div>
              <div>
                <label style={lbl}>Diff. (%)</label>
                <input style={inp} inputMode="decimal" value={String(b.diffProzent ?? '').replace('.', ',')} onChange={(e) => setB(i, 'diffProzent', e.target.value)} />
              </div>
            </div>
            <div className="row2">
              <div>
                <label style={lbl}>Kumuliert (€)</label>
                <input style={inp} inputMode="decimal" value={String(b.kumEuro ?? '').replace('.', ',')} onChange={(e) => setB(i, 'kumEuro', e.target.value)} />
              </div>
              <div>
                <label style={lbl}>Kumuliert (%)</label>
                <input style={inp} inputMode="decimal" value={String(b.kumProzent ?? '').replace('.', ',')} onChange={(e) => setB(i, 'kumProzent', e.target.value)} />
              </div>
            </div>
          </div>
        ))}
        <button className="btn secondary" onClick={() => setT({ ...t, bereiche: [...t.bereiche, { name: '', diffEuro: '', diffProzent: '', kumEuro: '', kumProzent: '' }] })}>+ Bereich</button>

        <button className="btn" onClick={speichern}>Speichern</button>
        {!neu && (
          <button className="btn danger" onClick={() => { if (confirm('TS-Inventur löschen?')) { update((d) => { d.tsInventuren = d.tsInventuren.filter((x) => x.id !== t.id) }); nav(-1) } }}>Löschen</button>
        )}
      </div>
    </>
  )
}

const lbl = { fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }
const inp = {
  width: '100%', background: 'var(--bg2)', border: '1px solid var(--border)',
  borderRadius: 10, padding: '9px 11px', fontSize: 15, outline: 'none',
}
