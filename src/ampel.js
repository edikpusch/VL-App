// ─── Ampel-Logik (automatisch, zielbasiert) ──────────────────────────
// Regel: schlechtester Einzelwert bestimmt die Gesamtampel.
// Rückgabe: { farbe: 'gruen'|'gelb'|'rot', gruende: [{farbe, text}] }

import { daysUntil, zieleFuer, currentMonth, num, fmtNum } from './store.js'

const RANG = { gruen: 0, gelb: 1, rot: 2 }

// ─── Abschriften-Bewertung je Bereich (vs Vorjahr UND Vorwoche) ──────
// Höhere % = schlechter. Rot: schlechter als beide Referenzen oder Spitze;
// Gelb: schlechter als eine; sonst Grün.
export function abschriftenBewertung(data, filialeId) {
  const byBereich = {}
  for (const a of data.abschriften || []) {
    if (a.filialeId !== filialeId) continue
    ;(byBereich[a.bereich] ||= []).push(a)
  }
  const res = []
  for (const [bereich, arr] of Object.entries(byBereich)) {
    arr.sort((x, y) => (y.jahr - x.jahr) || (y.kw - x.kw)) // neueste zuerst
    const cur = arr[0]
    const p = parseFloat(cur.prozent)
    if (isNaN(p)) continue
    const vj = parseFloat(cur.vjProzent)
    const vw = arr[1] ? parseFloat(arr[1].prozent) : NaN
    const refs = []
    if (!isNaN(vj)) refs.push({ label: 'VJ', wert: vj })
    if (!isNaN(vw)) refs.push({ label: 'VW', wert: vw })
    const worse = refs.filter((r) => p > r.wert + 0.1)
    // Sprung nur kritisch, wenn nicht klar unter Vorjahr
    const spike = refs.some((r) => r.wert > 0.3 && p >= r.wert * 2) && (isNaN(vj) || p > vj)
    let farbe = 'gruen'
    if (spike || (worse.length === refs.length && refs.length >= 2)) farbe = 'rot'
    else if (worse.length >= 1) farbe = 'gelb'
    res.push({
      bereich, kw: cur.kw, jahr: cur.jahr, prozent: p, vjProzent: vj, vorwoche: vw, farbe,
      verlauf: arr.slice(0, 6).reverse().map((x) => parseFloat(x.prozent)),
    })
  }
  return res.sort((a, b) => RANG[b.farbe] - RANG[a.farbe] || b.prozent - a.prozent)
}

export function letzterWochenbericht(data, filialeId) {
  return (data.wochenberichte || [])
    .filter((w) => w.filialeId === filialeId)
    .sort((a, b) => (b.jahr - a.jahr) || (b.kw - a.kw))[0] || null
}

export function letzteTsInventur(data, filialeId) {
  return (data.tsInventuren || [])
    .filter((t) => t.filialeId === filialeId)
    .sort((a, b) => (b.datum || '').localeCompare(a.datum || ''))[0] || null
}

function refText(b) {
  const t = []
  if (!isNaN(b.vjProzent)) t.push('VJ ' + String(b.vjProzent).replace('.', ','))
  if (!isNaN(b.vorwoche)) t.push('VW ' + String(b.vorwoche).replace('.', ','))
  return t.length ? ' (' + t.join(', ') + ')' : ''
}

export function computeAmpel(data, filialeId) {
  const gruende = []
  const ziele = zieleFuer(data, filialeId)

  // 1) Überfällige Aufgaben
  const offen = data.aufgaben.filter((a) => a.filialeId === filialeId && a.status === 'offen')
  const ueberfaellig = offen.filter((a) => a.faelligkeit && daysUntil(a.faelligkeit) < 0)
  const hoheUeberfaellig = ueberfaellig.some((a) => a.prio === 'hoch')
  const hoheBald = offen.some((a) => a.prio === 'hoch' && a.faelligkeit && daysUntil(a.faelligkeit) >= 0 && daysUntil(a.faelligkeit) <= 2)

  if (ueberfaellig.length >= 3 || hoheUeberfaellig) {
    gruende.push({ farbe: 'rot', text: ueberfaellig.length + ' Aufgabe' + (ueberfaellig.length === 1 ? '' : 'n') + ' überfällig' + (hoheUeberfaellig ? ' (hohe Prio!)' : '') })
  } else if (ueberfaellig.length >= 1 || hoheBald) {
    gruende.push({ farbe: 'gelb', text: ueberfaellig.length ? ueberfaellig.length + ' Aufgabe' + (ueberfaellig.length === 1 ? '' : 'n') + ' überfällig' : 'Hohe Prio fällig in ≤2 Tagen' })
  }

  // 2) Inventurdifferenz % — letzte Inventur je Bereich
  const invs = data.inventuren.filter((i) => i.filialeId === filialeId)
  const proBereich = {}
  for (const inv of invs) {
    if (!proBereich[inv.bereich] || inv.datum > proBereich[inv.bereich].datum) proBereich[inv.bereich] = inv
  }
  for (const [bereich, inv] of Object.entries(proBereich)) {
    const ziel = ziele.inventurDiff[bereich]
    if (ziel == null || inv.diffProzent == null || inv.diffProzent === '') continue
    const wert = Math.abs(parseFloat(inv.diffProzent))
    if (isNaN(wert)) continue
    if (wert > ziel * 1.5) gruende.push({ farbe: 'rot', text: bereich + '-Differenz ' + String(wert).replace('.', ',') + ' % (Ziel ' + String(ziel).replace('.', ',') + ' %)' })
    else if (wert > ziel) gruende.push({ farbe: 'gelb', text: bereich + '-Differenz ' + String(wert).replace('.', ',') + ' % (Ziel ' + String(ziel).replace('.', ',') + ' %)' })
  }

  // 3) Personalkosten Ist % vs Plan % — letzter Monat
  const pkE = (data.personalkosten || [])
    .filter((p) => p.filialeId === filialeId && p.monat <= currentMonth())
    .sort((a, b) => b.monat.localeCompare(a.monat))[0]
  if (pkE) {
    const ist = num(pkE.istProzent), plan = num(pkE.planProzent)
    if (!isNaN(ist) && !isNaN(plan)) {
      if (ist > plan + 0.3) gruende.push({ farbe: 'rot', text: 'Personalkosten ' + fmtNum(ist) + ' % (Plan ' + fmtNum(plan) + ' %)' })
      else if (ist > plan) gruende.push({ farbe: 'gelb', text: 'Personalkosten ' + fmtNum(ist) + ' % (Plan ' + fmtNum(plan) + ' %)' })
    }
  }

  // 4) Wochenbericht — letzte KW: Kassierleistung vs VJ, Umsatz vs Plan
  const wb = letzterWochenbericht(data, filialeId)
  if (wb) {
    const kIst = num(wb.kassierIst), kVj = num(wb.kassierVj)
    if (!isNaN(kIst) && !isNaN(kVj)) {
      if (kIst < kVj * 0.9) gruende.push({ farbe: 'rot', text: 'Kassierleistung ' + fmtNum(kIst) + ' Pos./Min (VJ ' + fmtNum(kVj) + ')' })
      else if (kIst < kVj) gruende.push({ farbe: 'gelb', text: 'Kassierleistung ' + fmtNum(kIst) + ' Pos./Min (VJ ' + fmtNum(kVj) + ')' })
    }
    const uIst = num(wb.umsatzIst), uPlan = num(wb.umsatzPlan)
    if (!isNaN(uIst) && !isNaN(uPlan)) {
      if (uIst < uPlan * 0.95) gruende.push({ farbe: 'rot', text: 'Umsatz unter Plan (KW ' + wb.kw + ')' })
      else if (uIst < uPlan) gruende.push({ farbe: 'gelb', text: 'Umsatz leicht unter Plan (KW ' + wb.kw + ')' })
    }
  }

  // 4b) Abschriften je Bereich (vs VJ + Vorwoche)
  for (const b of abschriftenBewertung(data, filialeId)) {
    if (b.farbe === 'gruen') continue
    gruende.push({ farbe: b.farbe, text: b.bereich + '-Abschrift ' + String(b.prozent).replace('.', ',') + ' %' + refText(b) })
  }

  // 5) Befristungen ohne Entscheidung
  const filiale = data.filialen.find((f) => f.id === filialeId)
  for (const ma of filiale?.mitarbeiter || []) {
    if (ma.vertragsart !== 'befristet' || !ma.vertragsende || ma.entscheidung) continue
    const tage = daysUntil(ma.vertragsende)
    if (tage < 30) gruende.push({ farbe: 'rot', text: 'Befristung ' + ma.name + ' läuft ' + (tage < 0 ? 'ist abgelaufen' : 'in ' + tage + ' Tagen ab') + ' — keine Entscheidung' })
    else if (tage < 90) gruende.push({ farbe: 'gelb', text: 'Befristung ' + ma.name + ' läuft in ' + tage + ' Tagen ab — keine Entscheidung' })
  }

  const farbe = gruende.reduce((acc, g) => (RANG[g.farbe] > RANG[acc] ? g.farbe : acc), 'gruen')
  return { farbe, gruende }
}

// ─── „Heute"-Leiste: alles Fällige bezirksweit ──────────────────────
// Rückgabe: sortierte Liste { typ, filialeId, text, datum, ueberfaellig, link }

export function heuteItems(data) {
  const items = []
  const fName = (id) => data.filialen.find((f) => f.id === id)?.name || 'Bezirk'

  for (const a of data.aufgaben) {
    if (a.status !== 'offen' || !a.faelligkeit) continue
    const tage = daysUntil(a.faelligkeit)
    if (tage <= 7) {
      items.push({
        typ: 'aufgabe', id: a.id, filialeId: a.filialeId, datum: a.faelligkeit,
        ueberfaellig: tage < 0, prio: a.prio,
        text: a.titel, sub: fName(a.filialeId),
        link: '/aufgabe/' + a.id,
      })
    }
  }

  for (const n of data.notizen) {
    if (n.erledigt || !n.wiedervorlage) continue
    const tage = daysUntil(n.wiedervorlage)
    if (tage <= 0) {
      items.push({
        typ: 'notiz', id: n.id, filialeId: n.filialeId, datum: n.wiedervorlage,
        ueberfaellig: tage < 0,
        text: n.text.length > 60 ? n.text.slice(0, 60) + '…' : n.text, sub: fName(n.filialeId),
        link: '/notiz/' + n.id,
      })
    }
  }

  for (const f of data.filialen) {
    for (const ma of f.mitarbeiter || []) {
      if (ma.vertragsart !== 'befristet' || !ma.vertragsende || ma.entscheidung) continue
      const tage = daysUntil(ma.vertragsende)
      if (tage < 90) {
        items.push({
          typ: 'befristung', id: ma.id, filialeId: f.id, datum: ma.vertragsende,
          ueberfaellig: tage < 30,
          text: 'Befristung ' + ma.name + (tage < 0 ? ' abgelaufen!' : ' läuft in ' + tage + ' Tagen ab'),
          sub: f.name,
          link: '/filiale/' + f.id + '/personal',
        })
      }
    }
  }

  return items.sort((a, b) => (a.datum || '').localeCompare(b.datum || ''))
}
