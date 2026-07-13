// ─── VL App Datenhaltung (localStorage) ──────────────────────────────
// Ein Key, ein Objekt. Stabile IDs für spätere Modul-Integration.

const KEY = 'vla_data'

export const BEREICHE = ['O&G', 'Bake-Off', 'SB-Fleisch/SB-Wurst', 'Mopro', 'Trocken']

// Bereiche des Abschriftenreports (wöchentlich)
export const ABSCHRIFT_BEREICHE = ['TS', 'BO', 'Blumen', 'O&G', 'Mopro', 'SB-Wurst', 'SB-Fleisch', 'SB-Fisch']

// Maßnahmen-Vorschläge je Bereich (Basis; freie Maßnahmen zusätzlich möglich)
export const MASSNAHMEN = {
  abschrift: {
    'BO': ['Backmengen reduzieren', 'Letzte Backung früher', 'Nachmittags-Sortiment straffen'],
    'Blumen': ['Bestellmenge senken', 'Wasser/Präsentation prüfen', 'Rechtzeitig reduzieren'],
    'O&G': ['Bestellmenge senken', 'Zweitplatzierung bei kurzem MHD abbauen', 'Rotation/FIFO prüfen', 'Qualität Wareneingang prüfen'],
    'Mopro': ['MHD-Management verschärfen', 'Bestellmenge senken', 'Kühlkette prüfen'],
    'SB-Fleisch': ['MHD-Rotation', 'Reduzieren statt abschreiben', 'Bestellmenge senken'],
    'SB-Wurst': ['MHD-Rotation', 'Reduzieren statt abschreiben', 'Bestellmenge senken'],
    'SB-Fisch': ['Bestellmenge senken', 'Bedientheke-Übernahme prüfen', 'MHD-Rotation'],
    'TS': ['Bestellmenge senken', 'Aktionsware kontrollieren'],
  },
  inventur: {
    _: ['Wareneingangskontrolle verschärfen', 'Leergut-Handling prüfen', 'Diebstahlsicherung erhöhen', 'MHD-Ausbuchung korrekt erfassen', 'Auszeichnung/Preise prüfen'],
  },
}

export function massnahmenVorschlaege(typ, bereich) {
  if (typ === 'inventur') return MASSNAHMEN.inventur[bereich] || MASSNAHMEN.inventur._
  return MASSNAHMEN.abschrift[bereich] || ['Bestellmenge senken', 'Rotation/FIFO prüfen']
}

// Bereich → Aufgaben-Kategorie (für Maßnahme-Aufgaben)
export function bereichZuKategorie(bereich) {
  const map = { BO: 'Bake-Off', 'Bake-Off': 'Bake-Off', 'O&G': 'O&G', Blumen: 'O&G', Mopro: 'Sonstiges', TS: 'Sonstiges', 'SB-Fleisch': 'Fleisch', 'SB-Wurst': 'Fleisch', 'SB-Fisch': 'Fleisch', 'SB-Fleisch/SB-Wurst': 'Fleisch', Trocken: 'Sonstiges' }
  return map[bereich] || 'Sonstiges'
}

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
    kennzahlen: [],    // (alt, ungenutzt) – ersetzt durch personalkosten + wochenberichte
    abschriften: [],   // { id, filialeId, jahr, kw, bereich, prozent, vjProzent }
    flops: [],         // { id, filialeId, jahr, kw, bereich, artikel, verlustEuro }
    tsInventuren: [],  // { id, filialeId, datum, gesamtVerlustEuro, gesamtVerlustProzent, bereiche:[{name,diffEuro,diffProzent,kumEuro,kumProzent}] }
    personalkosten: [],// { id, filialeId, monat, planEuro, planProzent, istEuro, istProzent }
    wochenberichte: [],// { id, filialeId, jahr, kw, ...Umsatz/OG/SB/BO/Stunden/Kunden/Payback/Kassier }
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

// ISO-Kalenderwoche
export function isoWeek(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const kw = Math.ceil(((date - yearStart) / 86400000 + 1) / 7)
  return { kw, jahr: date.getUTCFullYear() }
}

// ─── Zahlen-Helfer (Komma↔Punkt, Formatierung, Abweichungen) ─────────

// Deutsche Eingabe → kanonisch: gruppierte Tausenderpunkte entfernen, Komma→Punkt.
// "312.000" → "312000", "1.234,56" → "1234.56", "8,5" → "8.5", "8.5" bleibt "8.5".
export function normNum(s) {
  if (s == null) return ''
  let x = String(s).trim()
  if (/^-?\d{1,3}(\.\d{3})+(,\d*)?$/.test(x)) x = x.replace(/\./g, '')
  return x.replace(',', '.')
}

export function num(v) {
  if (v === '' || v == null) return NaN
  return parseFloat(normNum(v))
}

// Anzeige: deutsche Zahl (Punkt→Komma), optional Nachkommastellen
export function fmtNum(v, dec = 1) {
  const n = num(v)
  if (isNaN(n)) return '–'
  return n.toLocaleString('de-DE', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}
export function fmtEuro(v, dec = 0) {
  const n = num(v)
  if (isNaN(n)) return '–'
  return n.toLocaleString('de-DE', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + ' €'
}
export function fmtProzent(v, dec = 1) {
  const n = num(v)
  if (isNaN(n)) return '–'
  return (n > 0 ? '+' : '') + n.toLocaleString('de-DE', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + ' %'
}

// Prozentpunkte-Differenz (z. B. Ist% − Plan%): mit Vorzeichen, ohne %-Zeichen
export function fmtPP(v, dec = 1) {
  const n = num(v)
  if (isNaN(n)) return '–'
  return (n > 0 ? '+' : '') + n.toLocaleString('de-DE', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + ' pp'
}

export function abwEuro(ist, ref) {
  const i = num(ist), r = num(ref)
  return isNaN(i) || isNaN(r) ? NaN : i - r
}
export function abwProzent(ist, ref) {
  const i = num(ist), r = num(ref)
  return isNaN(i) || isNaN(r) || r === 0 ? NaN : ((i - r) / r) * 100
}
export function anteilProzent(teil, gesamt) {
  const t = num(teil), g = num(gesamt)
  return isNaN(t) || isNaN(g) || g === 0 ? NaN : (t / g) * 100
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
