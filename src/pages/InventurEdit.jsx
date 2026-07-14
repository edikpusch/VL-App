import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useData } from '../useData.js'
import { uid, todayISO, BEREICHE, addHistorie, normNum, lerneVorschlag } from '../store.js'
import { Header, VorschlagListen, focusNextOnEnter } from '../components/Ui.jsx'

export default function InventurEdit() {
  const { id } = useParams()
  const [sp] = useSearchParams()
  const nav = useNavigate()
  const [data, update] = useData()
  const bestehend = data.inventuren.find((i) => i.id === id)
  const neu = !bestehend

  const [inv, setInv] = useState(
    bestehend
      ? { ...inv0(bestehend) }
      : {
          id: uid(), filialeId: sp.get('filiale') || (data.filialen[0]?.id ?? null),
          datum: todayISO(), bereich: BEREICHE[0],
          diffEuro: '', diffProzent: '', vjEuro: '', vjProzent: '',
          verlustbringer: [], notizen: '',
        }
  )
  const [vbInput, setVbInput] = useState('')

  function inv0(x) { return { ...x, verlustbringer: x.verlustbringer || [] } }

  const set = (key, val) => setInv({ ...inv, [key]: val })

  const speichern = () => {
    if (!inv.filialeId) return alert('Bitte eine Filiale wählen.')
    update((d) => {
      const idx = d.inventuren.findIndex((x) => x.id === inv.id)
      if (idx >= 0) d.inventuren[idx] = inv
      else {
        d.inventuren.unshift(inv)
        addHistorie(d, inv.filialeId, 'Inventur ' + inv.bereich + ' erfasst: ' + String(inv.diffProzent || '–').replace('.', ',') + ' %')
      }
    })
    nav(-1)
  }

  // Maßnahme = direkt verknüpfte Aufgabe anlegen
  const massnahmeAnlegen = () => {
    const titel = prompt('Maßnahme (wird als Aufgabe angelegt):')
    if (!titel || !titel.trim()) return
    update((d) => {
      const idx = d.inventuren.findIndex((x) => x.id === inv.id)
      if (idx >= 0) d.inventuren[idx] = inv
      else d.inventuren.unshift(inv)
      d.aufgaben.unshift({
        id: uid(), filialeId: inv.filialeId, titel: titel.trim(),
        kategorie: 'Inventur', prio: 'hoch', faelligkeit: todayISO(),
        beschreibung: 'Maßnahme aus Inventur ' + inv.bereich + ' vom ' + inv.datum,
        status: 'offen', intervallTage: 0, inventurId: inv.id,
      })
      lerneVorschlag(d, 'massnahmen', titel.trim())
    })
  }

  const massnahmen = data.aufgaben.filter((a) => a.inventurId === inv.id)

  const addVb = () => {
    const v = vbInput.trim()
    if (!v) return
    set('verlustbringer', [...inv.verlustbringer, v])
    update((d) => lerneVorschlag(d, 'artikel', v, inv.bereich))
    setVbInput('')
  }

  return (
    <>
      <Header title={neu ? 'Inventur-Ergebnis' : 'Inventur bearbeiten'} />
      <VorschlagListen data={data} />
      <div className="page">
        <div className="row2">
          <div className="field">
            <label>Filiale</label>
            <select value={inv.filialeId || ''} onChange={(e) => set('filialeId', e.target.value)}>
              {data.filialen.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Datum</label>
            <input type="date" value={inv.datum} onChange={(e) => set('datum', e.target.value)} />
          </div>
        </div>

        <div className="field">
          <label>Bereich</label>
          <div className="chip-row">
            {BEREICHE.map((b) => (
              <span key={b} className={'chip' + (inv.bereich === b ? ' active' : '')} onClick={() => set('bereich', b)}>{b}</span>
            ))}
          </div>
        </div>

        <div className="row2">
          <div className="field">
            <label>Differenz €</label>
            <input value={inv.diffEuro} onChange={(e) => set('diffEuro', normNum(e.target.value))} inputMode="decimal" placeholder="z. B. 1250" />
          </div>
          <div className="field">
            <label>Differenz %</label>
            <input value={inv.diffProzent} onChange={(e) => set('diffProzent', normNum(e.target.value))} inputMode="decimal" placeholder="z. B. 0,9" />
          </div>
        </div>
        <div className="row2">
          <div className="field">
            <label>Vorjahr €</label>
            <input value={inv.vjEuro} onChange={(e) => set('vjEuro', normNum(e.target.value))} inputMode="decimal" />
          </div>
          <div className="field">
            <label>Vorjahr %</label>
            <input value={inv.vjProzent} onChange={(e) => set('vjProzent', normNum(e.target.value))} inputMode="decimal" />
          </div>
        </div>

        <div className="field">
          <label>Top-Verlustbringer</label>
          <div className="chip-row" style={{ marginBottom: 8 }}>
            {inv.verlustbringer.map((v, i) => (
              <span key={i} className="chip active" onClick={() => set('verlustbringer', inv.verlustbringer.filter((_, j) => j !== i))}>{v} ✕</span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              list="dl-artikel"
              style={{ flex: 1, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', outline: 'none' }}
              value={vbInput} onChange={(e) => setVbInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addVb()}
              placeholder="Artikel eingeben… (tippen für Vorschläge)"
            />
            <button className="btn small" onClick={addVb}>+</button>
          </div>
        </div>

        <div className="field">
          <label>Notizen</label>
          <textarea value={inv.notizen} onChange={(e) => set('notizen', e.target.value)} />
        </div>

        {massnahmen.length > 0 && (
          <>
            <div className="section-title">Verknüpfte Maßnahmen</div>
            {massnahmen.map((m) => (
              <div key={m.id} className="card tappable" onClick={() => nav('/aufgabe/' + m.id)}>
                {m.status === 'erledigt' ? '✅ ' : '⬜ '}{m.titel}
              </div>
            ))}
          </>
        )}

        <button className="btn secondary" onClick={massnahmeAnlegen}>+ Maßnahme als Aufgabe anlegen</button>
        <button className="btn" onClick={speichern}>Speichern</button>
        {!neu && (
          <button className="btn danger" onClick={() => { if (confirm('Inventur-Eintrag löschen?')) { update((d) => { d.inventuren = d.inventuren.filter((x) => x.id !== inv.id) }); nav(-1) } }}>
            Löschen
          </button>
        )}
      </div>
    </>
  )
}
