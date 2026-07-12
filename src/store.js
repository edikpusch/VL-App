// ─── VL App Datenhaltung (localStorage) ──────────────────────────────
// Ein Key, ein Objekt. Stabile IDs für spätere Modul-Integration.

const KEY = 'vla_data'

export const BEREICHE = ['O&G', 'Bake-Off', 'SB-Fleisch/SB-Wurst', 'Mopro', 'Trocken']

export const DEFAULT_KATEGORIEN = [
  'Bake-Off', 'O&G', 'Fleisch', 'Getränke', 'Werbemittel',
  'TMBS', 'Inventur', 'Aktion', 'Personal', 'Sonstiges',
]

export const FUNKTIONEN = ['ML', 'stv. ML', 'MLV', 'VK', 'GfB', 'Azubi', 'Sonstige']

export function defaultData() {
  return {
    version: 1,
    pinHash: null,
    einstellungen: {
      kategorien: [...DEFAULT_KATEGORIEN],
      ziele: {
        // Bezirksweite Defaults – in Einstellungen anpassbar
        inventurDiff: Object.fromEntries(BEREICHE.map((b) => [b, 0.8])), // % je Bereich
        kassierleistung: 30,      // Artikel/Minute
        personalkosten: 8.5,      // % vom Umsatz
      },
      zieleProFiliale: {},        // { [filialeId]: { kassierleistung?, personalkosten?, inventurDiff? } }
    },
    filialen: [],
    aufgaben: [],
    notizen: [],
    inventuren: [],
    kennzahlen: [],
  }
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaultData()
    const data = JSON.parse(raw)
    // Defensive: fehlende Felder auffüllen (Migrationen)
    const def = defaultData()
    for (const k of Object.keys(def)) if (data[k] === undefined) data[k] = def[k]
    for (const k of Object.keys(def.einstellungen)) {
      if (data.einstellungen[k] === undefined) data.einstellungen[k] = def.einstellungen[k]
    }
    return data
  } catch {
    return defaultData()
  }
}

export function save(data) {
  localStorage.setItem(KEY, JSON.stringify(data))
}

export function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2, 9)
}

// ─── Datum-Helfer ────────────────────────────────────────────────────

export function todayISO() {
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

export function addDays(iso, days) {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

export function daysUntil(iso) {
  if (!iso) return Infinity
  const t = new Date(todayISO() + 'T12:00:00')
  const d = new Date(iso + 'T12:00:00')
  return Math.round((d - t) / 86400000)
}

export function fmtDate(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return d + '.' + m + '.' + y
}

export function fmtMonat(ym) {
  if (!ym) return ''
  const [y, m] = ym.split('-')
  const namen = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']
  return namen[parseInt(m, 10) - 1] + ' ' + y
}

export function currentMonth() {
  return todayISO().slice(0, 7)
}

// ─── Historie ────────────────────────────────────────────────────────

export function addHistorie(data, filialeId, text, typ = 'auto') {
  const f = data.filialen.find((x) => x.id === filialeId)
  if (!f) return
  if (!f.historie) f.historie = []
  f.historie.unshift({ id: uid(), datum: todayISO(), typ, text })
}

// ─── Ziele je Filiale (mit Bezirks-Fallback) ─────────────────────────

export function zieleFuer(data, filialeId) {
  const basis = data.einstellungen.ziele
  const ovr = data.einstellungen.zieleProFiliale?.[filialeId] || {}
  return {
    kassierleistung: ovr.kassierleistung ?? basis.kassierleistung,
    personalkosten: ovr.personalkosten ?? basis.personalkosten,
    inventurDiff: { ...basis.inventurDiff, ...(ovr.inventurDiff || {}) },
  }
}

// ─── PIN (SHA-256, wie MehrstundenManager) ───────────────────────────

export async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}
