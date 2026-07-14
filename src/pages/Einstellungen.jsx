import { useRef, useState } from 'react'
import { useData } from '../useData.js'
import { BEREICHE, sha256, save, load, num, normNum, todayISO } from '../store.js'
import { Header } from '../components/Ui.jsx'

// Einstellungen: Ziele auf Bezirks- UND Filialebene.
// Filial-Ziel leer = erbt den Bezirks-Standard (Platzhalter zeigt ihn an).
export default function Einstellungen() {
  const [data, update] = useData()
  const fileRef = useRef(null)
  const [katInput, setKatInput] = useState('')
  const [scope, setScope] = useState('') // '' = Bezirks-Standard, sonst filialeId

  const basis = data.einstellungen.ziele
  const filiale = scope ? data.filialen.find((f) => f.id === scope) : null
  const ovr = scope ? (data.einstellungen.zieleProFiliale?.[scope] || {}) : null

  // ── Ziel speichern (Bezirk oder Filial-Override) ──
  const setZiel = (pfad, val) => {
    const n = val === '' ? '' : num(val)
    update((d) => {
      if (!scope) {
        // Bezirks-Standard
        if (pfad.startsWith('inv:')) d.einstellungen.ziele.inventurDiff[pfad.slice(4)] = n
        else d.einstellungen.ziele[pfad] = n
      } else {
        // Filial-Override: leer = löschen (erbt wieder)
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
      }
    })
  }

  const wert = (pfad) => {
    if (!scope) {
      const v = pfad.startsWith('inv:') ? basis.inventurDiff[pfad.slice(4)] : basis[pfad]
      return v === '' || v == null ? '' : String(v).replace('.', ',')
    }
    const v = pfad.startsWith('inv:') ? ovr.inventurDiff?.[pfad.slice(4)] : ovr[pfad]
    return v === '' || v == null ? '' : String(v).replace('.', ',')
  }
  const platzhalter = (pfad) => {
    if (!scope) return ''
    const v = pfad.startsWith('inv:') ? basis.inventurDiff[pfad.slice(4)] : basis[pfad]
    return v === '' || v == null ? '' : 'Bezirk: ' + String(v).replace('.', ',')
  }

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
        {/* ── Ziele: Bezirk / pro Filiale ── */}
        <div className="section-title">🎯 Zielvorgaben</div>
        <div className="chip-row" style={{ marginBottom: 10 }}>
          <span className={'chip' + (!scope ? ' active' : '')} onClick={() => setScope('')}>Bezirks-Standard</span>
          {data.filialen.map((f) => (
            <span key={f.id} className={'chip' + (scope === f.id ? ' active' : '')} onClick={() => setScope(f.id)}>
              {f.name}{hatOverrides(f.id) ? ' •' : ''}
            </span>
          ))}
        </div>

        <div className="card" key={scope}>
          {scope && (
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
              Abweichende Ziele nur für <b style={{ color: 'var(--text)' }}>{filiale?.name}</b>.
              Leere Felder erben den Bezirks-Standard.
            </div>
          )}
          <div className="row2" style={{ marginBottom: 10 }}>
            <div>
              <label style={lbl}>Kassierleistung (Pos./Min)</label>
              <input style={inp} inputMode="decimal" defaultValue={wert('kassierleistung')} placeholder={platzhalter('kassierleistung')}
                onBlur={(e) => setZiel('kassierleistung', normNum(e.target.value))} />
            </div>
            <div>
              <label style={lbl}>Personalkosten (%)</label>
              <input style={inp} inputMode="decimal" defaultValue={wert('personalkosten')} placeholder={platzhalter('personalkosten')}
                onBlur={(e) => setZiel('personalkosten', normNum(e.target.value))} />
            </div>
          </div>
          <label style={{ ...lbl, marginTop: 6 }}>Inventurdifferenz-Ziel je Bereich (%)</label>
          {BEREICHE.map((b) => (
            <div key={b} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 }}>
              <span style={{ flex: 1, fontSize: 14.5 }}>{b}</span>
              <input style={{ ...inp, width: 110 }} inputMode="decimal" defaultValue={wert('inv:' + b)} placeholder={platzhalter('inv:' + b)}
                onBlur={(e) => setZiel('inv:' + b, normNum(e.target.value))} />
            </div>
          ))}
          {scope && hatOverrides(scope) && (
            <button className="btn small danger" style={{ marginTop: 8 }}
              onClick={() => { if (confirm('Alle abweichenden Ziele für ' + filiale?.name + ' zurücksetzen?')) update((d) => { delete d.einstellungen.zieleProFiliale[scope] }) }}>
              Filial-Ziele zurücksetzen
            </button>
          )}
          <div style={{ color: 'var(--muted)', fontSize: 12.5, marginTop: 8 }}>
            Ampel: Gelb ab Ziel überschritten, Rot ab Ziel × 1,5 (Inventur) bzw. −10 % Kassierleistung / +0,3 pp Personalkosten.
            Abschriften werden gegen Vorjahr und Vorwoche bewertet (kein fester Zielwert). Werte gelten nach Verlassen des Feldes.
          </div>
        </div>

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
