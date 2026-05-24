/**
 * Interactive Tutorial Component
 * Displays clickable nodes over app screenshots to guide users
 */

import React, { useState, useEffect } from 'react';
import { Pause, RefreshCw, XCircle, FileText, Plus } from 'lucide-react';

// Static Home Screen Component - Exact replica using real app code
function StaticHomeScreen() {
  return (
    <div style={{ height: 'calc(var(--vh, 1vh) * 100)', width: '100%' }} className="bg-neutral-100 flex flex-col p-4 overflow-hidden relative">
      {/* Top Controls */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-3 sm:mb-4 flex-shrink-0">
        <button className="bg-neutral-200 p-2.5 sm:p-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 sm:gap-2 btn-base">
          <Pause size={14} className="sm:w-4 sm:h-4" /> Pause
        </button>
        <button className="bg-neutral-200 p-2.5 sm:p-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 sm:gap-2 btn-base">
          <RefreshCw size={14} className="sm:w-4 sm:h-4" /> Recalibrate
        </button>
        <button className="bg-neutral-200 p-2.5 sm:p-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 sm:gap-2 btn-base">
          <XCircle size={14} className="sm:w-4 sm:h-4" /> Close
        </button>
      </div>

      {/* Top Quick Tools */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-3 sm:mb-4 flex-shrink-0">
        <button className="p-4 sm:p-6 rounded-xl text-sm sm:text-xl font-bold btn-base transition-colors bg-blue-100 text-blue-700">
          Reversibles
        </button>
        <button className="p-4 sm:p-6 rounded-xl text-sm sm:text-xl font-bold btn-base transition-colors bg-orange-100 text-orange-700">
          ROSC
        </button>
        <button className="p-4 sm:p-6 rounded-xl text-sm sm:text-xl font-bold btn-base transition-colors bg-purple-100 text-purple-700">
          PHEA
        </button>
      </div>

      {/* Main Center Display */}
      <div className="flex-1 bg-white border-4 rounded-3xl relative overflow-hidden transition-colors duration-300 min-h-0 border-emerald-500">
        <div className="h-full flex flex-col items-center px-2 sm:px-3 pt-4 pb-2 sm:pb-3 relative">
          {/* Corner Cards */}
          <div className="absolute top-3 sm:top-4 left-3 sm:left-4 right-3 sm:right-4 flex justify-between gap-3 sm:gap-4">
            <div className="bg-neutral-100 border border-neutral-100 shadow-sm rounded-xl sm:rounded-2xl py-4 px-4 sm:py-7 sm:px-8 flex flex-col items-center min-w-[100px] sm:min-w-[140px]">
              <span className="text-[10px] sm:text-[12px] font-bold text-neutral-900 tracking-widest mb-1.5 sm:mb-3">Total time</span>
              <span className="text-[22px] sm:text-[43px] font-bold text-neutral-400 tabular-nums leading-none">1:28</span>
            </div>
            <div className="bg-neutral-100 border border-neutral-100 shadow-sm rounded-xl sm:rounded-2xl py-4 px-4 sm:py-7 sm:px-8 flex flex-col items-center min-w-[100px] sm:min-w-[140px]">
              <span className="text-[10px] sm:text-[12px] font-bold text-neutral-900 tracking-widest mb-1.5 sm:mb-3">CPR round</span>
              <span className="text-[22px] sm:text-[43px] font-bold text-neutral-400 tabular-nums leading-none">1</span>
            </div>
          </div>

          {/* Rhythm Check - Centered vertically and responsive size */}
          <div className="flex-1 flex flex-col items-center justify-center w-full pt-14 sm:pt-16">
            <div className="relative flex items-center justify-center w-[240px] h-[240px] sm:w-[320px] sm:h-[320px]">
              <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 300 300">
                <circle
                  cx="150"
                  cy="150"
                  r="140"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="6"
                  className="text-neutral-50"
                />
                <circle
                  cx="150"
                  cy="150"
                  r="140"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="6"
                  strokeLinecap="round"
                  className="text-emerald-500"
                  strokeDasharray="879.64"
                  strokeDashoffset="454.77"
                  style={{ pathLength: 1 }}
                />
              </svg>
              
              <div className="flex flex-col items-center z-10 translate-y-3 sm:translate-y-4">
                <div className="text-7xl sm:text-[120px] font-bold tabular-nums tracking-tighter leading-none text-neutral-900">
                  0:58
                </div>
                <div className="text-[14px] sm:text-[18px] uppercase tracking-widest font-bold mt-4 sm:mt-8 text-neutral-400">
                  Rhythm Check
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Main Controls */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 mt-3 sm:mt-4 flex-shrink-0">
        <button className="p-3 sm:p-5 rounded-2xl text-base sm:text-xl font-bold flex items-center justify-center gap-2 sm:gap-3 btn-base transition-colors bg-emerald-600 text-white">
          <FileText size={18} className="sm:w-6 sm:h-6" />
          Summary
        </button>
        <button className="p-3 sm:p-5 rounded-2xl text-base sm:text-xl font-bold flex items-center justify-center gap-2 sm:gap-3 btn-base transition-colors bg-emerald-600 text-white">
          <Plus size={18} className="sm:w-6 sm:h-6" />
          Add Tx
        </button>
      </div>
    </div>
  );
}

// Static Add Tx Menu Component
function StaticAddTxMenu() {
  const categories = [
    { name: 'Rhythm Check', items: ['Defib', 'Rhythm'], color: 'bg-red-50' },
    { name: 'Medications', items: ['Adrenaline', 'Amiodarone', 'Atropine', 'Calcium', 'Glucose 10%', 'Magnesium', 'Midazolam', 'Morphine', 'Sodium Bicarbonate', 'TXA'], color: 'bg-emerald-50' },
    { name: 'Airway', items: ['Airway', 'Intubation', 'SGA'], color: 'bg-blue-50' },
    { name: 'Access', items: ['IV', 'IO', 'Art line'], color: 'bg-purple-50' },
    { name: 'Other', items: ['Custom'], color: 'bg-neutral-50' },
  ];

  return (
    <div style={{ height: 'calc(var(--vh, 1vh) * 100)', width: '100%' }} className="bg-white flex flex-col overflow-y-auto">
      {categories.map((category) => (
        <div key={category.name}>
          <div className="p-2.5 px-4 font-bold text-[16px] tracking-wide border-b uppercase sticky top-0 text-center bg-neutral-100 text-neutral-800 border-neutral-200">
            {category.name}
          </div>
          <div className={`grid grid-cols-2 gap-3 p-4 ${category.color}`}>
            {category.items.map((item) => (
              <button
                key={item}
                className="p-4 rounded-xl font-bold text-lg bg-white shadow-sm border border-neutral-200 text-neutral-700"
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Static Adrenaline Dosing Component
function StaticAdrenalineDose() {
  const doses = [
    { label: '1mg (Adult cardiac arrest)', value: '1mg' },
    { label: '10mcg/kg (Paediatric cardiac arrest)', value: '10mcg/kg' },
    { label: '0.01mg/kg (Anaphylaxis)', value: '0.01mg/kg' },
    { label: 'Other', value: 'Other' },
  ];

  return (
    <div style={{ height: 'calc(var(--vh, 1vh) * 100)', width: '100%' }} className="bg-white flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-neutral-200 bg-neutral-50">
        <div className="text-2xl font-bold text-neutral-900">Adrenaline</div>
        <div className="text-sm text-neutral-600 mt-1">Select dose</div>
      </div>
      
      {/* Dose options */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {doses.map((dose) => (
          <button
            key={dose.value}
            className="w-full p-5 rounded-xl font-semibold text-lg bg-emerald-50 border-2 border-emerald-200 text-emerald-900 text-left"
          >
            {dose.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// Static Home With Alerts Component
function StaticHomeWithAlerts() {
  return (
    <div style={{ height: 'calc(var(--vh, 1vh) * 100)', width: '100%' }} className="bg-neutral-100 flex flex-col p-4 overflow-hidden relative">
      {/* Top Controls */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-3 sm:mb-4 flex-shrink-0">
        <button className="bg-neutral-200 p-2.5 sm:p-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 sm:gap-2 btn-base">
          <Pause size={14} className="sm:w-4 sm:h-4" /> Pause
        </button>
        <button className="bg-neutral-200 p-2.5 sm:p-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 sm:gap-2 btn-base">
          <RefreshCw size={14} className="sm:w-4 sm:h-4" /> Recalibrate
        </button>
        <button className="bg-neutral-200 p-2.5 sm:p-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 sm:gap-2 btn-base">
          <XCircle size={14} className="sm:w-4 sm:h-4" /> Close
        </button>
      </div>

      {/* Top Quick Tools */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-3 sm:mb-4 flex-shrink-0">
        <button className="p-4 sm:p-6 rounded-xl text-sm sm:text-xl font-bold btn-base transition-colors bg-blue-100 text-blue-700">
          Reversibles
        </button>
        <button className="p-4 sm:p-6 rounded-xl text-sm sm:text-xl font-bold btn-base transition-colors bg-orange-100 text-orange-700">
          ROSC
        </button>
        <button className="p-4 sm:p-6 rounded-xl text-sm sm:text-xl font-bold btn-base transition-colors bg-purple-100 text-purple-700">
          PHEA
        </button>
      </div>

      {/* Main Center Display with Alerts */}
      <div className="flex-1 bg-white border-4 rounded-3xl relative overflow-hidden transition-colors duration-300 min-h-0 border-emerald-500">
        <div className="h-full flex flex-col items-center px-2 sm:px-3 pt-4 pb-2 sm:pb-3 relative">
          {/* Corner Cards */}
          <div className="absolute top-3 sm:top-4 left-3 sm:left-4 right-3 sm:right-4 flex justify-between gap-3 sm:gap-4">
            <div className="bg-neutral-100 border border-neutral-100 shadow-sm rounded-xl sm:rounded-2xl py-4 px-4 sm:py-7 sm:px-8 flex flex-col items-center min-w-[100px] sm:min-w-[140px]">
              <span className="text-[10px] sm:text-[12px] font-bold text-neutral-900 tracking-widest mb-1.5 sm:mb-3">Total time</span>
              <span className="text-[22px] sm:text-[43px] font-bold text-neutral-400 tabular-nums leading-none">3:42</span>
            </div>
            <div className="bg-neutral-100 border border-neutral-100 shadow-sm rounded-xl sm:rounded-2xl py-4 px-4 sm:py-7 sm:px-8 flex flex-col items-center min-w-[100px] sm:min-w-[140px]">
              <span className="text-[10px] sm:text-[12px] font-bold text-neutral-900 tracking-widest mb-1.5 sm:mb-3">CPR round</span>
              <span className="text-[22px] sm:text-[43px] font-bold text-neutral-400 tabular-nums leading-none">2</span>
            </div>
          </div>

          {/* Timer */}
          <div className="flex-1 flex flex-col items-center justify-center w-full pt-14 sm:pt-16">
            <div className="relative flex items-center justify-center w-[240px] h-[240px] sm:w-[320px] sm:h-[320px]">
              <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 300 300">
                <circle cx="150" cy="150" r="140" fill="none" stroke="currentColor" strokeWidth="6" className="text-neutral-50" />
                <circle cx="150" cy="150" r="140" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" className="text-emerald-500" strokeDasharray="879.64" strokeDashoffset="659.73" style={{ pathLength: 1 }} />
              </svg>
              <div className="flex flex-col items-center z-10 translate-y-3 sm:translate-y-4">
                <div className="text-7xl sm:text-[120px] font-bold tabular-nums tracking-tighter leading-none text-neutral-900">1:15</div>
                <div className="text-[14px] sm:text-[18px] uppercase tracking-widest font-bold mt-4 sm:mt-8 text-neutral-400">Rhythm Check</div>
              </div>
            </div>
          </div>

          {/* Alert Banners at bottom */}
          <div className="absolute bottom-3 left-3 right-3 space-y-2">
            <div className="bg-amber-100 border-2 border-amber-500 rounded-xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                <span className="font-bold text-amber-900 text-sm">Adrenaline due</span>
              </div>
              <span className="text-amber-700 text-xs font-semibold">Next: 4:14</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Main Controls */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 mt-3 sm:mt-4 flex-shrink-0">
        <button className="p-3 sm:p-5 rounded-2xl text-base sm:text-xl font-bold flex items-center justify-center gap-2 sm:gap-3 btn-base transition-colors bg-emerald-600 text-white">
          <FileText size={18} className="sm:w-6 sm:h-6" />
          Summary
        </button>
        <button className="p-3 sm:p-5 rounded-2xl text-base sm:text-xl font-bold flex items-center justify-center gap-2 sm:gap-3 btn-base transition-colors bg-emerald-600 text-white">
          <Plus size={18} className="sm:w-6 sm:h-6" />
          Add Tx
        </button>
      </div>
    </div>
  );
}

// Static Summary Component
function StaticSummary() {
  return (
    <div style={{ height: 'calc(var(--vh, 1vh) * 100)', width: '100%' }} className="bg-white flex flex-col overflow-y-auto">
      {/* Medication Summary */}
      <div className="p-2.5 px-4 font-bold text-[16px] tracking-wide border-b uppercase sticky top-0 text-center bg-emerald-50 text-emerald-800 border-emerald-200">
        Medication Summary
      </div>
      <div className="p-4 bg-emerald-50 space-y-3">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-emerald-200">
          <div className="font-bold text-lg text-emerald-900">Adrenaline</div>
          <div className="text-2xl font-bold text-emerald-700 mt-1">2mg total</div>
          <div className="text-sm text-neutral-600 mt-1">2 doses given</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-emerald-200">
          <div className="font-bold text-lg text-emerald-900">Amiodarone</div>
          <div className="text-2xl font-bold text-emerald-700 mt-1">300mg total</div>
          <div className="text-sm text-neutral-600 mt-1">1 dose given</div>
        </div>
      </div>

      {/* Treatment Log */}
      <div className="p-2.5 px-4 font-bold text-[16px] tracking-wide border-b uppercase sticky top-0 text-center bg-neutral-100 text-neutral-800 border-neutral-200">
        Treatment Log
      </div>
      <div className="p-4 space-y-2">
        <div className="bg-neutral-50 rounded-lg p-3 border border-neutral-200">
          <div className="flex justify-between items-start">
            <div className="font-semibold text-neutral-900">Adrenaline 1mg</div>
            <div className="text-xs text-neutral-500">2 min ago</div>
          </div>
          <div className="text-sm text-neutral-600 mt-1">14:42 (3:14 elapsed)</div>
        </div>
        <div className="bg-neutral-50 rounded-lg p-3 border border-neutral-200">
          <div className="flex justify-between items-start">
            <div className="font-semibold text-neutral-900">Amiodarone 300mg</div>
            <div className="text-xs text-neutral-500">3 min ago</div>
          </div>
          <div className="text-sm text-neutral-600 mt-1">14:41 (3:13 elapsed)</div>
        </div>
        <div className="bg-neutral-50 rounded-lg p-3 border border-neutral-200">
          <div className="flex justify-between items-start">
            <div className="font-semibold text-neutral-900">Adrenaline 1mg</div>
            <div className="text-xs text-neutral-500">4 min ago</div>
          </div>
          <div className="text-sm text-neutral-600 mt-1">14:40 (3:12 elapsed)</div>
        </div>
      </div>
    </div>
  );
}

// Static Case Summary Component  
function StaticCaseSummary() {
  return (
    <div style={{ height: 'calc(var(--vh, 1vh) * 100)', width: '100%' }} className="bg-white flex flex-col overflow-y-auto">
      {/* Header with action buttons */}
      <div className="p-4 border-b border-neutral-200 bg-neutral-50">
        <div className="text-2xl font-bold text-neutral-900 mb-4">Case Summary</div>
        <div className="grid grid-cols-2 gap-3">
          <button className="p-3 rounded-xl font-bold text-sm bg-blue-600 text-white flex items-center justify-center gap-2">
            <FileText size={16} />
            Export PDF
          </button>
          <button className="p-3 rounded-xl font-bold text-sm bg-red-600 text-white flex items-center justify-center gap-2">
            <XCircle size={16} />
            Delete Case
          </button>
        </div>
      </div>

      {/* Case Stats */}
      <div className="p-4 bg-neutral-50 space-y-3">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="text-sm text-neutral-600">Total Duration</div>
          <div className="text-3xl font-bold text-neutral-900 mt-1">18:42</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="text-sm text-neutral-600">CPR Rounds</div>
          <div className="text-3xl font-bold text-neutral-900 mt-1">9</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="text-sm text-neutral-600">Outcome</div>
          <div className="text-2xl font-bold text-green-600 mt-1">ROSC</div>
        </div>
      </div>

      {/* Final Treatment Log */}
      <div className="p-2.5 px-4 font-bold text-[16px] tracking-wide border-b uppercase sticky top-0 text-center bg-neutral-100 text-neutral-800 border-neutral-200">
        Final Treatment Log
      </div>
      <div className="p-4 space-y-2">
        <div className="bg-neutral-50 rounded-lg p-3 border border-neutral-200">
          <div className="font-semibold text-neutral-900">ROSC</div>
          <div className="text-sm text-neutral-600 mt-1">14:18:42 (18:42 elapsed)</div>
        </div>
        <div className="bg-neutral-50 rounded-lg p-3 border border-neutral-200">
          <div className="font-semibold text-neutral-900">Adrenaline 1mg</div>
          <div className="text-sm text-neutral-600 mt-1">14:16:14 (16:14 elapsed)</div>
        </div>
        <div className="bg-neutral-50 rounded-lg p-3 border border-neutral-200">
          <div className="font-semibold text-neutral-900">Amiodarone 300mg</div>
          <div className="text-sm text-neutral-600 mt-1">14:08:41 (08:41 elapsed)</div>
        </div>
      </div>
    </div>
  );
}

interface TutorialElement {
  id: string;
  x: number;
  y: number;
  number: number;
  title: string;
  description: string;
}

interface TutorialScreen {
  title: string;
  image: string;
  nextScreen: string | null;
  elements: TutorialElement[];
}

interface TutorialScreens {
  [key: string]: TutorialScreen;
}

interface InteractiveTutorialProps {
  onClose: () => void;
}

const InteractiveTutorial: React.FC<InteractiveTutorialProps> = ({ onClose }) => {
  const [currentScreen, setCurrentScreen] = useState('intro1');
  const [exploredElements, setExploredElements] = useState<Set<string>>(new Set());
  const [activeExplanation, setActiveExplanation] = useState<TutorialElement | null>(null);

  const screens: TutorialScreens = {
    intro1: {
      title: 'Welcome to The Big One',
      image: 'https://github.com/MattJonesACTAS/The-Big-One/blob/main/public/tutorial/1.png?raw=true',
      nextScreen: 'intro2',
      elements: [],
    },
    intro2: {
      title: 'Getting Started',
      image: 'https://github.com/MattJonesACTAS/The-Big-One/blob/main/public/tutorial/1.png?raw=true',
      nextScreen: 'home1',
      elements: [],
    },
    home1: {
      title: 'CPR Timer Home Screen',
      image: 'https://github.com/MattJonesACTAS/The-Big-One/blob/main/public/tutorial/1.png?raw=true',
      nextScreen: 'addTxMenu',
      elements: [
        { id: 'totalTime', x: 19.8, y: 22, number: 1, title: 'Total Time', description: "Total time the monitor has been turned on" },
        { id: 'cprRound', x: 80.2, y: 22, number: 2, title: 'CPR Round', description: "The current round of CPR" },
        { id: 'timer', x: 50, y: 52, number: 3, title: 'Rhythm Check Timer', description: "The countdown to the next rhythm check. When the timer reaches 0:00, it pauses for 6 seconds to allow for the rhythm check, then restarts from 2:00." },
        { id: 'pause', x: 19.0, y: 4.2, number: 4, title: 'Pause Button', description: "Pause and resume the rhythm check timer" },
        { id: 'recalibrate', x: 51.0, y: 4.2, number: 5, title: 'Recalibrate Button', description: "The app estimates a rhythm check of 6 seconds. Recalibrate the timer to match reality if your rhythm checks are longer." },
        { id: 'tabs', x: 50, y: 10.75, number: 6, title: 'Checklists', description: "Quick access to checklists for the reversible causes of arrest, ROSC and Prehospital emergency anaesthesia (PHEA)" },
        { id: 'addTxBtn', x: 75, y: 95.4, number: 7, title: 'Add Treatment Button', description: "Tap here to log treatments and interventions during the arrest" },
      ],
    },
    addTxMenu: {
      title: 'Add Treatment Menu',
      image: 'https://github.com/MattJonesACTAS/The-Big-One/blob/main/public/tutorial/2.png?raw=true',
      nextScreen: 'adrenalineDose',
      elements: [
        { id: 'addTxSubmenu', x: 50, y: 45.9, number: 1, title: 'Add Tx submenu', description: "After pressing the Add Tx button, you will be brought to a submenu containing multiple kinds of treatments you can log" },
      ],
    },
    adrenalineDose: {
      title: 'Adrenaline Dosing',
      image: 'https://github.com/MattJonesACTAS/The-Big-One/blob/main/public/tutorial/4.png?raw=true',
      nextScreen: 'home2',
      elements: [
        { id: 'medications', x: 53.2, y: 44.2, number: 1, title: 'Medications', description: "Each medication will bring up one or multiple age/weight based dosage options depending on the indication. Custom doses can also be added. Let's log adrenaline and amiodarone." },
      ],
    },
    home2: {
      title: 'Medication Alerts',
      image: 'https://github.com/MattJonesACTAS/The-Big-One/blob/main/public/tutorial/5.png?raw=true',
      nextScreen: 'home2_summary',
      elements: [
        { id: 'adrenalineAlert', x: 28.4, y: 82.82, number: 1, title: 'Medication alerts', description: "When you log adrenaline or amiodarone, an alert will appear on the home screen to help you keep track of when the next dose is due." },
      ],
    },
    home2_summary: {
      title: 'Summary Navigation',
      image: 'https://github.com/MattJonesACTAS/The-Big-One/blob/main/public/tutorial/5.png?raw=true',
      nextScreen: 'summary',
      elements: [
        { id: 'summaryBtn', x: 26.6, y: 95.4, number: 1, title: 'Summary Button', description: "Next, let's have a look at the running case summary page" },
      ],
    },
    summary: {
      title: 'Active Case Summary',
      image: 'https://github.com/MattJonesACTAS/The-Big-One/blob/main/public/tutorial/6.png?raw=true',
      nextScreen: 'home2_close',
      elements: [
        { id: 'pharmaSummary', x: 50, y: 50, number: 1, title: 'Medication Summary', description: "All medications logged will appear here, with an accumulative tally of the total amount of each drug given." },
        { id: 'treatmentLog', x: 50, y: 70.9, number: 2, title: 'Treatment Log', description: "Chronological record of all logged interventions. Timestamps show the exact time, the elapsed time on the monitor, and how long ago each Tx was logged." },
      ],
    },
    home2_close: {
      title: 'Close Case Navigation',
      image: 'https://github.com/MattJonesACTAS/The-Big-One/blob/main/public/tutorial/5.png?raw=true',
      nextScreen: 'caseSummary',
      elements: [
        { id: 'close', x: 82.2, y: 4.2, number: 1, title: 'Close Button', description: "Let's say we've either stopped resuscitative efforts or we've handed our patient over at hospital. We can now close the case." },
      ],
    },
    caseSummary: {
      title: 'Closed Case Summary',
      image: 'https://github.com/MattJonesACTAS/The-Big-One/blob/main/public/tutorial/8.png?raw=true',
      nextScreen: null,
      elements: [
        { id: 'finalStats', x: 50, y: 61.64, number: 1, title: 'Final Case Data', description: "Now the case is over, the treatment log shows times to the second, not just to the minute" },
        { id: 'export', x: 27, y: 14, number: 2, title: 'Export PDF', description: "Export the case summary and Tx log to a pdf, which you can then email for later review." },
        { id: 'delete', x: 73, y: 14, number: 3, title: 'Delete Case', description: "Permanently delete the case information from the app" },
      ],
    },
  };

  const currentScreenData = screens[currentScreen];
  const requiredElements = new Set(currentScreenData.elements.map(el => el.id));
  const allExplored = Array.from(requiredElements).every(id => exploredElements.has(id));

  // Preload all tutorial images when component mounts
  useEffect(() => {
    const imagesToPreload = [
      'https://github.com/MattJonesACTAS/The-Big-One/blob/main/public/tutorial/1.png?raw=true',
      'https://github.com/MattJonesACTAS/The-Big-One/blob/main/public/tutorial/2.png?raw=true',
      'https://github.com/MattJonesACTAS/The-Big-One/blob/main/public/tutorial/4.png?raw=true',
      'https://github.com/MattJonesACTAS/The-Big-One/blob/main/public/tutorial/5.png?raw=true',
      'https://github.com/MattJonesACTAS/The-Big-One/blob/main/public/tutorial/6.png?raw=true',
      'https://github.com/MattJonesACTAS/The-Big-One/blob/main/public/tutorial/8.png?raw=true',
    ];

    imagesToPreload.forEach(src => {
      const img = new Image();
      img.src = src;
    });
  }, []);

  const handleElementClick = (element: TutorialElement) => {
    setActiveExplanation(element);
    setExploredElements(prev => new Set([...prev, element.id]));
  };

  const handleCloseExplanation = () => {
    setActiveExplanation(null);
  };

  const handleNext = () => {
    if (currentScreenData.nextScreen) {
      setCurrentScreen(currentScreenData.nextScreen);
      setExploredElements(new Set()); // Reset for next screen
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: ['home1', 'addTxMenu', 'adrenalineDose', 'home2', 'home2_summary', 'home2_close', 'summary', 'caseSummary'].includes(currentScreen) ? 'transparent' : '#1a1a1a',
      display: 'flex',
      flexDirection: 'column',
      alignItems: ['home1', 'addTxMenu', 'adrenalineDose', 'home2', 'home2_summary', 'home2_close', 'summary', 'caseSummary'].includes(currentScreen) ? 'stretch' : 'center',
      justifyContent: ['home1', 'addTxMenu', 'adrenalineDose', 'home2', 'home2_summary', 'home2_close', 'summary', 'caseSummary'].includes(currentScreen) ? 'stretch' : 'center',
      padding: ['home1', 'addTxMenu', 'adrenalineDose', 'home2', 'home2_summary', 'home2_close', 'summary', 'caseSummary'].includes(currentScreen) ? '0' : '20px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      zIndex: 9999,
      overflowY: 'auto',
    }}>
      {/* Render static components for various screens */}
      {currentScreen === 'home1' && <StaticHomeScreen />}
      {currentScreen === 'addTxMenu' && <StaticAddTxMenu />}
      {currentScreen === 'adrenalineDose' && <StaticAdrenalineDose />}
      {(currentScreen === 'home2' || currentScreen === 'home2_summary' || currentScreen === 'home2_close') && <StaticHomeWithAlerts />}
      {currentScreen === 'summary' && <StaticSummary />}
      {currentScreen === 'caseSummary' && <StaticCaseSummary />}
      
      {/* Exit button overlay for static screens */}
      {['home1', 'addTxMenu', 'adrenalineDose', 'home2', 'home2_summary', 'home2_close', 'summary', 'caseSummary'].includes(currentScreen) && (
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            zIndex: 10001,
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            fontSize: '20px',
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ×
        </button>
      )}
      
      {/* Screenshot rendering for intro screens only */}
      {(currentScreen === 'intro1' || currentScreen === 'intro2') && (
        <div style={{
          position: 'relative',
          width: '100%',
          maxWidth: '400px',
          backgroundColor: '#000',
          borderRadius: '20px',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}>
          {/* Exit button for testing */}
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              zIndex: 10001,
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              fontSize: '20px',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ×
          </button>

          <img
            src={currentScreenData.image}
            alt={currentScreenData.title}
            style={{
              width: '100%',
              height: 'auto',
              display: 'block',
            }}
          />
        </div>
      )}

      {/* Intro message boxes for intro1 and intro2 screens */}
      {(currentScreen === 'intro1' || currentScreen === 'intro2') && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          zIndex: 10000,
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            padding: '24px',
            maxWidth: '320px',
            width: '85%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          }}>
            <div style={{
              color: '#1a1a1a',
              fontSize: '16px',
              lineHeight: '1.6',
              textAlign: 'center',
              marginBottom: '20px',
            }}>
              {currentScreen === 'intro1' && 
                "The Big One is a tool that you can use when acting as the team leader during cardiac arrest cases to help you stay on top of everything."
              }
              {currentScreen === 'intro2' && 
                "On opening the app, you'll need to enter some times from the monitor and details about the patient. You'll then be brought to the home screen."
              }
            </div>
            
            {/* Next button at bottom of box */}
            <button
              onClick={handleNext}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#10b981',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
              }}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {currentScreenData.elements.map((element) => {
        const isExplored = exploredElements.has(element.id);
        if (isExplored) return null;
        
        // Progressive reveal: only show the next node in sequence
        const exploredNumbers = currentScreenData.elements
          .filter(el => exploredElements.has(el.id))
          .map(el => el.number);
        const nextNumber = exploredNumbers.length > 0 
          ? Math.max(...exploredNumbers) + 1 
          : 1;
        
        // Only render this node if it's the next in sequence
        if (element.number !== nextNumber) return null;
        
        return (
          <div
            key={element.id}
            onClick={() => handleElementClick(element)}
            style={{
              position: 'absolute',
              left: `${element.x}%`,
              top: `${element.y}%`,
              width: '43px',
              height: '43px',
              transform: 'translate(-50%, -50%)',
              cursor: 'pointer',
              zIndex: 10,
            }}
          >
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: '100%',
              height: '100%',
              transform: 'translate(-50%, -50%)',
              borderRadius: '50%',
              border: '2px solid #10b981',
              animation: 'ripple 2s infinite',
              opacity: 0.6,
            }} />
            
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: '26px',
              height: '26px',
              transform: 'translate(-50%, -50%)',
              borderRadius: '50%',
              backgroundColor: '#fff',
              border: '3px solid #10b981',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '15px',
              fontWeight: '700',
              color: '#10b981',
            }}>
              {element.number}
            </div>
          </div>
        );
      })}

      <style>{`
        @keyframes ripple {
          0% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 0.6;
          }
          100% {
            transform: translate(-50%, -50%) scale(1.8);
            opacity: 0;
          }
        }
        @keyframes buttonPulse {
          0%, 100% {
            transform: translateX(-50%) scale(1);
            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
          }
          50% {
            transform: translateX(-50%) scale(1.05);
            box-shadow: 0 6px 20px rgba(16, 185, 129, 0.5);
          }
        }
      `}</style>

      {/* Next button - centered bottom with pulsing animation (for non-intro screens) */}
      {/* Special case for home1: Add Tx button with flashing text */}
      {allExplored && currentScreenData.nextScreen && currentScreen === 'home1' && (
        <button
          onClick={handleNext}
          className="text-base sm:text-xl"
          style={{
            position: 'absolute',
            bottom: '16px',
            right: '16px',
            width: 'calc((100% - 32px - 12px) / 2)',
            height: '48px',
            backgroundColor: '#059669',
            color: '#ffffff',
            border: 'none',
            outline: 'none',
            borderRadius: '16px',
            fontWeight: '700',
            cursor: 'pointer',
            zIndex: 10001,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
          aria-label="Continue to Add Treatment screen"
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            animation: 'textFlash 2s infinite',
          }}>
            <Plus size={18} className="sm:w-6 sm:h-6" />
            Add Tx
          </div>
        </button>
      )}
      
      <style>{`
        @keyframes textFlash {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
      
      {/* Special case for home2_summary: show exact replica of Summary button */}
      {allExplored && currentScreenData.nextScreen && currentScreen === 'home2_summary' && (
        <button
          onClick={handleNext}
          style={{
            position: 'absolute',
            bottom: 'calc(3.5% + 5px)',
            left: 'calc(5% + 15px)',
            width: '41.8%',
            padding: '14.4px 20px',
            backgroundColor: '#10b981',
            color: '#fff',
            border: 'none',
            borderRadius: '16px',
            fontSize: '18px',
            fontWeight: '700',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            animation: 'buttonPulse 2s infinite',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
          Summary
        </button>
      )}
      
      {/* Special case for addTxMenu: clickable medication button */}
      {allExplored && currentScreenData.nextScreen && currentScreen === 'addTxMenu' && (
        <button
          onClick={handleNext}
          style={{
            position: 'absolute',
            top: '25%',
            left: '16px',
            right: '16px',
            height: '60px',
            backgroundColor: '#059669',
            color: '#ffffff',
            border: 'none',
            outline: 'none',
            borderRadius: '12px',
            fontSize: '18px',
            fontWeight: '700',
            cursor: 'pointer',
            zIndex: 10001,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            animation: 'textFlash 2s infinite',
          }}>
            Adrenaline
          </div>
        </button>
      )}
      
      {/* Special case for adrenalineDose: clickable dose button */}
      {allExplored && currentScreenData.nextScreen && currentScreen === 'adrenalineDose' && (
        <button
          onClick={handleNext}
          style={{
            position: 'absolute',
            top: '30%',
            left: '16px',
            right: '16px',
            height: '70px',
            backgroundColor: '#d1fae5',
            color: '#065f46',
            border: '2px solid #10b981',
            outline: 'none',
            borderRadius: '12px',
            fontSize: '18px',
            fontWeight: '700',
            cursor: 'pointer',
            zIndex: 10001,
            display: 'flex',
            alignItems: 'center',
            textAlign: 'left',
            paddingLeft: '20px',
          }}
        >
          <div style={{
            animation: 'textFlash 2s infinite',
          }}>
            1mg (Adult cardiac arrest)
          </div>
        </button>
      )}
      
      {/* Special case for home2_summary: Summary button overlay */}
      {allExplored && currentScreenData.nextScreen && currentScreen === 'home2_summary' && (
        <button
          onClick={handleNext}
          className="text-base sm:text-xl"
          style={{
            position: 'absolute',
            bottom: '16px',
            left: '16px',
            width: 'calc((100% - 32px - 12px) / 2)',
            height: '48px',
            backgroundColor: '#059669',
            color: '#ffffff',
            border: 'none',
            outline: 'none',
            borderRadius: '16px',
            fontWeight: '700',
            cursor: 'pointer',
            zIndex: 10001,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            animation: 'textFlash 2s infinite',
          }}>
            <FileText size={18} className="sm:w-6 sm:h-6" />
            Summary
          </div>
        </button>
      )}
      
      {/* Special case for home2_close: Close button overlay */}
      {allExplored && currentScreenData.nextScreen && currentScreen === 'home2_close' && (
        <button
          onClick={handleNext}
          className="text-xs sm:text-sm"
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            width: 'calc((100% - 32px - 12px) / 3)',
            height: '44px',
            backgroundColor: '#e5e5e5',
            color: '#000',
            border: 'none',
            outline: 'none',
            borderRadius: '12px',
            fontWeight: '700',
            cursor: 'pointer',
            zIndex: 10001,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            animation: 'textFlash 2s infinite',
          }}>
            <XCircle size={14} className="sm:w-4 sm:h-4" />
            Close
          </div>
        </button>
      )}
      
      {/* For summary and caseSummary screens: use regular Next button */}
      {allExplored && currentScreenData.nextScreen && (currentScreen === 'summary' || currentScreen === 'home2') && (
        <button
          onClick={handleNext}
          style={{
            position: 'absolute',
            bottom: '5%',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '16px 48px',
            backgroundColor: '#10b981',
            color: '#fff',
            border: 'none',
            borderRadius: '12px',
            fontSize: '18px',
            fontWeight: '700',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
            zIndex: 10001,
          }}
        >
          <div style={{ animation: 'textFlash 2s infinite' }}>
            Next
          </div>
        </button>
      )}
      
      {/* Regular Next button for intro screens only */}
      {allExplored && currentScreenData.nextScreen && currentScreen !== 'intro1' && currentScreen !== 'intro2' && currentScreen !== 'home1' && currentScreen !== 'addTxMenu' && currentScreen !== 'adrenalineDose' && currentScreen !== 'home2' && currentScreen !== 'home2_summary' && currentScreen !== 'home2_close' && currentScreen !== 'summary' && currentScreen !== 'caseSummary' && (
        <button
          onClick={handleNext}
          style={{
            position: 'absolute',
            bottom: '15%',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '12px 36px',
            backgroundColor: '#10b981',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '17px',
            fontWeight: '600',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
            animation: 'buttonPulse 2s infinite',
          }}
        >
          Next
        </button>
      )}

      {/* Finish button - appears on final screen in top-right */}
      {currentScreen === 'caseSummary' && allExplored && (
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            padding: '12px 24px',
            backgroundColor: '#10b981',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '15px',
            fontWeight: '600',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
          }}
        >
          Finish
        </button>
      )}

      {activeExplanation && (
        <div
          onClick={handleCloseExplanation}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            zIndex: 10000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#fff',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '400px',
              width: '100%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            }}
          >
            <h3 style={{
              margin: '0 0 12px 0',
              fontSize: '20px',
              color: '#1a1a1a',
              textAlign: 'center',
            }}>
              {activeExplanation.title}
            </h3>
            <p style={{
              margin: '0 0 20px 0',
              fontSize: '15px',
              lineHeight: '1.5',
              color: '#444',
              textAlign: 'center',
            }}>
              {activeExplanation.description}
            </p>
            <button
              onClick={handleCloseExplanation}
              style={{
                width: '100%',
                backgroundColor: '#10b981',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '12px',
                fontSize: '15px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default InteractiveTutorial;
