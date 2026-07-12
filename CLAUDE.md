# VL App – Projektkontext für Claude Code

## Übersicht
React PWA für Bezirksleiter: "Eine Filiale = eine digitale Akte" (Modul 5 des BR-Projekts, spätere Shell für alle Module).
Konzept: siehe VL-App-Konzept.md (Ordner Claude-Outputs) · Stack wie MehrstundenManager: React + Vite + localStorage, 100 % offline, Vercel-Deploy via GitHub Desktop.

## V1-Entscheidungen (12.07.2026 abgestimmt)
- Kennzahlen: nur Kassierleistung + Personalkosten-% (KEIN Umsatz)
- Filialbesuchs-Planung: erst V2 → Quick-Taps heute/morgen/+3 Tage/+1 Woche
- Geräte: Handy + Tablet gleichwertig, Warnungen nur in-App (keine Push)
- Historie: automatisch + manuelle Einträge
- Besonderheiten: Freitext-Tags
- Ziele: konfigurierbar in Einstellungen (Defaults: Inventurdiff 0,8 %, KL 30, PK 8,5 %)

## Struktur
```
src/
  store.js          ← localStorage (Key 'vla_data'), Datum-Helfer, sha256, zieleFuer()
  ampel.js          ← computeAmpel() + heuteItems() (Heute-Leiste)
  useData.js        ← Hook: [data, update] – update(fn) klont, speichert, rendert
  App.jsx           ← HashRouter + PIN-Gate (sessionStorage 'vla_unlocked')
  components/
    Ui.jsx          ← Header, Ampel, BottomNav, Empty, MiniChart (SVG-Sparkline)
    PinLock.jsx     ← PIN-Sperre (SHA-256)
  pages/
    Bezirk.jsx      ← Start: Heute-Leiste, globale Suche, Ampel-Kacheln (rot>gelb>grün)
    FilialeAkte.jsx ← Reiter: Info/Aufgaben/Inventuren/Kennzahlen/Personal/Notizen/Historie
                      exportiert AufgabenListe (wird von Aufgaben.jsx mitgenutzt)
    FilialeEdit / AufgabeEdit / NotizEdit / InventurEdit / MitarbeiterEdit
    Aufgaben.jsx    ← bezirksweit, Ansichten Fälligkeit/Filiale/Kategorie
    Kennzahlen.jsx  ← Bezirksvergleich · KennzahlenEingabe.jsx ← Monat → alle Filialen
    Befristungen.jsx← bezirksweite Liste nach Ablaufdatum
    Einstellungen.jsx← Ziele, Kategorien, PIN, JSON-Backup/-Import
```

## Datenstruktur (localStorage 'vla_data')
```js
{
  version, pinHash,
  einstellungen: { kategorien[], ziele: { inventurDiff{bereich:%}, kassierleistung, personalkosten }, zieleProFiliale{} },
  filialen: [{ id, nummer, name, adresse, telefon, oeffnungszeiten, verkaufsflaeche,
    ansprechpartner[], besonderheiten[Tags], letzteAmpel,
    mitarbeiter: [{ id, name, funktion, vertragsart, vertragsende, notiz, entscheidung }],
    historie: [{ id, datum, typ:'auto'|'manuell', text }] }],
  aufgaben: [{ id, filialeId|null, titel, kategorie, prio, faelligkeit, beschreibung, status, intervallTage, inventurId? }],
  notizen: [{ id, filialeId|null, text, wiedervorlage, erledigt }],
  inventuren: [{ id, filialeId, datum, bereich, diffEuro, diffProzent, vjEuro, vjProzent, verlustbringer[], notizen }],
  kennzahlen: [{ id, filialeId, monat:'YYYY-MM', kassierleistung, personalkosten }]
}
```

## Wichtige Regeln
- Ampel: schlechtester Einzelwert gewinnt; Begründung per Tap auf Ampel in Filialakte
- Befristungs-Monitor: <90 T. gelb, <30 T. rot – Entscheidung (verlängert/entfristet/läuft aus) löscht Warnung + Historie-Eintrag
- Wiederkehrende Aufgaben: bei Erledigung neue Instanz +intervallTage
- Ampelwechsel werden beim Öffnen der Bezirksseite in filiale.historie protokolliert (Vergleich mit letzteAmpel)
- KEINE Info-alerts (blockieren UI) – confirm() nur für destruktive Aktionen
- Zahleneingaben: Komma→Punkt beim Speichern, Punkt→Komma bei Anzeige
- Deploy: GitHub Desktop → Commit & Push → Vercel auto-deploy

## Roadmap
V2: JSON-Import aus InventurManager · Foto-Anhänge (IndexedDB) · Kalender-Wochenansicht
V3: Shell – Integration FlopMelder, MehrstundenManager, EinsatzplanGenerator
