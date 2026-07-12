import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useData } from '../useData.js'
import { uid, todayISO, addDays, addHistorie } from '../store.js'
import { Header } from '../components/Ui.jsx'

export default function NotizEdit() {
  const { id } = useParams()
  const [sp] = useSearchParams()
  const nav = useNavigate()
  const [data, update] = useData()
  const bestehend = data.notizen.find((n) => n.id === id)
  const neu = !bestehend

  const [n, setN] = useState(
    bestehend
      ? { ...bestehend }
      : { id: uid(), filialeId: sp.get('filiale') || null, text: '', wiedervorlage: '', erledigt: false, angelegt: todayISO() }
  )

  const set = (key, val) => setN({ ...n, [key]: val })

  const speichern = () => {
    if (!n.text.trim()) return alert('Bitte einen Text eingeben.')
    update((d) => {
      const idx = d.notizen.findIndex((x) => x.id === n.id)
      if (idx >= 0) d.notizen[idx] = n
      else d.notizen.unshift(n)
    })
    nav(-1)
  }

  const erledigen = () => {
    update((d) => {
      const idx = d.notizen.findIndex((x) => x.id === n.id)
      if (idx >= 0) {
        d.notizen[idx] = { ...n, erledigt: true, erledigtAm: todayISO() }
        if (n.filialeId) addHistorie(d, n.filialeId, 'Notiz erledigt: ' + n.text.slice(0, 60))
      }
    })
    nav(-1)
  }

  // Notiz → Aufgabe in einem Tap
  const inAufgabe = () => {
    update((d) => {
      d.aufgaben.unshift({
        id: uid(), filialeId: n.filialeId, titel: n.text.slice(0, 80),
        kategorie: 'Sonstiges', prio: 'mittel',
        faelligkeit: n.wiedervorlage || todayISO(),
        beschreibung: n.text.length > 80 ? n.text : '',
        status: 'offen', intervallTage: 0,
      })
      const idx = d.notizen.findIndex((x) => x.id === n.id)
      if (idx >= 0) d.notizen[idx] = { ...n, erledigt: true, erledigtAm: todayISO() }
      else d.notizen.unshift({ ...n, erledigt: true, erledigtAm: todayISO() })
      if (n.filialeId) addHistorie(d, n.filialeId, 'Notiz in Aufgabe umgewandelt: ' + n.text.slice(0, 60))
    })
    nav(-1)
  }

  const quickTaps = [
    ['Keine', ''],
    ['Morgen', addDays(todayISO(), 1)],
    ['+1 Woche', addDays(todayISO(), 7)],
    ['+2 Wochen', addDays(todayISO(), 14)],
  ]

  return (
    <>
      <Header title={neu ? 'Neue Notiz' : 'Notiz'} />
      <div className="page">
        <div className="field">
          <label>Filiale</label>
          <select value={n.filialeId || ''} onChange={(e) => set('filialeId', e.target.value || null)}>
            <option value="">Bezirk allgemein</option>
            {data.filialen.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>

        <div className="field">
          <label>Notiz *</label>
          <textarea value={n.text} onChange={(e) => set('text', e.target.value)} style={{ minHeight: 120 }} autoFocus={neu} placeholder='z. B. "Lavazza kurzes MHD, Zweitplatzierung entfernen"' />
        </div>

        <div className="field">
          <label>🔔 Wiedervorlage</label>
          <div className="chip-row" style={{ marginBottom: 8 }}>
            {quickTaps.map(([label, datum]) => (
              <span key={label} className={'chip' + ((n.wiedervorlage || '') === datum ? ' active' : '')} onClick={() => set('wiedervorlage', datum)}>{label}</span>
            ))}
          </div>
          <input type="date" value={n.wiedervorlage || ''} onChange={(e) => set('wiedervorlage', e.target.value)} />
        </div>

        <button className="btn" onClick={speichern}>Speichern</button>
        <button className="btn secondary" onClick={inAufgabe}>➜ In Aufgabe umwandeln</button>
        {!neu && !n.erledigt && <button className="btn secondary" onClick={erledigen}>✓ Erledigt</button>}
        {!neu && (
          <button className="btn danger" onClick={() => { if (confirm('Notiz löschen?')) { update((d) => { d.notizen = d.notizen.filter((x) => x.id !== n.id) }); nav(-1) } }}>
            Löschen
          </button>
        )}
      </div>
    </>
  )
}
