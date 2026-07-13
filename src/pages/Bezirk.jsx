import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../useData.js'
import { computeAmpel, heuteItems } from '../ampel.js'
import { daysUntil, fmtDate, addHistorie, todayISO } from '../store.js'
import { Ampel, Empty } from '../components/Ui.jsx'

const AMPEL_RANG = { rot: 0, gelb: 1, gruen: 2 }
const AMPEL_LABEL = { rot: 'Rot', gelb: 'Gelb', gruen: 'Grün' }

export default function Bezirk() {
  const [data, update] = useData()
  const nav = useNavigate()
  const [suche, setSuche] = useState('')

  const filialen = useMemo(() => {
    return data.filialen
      .map((f) => {
        const ampel = computeAmpel(data, f.id)
        const offen = data.aufgaben.filter((a) => a.filialeId === f.id && a.status === 'offen')
        const naechste = offen
          .filter((a) => a.faelligkeit)
          .sort((a, b) => a.faelligkeit.localeCompare(b.faelligkeit))[0]
        return { ...f, ampel, offenCount: offen.length, naechste }
      })
      .sort((a, b) => AMPEL_RANG[a.ampel.farbe] - AMPEL_RANG[b.ampel.farbe] || (a.name || '').localeCompare(b.name || ''))
  }, [data])

  // Ampelwechsel in Historie protokollieren
  useEffect(() => {
    const wechsel = data.filialen.filter((f) => {
      const jetzt = computeAmpel(data, f.id).farbe
      return f.letzteAmpel && f.letzteAmpel !== jetzt
    })
    const neu = data.filialen.filter((f) => !f.letzteAmpel)
    if (wechsel.length || neu.length) {
      update((d) => {
        for (const f of d.filialen) {
          const jetzt = computeAmpel(d, f.id).farbe
          if (f.letzteAmpel && f.letzteAmpel !== jetzt) {
            addHistorie(d, f.id, 'Ampel: ' + AMPEL_LABEL[f.letzteAmpel] + ' → ' + AMPEL_LABEL[jetzt])
          }
          f.letzteAmpel = jetzt
        }
      })
    }
  }, []) // nur beim Mount

  const heute = useMemo(() => heuteItems(data), [data])

  // ── Globale Suche ──
  const treffer = useMemo(() => {
    const q = suche.trim().toLowerCase()
    if (q.length < 2) return null
    const fName = (id) => data.filialen.find((f) => f.id === id)?.name || 'Bezirk'
    const res = []
    for (const a of data.aufgaben) {
      if ((a.titel + ' ' + (a.beschreibung || '')).toLowerCase().includes(q))
        res.push({ typ: 'Aufgabe', text: a.titel, sub: fName(a.filialeId), link: '/aufgabe/' + a.id })
    }
    for (const n of data.notizen) {
      if (n.text.toLowerCase().includes(q))
        res.push({ typ: 'Notiz', text: n.text.slice(0, 70), sub: fName(n.filialeId), link: '/notiz/' + n.id })
    }
    for (const f of data.filialen) {
      if ((f.name + ' ' + (f.nummer || '')).toLowerCase().includes(q))
        res.push({ typ: 'Filiale', text: f.name, sub: 'Nr. ' + (f.nummer || '–'), link: '/filiale/' + f.id })
      for (const ma of f.mitarbeiter || []) {
        if (ma.name.toLowerCase().includes(q))
          res.push({ typ: 'Mitarbeiter', text: ma.name + ' (' + (ma.funktion || '–') + ')', sub: f.name, link: '/filiale/' + f.id + '/personal' })
      }
    }
    for (const inv of data.inventuren) {
      if ((inv.bereich + ' ' + (inv.notizen || '') + ' ' + (inv.verlustbringer || []).join(' ')).toLowerCase().includes(q))
        res.push({ typ: 'Inventur', text: inv.bereich + ' ' + fmtDate(inv.datum), sub: fName(inv.filialeId), link: '/inventur/' + inv.id })
    }
    for (const ti of data.tsInventuren || []) {
      for (const b of ti.bereiche || []) {
        if (b.name && b.name.toLowerCase().includes(q))
          res.push({ typ: 'TS-Bereich', text: b.name + ' — ' + String(b.diffProzent ?? '–').replace('.', ',') + ' %', sub: fName(ti.filialeId) + ' · ' + fmtDate(ti.datum), link: '/ts-inventur/' + ti.id })
      }
    }
    return res.slice(0, 40)
  }, [suche, data])

  return (
    <>
      <div className="header">
        <h1>Mein Bezirk</h1>
        <span className="badge accent">{data.filialen.length} Filialen</span>
      </div>
      <div className="page">
        <input
          className="search-input"
          placeholder="🔍 Suche: Aufgaben, Notizen, Mitarbeiter…"
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
        />

        {treffer ? (
          <>
            <div className="section-title">{treffer.length} Treffer</div>
            {treffer.length === 0 && <Empty icon="🔍" text="Nichts gefunden." />}
            {treffer.map((t, i) => (
              <div key={i} className="heute-item" onClick={() => nav(t.link)}>
                <span className="badge accent">{t.typ}</span>
                <div className="text">
                  <div className="titel">{t.text}</div>
                  <div className="sub">{t.sub}</div>
                </div>
              </div>
            ))}
          </>
        ) : (
          <>
            {heute.length > 0 && (
              <>
                <div className="section-title">
                  <span>📌 Heute & diese Woche</span>
                  <span className="badge">{heute.length}</span>
                </div>
                {heute.map((it) => (
                  <div
                    key={it.typ + it.id}
                    className={'heute-item' + (it.ueberfaellig ? ' ueberfaellig' : '')}
                    onClick={() => nav(it.link)}
                  >
                    <span style={{ fontSize: 18 }}>
                      {it.typ === 'aufgabe' ? '✓' : it.typ === 'notiz' ? '📝' : '⏳'}
                    </span>
                    <div className="text">
                      <div className="titel">{it.text}</div>
                      <div className="sub">{it.sub}</div>
                    </div>
                    <span className={'datum' + (it.ueberfaellig ? ' rot' : '')}>
                      {daysUntil(it.datum) < 0
                        ? Math.abs(daysUntil(it.datum)) + ' T. über'
                        : daysUntil(it.datum) === 0
                        ? 'heute'
                        : fmtDate(it.datum).slice(0, 6)}
                    </span>
                  </div>
                ))}
              </>
            )}

            <div className="section-title">
              <span>Filialen</span>
              <button className="btn small secondary" onClick={() => nav('/filiale/neu')}>+ Neu</button>
            </div>

            {filialen.length === 0 && (
              <Empty icon="🏪" text="Noch keine Filialen. Lege deine erste Filiale an – sie wird zur digitalen Akte." />
            )}

            <div className="kachel-grid">
              {filialen.map((f) => (
                <div key={f.id} className={'kachel ' + f.ampel.farbe} onClick={() => nav('/filiale/' + f.id)}>
                  <div className="top">
                    <Ampel farbe={f.ampel.farbe} />
                    <span className="name">{f.name}</span>
                    {f.nummer && <span className="badge">{f.nummer}</span>}
                  </div>
                  <div className="meta">
                    <span>{f.offenCount} offene Aufgabe{f.offenCount === 1 ? '' : 'n'}</span>
                    {f.naechste && (
                      <span>
                        nächste: {fmtDate(f.naechste.faelligkeit)}
                        {daysUntil(f.naechste.faelligkeit) < 0 ? ' ⚠️' : ''}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  )
}
