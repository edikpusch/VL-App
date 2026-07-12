import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useData } from '../useData.js'
import { computeAmpel } from '../ampel.js'
import { BEREICHE, daysUntil, fmtDate, fmtMonat, addHistorie, todayISO, uid } from '../store.js'
import { Header, Ampel, Empty, MiniChart } from '../components/Ui.jsx'

const TABS = [
  ['info', 'Info'],
  ['aufgaben', 'Aufgaben'],
  ['inventuren', 'Inventuren'],
  ['kennzahlen', 'Kennzahlen'],
  ['personal', 'Personal'],
  ['notizen', 'Notizen'],
  ['historie', 'Historie'],
]

export default function FilialeAkte() {
  const { id, tab = 'info' } = useParams()
  const nav = useNavigate()
  const [data, update] = useData()
  const [zeigeGruende, setZeigeGruende] = useState(false)

  const filiale = data.filialen.find((f) => f.id === id)
  if (!filiale) return <Header title="Filiale nicht gefunden" backTo="/" />

  const ampel = computeAmpel(data, id)

  return (
    <>
      <Header
        title={filiale.name}
        backTo="/"
        right={
          <span style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => setZeigeGruende(!zeigeGruende)}>
            <Ampel farbe={ampel.farbe} lg />
          </span>
        }
      />

      {zeigeGruende && (
        <div className="page" style={{ paddingBottom: 0 }}>
          <div className="card">
            {ampel.gruende.length === 0 ? (
              <span style={{ color: 'var(--gruen)' }}>🟢 Alles im grünen Bereich.</span>
            ) : (
              ampel.gruende.map((g, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '3px 0' }}>
                  <Ampel farbe={g.farbe} />
                  <span style={{ fontSize: 14.5 }}>{g.text}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <div className="tabs">
        {TABS.map(([key, label]) => (
          <div key={key} className={'tab' + (tab === key ? ' active' : '')} onClick={() => nav('/filiale/' + id + (key === 'info' ? '' : '/' + key), { replace: true })}>
            {label}
          </div>
        ))}
      </div>

      <div className="page" style={{ paddingTop: 6 }}>
        {tab === 'info' && <TabInfo filiale={filiale} nav={nav} />}
        {tab === 'aufgaben' && <TabAufgaben data={data} update={update} filiale={filiale} nav={nav} />}
        {tab === 'inventuren' && <TabInventuren data={data} filiale={filiale} nav={nav} />}
        {tab === 'kennzahlen' && <TabKennzahlen data={data} filiale={filiale} nav={nav} />}
        {tab === 'personal' && <TabPersonal filiale={filiale} nav={nav} />}
        {tab === 'notizen' && <TabNotizen data={data} update={update} filiale={filiale} nav={nav} />}
        {tab === 'historie' && <TabHistorie update={update} filiale={filiale} />}
      </div>
    </>
  )
}

// ── Info: Stammdaten + Ansprechpartner + Besonderheiten ──
function TabInfo({ filiale, nav }) {
  return (
    <>
      <div className="card">
        <div style={{ display: 'grid', gap: 7, fontSize: 15 }}>
          <Zeile label="Filialnummer" wert={filiale.nummer} />
          <Zeile label="Adresse" wert={filiale.adresse} />
          <Zeile label="Telefon" wert={filiale.telefon ? <a href={'tel:' + filiale.telefon} style={{ color: 'var(--accent)' }}>{filiale.telefon}</a> : null} />
          <Zeile label="Öffnungszeiten" wert={filiale.oeffnungszeiten} />
          <Zeile label="Verkaufsfläche" wert={filiale.verkaufsflaeche ? filiale.verkaufsflaeche + ' m²' : null} />
        </div>
      </div>

      <div className="section-title">Ansprechpartner</div>
      {(filiale.ansprechpartner || []).length === 0 && <div className="empty" style={{ padding: 14 }}>Keine hinterlegt.</div>}
      {(filiale.ansprechpartner || []).map((p) => (
        <div key={p.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600 }}>{p.name}</div>
            <div style={{ color: 'var(--muted)', fontSize: 13.5 }}>{p.rolle}</div>
          </div>
          {p.telefon && <a href={'tel:' + p.telefon} className="badge accent">📞 {p.telefon}</a>}
        </div>
      ))}

      <div className="section-title">Besonderheiten</div>
      <div className="chip-row" style={{ marginBottom: 12 }}>
        {(filiale.besonderheiten || []).length === 0 && <span style={{ color: 'var(--muted)', fontSize: 14 }}>Keine Tags.</span>}
        {(filiale.besonderheiten || []).map((t, i) => <span key={i} className="badge accent" style={{ fontSize: 13.5, padding: '6px 12px' }}>{t}</span>)}
      </div>

      <button className="btn secondary" onClick={() => nav('/filiale/' + filiale.id + '/edit')}>✏️ Filiale bearbeiten</button>
    </>
  )
}

function Zeile({ label, wert }) {
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      <span style={{ color: 'var(--muted)', minWidth: 128, fontSize: 13.5, paddingTop: 1 }}>{label}</span>
      <span>{wert || '–'}</span>
    </div>
  )
}

// ── Aufgaben ──
export function AufgabenListe({ aufgaben, data, update, nav, zeigeFiliale }) {
  const fName = (id) => data.filialen.find((f) => f.id === id)?.name || 'Bezirk'

  const erledigen = (a) => {
    update((d) => {
      const auf = d.aufgaben.find((x) => x.id === a.id)
      if (!auf) return
      if (auf.status === 'offen') {
        auf.status = 'erledigt'
        auf.erledigtAm = todayISO()
        if (auf.filialeId) addHistorie(d, auf.filialeId, 'Aufgabe erledigt: ' + auf.titel)
        // Wiederkehrend → nächste Instanz anlegen
        if (auf.intervallTage) {
          const basis = auf.faelligkeit && auf.faelligkeit > todayISO() ? auf.faelligkeit : todayISO()
          const [y, m, day] = basis.split('-').map(Number)
          const next = new Date(y, m - 1, day + Number(auf.intervallTage))
          d.aufgaben.unshift({
            ...auf, id: uid(), status: 'offen', erledigtAm: null,
            faelligkeit: next.getFullYear() + '-' + String(next.getMonth() + 1).padStart(2, '0') + '-' + String(next.getDate()).padStart(2, '0'),
          })
        }
      } else {
        auf.status = 'offen'
        auf.erledigtAm = null
      }
    })
  }

  if (aufgaben.length === 0) return <Empty icon="✅" text="Keine Aufgaben." />

  return aufgaben.map((a) => {
    const tage = a.faelligkeit ? daysUntil(a.faelligkeit) : null
    return (
      <div key={a.id} className={'aufgabe-item' + (a.status === 'erledigt' ? ' erledigt' : '')}>
        <button className="check" onClick={() => erledigen(a)}>✓</button>
        <div className="body" onClick={() => nav('/aufgabe/' + a.id)}>
          <div className="titel">{a.titel}</div>
          <div className="meta">
            <span className={'prio-dot prio-' + (a.prio || 'mittel')} />
            <span className="badge">{a.kategorie}</span>
            {zeigeFiliale && <span className="badge">{fName(a.filialeId)}</span>}
            {a.faelligkeit && a.status === 'offen' && (
              <span className={'badge' + (tage < 0 ? ' rot' : tage <= 1 ? ' gelb' : '')}>
                {tage < 0 ? Math.abs(tage) + ' T. überfällig' : tage === 0 ? 'heute' : tage === 1 ? 'morgen' : fmtDate(a.faelligkeit)}
              </span>
            )}
            {a.intervallTage ? <span className="badge">🔁 alle {a.intervallTage} T.</span> : null}
          </div>
        </div>
      </div>
    )
  })
}

function TabAufgaben({ data, update, filiale, nav }) {
  const offen = data.aufgaben
    .filter((a) => a.filialeId === filiale.id && a.status === 'offen')
    .sort((a, b) => (a.faelligkeit || '9999').localeCompare(b.faelligkeit || '9999'))
  return (
    <>
      <AufgabenListe aufgaben={offen} data={data} update={update} nav={nav} />
      <button className="fab" onClick={() => nav('/aufgabe/neu?filiale=' + filiale.id)}>+</button>
    </>
  )
}

// ── Inventuren ──
function TabInventuren({ data, filiale, nav }) {
  const invs = data.inventuren
    .filter((i) => i.filialeId === filiale.id)
    .sort((a, b) => (b.datum || '').localeCompare(a.datum || ''))

  // Verlauf je Bereich (letzte 6, chronologisch)
  const verlauf = {}
  for (const b of BEREICHE) {
    verlauf[b] = invs.filter((i) => i.bereich === b).slice(0, 6).reverse().map((i) => Math.abs(parseFloat(i.diffProzent)))
  }

  return (
    <>
      {BEREICHE.some((b) => verlauf[b].length >= 2) && (
        <>
          <div className="section-title">Verlauf (Differenz %)</div>
          <div className="card">
            {BEREICHE.filter((b) => verlauf[b].length >= 2).map((b) => (
              <div key={b} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '5px 0' }}>
                <span style={{ minWidth: 130, fontSize: 14 }}>{b}</span>
                <MiniChart werte={verlauf[b]} farbe="auto" invertiert breite={140} hoehe={36} />
                <span style={{ fontSize: 14, fontWeight: 600 }}>{String(verlauf[b][verlauf[b].length - 1]).replace('.', ',')} %</span>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="section-title">Historie</div>
      {invs.length === 0 && <Empty icon="📦" text="Noch keine Inventur-Ergebnisse erfasst." />}
      {invs.map((inv) => {
        const vj = parseFloat(inv.vjProzent)
        const jetzt = Math.abs(parseFloat(inv.diffProzent))
        const besser = !isNaN(vj) && !isNaN(jetzt) ? jetzt <= Math.abs(vj) : null
        return (
          <div key={inv.id} className="card tappable" onClick={() => nav('/inventur/' + inv.id)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontWeight: 600, flex: 1 }}>{inv.bereich}</span>
              <span className="badge">{fmtDate(inv.datum)}</span>
            </div>
            <div style={{ display: 'flex', gap: 14, marginTop: 8, fontSize: 14.5, flexWrap: 'wrap' }}>
              <span>Diff: <b>{inv.diffEuro ? Number(inv.diffEuro).toLocaleString('de-DE') + ' €' : '–'}</b> / <b>{String(inv.diffProzent ?? '–').replace('.', ',')} %</b></span>
              {!isNaN(vj) && (
                <span style={{ color: besser ? 'var(--gruen)' : 'var(--rot)' }}>
                  VJ {String(inv.vjProzent).replace('.', ',')} % {besser ? '▼ besser' : '▲ schlechter'}
                </span>
              )}
            </div>
          </div>
        )
      })}
      <button className="fab" onClick={() => nav('/inventur/neu?filiale=' + filiale.id)}>+</button>
    </>
  )
}

// ── Kennzahlen ──
function TabKennzahlen({ data, filiale, nav }) {
  const kz = data.kennzahlen
    .filter((k) => k.filialeId === filiale.id)
    .sort((a, b) => a.monat.localeCompare(b.monat))
  const letzte12 = kz.slice(-12)

  return (
    <>
      {kz.length === 0 && <Empty icon="📊" text="Noch keine Kennzahlen. Eingabe über den Kennzahlen-Reiter unten." />}
      {kz.length > 0 && (
        <>
          <div className="card">
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}>Kassierleistung (Art./Min)</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <MiniChart werte={letzte12.map((k) => k.kassierleistung)} farbe="auto" breite={200} hoehe={46} />
              <span style={{ fontSize: 22, fontWeight: 700 }}>{String(letzte12[letzte12.length - 1].kassierleistung ?? '–').replace('.', ',')}</span>
            </div>
          </div>
          <div className="card">
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}>Personalkosten (%)</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <MiniChart werte={letzte12.map((k) => k.personalkosten)} farbe="auto" invertiert breite={200} hoehe={46} />
              <span style={{ fontSize: 22, fontWeight: 700 }}>{String(letzte12[letzte12.length - 1].personalkosten ?? '–').replace('.', ',')}</span>
            </div>
          </div>
          <div className="section-title">Monate</div>
          {[...kz].reverse().map((k) => (
            <div key={k.id} className="card" style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <span style={{ minWidth: 76, fontWeight: 600 }}>{fmtMonat(k.monat)}</span>
              <span style={{ fontSize: 14 }}>KL: <b>{String(k.kassierleistung ?? '–').replace('.', ',')}</b></span>
              <span style={{ fontSize: 14 }}>PK: <b>{String(k.personalkosten ?? '–').replace('.', ',')} %</b></span>
            </div>
          ))}
        </>
      )}
      <button className="btn" onClick={() => nav('/kennzahlen/eingabe')}>Kennzahlen eingeben</button>
    </>
  )
}

// ── Personal ──
function TabPersonal({ filiale, nav }) {
  const mas = [...(filiale.mitarbeiter || [])].sort((a, b) => a.name.localeCompare(b.name))
  return (
    <>
      {mas.length === 0 && <Empty icon="👥" text="Noch keine Mitarbeiter erfasst." />}
      {mas.map((ma) => {
        const tage = ma.vertragsart === 'befristet' && ma.vertragsende ? daysUntil(ma.vertragsende) : null
        const warn = tage !== null && !ma.entscheidung && tage < 90
        return (
          <div key={ma.id} className="card tappable" onClick={() => nav('/mitarbeiter/' + filiale.id + '/' + ma.id)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontWeight: 600, flex: 1 }}>{ma.name}</span>
              <span className="badge">{ma.funktion || '–'}</span>
            </div>
            {ma.vertragsart === 'befristet' && (
              <div style={{ marginTop: 7, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span className={'badge' + (warn ? (tage < 30 ? ' rot' : ' gelb') : '')}>
                  befristet bis {fmtDate(ma.vertragsende)}{warn ? ' ⚠️ ' + (tage < 0 ? 'abgelaufen' : tage + ' Tage') : ''}
                </span>
                {ma.entscheidung && <span className="badge gruen">✓ {ma.entscheidung.text}</span>}
              </div>
            )}
          </div>
        )
      })}
      <button className="fab" onClick={() => nav('/mitarbeiter/' + filiale.id + '/neu')}>+</button>
    </>
  )
}

// ── Notizen ──
function TabNotizen({ data, update, filiale, nav }) {
  const notizen = data.notizen
    .filter((n) => n.filialeId === filiale.id && !n.erledigt)
    .sort((a, b) => (a.wiedervorlage || '9999').localeCompare(b.wiedervorlage || '9999'))
  return (
    <>
      {notizen.length === 0 && <Empty icon="📝" text="Keine offenen Notizen." />}
      {notizen.map((n) => (
        <div key={n.id} className="card tappable" onClick={() => nav('/notiz/' + n.id)}>
          <div style={{ fontSize: 15, whiteSpace: 'pre-wrap' }}>{n.text.length > 140 ? n.text.slice(0, 140) + '…' : n.text}</div>
          {n.wiedervorlage && (
            <div style={{ marginTop: 7 }}>
              <span className={'badge' + (daysUntil(n.wiedervorlage) <= 0 ? ' gelb' : '')}>🔔 {fmtDate(n.wiedervorlage)}</span>
            </div>
          )}
        </div>
      ))}
      <button className="fab" onClick={() => nav('/notiz/neu?filiale=' + filiale.id)}>+</button>
    </>
  )
}

// ── Historie ──
function TabHistorie({ update, filiale }) {
  const [text, setText] = useState('')
  const eintraege = filiale.historie || []

  const hinzufuegen = () => {
    if (!text.trim()) return
    update((d) => addHistorie(d, filiale.id, text.trim(), 'manuell'))
    setText('')
  }

  return (
    <>
      <div className="card" style={{ display: 'flex', gap: 8 }}>
        <input
          style={{ flex: 1, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 12px', outline: 'none' }}
          placeholder="Manueller Eintrag (z. B. ML-Wechsel)…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && hinzufuegen()}
        />
        <button className="btn small" onClick={hinzufuegen}>+</button>
      </div>
      {eintraege.length === 0 && <Empty icon="🕘" text="Noch keine Einträge. Erledigte Aufgaben und Ampelwechsel landen automatisch hier." />}
      {eintraege.map((h) => (
        <div key={h.id} className="hist-item">
          <span className="datum">{fmtDate(h.datum)}</span>
          <span>{h.typ === 'manuell' ? '✍️ ' : ''}{h.text}</span>
        </div>
      ))}
    </>
  )
}
