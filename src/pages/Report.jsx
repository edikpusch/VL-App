import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useData } from '../useData.js'
import { abschriftenBewertung, letzterWochenbericht, letzteTsInventur } from '../ampel.js'
import { BEREICHE, REPORT_BLOECKE, fmtDate, fmtMonat, fmtNum, fmtEuro, fmtProzent, fmtPP, num, todayISO, daysUntil } from '../store.js'
import { Header } from '../components/Ui.jsx'

// Filial-Report: helle Druckansicht mit wählbaren Blöcken (Vorlage für alle Filialen).
// „Drucken / PDF" nutzt den Browser-Druckdialog (offline, Download als PDF möglich).
export default function Report() {
  const { id } = useParams()
  const [data, update] = useData()
  const filiale = data.filialen.find((f) => f.id === id)

  const gewaehlt = data.einstellungen.reportBloecke || []
  const hat = (key) => gewaehlt.includes(key)
  const toggle = (key) =>
    update((d) => {
      const arr = d.einstellungen.reportBloecke || []
      d.einstellungen.reportBloecke = arr.includes(key) ? arr.filter((x) => x !== key) : [...arr, key]
    })

  // ── Daten je Block ──
  const abschriften = useMemo(() => abschriftenBewertung(data, id), [data, id])
  const wb = useMemo(() => letzterWochenbericht(data, id), [data, id])
  const pk = useMemo(() => (data.personalkosten || []).filter((p) => p.filialeId === id).sort((a, b) => b.monat.localeCompare(a.monat))[0], [data, id])
  const ts = useMemo(() => letzteTsInventur(data, id), [data, id])
  const invLetzte = useMemo(() => {
    const m = {}
    for (const inv of data.inventuren.filter((i) => i.filialeId === id)) {
      if (!m[inv.bereich] || inv.datum > m[inv.bereich].datum) m[inv.bereich] = inv
    }
    return BEREICHE.map((b) => m[b]).filter(Boolean)
  }, [data, id])
  const massnahmen = useMemo(
    () => data.aufgaben
      .filter((a) => a.filialeId === id && a.status === 'offen')
      .sort((a, b) => (a.faelligkeit || '9999').localeCompare(b.faelligkeit || '9999'))
      .slice(0, 12),
    [data, id]
  )
  const flopsFor = (b) =>
    (data.flops || [])
      .filter((f) => f.filialeId === id && f.bereich === b.bereich && f.kw === b.kw && f.jahr === b.jahr)
      .sort((x, y) => (parseFloat(y.verlustEuro) || 0) - (parseFloat(x.verlustEuro) || 0))
      .slice(0, 5)

  if (!filiale) return <Header title="Filiale nicht gefunden" backTo="/" />

  const kw = abschriften[0]?.kw ?? wb?.kw
  const pfeil = (schlechter) => (schlechter ? ' ▲' : ' ▼')

  return (
    <>
      <div className="no-print">
        <Header title="Filial-Report" backTo={'/filiale/' + id} />
        <div className="page" style={{ paddingBottom: 8 }}>
          <div className="card">
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>
              Inhalte für die Filiale wählen (wird als Vorlage gespeichert):
            </div>
            <div className="chip-row">
              {REPORT_BLOECKE.map(([key, label]) => (
                <span key={key} className={'chip' + (hat(key) ? ' active' : '')} onClick={() => toggle(key)}>
                  {hat(key) ? '✓ ' : ''}{label}
                </span>
              ))}
            </div>
          </div>
          <button className="btn" onClick={() => window.print()}>🖨️ Drucken / Als PDF speichern</button>
        </div>
      </div>

      {/* ── Druckbogen (hell, auch als Vorschau sichtbar) ── */}
      <div className="page">
        <div className="report">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '2px solid #222', paddingBottom: 8, marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 19, fontWeight: 700 }}>Filiale {filiale.nummer ? filiale.nummer + ' · ' : ''}{filiale.name}</div>
              <div style={{ fontSize: 12, color: '#555' }}>Kennzahlen-Übersicht{kw ? ' · KW ' + kw : ''} · Stand {fmtDate(todayISO())}</div>
            </div>
            <div style={{ fontSize: 12, color: '#555' }}>▲ = schlechter · ▼ = besser</div>
          </div>

          {hat('abschriften') && abschriften.length > 0 && (
            <section>
              <h3>Abschriften je Warengruppe (KW {abschriften[0].kw})</h3>
              <table>
                <thead>
                  <tr><th>Warengruppe</th><th>Aktuell %</th><th>Vorwoche</th><th>Vorjahr</th><th>Bewertung</th></tr>
                </thead>
                <tbody>
                  {abschriften.map((b) => (
                    <tr key={b.bereich}>
                      <td>{b.bereich}</td>
                      <td style={{ fontWeight: 700 }}>{fmtNum(b.prozent)}</td>
                      <td>{isNaN(b.vorwoche) ? '–' : fmtNum(b.vorwoche) + pfeil(b.prozent > b.vorwoche)}</td>
                      <td>{isNaN(b.vjProzent) ? '–' : fmtNum(b.vjProzent) + pfeil(b.prozent > b.vjProzent)}</td>
                      <td>{b.farbe === 'rot' ? '⬤ Handeln!' : b.farbe === 'gelb' ? '◐ Beobachten' : '○ im Rahmen'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {hat('flops') && abschriften.some((b) => flopsFor(b).length > 0) && (
            <section>
              <h3>Größte Verlustartikel</h3>
              {abschriften.filter((b) => flopsFor(b).length > 0).map((b) => (
                <div key={b.bereich} style={{ marginBottom: 6 }}>
                  <div style={{ fontWeight: 700, fontSize: 12.5, margin: '4px 0 2px' }}>{b.bereich}</div>
                  {flopsFor(b).map((f) => (
                    <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '1px 0' }}>
                      <span>{f.artikel}</span>
                      <span>{fmtEuro(f.verlustEuro)}</span>
                    </div>
                  ))}
                </div>
              ))}
            </section>
          )}

          {hat('wochenbericht') && wb && (
            <section>
              <h3>Umsatz (KW {wb.kw})</h3>
              <table>
                <tbody>
                  <tr><td>Gesamtumsatz Ist</td><td style={{ fontWeight: 700 }}>{fmtEuro(wb.umsatzIst)}</td><td>zu Plan: {fmtProzent(wb.umsatzAbwPlanP)}</td><td>zu VJ: {fmtProzent(wb.umsatzAbwVjP)}</td></tr>
                  {wb.ogIst !== '' && wb.ogIst != null && <tr><td>O&G</td><td>{fmtEuro(wb.ogIst)}</td><td>Anteil {fmtNum(wb.ogAnteil)} %</td><td>zu VJ: {fmtProzent(wb.ogAbwVjP)}</td></tr>}
                  {wb.sbIst !== '' && wb.sbIst != null && <tr><td>SB</td><td>{fmtEuro(wb.sbIst)}</td><td>Anteil {fmtNum(wb.sbAnteil)} %</td><td>zu VJ: {fmtProzent(wb.sbAbwVjP)}</td></tr>}
                  {wb.boUmsatz !== '' && wb.boUmsatz != null && <tr><td>Bake-Off / Woche</td><td>{fmtEuro(wb.boUmsatz)}</td><td>Anteil {fmtNum(wb.boAnteil)} %</td><td>zu VJ: {fmtProzent(wb.boAbwVjP)}</td></tr>}
                  {wb.kunden !== '' && wb.kunden != null && <tr><td>Kunden</td><td>{fmtNum(wb.kunden, 0)}</td><td colSpan="2">Payback-Anteil: {fmtNum(wb.payback)} %</td></tr>}
                </tbody>
              </table>
            </section>
          )}

          {hat('kassier') && wb && (
            <section>
              <h3>Kassierleistung & Stunden (KW {wb.kw})</h3>
              <table>
                <tbody>
                  <tr>
                    <td>Kassierleistung</td>
                    <td style={{ fontWeight: 700 }}>{fmtNum(wb.kassierIst)} Pos./Min</td>
                    <td>VJ: {fmtNum(wb.kassierVj)}</td>
                    <td>{fmtProzent(wb.kassierAbwP)}{!isNaN(num(wb.kassierAbwP)) ? pfeil(num(wb.kassierAbwP) < 0) : ''}</td>
                  </tr>
                  {wb.stundenIst !== '' && wb.stundenIst != null && (
                    <tr>
                      <td>Stunden</td>
                      <td>Ist {fmtNum(wb.stundenIst)}</td>
                      <td>Soll {fmtNum(wb.stundenSoll)}</td>
                      <td>Diff {fmtNum(wb.stundenDiff)}{num(wb.stundenDiff) > 0 ? ' ▲' : ''}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          )}

          {hat('inventuren') && (invLetzte.length > 0 || ts) && (
            <section>
              <h3>Inventurdifferenzen</h3>
              {invLetzte.length > 0 && (
                <table>
                  <thead><tr><th>Bereich</th><th>Differenz</th><th>%</th><th>Vorjahr %</th><th>Datum</th></tr></thead>
                  <tbody>
                    {invLetzte.map((inv) => (
                      <tr key={inv.id}>
                        <td>{inv.bereich}</td>
                        <td>{fmtEuro(inv.diffEuro)}</td>
                        <td style={{ fontWeight: 700 }}>{fmtNum(inv.diffProzent, 2)}</td>
                        <td>{inv.vjProzent !== '' && inv.vjProzent != null ? fmtNum(inv.vjProzent, 2) : '–'}</td>
                        <td>{fmtDate(inv.datum)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {ts && (
                <>
                  <div style={{ fontWeight: 700, fontSize: 12.5, margin: '8px 0 2px' }}>
                    TS-Inventur {fmtDate(ts.datum)} — Gesamtverlust {fmtEuro(ts.gesamtVerlustEuro)} ({fmtNum(ts.gesamtVerlustProzent)} %)
                  </div>
                  {(ts.bereiche || []).filter((b) => b.name).slice(0, 5).map((b, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '1px 0' }}>
                      <span>{b.name}</span>
                      <span>{fmtEuro(b.diffEuro)} · {fmtNum(b.diffProzent)} %{b.kumEuro !== '' && b.kumEuro != null ? ' · kum. ' + fmtEuro(b.kumEuro) : ''}</span>
                    </div>
                  ))}
                </>
              )}
            </section>
          )}

          {hat('personalkosten') && pk && (
            <section>
              <h3>Personalkosten ({fmtMonat(pk.monat)})</h3>
              <table>
                <tbody>
                  <tr>
                    <td>Plan</td><td>{fmtEuro(pk.planEuro)} · {fmtNum(pk.planProzent)} %</td>
                    <td>Ist</td><td style={{ fontWeight: 700 }}>{fmtEuro(pk.istEuro)} · {fmtNum(pk.istProzent)} %</td>
                    <td>Abw.: {fmtPP(num(pk.istProzent) - num(pk.planProzent))}{num(pk.istProzent) > num(pk.planProzent) ? ' ▲' : ' ▼'}</td>
                  </tr>
                </tbody>
              </table>
            </section>
          )}

          {hat('massnahmen') && massnahmen.length > 0 && (
            <section>
              <h3>Offene Maßnahmen & Aufgaben</h3>
              {massnahmen.map((a) => (
                <div key={a.id} style={{ display: 'flex', gap: 8, fontSize: 12.5, padding: '2px 0' }}>
                  <span>☐</span>
                  <span style={{ flex: 1 }}>{a.titel}{a.bereich ? ' (' + a.bereich + ')' : ''}</span>
                  <span style={{ color: '#555' }}>
                    {a.faelligkeit ? 'bis ' + fmtDate(a.faelligkeit) + (daysUntil(a.faelligkeit) < 0 ? ' ⚠' : '') : ''}
                  </span>
                </div>
              ))}
            </section>
          )}

          <div style={{ borderTop: '1px solid #ccc', marginTop: 14, paddingTop: 6, fontSize: 11, color: '#777', display: 'flex', justifyContent: 'space-between' }}>
            <span>Erstellt mit VL App · {fmtDate(todayISO())}</span>
            <span>Bitte im Team besprechen ✍</span>
          </div>
        </div>
      </div>
    </>
  )
}
