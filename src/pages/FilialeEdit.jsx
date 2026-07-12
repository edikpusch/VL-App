import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useData } from '../useData.js'
import { uid } from '../store.js'
import { Header } from '../components/Ui.jsx'

const ROLLEN = ['Marktleiter', 'stv. Marktleiter', 'Schlüsselträger']

export default function FilialeEdit() {
  const { id } = useParams()
  const nav = useNavigate()
  const [data, update] = useData()
  const bestehend = data.filialen.find((f) => f.id === id)
  const neu = !bestehend

  const [f, setF] = useState(
    bestehend
      ? JSON.parse(JSON.stringify(bestehend))
      : { id: uid(), nummer: '', name: '', adresse: '', telefon: '', oeffnungszeiten: '', verkaufsflaeche: '', ansprechpartner: [], besonderheiten: [], mitarbeiter: [], historie: [] }
  )
  const [tagInput, setTagInput] = useState('')

  const set = (key, val) => setF({ ...f, [key]: val })

  const speichern = () => {
    if (!f.name.trim()) return alert('Bitte einen Filialnamen eingeben.')
    update((d) => {
      const idx = d.filialen.findIndex((x) => x.id === f.id)
      if (idx >= 0) d.filialen[idx] = { ...d.filialen[idx], ...f }
      else d.filialen.push(f)
    })
    nav('/filiale/' + f.id, { replace: true })
  }

  const loeschen = () => {
    if (!confirm('Filiale "' + f.name + '" wirklich löschen? Alle zugehörigen Aufgaben, Notizen, Inventuren und Kennzahlen werden mit entfernt.')) return
    update((d) => {
      d.filialen = d.filialen.filter((x) => x.id !== f.id)
      d.aufgaben = d.aufgaben.filter((a) => a.filialeId !== f.id)
      d.notizen = d.notizen.filter((n) => n.filialeId !== f.id)
      d.inventuren = d.inventuren.filter((i) => i.filialeId !== f.id)
      d.kennzahlen = d.kennzahlen.filter((k) => k.filialeId !== f.id)
    })
    nav('/', { replace: true })
  }

  const addTag = () => {
    const t = tagInput.trim()
    if (!t) return
    set('besonderheiten', [...(f.besonderheiten || []), t])
    setTagInput('')
  }

  const setAp = (i, key, val) => {
    const ap = [...f.ansprechpartner]
    ap[i] = { ...ap[i], [key]: val }
    set('ansprechpartner', ap)
  }

  return (
    <>
      <Header title={neu ? 'Neue Filiale' : f.name + ' bearbeiten'} />
      <div className="page">
        <div className="row2">
          <div className="field">
            <label>Filialnummer</label>
            <input value={f.nummer} onChange={(e) => set('nummer', e.target.value)} placeholder="z. B. 4711" />
          </div>
          <div className="field">
            <label>Name *</label>
            <input value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="z. B. Musterstadt" />
          </div>
        </div>
        <div className="field">
          <label>Adresse</label>
          <input value={f.adresse} onChange={(e) => set('adresse', e.target.value)} placeholder="Straße, PLZ Ort" />
        </div>
        <div className="row2">
          <div className="field">
            <label>Telefon</label>
            <input value={f.telefon} onChange={(e) => set('telefon', e.target.value)} inputMode="tel" />
          </div>
          <div className="field">
            <label>Verkaufsfläche (m²)</label>
            <input value={f.verkaufsflaeche} onChange={(e) => set('verkaufsflaeche', e.target.value)} inputMode="numeric" />
          </div>
        </div>
        <div className="field">
          <label>Öffnungszeiten</label>
          <input value={f.oeffnungszeiten} onChange={(e) => set('oeffnungszeiten', e.target.value)} placeholder="z. B. Mo–Sa 7–21 Uhr" />
        </div>

        <div className="section-title">Ansprechpartner</div>
        {(f.ansprechpartner || []).map((p, i) => (
          <div key={p.id} className="card">
            <div className="row2" style={{ marginBottom: 8 }}>
              <input style={inp} value={p.name} onChange={(e) => setAp(i, 'name', e.target.value)} placeholder="Name" />
              <select style={inp} value={p.rolle} onChange={(e) => setAp(i, 'rolle', e.target.value)}>
                {ROLLEN.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input style={{ ...inp, flex: 1 }} value={p.telefon} onChange={(e) => setAp(i, 'telefon', e.target.value)} placeholder="Telefon" inputMode="tel" />
              <button className="btn small danger" onClick={() => set('ansprechpartner', f.ansprechpartner.filter((x) => x.id !== p.id))}>✕</button>
            </div>
          </div>
        ))}
        <button className="btn secondary" onClick={() => set('ansprechpartner', [...(f.ansprechpartner || []), { id: uid(), name: '', rolle: 'Marktleiter', telefon: '' }])}>
          + Ansprechpartner
        </button>

        <div className="section-title">Besonderheiten (Tags)</div>
        <div className="chip-row" style={{ marginBottom: 10 }}>
          {(f.besonderheiten || []).map((t, i) => (
            <span key={i} className="chip active" onClick={() => set('besonderheiten', f.besonderheiten.filter((_, j) => j !== i))}>
              {t} ✕
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            style={{ ...inp, flex: 1 }}
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTag()}
            placeholder="z. B. Bake-Off, Leergutautomat XY…"
          />
          <button className="btn small" onClick={addTag}>+</button>
        </div>

        <button className="btn" style={{ marginTop: 22 }} onClick={speichern}>Speichern</button>
        {!neu && <button className="btn danger" onClick={loeschen}>Filiale löschen</button>}
      </div>
    </>
  )
}

const inp = {
  width: '100%', background: 'var(--bg2)', border: '1px solid var(--border)',
  borderRadius: 10, padding: '10px 12px', fontSize: 15, outline: 'none',
}
