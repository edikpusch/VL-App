// ─── Ampel-Logik (automatisch, zielbasiert) ──────────────────────────
// Regel: schlechtester Einzelwert bestimmt die Gesamtampel.
// Rückgabe: { farbe: 'gruen'|'gelb'|'rot', gruende: [{farbe, text}] }

import { daysUntil, zieleFuer, currentMonth } from './store.js'

const RANG = { gruen: 0, gelb: 1, rot: 2 }

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

  // 3+4) Kennzahlen — letzter erfasster Monat
  const kz = data.kennzahlen
    .filter((k) => k.filialeId === filialeId && k.monat <= currentMonth())
    .sort((a, b) => b.monat.localeCompare(a.monat))[0]
  if (kz) {
    const kl = parseFloat(kz.kassierleistung)
    if (!isNaN(kl) && ziele.kassierleistung) {
      if (kl < ziele.kassierleistung * 0.9) gruende.push({ farbe: 'rot', text: 'Kassierleistung ' + String(kl).replace('.', ',') + ' (Ziel ' + ziele.kassierleistung + ')' })
      else if (kl < ziele.kassierleistung) gruende.push({ farbe: 'gelb', text: 'Kassierleistung ' + String(kl).replace('.', ',') + ' (Ziel ' + ziele.kassierleistung + ')' })
    }
    const pk = parseFloat(kz.personalkosten)
    if (!isNaN(pk) && ziele.personalkosten) {
      if (pk > ziele.personalkosten + 0.3) gruende.push({ farbe: 'rot', text: 'Personalkosten ' + String(pk).replace('.', ',') + ' % (Ziel ' + String(ziele.personalkosten).replace('.', ',') + ' %)' })
      else if (pk > ziele.personalkosten) gruende.push({ farbe: 'gelb', text: 'Personalkosten ' + String(pk).replace('.', ',') + ' % (Ziel ' + String(ziele.personalkosten).replace('.', ',') + ' %)' })
    }
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
