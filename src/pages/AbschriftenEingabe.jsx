import { useState, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useData } from '../useData.js'
import { ABSCHRIFT_BEREICHE, uid, isoWeek, normNum, lerneVorschlag } from '../store.js'
import { focusNextOnEnter, VorschlagListen } from '../components/Ui.jsx'

// Schnell-Eingabe Abschriftenreport: KW wählen → je Bereich % + VJ %.
// Vorwoche wird automatisch aus der vorherigen KW angezeigt.
export default function AbschriftenEingabe() {
  const [data, update] = useData()
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const { kw: curKw, jahr: curJahr } = isoWeek()

  const [filialeId, setFilialeId] = useState(sp.get('filiale') || (data.filialen[0]?.id ?? ''))
  const [jahr, setJahr] = useState(curJahr)
  const [kw, setKw] = useState(curKw)

  const [werte, setWerte] = useState(() => init(data, filialeId, jahr, kw))
  const [flops, setFlops] = useState(() => initFlops(data, filialeId, jahr, kw))

  function init(d, fid, j, k) {
    const w = {}
    for (const b of ABSCHRIFT_BEREICHE) {
      const e = d.abschriften.find((a) => a.filialeId === fid && a.jahr === j && a.kw === k && a.bereich === b)
      w[b] = { prozent: e?.prozent ?? '', vjProzent: e?.vjProzent ?? '' }
    }
    return w
  }
  function initFlops(d, fid, j, k) {
    return (d.flops || [])
      .filter((f) => f.filialeId === fid && f.jahr === j && f.kw === k)
      .map((f) => ({ ...f }))
  }

  const neuLaden = (fid, j, k) => {
    setWerte(init(data, fid, j, k))
    setFlops(initFlops(data, fid, j, k))
  }

  // Vorwoche-Referenz
  const vorwoche = useMemo(() => {
    const pk = kw > 1 ? kw - 1 : 52
    const pj = kw > 1 ? jahr : jahr - 1
    const m = {}
    for (const b of ABSCHRIFT_BEREICHE) {
      const e = data.abschriften.find((a) => a.filialeId === filialeId && a.jahr === pj && a.kw === pk && a.bereich === b)
      if (e) m[b] = e.prozent
    }
    return m
  }, [data, filialeId, jahr, kw])

  const set = (b, key, val) => setWerte({ ...werte, [b]: { ...werte[b], [key]: normNum(val) } })

  const addFlop = () => setFlops([...flops, { id: uid(), bereich: ABSCHRIFT_BEREICHE[0], artikel: '', verlustEuro: '' }])
  const setFlop = (i, key, val) => {
    const f = [...flops]
    f[i] = { ...f[i], [key]: key === 'verlustEuro' ? normNum(val) : val }
    setFlops(f)
  }

  const speichern = () => {
    if (!filialeId) return alert('Bitte eine Filiale wählen.')
    update((d) => {
      for (const b of ABSCHRIFT_BEREICHE) {
        const w = werte[b]
        const idx = d.abschriften.findIndex((a) => a.filialeId === filialeId && a.jahr === jahr && a.kw === kw && a.bereich === b)
        if (w.prozent === '' && w.vjProzent === '') {
          if (idx >= 0) d.abschriften.splice(idx, 1)
          continue
        }
        const eintrag = { id: idx >= 0 ? d.abschriften[idx].id : uid(), filialeId, jahr, kw, bereich: b, prozent: w.prozent, vjProzent: w.vjProzent }
        if (idx >= 0) d.abschriften[idx] = eintrag
        else d.abschriften.push(eintrag)
      }
      // Flops für diese KW ersetzen
      d.flops = (d.flops || []).filter((f) => !(f.filialeId === filialeId && f.jahr === jahr && f.kw === kw))
      for (const f of flops) {
        if (!f.artikel.trim()) continue
        d.flops.push({ id: f.id || uid(), filialeId, jahr, kw, bereich: f.bereich, artikel: f.artikel.trim(), verlustEuro: f.verlustEuro || '0' })
        lerneVorschlag(d, 'artikel', f.artikel, f.bereich)
      }
    })
    nav('/filiale/' + filialeId + '/abschriften', { replace: true })
  }

  return (
    <>
      <div className="header">
        <button className="back" onClick={() => nav(-1)}>‹</button>
        <h1>Abschriften eingeben</h1>
      </div>
      <VorschlagListen data={data} />
      <div className="page">
        <div className="field">
          <label>Filiale</label>
          <select value={filialeId} onChange={(e) => { setFilialeId(e.target.value); neuLaden(e.target.value, jahr, kw) }}>
            {data.filialen.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
        <div className="row2">
          <div className="field">
            <label>Jahr</label>
            <input type="number" value={jahr} onChange={(e) => { const j = Number(e.target.value); setJahr(j); neuLaden(filialeId, j, kw) }} inputMode="numeric" />
          </div>
          <div className="field">
            <label>Kalenderwoche</label>
            <input type="number" min="1" max="53" value={kw} onChange={(e) => { const k = Number(e.target.value); setKw(k); neuLaden(filialeId, jahr, k) }} inputMode="numeric" />
          </div>
        </div>

        <div className="section-title">Abschriften % je Bereich</div>
        <div className="card" style={{ padding: '6px 10px' }}>
          <div style={{ display: 'flex', gap: 8, padding: '4px 4px 8px', fontSize: 12, color: 'var(--muted)' }}>
            <span style={{ flex: 1 }}>Bereich</span>
            <span style={{ width: 76, textAlign: 'center' }}>akt. %</span>
            <span style={{ width: 76, textAlign: 'center' }}>VJ %</span>
            <span style={{ width: 46, textAlign: 'center' }}>VW</span>
          </div>
          {ABSCHRIFT_BEREICHE.map((b) => (
            <div key={b} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 4px' }}>
              <span style={{ flex: 1, fontSize: 14.5 }}>{b}</span>
              <input style={{ ...inp, width: 76, textAlign: 'center' }} inputMode="decimal" enterKeyHint="next" onKeyDown={focusNextOnEnter} value={String(werte[b]?.prozent ?? '').replace('.', ',')} onChange={(e) => set(b, 'prozent', e.target.value)} />
              <input style={{ ...inp, width: 76, textAlign: 'center' }} inputMode="decimal" enterKeyHint="next" onKeyDown={focusNextOnEnter} value={String(werte[b]?.vjProzent ?? '').replace('.', ',')} onChange={(e) => set(b, 'vjProzent', e.target.value)} />
              <span style={{ width: 46, textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>{vorwoche[b] != null ? String(vorwoche[b]).replace('.', ',') : '–'}</span>
            </div>
          ))}
        </div>

        <div className="section-title">
          <span>Verlustbringer (Floppliste)</span>
          <button className="btn small secondary" onClick={addFlop}>+ Zeile</button>
        </div>
        {flops.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 13.5, padding: '0 2px 8px' }}>Optional — Top-Verlustartikel für den Besuchsmodus.</div>}
        {flops.map((f, i) => (
          <div key={f.id} className="card" style={{ padding: 10, display: 'flex', gap: 6, alignItems: 'center' }}>
            <select style={{ ...inp, width: 96 }} value={f.bereich} onChange={(e) => setFlop(i, 'bereich', e.target.value)}>
              {ABSCHRIFT_BEREICHE.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
            <input style={{ ...inp, flex: 1 }} list="dl-artikel" value={f.artikel} onChange={(e) => setFlop(i, 'artikel', e.target.value)} placeholder="Artikel" />
            <input style={{ ...inp, width: 66 }} inputMode="decimal" enterKeyHint="next" onKeyDown={focusNextOnEnter} value={String(f.verlustEuro ?? '').replace('.', ',')} onChange={(e) => setFlop(i, 'verlustEuro', e.target.value)} placeholder="€" />
            <button className="btn small danger" onClick={() => setFlops(flops.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}

        <button className="btn" style={{ marginTop: 16 }} onClick={speichern}>Speichern</button>
      </div>
    </>
  )
}

const inp = {
  background: 'var(--bg2)', border: '1px solid var(--border)',
  borderRadius: 10, padding: '9px 10px', fontSize: 15, outline: 'none',
}
