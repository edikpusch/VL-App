import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useData } from '../useData.js'
import { uid, todayISO, addDays, addHistorie, lerneVorschlag } from '../store.js'
import { Header, VorschlagListen } from '../components/Ui.jsx'

export default function AufgabeEdit() {
  const { id } = useParams()
  const [sp] = useSearchParams()
  const nav = useNavigate()
  const [data, update] = useData()
  const bestehend = data.aufgaben.find((a) => a.id === id)
  const neu = !bestehend

  const [a, setA] = useState(
    bestehend
      ? { ...bestehend }
      : {
          id: uid(),
          filialeId: sp.get('filiale') || (data.filialen[0]?.id ?? null),
          titel: '', kategorie: data.einstellungen.kategorien[0] || 'Sonstiges',
          prio: 'mittel', faelligkeit: todayISO(), beschreibung: '',
          status: 'offen', intervallTage: 0,
        }
  )

  const set = (key, val) => setA({ ...a, [key]: val })

  const speichern = () => {
    if (!a.titel.trim()) return alert('Bitte einen Titel eingeben.')
    update((d) => {
      const idx = d.aufgaben.findIndex((x) => x.id === a.id)
      if (idx >= 0) d.aufgaben[idx] = a
      else d.aufgaben.unshift(a)
      lerneVorschlag(d, 'aufgaben', a.titel)
    })
    nav(-1)
  }

  const loeschen = () => {
    if (!confirm('Aufgabe löschen?')) return
    update((d) => { d.aufgaben = d.aufgaben.filter((x) => x.id !== a.id) })
    nav(-1)
  }

  const quickTaps = [
    ['Heute', todayISO()],
    ['Morgen', addDays(todayISO(), 1)],
    ['+3 Tage', addDays(todayISO(), 3)],
    ['+1 Woche', addDays(todayISO(), 7)],
  ]

  return (
    <>
      <Header title={neu ? 'Neue Aufgabe' : 'Aufgabe bearbeiten'} />
      <div className="page">
        <div className="field">
          <label>Filiale</label>
          <select value={a.filialeId || ''} onChange={(e) => set('filialeId', e.target.value || null)}>
            <option value="">Bezirk allgemein</option>
            {data.filialen.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>

        <div className="field">
          <label>Kategorie</label>
          <div className="chip-row">
            {data.einstellungen.kategorien.map((k) => (
              <span key={k} className={'chip' + (a.kategorie === k ? ' active' : '')} onClick={() => set('kategorie', k)}>{k}</span>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Titel *</label>
          <input list="dl-aufgaben" value={a.titel} onChange={(e) => set('titel', e.target.value)} placeholder="Was ist zu tun? (tippen für Vorschläge)" autoFocus={neu} />
        </div>
        <VorschlagListen data={data} />

        <div className="field">
          <label>Priorität</label>
          <div className="chip-row">
            {['hoch', 'mittel', 'niedrig'].map((p) => (
              <span key={p} className={'chip' + (a.prio === p ? ' active' : '')} onClick={() => set('prio', p)}>
                <span className={'prio-dot prio-' + p} style={{ marginRight: 6 }} />{p}
              </span>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Fälligkeit</label>
          <div className="chip-row" style={{ marginBottom: 8 }}>
            {quickTaps.map(([label, datum]) => (
              <span key={label} className={'chip' + (a.faelligkeit === datum ? ' active' : '')} onClick={() => set('faelligkeit', datum)}>{label}</span>
            ))}
          </div>
          <input type="date" value={a.faelligkeit || ''} onChange={(e) => set('faelligkeit', e.target.value)} />
        </div>

        <div className="field">
          <label>Wiederholung (Tage, 0 = keine)</label>
          <div className="chip-row" style={{ marginBottom: 8 }}>
            {[[0, 'Keine'], [7, 'Wöchentl.'], [14, '14 Tage'], [30, 'Monatl.']].map(([t, label]) => (
              <span key={t} className={'chip' + (Number(a.intervallTage) === t ? ' active' : '')} onClick={() => set('intervallTage', t)}>{label}</span>
            ))}
          </div>
          <input type="number" min="0" value={a.intervallTage || 0} onChange={(e) => set('intervallTage', Number(e.target.value))} inputMode="numeric" />
        </div>

        <div className="field">
          <label>Beschreibung (optional)</label>
          <textarea value={a.beschreibung || ''} onChange={(e) => set('beschreibung', e.target.value)} />
        </div>

        <button className="btn" onClick={speichern}>Speichern</button>
        {!neu && <button className="btn danger" onClick={loeschen}>Löschen</button>}
      </div>
    </>
  )
}
