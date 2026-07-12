import { useState } from 'react'
import { sha256 } from '../store.js'

// PIN-Sperre beim App-Start (SHA-256, wie MehrstundenManager).
// Entsperrt für die Sitzung (sessionStorage).
export default function PinLock({ pinHash, onUnlock }) {
  const [pin, setPin] = useState('')
  const [fehler, setFehler] = useState(false)

  const taste = async (z) => {
    if (z === '⌫') {
      setPin(pin.slice(0, -1))
      setFehler(false)
      return
    }
    const neu = pin + z
    setPin(neu)
    if (neu.length >= 4) {
      const hash = await sha256(neu)
      if (hash === pinHash) {
        sessionStorage.setItem('vla_unlocked', '1')
        onUnlock()
      } else if (neu.length >= 8) {
        setFehler(true)
        setPin('')
      } else {
        // Bei PINs > 4 Stellen weiter tippen lassen; Fehler erst zeigen wenn nichts mehr passt
        setFehler(neu.length >= 4)
      }
    }
  }

  return (
    <div className="pinlock">
      <div style={{ fontSize: 44 }}>🔒</div>
      <div style={{ fontSize: 18, fontWeight: 600 }}>VL App entsperren</div>
      <div className="pin-dots">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={'pin-dot' + (pin.length > i ? ' filled' : '')} />
        ))}
      </div>
      {fehler && pin.length === 0 && <div style={{ color: 'var(--rot)', fontSize: 14 }}>Falsche PIN</div>}
      <div className="pin-pad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((z, i) =>
          z === '' ? <span key={i} /> : (
            <button key={i} onClick={() => taste(z)}>{z}</button>
          )
        )}
      </div>
    </div>
  )
}
