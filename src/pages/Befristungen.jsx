import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../useData.js'
import { daysUntil, fmtDate } from '../store.js'
import { Header, Empty } from '../components/Ui.jsx'

// Bezirksweite Befristungsliste, sortiert nach Ablaufdatum
export default function Befristungen() {
  const [data] = useData()
  const nav = useNavigate()

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
      <Header title="Befristungen" backTo={null} right={<span className="badge accent">{liste.length}</span>} />
      <div className="page">
        {liste.length === 0 && <Empty icon="⏳" text="Keine befristeten Verträge im Bezirk." />}
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
      </div>
    </>
  )
}
