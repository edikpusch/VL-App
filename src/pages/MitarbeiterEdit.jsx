import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useData } from '../useData.js'
import { uid, FUNKTIONEN, fmtDate, todayISO, addHistorie, daysUntil } from '../store.js'
import { Header } from '../components/Ui.jsx'

export default function MitarbeiterEdit() {
  const { filialeId, id } = useParams()
  const [sp] = useSearchParams()
  const nav = useNavigate()
  const [data, update] = useData()
  const filiale = data.filialen.find((f) => f.id === filialeId)
  const bestehend = filiale?.mitarbeiter?.find((m) => m.id === id)
  const neu = !bestehend

  const [ma, setMa] = useState(
    bestehend
      ? { ...bestehend }
      : { id: uid(), name: '', funktion: 'VK', vertragsart: sp.get('befristet') ? 'befristet' : 'unbefristet', vertragsende: '', notiz: '', entscheidung: null }
  )
  const [entscheidungBis, setEntscheidungBis] = useState('')

  if (!filiale) return <Header title="Filiale nicht gefunden" backTo="/" />

  const set = (key, val) => setMa({ ...ma, [key]: val })

  const speichern = () => {
    if (!ma.name.trim()) return alert('Bitte einen Namen eingeben.')
    update((d) => {
      const f = d.filialen.find((x) => x.id === filialeId)
      if (!f.mitarbeiter) f.mitarbeiter = []
      const idx = f.mitarbeiter.findIndex((x) => x.id === ma.id)
      if (idx >= 0) f.mitarbeiter[idx] = ma
      else f.mitarbeiter.push(ma)
    })
    nav('/filiale/' + filialeId + '/personal', { replace: true })
  }

  // Befristungs-Entscheidung dokumentieren → Warnung erlischt, Historie-Eintrag
  const entscheiden = (typ) => {
    let text = ''
    let neuMa = { ...ma }
    if (typ === 'verlaengert') {
      if (!entscheidungBis) return alert('Bitte das neue Vertragsende wählen.')
      text = 'verlängert bis ' + fmtDate(entscheidungBis)
      neuMa.vertragsende = entscheidungBis
      neuMa.entscheidung = null // neue Befristung → Monitor läuft weiter bis 90 Tage vor neuem Ende
    } else if (typ === 'entfristet') {
      text = 'entfristet'
      neuMa.vertragsart = 'unbefristet'
      neuMa.vertragsende = ''
      neuMa.entscheidung = null
    } else {
      text = 'läuft aus'
      neuMa.entscheidung = { typ, text, datum: todayISO() }
    }
    setMa(neuMa)
    update((d) => {
      const f = d.filialen.find((x) => x.id === filialeId)
      const idx = f.mitarbeiter.findIndex((x) => x.id === ma.id)
      if (idx >= 0) f.mitarbeiter[idx] = neuMa
      else f.mitarbeiter.push(neuMa)
      addHistorie(d, filialeId, 'Befristung ' + ma.name + ': ' + text)
    })
  }

  const tage = ma.vertragsart === 'befristet' && ma.vertragsende ? daysUntil(ma.vertragsende) : null

  return (
    <>
      <Header title={neu ? 'Neuer Mitarbeiter' : ma.name} />
      <div className="page">
        <div className="field">
          <label>Name *</label>
          <input value={ma.name} onChange={(e) => set('name', e.target.value)} autoFocus={neu} />
        </div>

        <div className="field">
          <label>Funktion</label>
          <div className="chip-row">
            {FUNKTIONEN.map((fk) => (
              <span key={fk} className={'chip' + (ma.funktion === fk ? ' active' : '')} onClick={() => set('funktion', fk)}>{fk}</span>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Vertragsart</label>
          <div className="chip-row">
            {['unbefristet', 'befristet'].map((v) => (
              <span key={v} className={'chip' + (ma.vertragsart === v ? ' active' : '')} onClick={() => set('vertragsart', v)}>{v}</span>
            ))}
          </div>
        </div>

        {ma.vertragsart === 'befristet' && (
          <div className="field">
            <label>Vertragsende</label>
            <input type="date" value={ma.vertragsende || ''} onChange={(e) => set('vertragsende', e.target.value)} />
            {tage !== null && tage < 90 && !ma.entscheidung && (
              <div className="card" style={{ marginTop: 10, borderLeft: '4px solid ' + (tage < 30 ? 'var(--rot)' : 'var(--gelb)') }}>
                <div style={{ fontWeight: 600, marginBottom: 10 }}>
                  {tage < 0 ? '🔴 Vertrag abgelaufen!' : (tage < 30 ? '🔴' : '⚠️') + ' Läuft in ' + tage + ' Tagen ab — Entscheidung fällig'}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <input type="date" value={entscheidungBis} onChange={(e) => setEntscheidungBis(e.target.value)}
                    style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px', outline: 'none' }} />
                  <button className="btn small" onClick={() => entscheiden('verlaengert')}>Verlängert bis…</button>
                  <button className="btn small secondary" onClick={() => entscheiden('entfristet')}>Entfristet</button>
                  <button className="btn small secondary" onClick={() => entscheiden('laeuft_aus')}>Läuft aus</button>
                </div>
              </div>
            )}
            {ma.entscheidung && (
              <div style={{ marginTop: 8 }}>
                <span className="badge gruen">✓ Entscheidung: {ma.entscheidung.text} ({fmtDate(ma.entscheidung.datum)})</span>
              </div>
            )}
          </div>
        )}

        <div className="field">
          <label>Notiz</label>
          <textarea value={ma.notiz || ''} onChange={(e) => set('notiz', e.target.value)} />
        </div>

        <button className="btn" onClick={speichern}>Speichern</button>
        {!neu && (
          <button className="btn danger" onClick={() => {
            if (!confirm(ma.name + ' wirklich entfernen?')) return
            update((d) => {
              const f = d.filialen.find((x) => x.id === filialeId)
              f.mitarbeiter = f.mitarbeiter.filter((x) => x.id !== ma.id)
            })
            nav('/filiale/' + filialeId + '/personal', { replace: true })
          }}>Entfernen</button>
        )}
      </div>
    </>
  )
}
