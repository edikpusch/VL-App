import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../useData.js'
import { daysUntil, fmtDate } from '../store.js'
import { Header, Empty } from '../components/Ui.jsx'

// Bezirksweite Befristungsliste, sortiert nach Ablaufdatum.
// Neue Befristungen direkt von hier anlegen (Filiale wählen → Mitarbeiter).
export default function Befristungen() {
  const [data] = useData()
  const nav = useNavigate()
  const [neuPicker, setNeuPicker] = useState(false)

  const liste = useMemo(() => {
    const res = []
    for (const f of data.filialen) {
      for (const ma of f.mitarbeiter || []) {
        if (ma.vertragsart === 'befristet' && ma.vertragsende) {
          res.push({ ma, filiale: f, tage: daysUntil(ma.vertragsende) })
        }
      }
    }
    return res.sort((a, b) => a.ma.vertragsende.localeCompare(b.ma.vertragsende))
  }, [data])

  return (
    <>
      <Header
        title="Befristungen"
        backTo={null}
        right={<button className="btn small" onClick={() => setNeuPicker(!neuPicker)}>+ Neu</button>}
      />
      <div className="page">
        {neuPicker && (
          <div className="card">
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>Befristeten Vertrag anlegen — in welcher Filiale?</div>
            <div className="chip-row">
              {data.filialen.map((f) => (
                <span key={f.id} className="chip" onClick={() => nav('/mitarbeiter/' + f.id + '/neu?befristet=1')}>{f.name}</span>
              ))}
              {data.filialen.length === 0 && <span style={{ color: 'var(--muted)', fontSize: 14 }}>Erst eine Filiale anlegen.</span>}
            </div>
          </div>
        )}

        {liste.length === 0 && (
          <Empty icon="⏳" text={'Keine befristeten Verträge erfasst. Über „+ Neu" oben legst du Mitarbeiter mit Vertragsende an — die App warnt dann automatisch.'} />
        )}

        {liste.map(({ ma, filiale, tage }) => {
          const offen = !ma.entscheidung
          const farbe = offen && tage < 30 ? 'rot' : offen && tage < 90 ? 'gelb' : ''
          return (
            <div key={ma.id} className="card tappable" style={farbe ? { borderLeft: '4px solid var(--' + farbe + ')' } : {}}
              onClick={() => nav('/mitarbeiter/' + filiale.id + '/' + ma.id)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontWeight: 600, flex: 1 }}>{ma.name}</span>
                <span className="badge">{ma.funktion || '–'}</span>
                <span className="badge">{filiale.name}</span>
              </div>
              <div style={{ marginTop: 7, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span className={'badge' + (farbe ? ' ' + farbe : '')}>
                  bis {fmtDate(ma.vertragsende)} ({tage < 0 ? Math.abs(tage) + ' T. abgelaufen' : 'in ' + tage + ' Tagen'})
                </span>
                {ma.entscheidung
                  ? <span className="badge gruen">✓ {ma.entscheidung.text}</span>
                  : tage < 90 && <span className={'badge ' + farbe}>Entscheidung fällig!</span>}
              </div>
            </div>
          )
        })}

        <div className="card" style={{ marginTop: 14, fontSize: 13, color: 'var(--muted)' }}>
          ⚠️ Automatische Warnungen: <span style={{ color: 'var(--gelb)' }}>gelb</span> ab 3 Monaten (90 T.),{' '}
          <span style={{ color: 'var(--rot)' }}>rot</span> ab 1 Monat (30 T.) vor Vertragsende — sichtbar in der
          Heute-Leiste, der Filial-Ampel und hier. Eine dokumentierte Entscheidung (verlängert/entfristet/läuft aus) löscht die Warnung.
        </div>
      </div>
    </>
  )
}
