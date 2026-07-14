import { useRef, useState } from 'react'
import { useData } from '../useData.js'
import { BEREICHE, sha256, save, load, num, normNum, todayISO, zieleDurchschnitt } from '../store.js'
import { Header } from '../components/Ui.jsx'

// Einstellungen: Ziele werden NUR pro Filiale gepflegt.
// Der Bezirkswert ist ein angezeigter Durchschnitt (Ø) der Filialziele.
export default function Einstellungen() {
  const [data, update] = useData()
  const fileRef = useRef(null)
  const [katInput, setKatInput] = useState('')
  const [scope, setScope] = useState(() => data.filialen[0]?.id || '')

  const filiale = data.filialen.find((f) => f.id === scope)
  const ovr = data.einstellungen.zieleProFiliale?.[scope] || {}
  const avg = zieleDurchschnitt(data)

  // ── Filial-Ziel speichern (leer = kein Ziel, Prüfung setzt aus) ──
  const setZiel = (pfad, val) => {
    if (!scope) return
    const n = val === '' ? '' : num(val)
    update((d) => {
      const zpf = (d.einstellungen.zieleProFiliale ||= {})
      const z = (zpf[scope] ||= {})
      if (pfad.startsWith('inv:')) {
        const inv = (z.inventurDiff ||= {})
        if (n === '' || isNaN(n)) delete inv[pfad.slice(4)]
        else inv[pfad.slice(4)] = n
        if (Object.keys(inv).length === 0) delete z.inventurDiff
      } else {
        if (n === '' || isNaN(n)) delete z[pfad]
        else z[pfad] = n
      }
      if (Object.keys(z).length === 0) delete zpf[scope]
    })
  }

  const wert = (pfad) => {
    const v = pfad.startsWith('inv:') ? ovr.inventurDiff?.[pfad.slice(4)] : ovr[pfad]
    return v === '' || v == null ? '' : String(v).replace('.', ',')
  }
  const oe = (v) => (v == null ? '–' : String(v).replace('.', ','))

  const hatOverrides = (fid) => {
    const z = data.einstellungen.zieleProFiliale?.[fid]
    return z && Object.keys(z).length > 0
  }

  // ── PIN ──
  const pinSetzen = async () => {
    const pin = prompt(data.pinHash ? 'Neue PIN (4-stellig, leer = PIN entfernen):' : 'PIN festlegen (4-stellig):')
    if (pin === null) return
    if (pin === '') {
      if (confirm('PIN-Schutz wirklich entfernen?')) update((d) => { d.pinHash = null })
      return
    }
    if (!/^\d{4,8}$/.test(pin)) return alert('Bitte 4–8 Ziffern.')
    const hash = await sha256(pin)
    update((d) => { d.pinHash = hash })
  }

  // ── Backup ──
  const exportieren = async () => {
    const json = JSON.stringify(load(), null, 2)
    const dateiname = 'vl-app-backup-' + todayISO() + '.json'
    const file = new File([json], dateiname, { type: 'application/json' })
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'VL App Backup' })
        return
      } catch (e) {
        if (e.name === 'AbortError') return
      }
    }
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = dateiname
    a.click()
    URL.revokeObjectURL(url)
  }

  const importieren = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const neu = JSON.parse(reader.result)
        if (!neu || !Array.isArray(neu.filialen)) throw new Error('Ungültiges Format')
        if (!confirm('Backup-Import ersetzt ALLE aktuellen Daten (' + neu.filialen.length + ' Filialen, ' + (neu.aufgaben?.length || 0) + ' Aufgaben). Fortfahren?')) return
        save(neu)
        location.reload()
      } catch {
        alert('Datei konnte nicht gelesen werden — ist das ein VL-App-Backup?')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const addKategorie = () => {
    const k = katInput.trim()
    if (!k) return
    update((d) => { if (!d.einstellungen.kategorien.includes(k)) d.einstellungen.kategorien.push(k) })
    setKatInput('')
  }

  return (
    <>
      <Header title="Einstellungen" backTo={null} />
      <div className="page">
        {/* ── Ziele: nur pro Filiale, Ø Bezirk als Anzeige ── */}
        <div className="section-title">🎯 Zielvorgaben (pro Filiale)</div>

        <div className="card" style={{ padding: '10px 14px' }}>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 6 }}>Ø Bezirk (berechnet aus den Filialzielen)</div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 13.5 }}>
            <span>KL: <b>{oe(avg.kassierleistung)}</b></span>
            <span>PK: <b>{oe(avg.personalkosten)} %</b></span>
            {BEREICHE.map((b) => (
              <span key={b}>{b}: <b>{oe(avg.inventurDiff[b])} %</b></span>
            ))}
          </div>
        </div>

        <div className="chip-row" style={{ marginBottom: 10 }}>
          {data.filialen.map((f) => (
            <span key={f.id} className={'chip' + (scope === f.id ? ' active' : '')} onClick={() => setScope(f.id)}>
              {f.name}{hatOverrides(f.id) ? ' •' : ''}
            </span>
          ))}
          {data.filialen.length === 0 && <span style={{ color: 'var(--muted)', fontSize: 14 }}>Erst Filialen anlegen.</span>}
        </div>

        {filiale && (
          <div className="card" key={scope}>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
              Ziele für <b style={{ color: 'var(--text)' }}>{filiale.name}</b>. Leeres Feld = kein Ziel (Ampel-Prüfung setzt aus).
            </div>
            <div className="row2" style={{ marginBottom: 10 }}>
              <div>
                <label style={lbl}>Kassierleistung (Pos./Min)</label>
                <input style={inp} inputMode="decimal" defaultValue={wert('kassierleistung')} placeholder={avg.kassierleistung != null ? 'Ø ' + oe(avg.kassierleistung) : ''}
                  onBlur={(e) => setZiel('kassierleistung', normNum(e.target.value))} />
              </div>
              <div>
                <label style={lbl}>Personalkosten (%)</label>
                <input style={inp} inputMode="decimal" defaultValue={wert('personalkosten')} placeholder={avg.personalkosten != null ? 'Ø ' + oe(avg.personalkosten) : ''}
                  onBlur={(e) => setZiel('personalkosten', normNum(e.target.value))} />
              </div>
            </div>
            <label style={{ ...lbl, marginTop: 6 }}>Inventurdifferenz-Ziel je Bereich (%)</label>
            {BEREICHE.map((b) => (
              <div key={b} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 }}>
                <span style={{ flex: 1, fontSize: 14.5 }}>{b}</span>
                <input style={{ ...inp, width: 110 }} inputMode="decimal" defaultValue={wert('inv:' + b)} placeholder={avg.inventurDiff[b] != null ? 'Ø ' + oe(avg.inventurDiff[b]) : ''}
                  onBlur={(e) => setZiel('inv:' + b, normNum(e.target.value))} />
              </div>
            ))}
            {hatOverrides(scope) && (
              <button className="btn small danger" style={{ marginTop: 8 }}
                onClick={() => { if (confirm('Alle Ziele für ' + filiale.name + ' löschen?')) update((d) => { delete d.einstellungen.zieleProFiliale[scope] }) }}>
                Filial-Ziele löschen
              </button>
            )}
            <div style={{ color: 'var(--muted)', fontSize: 12.5, marginTop: 8 }}>
              Ampel: Gelb ab Ziel überschritten, Rot ab Ziel × 1,5 (Inventur).
              Abschriften werden gegen Vorjahr und Vorwoche bewertet (kein fester Zielwert). Werte gelten nach Verlassen des Feldes.
            </div>
          </div>
        )}

        {/* ── Kategorien ── */}
        <div className="section-title">🏷️ Aufgaben-Kategorien</div>
        <div className="card">
          <div className="chip-row" style={{ marginBottom: 10 }}>
            {data.einstellungen.kategorien.map((k) => (
              <span key={k} className="chip active" onClick={() => {
                if (confirm('Kategorie "' + k + '" entfernen?')) update((d) => { d.einstellungen.kategorien = d.einstellungen.kategorien.filter((x) => x !== k) })
              }}>{k} ✕</span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input style={{ ...inp, flex: 1 }} value={katInput} onChange={(e) => setKatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addKategorie()} placeholder="Neue Kategorie…" />
            <button className="btn small" onClick={addKategorie}>+</button>
          </div>
        </div>

        {/* ── Vorschläge ── */}
        <div className="section-title">📚 Vorschlags-Listen</div>
        <div className="card">
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>
            Lernt automatisch aus deinen Eingaben — Tipp zum Entfernen einzelner Vorschläge.
          </div>
          <VorschlagPflege titel="Artikel" items={(data.vorschlaege?.artikel || []).map((a) => a.name)}
            onDelete={(name) => update((d) => { d.vorschlaege.artikel = d.vorschlaege.artikel.filter((a) => a.name !== name) })} />
          <VorschlagPflege titel="Maßnahmen" items={data.vorschlaege?.massnahmen || []}
            onDelete={(m) => update((d) => { d.vorschlaege.massnahmen = d.vorschlaege.massnahmen.filter((x) => x !== m) })} />
          <VorschlagPflege titel="Aufgaben-Titel" items={data.vorschlaege?.aufgaben || []}
            onDelete={(t) => update((d) => { d.vorschlaege.aufgaben = d.vorschlaege.aufgaben.filter((x) => x !== t) })} />
        </div>

        {/* ── PIN ── */}
        <div className="section-title">🔒 Zugriffsschutz</div>
        <div className="card">
          <div style={{ marginBottom: 10, fontSize: 14.5 }}>
            {data.pinHash ? '✅ PIN-Schutz aktiv (Personaldaten geschützt)' : '⚠️ Kein PIN gesetzt — die App enthält Personaldaten!'}
          </div>
          <button className="btn small secondary" onClick={pinSetzen}>{data.pinHash ? 'PIN ändern / entfernen' : 'PIN festlegen'}</button>
        </div>

        {/* ── Backup ── */}
        <div className="section-title">💾 Datensicherung</div>
        <div className="card">
          <div style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 12 }}>
            Alle Daten liegen nur auf diesem Gerät. Regelmäßig sichern!
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn small" onClick={exportieren}>⬆️ Backup exportieren</button>
            <button className="btn small secondary" onClick={() => fileRef.current?.click()}>⬇️ Backup importieren</button>
          </div>
          <input ref={fileRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={importieren} />
        </div>

        <div style={{ color: 'var(--muted)', fontSize: 12.5, textAlign: 'center', marginTop: 24 }}>
          VL App · 100 % offline · {data.filialen.length} Filialen
        </div>
      </div>
    </>
  )
}

function VorschlagPflege({ titel, items, onDelete }) {
  const [offen, setOffen] = useState(false)
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '4px 0' }} onClick={() => setOffen(!offen)}>
        <span style={{ flex: 1, fontSize: 14.5 }}>{titel}</span>
        <span className="badge">{items.length}</span>
        <span style={{ color: 'var(--muted)' }}>{offen ? '▲' : '▼'}</span>
      </div>
      {offen && (
        <div className="chip-row" style={{ paddingTop: 6 }}>
          {items.length === 0 && <span style={{ color: 'var(--muted)', fontSize: 13.5 }}>Noch nichts gelernt.</span>}
          {items.map((it) => (
            <span key={it} className="chip" onClick={() => onDelete(it)}>{it} ✕</span>
          ))}
        </div>
      )}
    </div>
  )
}

const lbl = { fontSize: 12.5, color: 'var(--muted)', display: 'block', marginBottom: 4 }
const inp = {
  width: '100%', background: 'var(--bg2)', border: '1px solid var(--border)',
  borderRadius: 10, padding: '9px 11px', fontSize: 15, outline: 'none',
}
