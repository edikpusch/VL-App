import { useState, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useData } from '../useData.js'
import { computeAmpel, abschriftenBewertung, letzterWochenbericht, letzteTsInventur } from '../ampel.js'
import { BEREICHE, uid, todayISO, fmtDate, daysUntil, addHistorie, bereichZuKategorie, massnahmenVorschlaege, lerneVorschlag, num, fmtNum, fmtEuro, fmtProzent } from '../store.js'
import { Header, Ampel, MiniChart, VorschlagListen } from '../components/Ui.jsx'

// „Auf einen Blick" – konsolidierte Filialbesuchs-Ansicht:
// Diagnose (Zahl) → Treiber (Floppliste) → Maßnahme (wird Aufgabe)
export default function Besuchsmodus() {
  const { id } = useParams()
  const nav = useNavigate()
  const [data, update] = useData()
  const filiale = data.filialen.find((f) => f.id === id)

  // Hooks müssen VOR jedem bedingten return stehen (React-Regel)
  const abschriften = useMemo(() => abschriftenBewertung(data, id), [data, id])

  // Inventurdifferenz: letzte je Bereich
  const invLetzte = useMemo(() => {
    const m = {}
    for (const inv of data.inventuren.filter((i) => i.filialeId === id)) {
      if (!m[inv.bereich] || inv.datum > m[inv.bereich].datum) m[inv.bereich] = inv
    }
    return BEREICHE.map((b) => m[b]).filter(Boolean)
  }, [data, id])

  const wb = useMemo(() => letzterWochenbericht(data, id), [data, id])
  const pk = useMemo(() => (data.personalkosten || []).filter((p) => p.filialeId === id).sort((a, b) => b.monat.localeCompare(a.monat))[0], [data, id])
  const ts = useMemo(() => letzteTsInventur(data, id), [data, id])

  if (!filiale) return <Header title="Filiale nicht gefunden" backTo="/" />

  const ampel = computeAmpel(data, id)
  const kritisch = abschriften.filter((a) => a.farbe !== 'gruen')
  const gruen = abschriften.filter((a) => a.farbe === 'gruen')

  const offen = data.aufgaben.filter((a) => a.filialeId === id && a.status === 'offen')
    .sort((a, b) => (a.faelligkeit || '9999').localeCompare(b.faelligkeit || '9999'))
  const befristungen = (filiale.mitarbeiter || []).filter((m) => m.vertragsart === 'befristet' && m.vertragsende && !m.entscheidung && daysUntil(m.vertragsende) < 90)
  const wiedervorlagen = data.notizen.filter((n) => n.filialeId === id && !n.erledigt && n.wiedervorlage && daysUntil(n.wiedervorlage) <= 0)

  const flopsFor = (bereich, kw, jahr) =>
    (data.flops || [])
      .filter((f) => f.filialeId === id && f.bereich === bereich && f.kw === kw && f.jahr === jahr)
      .sort((a, b) => parseFloat(b.verlustEuro) - parseFloat(a.verlustEuro))

  const addMassnahme = (bereich, titel) => {
    update((d) => {
      d.aufgaben.unshift({
        id: uid(), filialeId: id, titel, kategorie: bereichZuKategorie(bereich),
        prio: 'hoch', faelligkeit: todayISO(),
        beschreibung: 'Maßnahme aus Besuchsmodus (' + bereich + ')',
        status: 'offen', intervallTage: 0, bereich,
      })
      addHistorie(d, id, 'Maßnahme angelegt: ' + titel + ' (' + bereich + ')')
      lerneVorschlag(d, 'massnahmen', titel)
    })
  }

  const farbHex = { rot: 'var(--rot)', gelb: 'var(--gelb)', gruen: 'var(--gruen)' }

  return (
    <>
      <Header title={'Besuch: ' + filiale.name} backTo={'/filiale/' + id} />
      <VorschlagListen data={data} />
      <div className="page">
        {/* Ampel-Kopf */}
        <div className="card" style={{ borderLeft: '4px solid ' + farbHex[ampel.farbe] }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: ampel.gruende.length ? 10 : 0 }}>
            <Ampel farbe={ampel.farbe} lg />
            <span style={{ fontWeight: 600, fontSize: 17, flex: 1 }}>
              {ampel.farbe === 'gruen' ? 'Alles im grünen Bereich' : ampel.gruende.length + ' Punkt' + (ampel.gruende.length === 1 ? '' : 'e') + ' zu klären'}
            </span>
          </div>
          {ampel.gruende.map((g, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '2px 0', fontSize: 13.5 }}>
              <Ampel farbe={g.farbe} />
              <span>{g.text}</span>
            </div>
          ))}
        </div>

        {/* Abschriften */}
        <div className="section-title">Abschriften — Handlungsbedarf</div>
        {abschriften.length === 0 && (
          <div className="card" style={{ color: 'var(--muted)', fontSize: 14 }}>
            Noch keine Abschriften erfasst. <span style={{ color: 'var(--accent)' }} onClick={() => nav('/abschriften/eingabe?filiale=' + id)}>Jetzt eingeben →</span>
          </div>
        )}
        {kritisch.map((b) => (
          <BereichKarte key={b.bereich} b={b} flops={flopsFor(b.bereich, b.kw, b.jahr)} onMassnahme={addMassnahme} farbHex={farbHex} />
        ))}
        {gruen.length > 0 && (
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(74,222,128,0.08)' }}>
            <span style={{ color: 'var(--gruen)' }}>✓</span>
            <span style={{ fontSize: 13.5, color: 'var(--muted)' }}>{gruen.map((g) => g.bereich).join(' · ')} im Ziel bzw. besser als VJ/VW</span>
          </div>
        )}

        {/* Inventurdifferenzen */}
        {invLetzte.length > 0 && (
          <>
            <div className="section-title">Inventurdifferenz (zuletzt)</div>
            <div className="kachel-grid">
              {invLetzte.map((inv) => {
                const p = parseFloat(inv.diffProzent)
                const vj = parseFloat(inv.vjProzent)
                const schlecht = !isNaN(vj) ? Math.abs(p) > Math.abs(vj) : false
                return (
                  <div key={inv.id} className="card tappable" style={{ margin: 0 }} onClick={() => nav('/inventur/' + inv.id)}>
                    <div style={{ fontSize: 13, color: 'var(--muted)' }}>{inv.bereich}</div>
                    <div style={{ fontSize: 19, fontWeight: 700, color: schlecht ? 'var(--rot)' : 'var(--text)' }}>
                      {String(inv.diffProzent ?? '–').replace('.', ',')} %
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>
                      {inv.diffEuro ? Number(inv.diffEuro).toLocaleString('de-DE') + ' €' : ''} · {fmtDate(inv.datum)}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* Umsatz & Leistung */}
        {(wb || pk) && (
          <>
            <div className="section-title">Umsatz & Leistung{wb ? ' (KW ' + wb.kw + ')' : ''}</div>
            <div className="card">
              {wb && (
                <>
                  <ZeileKz label="Umsatz Ist" wert={fmtEuro(wb.umsatzIst)} />
                  <ZeileKz label="Abw. Plan / VJ" wert={fmtProzent(wb.umsatzAbwPlanP) + ' / ' + fmtProzent(wb.umsatzAbwVjP)} farbe={num(wb.umsatzAbwPlanP) < 0 ? 'var(--rot)' : 'var(--gruen)'} />
                  <ZeileKz label="Kassierleistung" wert={fmtNum(wb.kassierIst) + ' Pos./Min (' + fmtProzent(wb.kassierAbwP) + ')'} farbe={num(wb.kassierAbwP) < 0 ? 'var(--rot)' : 'var(--gruen)'} />
                  <ZeileKz label="Stunden Ist/Soll" wert={fmtNum(wb.stundenIst) + ' / ' + fmtNum(wb.stundenSoll) + ' (' + fmtNum(wb.stundenDiff) + ')'} farbe={num(wb.stundenDiff) > 0 ? 'var(--rot)' : undefined} />
                </>
              )}
              {pk && (
                <ZeileKz label="Personalkosten Ist" wert={fmtNum(pk.istProzent) + ' % (Plan ' + fmtNum(pk.planProzent) + ' %)'} farbe={num(pk.istProzent) > num(pk.planProzent) ? 'var(--rot)' : 'var(--gruen)'} />
              )}
            </div>
          </>
        )}

        {/* TS-Inventur */}
        {ts && (
          <>
            <div className="section-title">TS-Inventur ({fmtDate(ts.datum)})</div>
            <div className="card tappable" onClick={() => nav('/ts-inventur/' + ts.id)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontWeight: 600 }}>Gesamtverlust</span>
                <span style={{ fontWeight: 700, color: 'var(--rot)' }}>{fmtEuro(ts.gesamtVerlustEuro)} · {fmtNum(ts.gesamtVerlustProzent)} %</span>
              </div>
              {(ts.bereiche || []).filter((b) => b.name).slice(0, 5).map((b, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, padding: '2px 0' }}>
                  <span>{b.name}</span>
                  <span>{fmtEuro(b.diffEuro)} · {fmtNum(b.diffProzent)} %</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Kompakt-Blöcke */}
        <div className="section-title">Beim Besuch checken</div>
        <BesuchBlock icon="✓" titel="Offene Aufgaben" count={offen.length} onClick={() => nav('/filiale/' + id + '/aufgaben')}>
          {offen.slice(0, 4).map((a) => (
            <div key={a.id} style={{ fontSize: 13.5, padding: '2px 0' }}>
              <span className={'prio-dot prio-' + (a.prio || 'mittel')} style={{ marginRight: 6 }} />
              {a.titel} {a.faelligkeit && daysUntil(a.faelligkeit) < 0 ? <span className="badge rot" style={{ marginLeft: 4 }}>überfällig</span> : ''}
            </div>
          ))}
        </BesuchBlock>

        {befristungen.length > 0 && (
          <BesuchBlock icon="⏳" titel="Befristungen fällig" count={befristungen.length} onClick={() => nav('/filiale/' + id + '/personal')}>
            {befristungen.map((m) => (
              <div key={m.id} style={{ fontSize: 13.5, padding: '2px 0' }}>
                {m.name} — bis {fmtDate(m.vertragsende)} <span className={'badge ' + (daysUntil(m.vertragsende) < 30 ? 'rot' : 'gelb')}>{daysUntil(m.vertragsende)} T.</span>
              </div>
            ))}
          </BesuchBlock>
        )}

        {wiedervorlagen.length > 0 && (
          <BesuchBlock icon="📝" titel="Notiz-Wiedervorlagen" count={wiedervorlagen.length} onClick={() => nav('/filiale/' + id + '/notizen')}>
            {wiedervorlagen.map((n) => (
              <div key={n.id} style={{ fontSize: 13.5, padding: '2px 0' }}>{n.text.slice(0, 70)}</div>
            ))}
          </BesuchBlock>
        )}

        {(filiale.ansprechpartner || []).length > 0 && (
          <div className="card">
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>Ansprechpartner</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {filiale.ansprechpartner.map((p) => (
                p.telefon
                  ? <a key={p.id} href={'tel:' + p.telefon} className="badge accent" style={{ padding: '7px 12px', fontSize: 13.5 }}>📞 {p.name}</a>
                  : <span key={p.id} className="badge" style={{ padding: '7px 12px' }}>{p.name}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}

function BereichKarte({ b, flops, onMassnahme, farbHex }) {
  const [alleFlops, setAlleFlops] = useState(false)
  const [picker, setPicker] = useState(false)
  const [frei, setFrei] = useState('')
  const sichtbar = alleFlops ? flops : flops.slice(0, 5)
  const vorschlaege = massnahmenVorschlaege('abschrift', b.bereich)

  return (
    <div className="card" style={{ borderLeft: '4px solid ' + farbHex[b.farbe] }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 16, fontWeight: 600, flex: 1 }}>{b.bereich}</span>
        <span style={{ fontSize: 22, fontWeight: 700, color: farbHex[b.farbe] }}>{String(b.prozent).replace('.', ',')}%</span>
      </div>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 3, display: 'flex', gap: 12, alignItems: 'center' }}>
        {!isNaN(b.vjProzent) && <span>VJ {String(b.vjProzent).replace('.', ',')}{b.prozent > b.vjProzent ? ' ▲' : ' ▼'}</span>}
        {!isNaN(b.vorwoche) && <span>VW {String(b.vorwoche).replace('.', ',')}{b.prozent > b.vorwoche ? ' ▲' : ' ▼'}</span>}
        {b.verlauf.length >= 2 && <MiniChart werte={b.verlauf} farbe="auto" invertiert breite={90} hoehe={26} />}
      </div>

      {flops.length > 0 && (
        <div style={{ marginTop: 9 }}>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 4 }}>Top-Verlustbringer</div>
          {sichtbar.map((f) => (
            <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, padding: '2px 0' }}>
              <span>{f.artikel}</span>
              <span style={{ fontWeight: 600 }}>{Number(f.verlustEuro).toLocaleString('de-DE')} €</span>
            </div>
          ))}
          {flops.length > 5 && (
            <span style={{ fontSize: 12.5, color: 'var(--accent)', cursor: 'pointer' }} onClick={() => setAlleFlops(!alleFlops)}>
              {alleFlops ? '▲ weniger' : '▼ alle ' + flops.length + ' anzeigen'}
            </span>
          )}
        </div>
      )}

      {!picker ? (
        <button className="btn small secondary" style={{ marginTop: 10 }} onClick={() => setPicker(true)}>+ Maßnahme</button>
      ) : (
        <div style={{ marginTop: 10 }}>
          <div className="chip-row" style={{ marginBottom: 8 }}>
            {vorschlaege.map((v) => (
              <span key={v} className="chip" onClick={() => { onMassnahme(b.bereich, v); setPicker(false) }}>+ {v}</span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              list="dl-massnahmen"
              style={{ flex: 1, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 12px', outline: 'none' }}
              value={frei} onChange={(e) => setFrei(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && frei.trim()) { onMassnahme(b.bereich, frei.trim()); setFrei(''); setPicker(false) } }}
              placeholder="Eigene Maßnahme… (tippen für Vorschläge)"
            />
            <button className="btn small" onClick={() => { if (frei.trim()) { onMassnahme(b.bereich, frei.trim()); setFrei(''); setPicker(false) } }}>✓</button>
          </div>
        </div>
      )}
    </div>
  )
}

function ZeileKz({ label, wert, farbe }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 14.5 }}>
      <span style={{ color: 'var(--muted)' }}>{label}</span>
      <span style={{ fontWeight: 600, color: farbe }}>{wert}</span>
    </div>
  )
}

function BesuchBlock({ icon, titel, count, onClick, children }) {
  return (
    <div className="card tappable" onClick={onClick}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: children ? 8 : 0 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ fontWeight: 600, flex: 1 }}>{titel}</span>
        <span className="badge accent">{count}</span>
      </div>
      {children}
    </div>
  )
}
