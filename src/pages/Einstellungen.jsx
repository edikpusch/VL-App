import { useRef, useState } from 'react'
import { useData } from '../useData.js'
import { BEREICHE, sha256, save, load, defaultData, todayISO } from '../store.js'
import { Header } from '../components/Ui.jsx'

export default function Einstellungen() {
  const [data, update] = useData()
  const fileRef = useRef(null)
  const [katInput, setKatInput] = useState('')

  const ziele = data.einstellungen.ziele

  const setZiel = (pfad, val) => {
    const num = val === '' ? '' : parseFloat(val.replace(',', '.'))
    update((d) => {
      if (pfad.startsWith('inv:')) d.einstellungen.ziele.inventurDiff[pfad.slice(4)] = num
      else d.einstellungen.ziele[pfad] = num
    })
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
    // Fallback: Download
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
        if (!confirm('Backup vom Import ersetzt ALLE aktuellen Daten (' + neu.filialen.length + ' Filialen, ' + (neu.aufgaben?.length || 0) + ' Aufgaben). Fortfahren?')) return
        save(neu)
        location.reload()
      } catch {
        alert('Datei konnte nicht gelesen werden — ist das ein VL-App-Backup?')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const zahl = (v) => (v === '' || v == null ? '' : String(v).replace('.', ','))

  return (
    <>
      <Header title="Einstellungen" backTo={null} />
      <div className="page">
        <div className="section-title">🎯 Zielvorgaben (Ampel-Logik)</div>
        <div className="card">
          <div className="row2" style={{ marginBottom: 10 }}>
            <div>
              <label style={lbl}>Kassierleistung (Art./Min)</label>
              <input style={inp} inputMode="decimal" value={zahl(ziele.kassierleistung)} onChange={(e) => setZiel('kassierleistung', e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Personalkosten (%)</label>
              <input style={inp} inputMode="decimal" value={zahl(ziele.personalkosten)} onChange={(e) => setZiel('personalkosten', e.target.value)} />
            </div>
          </div>
          <label style={{ ...lbl, marginTop: 6 }}>Inventurdifferenz-Ziel je Bereich (%)</label>
          {BEREICHE.map((b) => (
            <div key={b} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 }}>
              <span style={{ flex: 1, fontSize: 14.5 }}>{b}</span>
              <input style={{ ...inp, width: 90 }} inputMode="decimal" value={zahl(ziele.inventurDiff[b])} onChange={(e) => setZiel('inv:' + b, e.target.value)} />
            </div>
          ))}
          <div style={{ color: 'var(--muted)', fontSize: 12.5, marginTop: 4 }}>
            Gelb ab Ziel überschritten, Rot ab Ziel × 1,5 (Inventur) bzw. −10 % Kassierleistung / +0,3 pp Personalkosten.
          </div>
        </div>

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
              onKeyDown={(e) => { if (e.key === 'Enter' && katInput.trim()) { update((d) => { if (!d.einstellungen.kategorien.includes(katInput.trim())) d.einstellungen.kategorien.push(katInput.trim()) }); setKatInput('') } }}
              placeholder="Neue Kategorie…" />
            <button className="btn small" onClick={() => { if (katInput.trim()) { update((d) => { if (!d.einstellungen.kategorien.includes(katInput.trim())) d.einstellungen.kategorien.push(katInput.trim()) }); setKatInput('') } }}>+</button>
          </div>
        </div>

        <div className="section-title">🔒 Zugriffsschutz</div>
        <div className="card">
          <div style={{ marginBottom: 10, fontSize: 14.5 }}>
            {data.pinHash ? '✅ PIN-Schutz aktiv (Personaldaten geschützt)' : '⚠️ Kein PIN gesetzt — die App enthält Personaldaten!'}
          </div>
          <button className="btn small secondary" onClick={pinSetzen}>{data.pinHash ? 'PIN ändern / entfernen' : 'PIN festlegen'}</button>
        </div>

        <div className="section-title">💾 Datensicherung</div>
        <div className="card">
          <div style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 12 }}>
            Alle Daten liegen nur auf diesem Gerät. Regelmäßig sichern!
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn small" onClick={exportieren}>⬆️ Backup exportieren</button>
            <button className="btn small secondary" onClick={() => fileRef.current?.click()}>⬇️ Backup importieren</button>
          </div>
          <input ref={fileRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={importieren} />
        </div>

        <div style={{ color: 'var(--muted)', fontSize: 12.5, textAlign: 'center', marginTop: 24 }}>
          VL App V1 · 100 % offline · {data.filialen.length} Filialen
        </div>
      </div>
    </>
  )
}

const lbl = { fontSize: 12.5, color: 'var(--muted)', display: 'block', marginBottom: 4 }
const inp = {
  width: '100%', background: 'var(--bg2)', border: '1px solid var(--border)',
  borderRadius: 10, padding: '9px 11px', fontSize: 15, outline: 'none',
}
