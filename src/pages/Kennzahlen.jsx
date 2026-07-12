import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../useData.js'
import { fmtMonat, currentMonth, zieleFuer } from '../store.js'
import { Header, Empty, MiniChart } from '../components/Ui.jsx'

export default function Kennzahlen() {
  const [data] = useData()
  const nav = useNavigate()

  const monate = useMemo(
    () => [...new Set(data.kennzahlen.map((k) => k.monat))].sort().reverse(),
    [data]
  )
  const [monat, setMonat] = useState(monate[0] || currentMonth())

  const zeilen = useMemo(() => {
    return data.filialen.map((f) => {
      const kz = data.kennzahlen.find((k) => k.filialeId === f.id && k.monat === monat)
      const verlauf = data.kennzahlen
        .filter((k) => k.filialeId === f.id)
        .sort((a, b) => a.monat.localeCompare(b.monat))
        .slice(-12)
      const ziele = zieleFuer(data, f.id)
      return {
        f, kz, ziele,
        klVerlauf: verlauf.map((k) => k.kassierleistung),
        kl: kz ? parseFloat(kz.kassierleistung) : NaN,
        pk: kz ? parseFloat(kz.personalkosten) : NaN,
      }
    })
  }, [data, monat])

  const klWerte = zeilen.map((z) => z.kl).filter((v) => !isNaN(v))
  const pkWerte = zeilen.map((z) => z.pk).filter((v) => !isNaN(v))
  const klBest = Math.max(...klWerte), klWorst = Math.min(...klWerte)
  const pkBest = Math.min(...pkWerte), pkWorst = Math.max(...pkWerte)

  const fmtNum = (v) => (isNaN(v) ? '–' : String(v).replace('.', ','))

  return (
    <>
      <Header title="Kennzahlen" backTo={null} />
      <div className="page">
        {data.kennzahlen.length === 0 ? (
          <Empty icon="📊" text="Noch keine Kennzahlen erfasst. Starte mit der Monatseingabe." />
        ) : (
          <>
            <div className="chip-row" style={{ marginBottom: 14 }}>
              {monate.slice(0, 6).map((m) => (
                <span key={m} className={'chip' + (monat === m ? ' active' : '')} onClick={() => setMonat(m)}>{fmtMonat(m)}</span>
              ))}
            </div>

            <div className="section-title">Bezirksvergleich {fmtMonat(monat)}</div>
            <div className="card table-wrap" style={{ padding: '4px 8px' }}>
              <table className="vergleich">
                <thead>
                  <tr><th>Filiale</th><th>KL</th><th>PK %</th><th>Trend KL</th></tr>
                </thead>
                <tbody>
                  {zeilen.map(({ f, kl, pk, klVerlauf, ziele }) => (
                    <tr key={f.id} onClick={() => nav('/filiale/' + f.id + '/kennzahlen')} style={{ cursor: 'pointer' }}>
                      <td>{f.name}</td>
                      <td className={klWerte.length > 1 ? (kl === klBest ? 'best' : kl === klWorst ? 'worst' : '') : ''}>
                        {fmtNum(kl)}{!isNaN(kl) && kl < ziele.kassierleistung ? ' ⚠' : ''}
                      </td>
                      <td className={pkWerte.length > 1 ? (pk === pkBest ? 'best' : pk === pkWorst ? 'worst' : '') : ''}>
                        {fmtNum(pk)}{!isNaN(pk) && pk > ziele.personalkosten ? ' ⚠' : ''}
                      </td>
                      <td><MiniChart werte={klVerlauf} farbe="auto" breite={90} hoehe={28} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ color: 'var(--muted)', fontSize: 12.5, margin: '6px 2px 0' }}>
              KL = Kassierleistung (Art./Min) · PK = Personalkosten · <span style={{ color: 'var(--gruen)' }}>grün = beste</span>, <span style={{ color: 'var(--rot)' }}>rot = schlechteste</span> · ⚠ = Ziel verfehlt
            </div>
          </>
        )}
        <button className="btn" style={{ marginTop: 18 }} onClick={() => nav('/kennzahlen/eingabe')}>Monat eingeben</button>
      </div>
    </>
  )
}
