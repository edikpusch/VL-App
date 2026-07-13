import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../useData.js'
import { letzterWochenbericht } from '../ampel.js'
import { num, fmtNum, fmtProzent, currentMonth, fmtMonat } from '../store.js'
import { Header, Empty } from '../components/Ui.jsx'

export default function Kennzahlen() {
  const [data] = useData()
  const nav = useNavigate()

  const zeilen = useMemo(() => data.filialen.map((f) => ({ f, wb: letzterWochenbericht(data, f.id) })), [data])
  const hatWb = zeilen.some((z) => z.wb)

  const pkMonat = useMemo(() => {
    const monate = [...new Set((data.personalkosten || []).map((p) => p.monat))].sort()
    return monate[monate.length - 1] || currentMonth()
  }, [data])
  const pkZeilen = useMemo(() => data.filialen.map((f) => ({
    f, pk: (data.personalkosten || []).find((p) => p.filialeId === f.id && p.monat === pkMonat),
  })), [data, pkMonat])
  const hatPk = pkZeilen.some((z) => z.pk)

  const cls = (v, gutWennKlein) => {
    if (isNaN(v)) return ''
    if (gutWennKlein) return v > 0 ? 'worst' : v < 0 ? 'best' : ''
    return v < 0 ? 'worst' : v > 0 ? 'best' : ''
  }

  return (
    <>
      <Header title="Kennzahlen" backTo={null} />
      <div className="page">
        <div className="chip-row" style={{ marginBottom: 16 }}>
          <span className="chip active" onClick={() => nav('/wochenbericht/eingabe')}>+ Wochenbericht</span>
          <span className="chip active" onClick={() => nav('/personalkosten/eingabe')}>+ Personalkosten</span>
        </div>

        {!hatWb && !hatPk && <Empty icon="📊" text="Noch keine Kennzahlen. Starte mit dem Wochenbericht." />}

        {hatWb && (
          <>
            <div className="section-title">Wochenbericht — Bezirksvergleich (letzte KW)</div>
            <div className="card table-wrap" style={{ padding: '4px 8px' }}>
              <table className="vergleich">
                <thead>
                  <tr><th>Filiale</th><th>KW</th><th>Ums. Ist</th><th>vs Plan</th><th>vs VJ</th><th>Kassier</th></tr>
                </thead>
                <tbody>
                  {zeilen.map(({ f, wb }) => (
                    <tr key={f.id} onClick={() => nav('/filiale/' + f.id + '/kennzahlen')} style={{ cursor: 'pointer' }}>
                      <td>{f.name}</td>
                      <td>{wb ? wb.kw : '–'}</td>
                      <td>{wb ? fmtNum(wb.umsatzIst, 0) : '–'}</td>
                      <td className={wb ? cls(num(wb.umsatzAbwPlanP), false) : ''}>{wb ? fmtProzent(wb.umsatzAbwPlanP) : '–'}</td>
                      <td className={wb ? cls(num(wb.umsatzAbwVjP), false) : ''}>{wb ? fmtProzent(wb.umsatzAbwVjP) : '–'}</td>
                      <td className={wb ? cls(num(wb.kassierAbwP), false) : ''}>{wb ? fmtNum(wb.kassierIst) : '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {hatPk && (
          <>
            <div className="section-title">Personalkosten — {fmtMonat(pkMonat)}</div>
            <div className="card table-wrap" style={{ padding: '4px 8px' }}>
              <table className="vergleich">
                <thead>
                  <tr><th>Filiale</th><th>Plan %</th><th>Ist %</th><th>Abw. pp</th></tr>
                </thead>
                <tbody>
                  {pkZeilen.map(({ f, pk }) => {
                    const abw = pk ? num(pk.istProzent) - num(pk.planProzent) : NaN
                    return (
                      <tr key={f.id} onClick={() => nav('/filiale/' + f.id + '/kennzahlen')} style={{ cursor: 'pointer' }}>
                        <td>{f.name}</td>
                        <td>{pk ? fmtNum(pk.planProzent) : '–'}</td>
                        <td>{pk ? fmtNum(pk.istProzent) : '–'}</td>
                        <td className={cls(abw, true)}>{isNaN(abw) ? '–' : fmtProzent(abw)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  )
}
