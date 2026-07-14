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
    AbschriftenEingabe.jsx ← KW-Schnelleingabe: je Bereich %+VJ%, Vorwoche auto, Floppliste
    WochenberichtFlow.jsx  ← Durchklick-Wizard: Umsatz/OG/SB/BO/Stunden/Kunden/Payback/Kassier
                             Abweichungen auto-berechnet, pro Feld überschreibbar (manual-Set)
    PersonalkostenEingabe.jsx ← Monat → alle Filialen, Plan/Ist €+%, Abw. auto
    TsInventurEdit.jsx     ← TS-Inventur: Gesamtverlust + 5 schwächste Bereiche (Freitext, datalist bezirksweit)
    Besuchsmodus.jsx ← „Auf einen Blick" pro Filiale: Diagnose→Treiber→Maßnahme (→Aufgabe)
    Befristungen.jsx← bezirksweite Liste nach Ablaufdatum
    Einstellungen.jsx← Ziele, Kategorien, PIN, JSON-Backup/-Import
```

## Kennzahlen-Architektur (mehrere Report-Typen)
- store.js Zahlen-Helfer: `normNum()` (entfernt deutsche Tausenderpunkte "312.000"→312000, Komma→Punkt — IMMER für Zahleneingaben verwenden!), `num()`, `fmtNum/fmtEuro/fmtProzent/fmtPP`, `abwEuro/abwProzent/anteilProzent`.
- `wochenberichte` (wöchentlich, pro KW): Gesamtumsatz (VJ/Plan/Ist + Abw. zu Plan UND VJ), O&G/SB (VJ/Ist/Abw./Anteil), Bake-Off (Umsatz/Wo./Abw.VJ%/Anteil), Stunden (Ist/Soll/Diff), Kunden, Payback, **Kassierstatistik** (kassierIst/kassierVj Pos./Min + Abw.). Alle Derivate gespeichert; Wizard rechnet auto, `manual`-Set schützt überschriebene Felder bei Basisänderung.
- `personalkosten` (monatlich): planEuro/planProzent/istEuro/istProzent; Abw. berechnet.
- `tsInventuren` (monatlich): gesamtVerlust €+%, bereiche[] (Freitext-Name + diff €/% + kum €/%). Namen bezirksweit durchsuchbar (Bezirk-Suche) + datalist-Autovervollständigung.
- Ampel (ampel.js) nutzt jetzt: personalkosten (Ist% vs Plan%), letzterWochenbericht (Kassier vs VJ, Umsatz vs Plan), plus Abschriften + Inventuren + Befristungen. Helfer `letzterWochenbericht()`, `letzteTsInventur()`.
- Altes `kennzahlen`-Array (kassierleistung/personalkosten) ist ABGELÖST/ungenutzt (bleibt für Alt-Backups im Schema).

## Abschriften & Besuchsmodus (Kern-KPIs)
- Echte VL-Kennzahlen = **Abschriften % je Bereich** (wöchentl.) + **Inventurdifferenz je Bereich** (monatl.). Quelle: gedruckte Reports (Abschriftenreport kompakt, Floppliste, Netto-Inventuren).
- ABSCHRIFT_BEREICHE = TS · BO · Blumen · O&G · Mopro · SB-Wurst · SB-Fleisch · SB-Fisch (≠ Inventur-BEREICHE!)
- Bewertung `abschriftenBewertung()` in ampel.js: Vergleich gegen **Vorjahr UND Vorwoche** (kein starrer Zielwert). Rot = schlechter als beide; Gelb = schlechter als eine; Sprung erzwingt kein Rot, wenn Wert unter VJ. Fließt in computeAmpel() ein.
- Besuchsmodus (`/filiale/:id/besuch`): kritische Bereiche zuerst, Top-5-Verlustbringer (aufklappbar), Maßnahmen-Picker (Vorschläge aus `massnahmenVorschlaege()` + Freitext) → legt Aufgabe (Prio hoch, `bereich`-Feld) + Historie an.
- Bilderkennung bewusst NICHT gebaut → siehe Datenschutz-Entscheidung unten.

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
  kennzahlen: [{ id, filialeId, monat:'YYYY-MM', kassierleistung, personalkosten }],
  abschriften: [{ id, filialeId, jahr, kw, bereich, prozent, vjProzent }],
  flops: [{ id, filialeId, jahr, kw, bereich, artikel, verlustEuro }],
  tsInventuren: [{ id, filialeId, datum, gesamtVerlustEuro, gesamtVerlustProzent, bereiche:[{name,diffEuro,diffProzent,kumEuro,kumProzent}] }],
  personalkosten: [{ id, filialeId, monat, planEuro, planProzent, istEuro, istProzent }],
  wochenberichte: [{ id, filialeId, jahr, kw, umsatzVj/Plan/Ist, umsatzAbwPlanE/P, umsatzAbwVjE/P, og*, sb*, bo*, stundenIst/Soll/Diff, kunden, payback, kassierIst/Vj/Abw/AbwP }]
}
```

## Datenschutz / Bilderkennung (13.07.2026 entschieden)
- Kennzahlen-Reports = firmenvertraulich, Mitarbeiterdaten = personenbezogen (DSGVO). Dürfen NICHT in öffentliche Cloud.
- On-device OCR (Tesseract) für dichte Zahlen-Tabellen zu unzuverlässig; gute Vision-KI wäre Cloud → verboten.
- **Entscheidung: Schnell-Eingabe (offline) als Weg.** OCR nur später und nur selbst gehostet im sicheren Netz (IT-Thema, nicht jetzt). Mitarbeiter ohnehin manuell.

## UX-Muster (13.07.2026 aus Praxistest)
- Abschriften-Tab: Karte antippen klappt Verlustartikel der KW auf
- Filial-Aufgaben: Ansicht „Diese Woche" (fällig ≤ Sonntag) + „Erledigt"-Seite; spätere Fälligkeiten (inkl. nächster Instanz wiederkehrender Aufgaben) eingeklappt unter „Später fällig"
- Befristungen-Seite: „+ Neu" → Filiale wählen → MitarbeiterEdit mit ?befristet=1 (Vertragsart vorbelegt)
- Einstellungen: Ziele mit Scope-Chips (Bezirks-Standard | pro Filiale); Filial-Felder leer = erben (Platzhalter „Bezirk: X"), gespeichert in zieleProFiliale, „•" am Chip markiert Overrides; Eingaben speichern onBlur (defaultValue + key={scope})

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
