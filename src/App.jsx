import { useState } from 'react'
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom'
import { load } from './store.js'
import PinLock from './components/PinLock.jsx'
import { BottomNav } from './components/Ui.jsx'

import Bezirk from './pages/Bezirk.jsx'
import FilialeAkte from './pages/FilialeAkte.jsx'
import FilialeEdit from './pages/FilialeEdit.jsx'
import Aufgaben from './pages/Aufgaben.jsx'
import AufgabeEdit from './pages/AufgabeEdit.jsx'
import NotizEdit from './pages/NotizEdit.jsx'
import InventurEdit from './pages/InventurEdit.jsx'
import MitarbeiterEdit from './pages/MitarbeiterEdit.jsx'
import Kennzahlen from './pages/Kennzahlen.jsx'
import AbschriftenEingabe from './pages/AbschriftenEingabe.jsx'
import WochenberichtFlow from './pages/WochenberichtFlow.jsx'
import PersonalkostenEingabe from './pages/PersonalkostenEingabe.jsx'
import TsInventurEdit from './pages/TsInventurEdit.jsx'
import Besuchsmodus from './pages/Besuchsmodus.jsx'
import Report from './pages/Report.jsx'
import Befristungen from './pages/Befristungen.jsx'
import Einstellungen from './pages/Einstellungen.jsx'

function Inhalt() {
  const loc = useLocation()
  // Bottom-Nav auf Editor-Seiten ausblenden (Platz für Tastatur)
  const editor = /\/(neu|edit|eingabe|report)|\/aufgabe\/|\/notiz\/|\/inventur\/|\/ts-inventur\/|\/mitarbeiter\//.test(loc.pathname)
  return (
    <>
      <Routes>
        <Route path="/" element={<Bezirk />} />
        <Route path="/filiale/neu" element={<FilialeEdit />} />
        <Route path="/filiale/:id/edit" element={<FilialeEdit />} />
        <Route path="/filiale/:id/besuch" element={<Besuchsmodus />} />
        <Route path="/filiale/:id/report" element={<Report />} />
        <Route path="/filiale/:id/:tab" element={<FilialeAkte />} />
        <Route path="/filiale/:id" element={<FilialeAkte />} />
        <Route path="/aufgaben" element={<Aufgaben />} />
        <Route path="/aufgabe/neu" element={<AufgabeEdit />} />
        <Route path="/aufgabe/:id" element={<AufgabeEdit />} />
        <Route path="/notiz/neu" element={<NotizEdit />} />
        <Route path="/notiz/:id" element={<NotizEdit />} />
        <Route path="/inventur/neu" element={<InventurEdit />} />
        <Route path="/inventur/:id" element={<InventurEdit />} />
        <Route path="/mitarbeiter/:filialeId/neu" element={<MitarbeiterEdit />} />
        <Route path="/mitarbeiter/:filialeId/:id" element={<MitarbeiterEdit />} />
        <Route path="/kennzahlen" element={<Kennzahlen />} />
        <Route path="/abschriften/eingabe" element={<AbschriftenEingabe />} />
        <Route path="/wochenbericht/eingabe" element={<WochenberichtFlow />} />
        <Route path="/personalkosten/eingabe" element={<PersonalkostenEingabe />} />
        <Route path="/ts-inventur/neu" element={<TsInventurEdit />} />
        <Route path="/ts-inventur/:id" element={<TsInventurEdit />} />
        <Route path="/befristungen" element={<Befristungen />} />
        <Route path="/einstellungen" element={<Einstellungen />} />
        <Route path="*" element={<Bezirk />} />
      </Routes>
      {!editor && <BottomNav />}
    </>
  )
}

export default function App() {
  const [gesperrt, setGesperrt] = useState(() => {
    const data = load()
    return !!data.pinHash && sessionStorage.getItem('vla_unlocked') !== '1'
  })

  if (gesperrt) {
    return <PinLock pinHash={load().pinHash} onUnlock={() => setGesperrt(false)} />
  }

  return (
    <HashRouter>
      <Inhalt />
    </HashRouter>
  )
}
