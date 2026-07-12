import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../useData.js'
import { Header, Empty } from '../components/Ui.jsx'
import { AufgabenListe } from './FilialeAkte.jsx'

export default function Aufgaben() {
  const [data, update] = useData()
  const nav = useNavigate()
  const [ansicht, setAnsicht] = useState('faelligkeit') // faelligkeit | filiale | kategorie
  const [zeigeErledigte, setZeigeErledigte] = useState(false)

  const aufgaben = useMemo(() => {
    const list = data.aufgaben.filter((a) => (zeigeErledigte ? a.status === 'erledigt' : a.status === 'offen'))
    if (zeigeErledigte) return list.sort((a, b) => (b.erledigtAm || '').localeCompare(a.erledigtAm || ''))
    return list.sort((a, b) => (a.faelligkeit || '9999').localeCompare(b.faelligkeit || '9999'))
  }, [data, zeigeErledigte])

  const gruppen = useMemo(() => {
    if (ansicht === 'faelligkeit') return [['Nach Fälligkeit', aufgaben]]
    const key = ansicht === 'filiale' ? (a) => (data.filialen.find((f) => f.id === a.filialeId)?.name || 'Bezirk allgemein') : (a) => a.kategorie || 'Sonstiges'
    const map = new Map()
    for (const a of aufgaben) {
      const k = key(a)
      if (!map.has(k)) map.set(k, [])
      map.get(k).push(a)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [aufgaben, ansicht, data])

  return (
    <>
      <Header title="Aufgaben" backTo={null} right={<span className="badge accent">{aufgaben.length}</span>} />
      <div className="page">
        <div className="chip-row" style={{ marginBottom: 14 }}>
          {[['faelligkeit', 'Fälligkeit'], ['filiale', 'Filiale'], ['kategorie', 'Kategorie']].map(([k, label]) => (
            <span key={k} className={'chip' + (ansicht === k ? ' active' : '')} onClick={() => setAnsicht(k)}>{label}</span>
          ))}
          <span className={'chip' + (zeigeErledigte ? ' active' : '')} onClick={() => setZeigeErledigte(!zeigeErledigte)}>✓ Erledigte</span>
        </div>

        {aufgaben.length === 0 && <Empty icon={zeigeErledigte ? '📭' : '🎉'} text={zeigeErledigte ? 'Noch nichts erledigt.' : 'Keine offenen Aufgaben im Bezirk!'} />}

        {gruppen.map(([titel, list]) => (
          <div key={titel}>
            {ansicht !== 'faelligkeit' && <div className="section-title">{titel} ({list.length})</div>}
            <AufgabenListe aufgaben={list} data={data} update={update} nav={nav} zeigeFiliale={ansicht !== 'filiale'} />
          </div>
        ))}
      </div>
      <button className="fab" onClick={() => nav('/aufgabe/neu')}>+</button>
    </>
  )
}
