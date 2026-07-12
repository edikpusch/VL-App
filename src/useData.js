import { useState } from 'react'
import { load, save } from './store.js'

// Jede Seite lädt beim Mount frisch aus localStorage.
// update() mutiert eine Kopie, speichert und rendert neu.
export function useData() {
  const [data, setData] = useState(() => load())
  const update = (fn) => {
    const d = JSON.parse(JSON.stringify(data))
    fn(d)
    save(d)
    setData(d)
  }
  return [data, update]
}
