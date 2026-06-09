/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  RotateCcw, 
  Pause, 
  Play, 
  CheckCircle2, 
  FileText, 
  Plus, 
  Trash2, 
  ChevronDown, 
  AlertCircle,
  XCircle,
  Clock,
  Zap,
  ShieldCheck,
  Stethoscope,
  ArrowRight,
  Sliders,
  RefreshCw,
  Hand
} from 'lucide-react';
import { AppState, Treatment, OverlayType } from './types';
import InteractiveTutorial from './InteractiveTutorial';
import TutorialOverlay from './TutorialOverlay';

// --- Constants ---
const INITIAL_STATE: AppState = {
  running: false,
  startTime: null,
  pausedTime: 0,
  elapsedSeconds: 0,
  rhythmCheckTarget: 120, // 2 minutes
  rhythmCheckOvertime: 0, // Counts up from 0 to 6 after rhythm check hits 0:00
  rhythmCheckPaused: false, // When true, rhythm check stays frozen even while running
  cprRound: 1,
  shocks: 0,
  treatments: [],
  currentOverlay: null,
  catchupElapsed: 0,
  startClockTime: null,
  patientWeight: null,
  patientType: null,
  reversiblesChecked: [],
  roscChecked: [],
  pheaChecked: [],
  isROSCMode: false,
  vitals: { hr: '', rr: '', gcs: '', bpSys: '', bpDia: '', spo2: '', etco2: '', bgl: '', temp: '' }
};

const MEDICATIONS = [
  'Adrenaline push', 'Adrenaline infusion', 'Amiodarone', 
  'Atropine', 'Calcium', 'Glucose 10%', 'Heparin', 'Ketamine push', 'Ketamine infusion', 'Lignocaine',
  'Magnesium', 'Midazolam', 'Morphine', 'Normal Saline', 'Oxygen', 'Sodium Bicarbonate', 'Suxamethonium'
];

type DoseOption = {
  dose: string;
  population: 'adult' | 'paed' | 'both';
  indication?: string;
};


const DOSE_CONFIG: Record<string, { doses: DoseOption[] }> = {
  'Adrenaline push': { 
    doses: [
      { dose: '1mg', population: 'adult', indication: 'Cardiac arrest' },
      { dose: '0.01mg/kg', population: 'paed', indication: 'Cardiac arrest' },
      { dose: 'Other', population: 'both' }
    ] 
  },
  'Adrenaline infusion': { 
    doses: [
      { dose: '1mg/500mL', population: 'both', indication: 'Gravity fed — adult & paed' },
      { dose: '3mg/50mL', population: 'both', indication: 'Infusion pump — adult or large paed (≥21kg)' },
      { dose: '300mcg/50mL', population: 'paed', indication: 'Infusion pump — small paed (≤20kg)' },
      { dose: 'Other', population: 'both' }
    ] 
  },
  'Amiodarone': { 
    doses: [
      { dose: '300mg', population: 'adult', indication: 'VF/pVT cardiac arrest' },
      { dose: '150mg', population: 'adult', indication: 'VT/AF/A.flutter with output' },
      { dose: '5mg/kg', population: 'paed', indication: 'VF/pVT cardiac arrest', calculated: true },
      { dose: '2.5mg/kg', population: 'paed', indication: 'VF/pVT cardiac arrest (repeat)', calculated: true },
      { dose: '5mg/kg', population: 'paed', indication: 'VT with output', calculated: true },
      { dose: 'Other', population: 'both' }
    ] 
  },
  'Atropine': { 
    doses: [
      { dose: '600mcg', population: 'adult', indication: 'Bradycardia' },
      { dose: 'Other', population: 'both' }
    ] 
  },
  'Calcium': { 
    doses: [
      { dose: '10mg/kg', population: 'both', indication: 'Cardiac arrest / With cardiac output', calculated: true },
      { dose: 'Other', population: 'both' }
    ] 
  },
  'Glucose 10%': { 
    doses: [
      { dose: '2.5mL/kg', population: 'both', calculated: true, indication: 'Hypoglycaemia' },
      { dose: 'Other', population: 'both' }
    ],
    customUnit: 'mls'
  },
  'Heparin': {
    doses: [
      { dose: '5000u', population: 'adult', indication: 'STEMI' },
      { dose: 'Other', population: 'both' }
    ]
  },
  'Ketamine push': { 
    doses: [
      { dose: '0.5mg/kg', population: 'both', indication: 'CPR induced consciousness' },
      { dose: '1mg/kg', population: 'adult', indication: 'Intubation induction with Suxamethonium / Post intubation analgosedation' },
      { dose: '1mg/kg', population: 'paed', indication: 'Post intubation analgosedation' },
      { dose: '2mg/kg', population: 'adult', indication: 'Intubation when suxamethonium is contraindicated' },
      { dose: 'Other', population: 'both' }
    ] 
  },
  'Ketamine infusion': {
    doses: [
      { dose: 'mg/h', population: 'both', indication: 'Post intubation analgosedation' }
    ]
  },
  'Lignocaine': { 
    doses: [
      { dose: '1mg/kg', population: 'both', indication: 'VT with output' },
      { dose: 'Other', population: 'both' }
    ] 
  },
  'Magnesium': { 
    doses: [
      { dose: '2.5g', population: 'adult', indication: 'pVT secondary to prolonged QT' },
      { dose: '50mg/kg', population: 'paed', indication: 'pVT secondary to prolonged QT' },
      { dose: 'Other', population: 'both' }
    ] 
  },
  'Midazolam': { 
    doses: [
      { dose: '0.05mg/kg', population: 'both', indication: 'Post intubation sedation with ketamine' },
      { dose: 'mg/h', population: 'adult', indication: 'Post intubation sedation morph/midaz infusion' },
      { dose: 'mg', population: 'adult', indication: 'Post intubation sedation with morphine - push dose' }
    ] 
  },
  'Morphine': {
    doses: [
      { dose: 'mg/h', population: 'adult', indication: 'Post intubation sedation morph/midaz infusion' },
      { dose: 'mg', population: 'adult', indication: 'Post intubation sedation with midazolam - push dose' }
    ]
  },
  'Normal Saline': { 
    doses: [
      { dose: '250mL', population: 'both' },
      { dose: '500mL', population: 'both' },
      { dose: 'Other', population: 'both' }
    ] 
  },
  'Sodium Bicarbonate': { 
    doses: [
      { dose: '1mMol/kg', population: 'both', indication: 'Cardiac arrest: Hyperkalaemia/OD / Cardioactive drug OD with output', calculated: true },
      { dose: '0.5mMol/kg', population: 'both', indication: 'Hyperkalaemia with output', calculated: true },
      { dose: 'Other', population: 'both' }
    ] 
  },
  'Suxamethonium': { 
    doses: [
      { dose: '1.5mg/kg', population: 'adult', indication: 'Intubation' },
      { dose: 'Other', population: 'both' }
    ] 
  },
  'Oxygen': {
    doses: [
      { dose: 'Nasal cannulae', population: 'both' },
      { dose: 'NRB', population: 'both' },
      { dose: 'BVM', population: 'both' }
    ]
  }
};

// --- Utilities ---
const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const formatTimeWithSeconds = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const formatTimeHMM = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}:${mins.toString().padStart(2, '0')}`;
};

const getLocalTime = (date?: Date) => {
  const d = date || new Date();
  return d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false });
};

const getLocalTimeWithSeconds = (date?: Date) => {
  const d = date || new Date();
  return d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
};

const calculateDose = (doseStr: string, weight: number | null): string => {
  if (!weight || !doseStr.includes('/kg')) return doseStr;
  
  const match = doseStr.match(/([\d.]+)(mg|g|mcg|ml|mL|mMol)\/kg/i);
  if (!match) return doseStr;
  
  const [_, amount, unit] = match;
  const calculated = parseFloat(amount) * (typeof weight === 'number' ? weight : parseFloat(String(weight)));
  const rounded = Math.round(calculated * 10) / 10;
  
  return `${amount}${unit}/kg (${rounded}${unit})`;
};

const cleanDoseForLog = (doseStr: string): string => {
  // Extract calculated dose from parentheses if present: "0.01mg/kg (0.3mg)" -> "0.3mg"
  const match = doseStr.match(/\(([\d.]+(?:mg|g|mcg|ml|mL|mls|mMol))\)/i);
  if (match) {
    return match[1];
  }
  return doseStr;
};

const formatGlucose10Dose = (doseStr: string): string => {
  // For Glucose 10%, format as (xxxml/xxg) - 0.1g per mL
  // Extract mL amount from various formats: "200mls", "200mL", "200ml", "2.5mL/kg (200mL)"
  console.log('formatGlucose10Dose input:', doseStr);
  const mlMatch = doseStr.match(/([\d.]+)\s*(?:ml|mls|mL|mLs)/i);
  console.log('formatGlucose10Dose match:', mlMatch);
  if (mlMatch) {
    const mls = parseFloat(mlMatch[1]);
    const grams = Math.round(mls * 0.1 * 10) / 10; // 0.1g per mL, rounded to 1 decimal
    const result = `(${mls}ml/${grams}g)`;
    console.log('formatGlucose10Dose output:', result);
    return result;
  }
  console.log('formatGlucose10Dose no match, returning:', doseStr);
  return doseStr;
};

const formatSodiumBicarbonateDose = (doseStr: string): string => {
  // For Sodium Bicarbonate 8.4%, format as (xxxmMol/xxxml) - 1mMol/mL concentration
  // Extract mMol amount from various formats: "80mMol", "1mMol/kg (80mMol)"
  console.log('formatSodiumBicarbonateDose input:', doseStr);
  const mmolMatch = doseStr.match(/([\d.]+)\s*(?:mmol|mMol|MMOL)/i);
  console.log('formatSodiumBicarbonateDose match:', mmolMatch);
  if (mmolMatch) {
    const mmol = parseFloat(mmolMatch[1]);
    const mls = Math.round(mmol * 10) / 10; // 1mMol = 1mL, rounded to 1 decimal
    const result = `(${mmol}mMol/${mls}ml)`;
    console.log('formatSodiumBicarbonateDose output:', result);
    return result;
  }
  console.log('formatSodiumBicarbonateDose no match, returning:', doseStr);
  return doseStr;
};

const formatCalciumDose = (doseStr: string, weight: number | null): string => {
  // Calcium chloride 10% = 100mg/mL
  // 10mg/kg, max 1g (10mL)
  if (!weight) return doseStr;
  if (weight >= 100) {
    return `10mg/kg — 1g max (10mL of 10%)`;
  }
  const calculatedMg = 10 * weight; // 10mg/kg
  const mg = Math.min(Math.round(calculatedMg * 10) / 10, 1000);
  const mL = Math.round(mg / 100 * 10) / 10; // 100mg/mL
  return `10mg/kg (${mg}mg / ${mL}mL of 10%)`;
};

export default function App() {
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(() => {
    return localStorage.getItem('disclaimerAccepted') === 'true';
  });
  const [disclaimerChecked, setDisclaimerChecked] = useState(false);

  const handleAcceptDisclaimer = () => {
    localStorage.setItem('disclaimerAccepted', 'true');
    setDisclaimerAccepted(true);
  };

  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem('theBigOneState');
    if (saved) {
      try {
        const loaded = JSON.parse(saved);
        return {
          ...loaded,
          currentOverlay: null // Reset overlays on reload
        };
      } catch (e) {
        return INITIAL_STATE;
      }
    }
    return INITIAL_STATE;
  });

  const [showCatchup, setShowCatchup] = useState(() => {
    const saved = localStorage.getItem('theBigOneState');
    if (!saved) return true; // No saved state = show catchup
    try {
      const loaded = JSON.parse(saved);
      return !loaded.running; // Show catchup if timer not running
    } catch (e) {
      return true;
    }
  });
  const [catchupStep, setCatchupStep] = useState(1);
  const [catchupElapsed, setCatchupElapsed] = useState({ mins: 0, secs: 0 });
  const [catchupRhythm, setCatchupRhythm] = useState({ mins: 2, secs: 0 });
  const [weightType, setWeightType] = useState<'adult' | 'paed' | null>(null);
  const [paedWeightMethod, setPaedWeightMethod] = useState<'weight' | 'age' | null>(null);
  const [weightInput, setWeightInput] = useState('');
  const [priorCounts, setPriorCounts] = useState({ shock: 0, disarm: 0, adrenaline: 0 });
  const [priorTxs, setPriorTxs] = useState<string[]>([]);
  const [useManualEntry, setUseManualEntry] = useState(false);
  const [elapsedTimestamp, setElapsedTimestamp] = useState<number | null>(null);
  const [cprTimestamp, setCprTimestamp] = useState<number | null>(null);
  const [timingMode, setTimingMode] = useState<'cpr' | 'elapsed' | 'log' | null>(null);
  const [rhythmInterval, setRhythmInterval] = useState<'evens' | 'odds' | 'half-evens' | 'half-odds' | null>(null);
  const [demoTick, setDemoTick] = useState(0); // drives animated timers on mode selection screen
  const [isCaseClosed, setIsCaseClosed] = useState(false);
  const [showCloseWarning, setShowCloseWarning] = useState(false);
  const [disregardAdrenaline, setDisregardAdrenaline] = useState<'pending' | 'confirmed' | null>(null);
  const [disregardAmiodarone, setDisregardAmiodarone] = useState<'pending' | 'confirmed' | null>(null);
  const [showDeleteWarning, setShowDeleteWarning] = useState(false);
  const [showPauseWarning, setShowPauseWarning] = useState(false);
  const [showResetWarning, setShowResetWarning] = useState(false);
  const [showTimerAdjust, setShowTimerAdjust] = useState(false);
  const [timerAdjustValue, setTimerAdjustValue] = useState({ mins: 2, secs: 0 });
  const [roscButtonFlashing, setRoscButtonFlashing] = useState(false);
  const [showLoggedNotification, setShowLoggedNotification] = useState(false);
  const loggedTreatmentRef = useRef<string>('');
  const [isShockForced, setIsShockForced] = useState(false);
  const [rearrested, setRearrested] = useState(false);
  const [hasShownForcedShock, setHasShownForcedShock] = useState(false);
  const lastBeepSecond = useRef<number | null>(null);
  const hasAutoClosedAt10 = useRef<boolean>(false);
  const previousCountdown = useRef<number | null>(null);
  
  // Tutorial mode state
  const [tutorialMode, setTutorialMode] = useState(false);
  const [tutorialScreen, setTutorialScreen] = useState({ index: -1, complete: false, nodeIndex: 0 });
  const [tutorialNodeIndex, setTutorialNodeIndex] = useState(0);

  // Add CSS classes to body for tutorial button flashing
  useEffect(() => {
    console.log('Tutorial screen tracking:', tutorialScreen);
    console.log('Current overlay:', state.currentOverlay);
    console.log('Treatments length:', state.treatments.length);
    
    // Node 7 (addTxBtn) complete - flash Add Tx button (index 8 = waiting for treatment screen)
    if (tutorialMode && tutorialScreen.index === 8 && state.currentOverlay === null) {
      document.body.classList.add('tutorial-flash-add-tx');
    } else {
      document.body.classList.remove('tutorial-flash-add-tx');
    }

    // Node 8 (addTxSubmenu) complete - flash Adrenaline and dose buttons (index 9)
    if (tutorialMode && tutorialScreen.index === 9) {
      document.body.classList.add('tutorial-flash-adrenaline');
      document.body.classList.add('tutorial-flash-dose');
    } else {
      document.body.classList.remove('tutorial-flash-adrenaline');
      document.body.classList.remove('tutorial-flash-dose');
    }

    // Node 10 (summaryBtn) complete - flash Summary button (index 11 = waiting for summary overlay)
    if (tutorialMode && tutorialScreen.index === 11 && state.currentOverlay === null) {
      document.body.classList.add('tutorial-flash-summary');
    } else {
      document.body.classList.remove('tutorial-flash-summary');
    }

    // Node 13 (closeOverlay) complete - flash summary close button (index 13 = waiting on summary)
    if (tutorialMode && tutorialScreen.index === 13 && state.currentOverlay === 'summary') {
      document.body.classList.add('tutorial-flash-summary-close');
    } else {
      document.body.classList.remove('tutorial-flash-summary-close');
    }

    // Node 13 (closeCase) complete - flash Close Case button (index 14 = waiting on home)
    if (tutorialMode && tutorialScreen.index === 14 && state.currentOverlay === null) {
      document.body.classList.add('tutorial-flash-close');
    } else {
      document.body.classList.remove('tutorial-flash-close');
    }

    // Tutorial done - flash Delete Case button
    if (tutorialMode && tutorialScreen.complete) {
      document.body.classList.add('tutorial-flash-delete');
    } else {
      document.body.classList.remove('tutorial-flash-delete');
    }
    
    return () => {
      document.body.classList.remove('tutorial-flash-add-tx');
      document.body.classList.remove('tutorial-flash-adrenaline');
      document.body.classList.remove('tutorial-flash-dose');
      document.body.classList.remove('tutorial-flash-summary');
      document.body.classList.remove('tutorial-flash-summary-close');
      document.body.classList.remove('tutorial-flash-close');
      document.body.classList.remove('tutorial-flash-delete');
    };
  }, [tutorialMode, tutorialScreen, state.treatments.length, state.currentOverlay]);

  // Timeout for disregard pending states (3 seconds)
  useEffect(() => {
    if (disregardAdrenaline === 'pending') {
      const timer = setTimeout(() => {
        setDisregardAdrenaline(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [disregardAdrenaline]);

  useEffect(() => {
    if (disregardAmiodarone === 'pending') {
      const timer = setTimeout(() => {
        setDisregardAmiodarone(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [disregardAmiodarone]);

  // Force scroll reset and layout recalculation on mount
  useEffect(() => {
    // Aggressive scroll reset for mobile browsers
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    
    // Force mobile browser to recalculate viewport - multiple passes
    const setVh = () => {
      const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      document.documentElement.style.setProperty('--vh', `${vh * 0.01}px`);
    };
    
    // Set immediately
    setVh();
    
    // Set after layout stabilizes
    requestAnimationFrame(() => {
      setVh();
      requestAnimationFrame(() => {
        setVh();
        // Final set after 100ms to catch any late layout changes
        setTimeout(setVh, 100);
      });
    });
    
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', setVh);
      return () => window.visualViewport.removeEventListener('resize', setVh);
    }
  }, []);

  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.05, audioCtx.currentTime + 0.01);
      gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.1);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.1);
      setTimeout(() => audioCtx.close(), 200);
    } catch (e) {
      console.warn('Audio context failed', e);
    }
  };

  // Persistence
  useEffect(() => {
    localStorage.setItem('theBigOneState', JSON.stringify(state));
  }, [state]);

  // Timer logic
  // Demo tick for animated timers on timing mode selection screen
  useEffect(() => {
    if (catchupStep !== 6) return;
    const interval = window.setInterval(() => setDemoTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [catchupStep]);

  useEffect(() => {
    let interval: number;
    if (state.running) {
      interval = window.setInterval(() => {
        setState(prev => {
          const now = Date.now();
          const newElapsed = Math.floor((now - (prev.startTime || now) + prev.pausedTime) / 1000);
          
          let nextTarget = prev.rhythmCheckTarget;
          let nextRound = prev.cprRound;
          let nextOverlay = prev.currentOverlay;
          let nextOvertime = prev.rhythmCheckOvertime;
          let nextPaused = prev.rhythmCheckPaused;
          
          // Only update rhythm check if not paused
          if (!prev.rhythmCheckPaused) {
            const countdown = prev.rhythmCheckTarget - newElapsed;

            // Auto-close overlay ONCE at 10s
            if (countdown === 10 && !hasAutoClosedAt10.current) {
              nextOverlay = null;
              hasAutoClosedAt10.current = true;
            }

            // Beep logic only between 10 and 5 seconds
            if (countdown <= 10 && countdown > 5 && lastBeepSecond.current !== newElapsed) {
              playBeep();
              lastBeepSecond.current = newElapsed;
            }

            // Handle rhythm check reaching 0:00 and overtime
            if (countdown <= 0) {
              // Calculate overtime (how many seconds past the target)
              nextOvertime = newElapsed - prev.rhythmCheckTarget;
              
              // When overtime reaches 6 seconds, force shock entry and reset immediately
              if (nextOvertime >= 6) {
                // Force shock overlay (don't wait for user to complete it)
                if (!showCatchup && !tutorialMode) {
                  nextOverlay = 'treatment';
                  setIsShockForced(true);
                }
                
                // Reset immediately regardless of shock entry
                nextTarget = newElapsed + 120;
                nextRound += 1;
                nextOvertime = 0;
                hasAutoClosedAt10.current = false;
                setHasShownForcedShock(false); // Reset for next cycle
              }
            } else {
              nextOvertime = 0; // Reset overtime when not past target
            }
            
            // Update previous countdown for next iteration
            previousCountdown.current = countdown;
          }
          
          return {
            ...prev,
            elapsedSeconds: newElapsed,
            rhythmCheckTarget: nextTarget,
            rhythmCheckOvertime: nextOvertime,
            rhythmCheckPaused: nextPaused,
            cprRound: nextRound,
            currentOverlay: nextOverlay
          };
        });
      }, 500);
    }
    return () => clearInterval(interval);
  }, [state.running]);

  const togglePause = () => {
    setState(prev => {
      // Toggle rhythm check pause, but keep elapsed timer running
      if (!prev.rhythmCheckPaused) {
        // Pausing rhythm check - freeze the countdown by capturing current value
        const currentCountdown = Math.max(0, prev.rhythmCheckTarget - prev.elapsedSeconds);
        setShowPauseWarning(false);
        return {
          ...prev,
          rhythmCheckPaused: true,
          frozenCountdown: currentCountdown  // Store the frozen countdown value
        };
      } else {
        // Unpausing rhythm check - adjust target to maintain the frozen countdown
        const newTarget = prev.elapsedSeconds + (prev.frozenCountdown || 0);
        return {
          ...prev,
          rhythmCheckPaused: false,
          rhythmCheckTarget: newTarget,
          frozenCountdown: undefined  // Clear frozen value
        };
      }
    });
  };

  const confirmPause = () => {
    // Simply toggle the pause state without resetting the timer
    togglePause();
  };

  const resetTimer = () => {
    setState(prev => ({
      ...prev,
      rhythmCheckTarget: prev.elapsedSeconds + 120,
      rhythmCheckOvertime: 0
    }));
    setShowResetWarning(false);
  };

  const applyTimerAdjustment = () => {
    const totalSeconds = timerAdjustValue.mins * 60 + timerAdjustValue.secs;
    
    if (totalSeconds > 0) {
      setState(prev => ({
        ...prev,
        rhythmCheckTarget: prev.elapsedSeconds + totalSeconds,
        rhythmCheckOvertime: 0
      }));
    }
    
    setShowTimerAdjust(false);
  };

  const addTreatment = (name: string) => {
    const now = new Date();
    const treatment: Treatment = {
      name,
      elapsed: state.elapsedSeconds,
      round: state.cprRound,
      clock: getLocalTime(now),
      clockSeconds: getLocalTimeWithSeconds(now)
    };

    setState(prev => {
      const isShockOrDisarm = name.includes('Shock') || name.includes('Disarm');
      const isROSC = name === 'Disarm - ROSC';
      const wasRhythmCheckPaused = prev.rhythmCheckPaused;
      
      // Auto-add OPA before BVM
      const newTreatments = [...prev.treatments];
      if (name === 'BVM') {
        const opaTreatment: Treatment = {
          name: 'OPA',
          elapsed: state.elapsedSeconds,
          round: state.cprRound,
          clock: getLocalTime(now),
          clockSeconds: getLocalTimeWithSeconds(now)
        };
        newTreatments.push(opaTreatment);
      }
      newTreatments.push(treatment);
      
      return {
        ...prev,
        treatments: newTreatments,
        shocks: (name.includes('Shock') && !name.includes('Disarm')) ? prev.shocks + 1 : prev.shocks,
        currentOverlay: null,
        // Reset rhythm check to 2:00 for ROSC or when unpausing via other shock/disarm
        rhythmCheckTarget: (isROSC || (isShockOrDisarm && wasRhythmCheckPaused)) 
          ? prev.elapsedSeconds + 120 
          : prev.rhythmCheckTarget,
        rhythmCheckOvertime: (isROSC || (isShockOrDisarm && wasRhythmCheckPaused)) ? 0 : prev.rhythmCheckOvertime,
        // Pause for ROSC, unpause for other shock/disarm
        rhythmCheckPaused: isShockOrDisarm ? isROSC : prev.rhythmCheckPaused,
        // For ROSC, freeze the countdown at 2:00
        frozenCountdown: isROSC ? 120 : prev.frozenCountdown,
        // Enter ROSC mode when ROSC logged, exit when any shock/disarm logged
        isROSCMode: isROSC ? true : isShockOrDisarm ? false : prev.isROSCMode,
        // Clear ROSC checklist when ROSC is logged again (new ROSC event)
        roscChecked: isROSC ? [] : prev.roscChecked
      };
    });
    
    // Make ROSC button flash when ROSC is selected
    if (name === 'Disarm - ROSC') {
      setRoscButtonFlashing(true);
    }
    
    setIsShockForced(false);

    // If this treatment was logged from a rearrest, show timer adjustment popup
    if (rearrested && (name.includes('Shock') || name.includes('Disarm'))) {
      setRearrested(false);
      setShowTimerAdjust(true);
    }
    
    // Show notification with treatment name
    if (name !== 'Disarm - ROSC') {
      loggedTreatmentRef.current = name;
      setShowLoggedNotification(true);
      setTimeout(() => setShowLoggedNotification(false), 2000);
    }
    
    // Reset the forced shock flag when Shock/Disarm is applied (rhythm check resets to 2:00)
    if (name.includes('Shock') || name.includes('Disarm')) {
      setHasShownForcedShock(false);
      previousCountdown.current = null; // Reset countdown tracking
    }
    
    // Reset disregard states when new doses given
    if (name.includes('Adrenaline')) {
      setDisregardAdrenaline(null);
    }
    if (name.includes('Amiodarone')) {
      setDisregardAmiodarone(null);
    }
  };

  const toggleChecklistItem = (checklist: 'reversibles' | 'rosc' | 'phea', label: string) => {
    setState(prev => {
      const key = `${checklist}Checked` as 'reversiblesChecked' | 'roscChecked' | 'pheaChecked';
      const current = prev[key];
      const updated = current.includes(label)
        ? current.filter(item => item !== label)
        : [...current, label];
      return { ...prev, [key]: updated };
    });
  };

  const adrenalineRoundStatus = useMemo(() => {
    const adrTreatments = state.treatments.filter(t => t.name.includes('Adrenaline'));
    const lastAdr = adrTreatments.pop();
    
    if (!lastAdr) {
      return { text: "", show: false, isDue: false };
    }
    
    if (lastAdr.prior) {
      return { text: "Next adrenaline: unknown", show: true, isDue: false };
    }

    const roundGiven = lastAdr.round || (Math.floor(lastAdr.elapsed / 120) + 1);
    const nextDueRound = roundGiven + 2;
    const isDue = state.cprRound >= nextDueRound;
    
    if (isDue) {
      return { text: "Next adrenaline: THIS ROUND", show: true, isDue: true };
    } else {
      return { text: `Next adrenaline: Round ${nextDueRound}`, show: true, isDue: false };
    }
  }, [state.treatments, state.cprRound]);

  const amiodaroneStatus = useMemo(() => {
    const allAmioTreatments = state.treatments.filter(t => t.name.includes('Amiodarone'));

    // Protocol: first amiodarone dose starts the 5-min timer, second (final) dose clears it.
    // We can't rely on dose string matching because cleanDoseForLog strips mg/kg to just
    // the calculated value (e.g. "5mg/kg (42mg)" -> "Amiodarone 42mg").
    // So we use count: 1 dose = show timer, 2+ doses = hide permanently.
    if (allAmioTreatments.length >= 2) {
      return { text: '', show: false, isDue: false, countdown: 0, flashRed: false };
    }

    const amioTreatments = allAmioTreatments;
    const lastAmio = amioTreatments[amioTreatments.length - 1];
    
    if (!lastAmio) {
      return { text: "", show: false, isDue: false, countdown: 0, flashRed: false };
    }
    
    if (lastAmio.prior) {
      return { text: "Next amiodarone: unknown", show: true, isDue: false, countdown: 0, flashRed: false };
    }

    const timeSinceLastDose = state.elapsedSeconds - lastAmio.elapsed;
    const timeUntilNext = 300 - timeSinceLastDose; // 5 minutes = 300 seconds
    
    if (timeUntilNext <= 0) {
      // Show negative countdown when overdue
      const overdueTime = Math.abs(timeUntilNext);
      const mins = Math.floor(overdueTime / 60);
      const secs = overdueTime % 60;
      const timeStr = `-${mins}:${secs.toString().padStart(2, '0')}`;
      return { text: `Next amiodarone: ${timeStr}`, show: true, isDue: true, countdown: timeUntilNext, flashRed: true };
    } else {
      const mins = Math.floor(timeUntilNext / 60);
      const secs = timeUntilNext % 60;
      const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
      const flashRed = timeUntilNext <= 30; // Flash red when 30s or less
      return { text: `Next amiodarone: ${timeStr}`, show: true, isDue: false, countdown: timeUntilNext, flashRed };
    }
  }, [state.treatments, state.elapsedSeconds]);


  const pharmaSummary = useMemo(() => {
    const summary: Record<string, { totalDose: number, unit: string, count: number, display: string }> = {};
    
    state.treatments.forEach(tx => {
      // Special handling for morph/midaz infusion
      if (tx.name.startsWith('Morph/midaz infusion')) {
        const medName = 'Morph/midaz infusion';
        if (!summary[medName]) {
          summary[medName] = { totalDose: 0, unit: '', count: 0, display: '' };
        }
        
        const doseStr = tx.name.substring(medName.length).trim();
        if (doseStr) {
          const directMatch = doseStr.match(/([\d.]+)(mg\/h|mg|mL|mMol|mcg|g|u|%)/i);
          if (directMatch) {
            const [_, amount, unit] = directMatch;
            if (!summary[medName].unit) summary[medName].unit = unit;
            if (summary[medName].unit === unit) {
              summary[medName].totalDose += parseFloat(amount);
            }
          }
        }
        summary[medName].count++;
        return; // Skip regular medication processing for this treatment
      }
      
      for (const med of MEDICATIONS) {
        // Skip Oxygen in pharma summary
        if (med === 'Oxygen') continue;
        
        if (tx.name.startsWith(med)) {
          if (!summary[med]) {
            summary[med] = { totalDose: 0, unit: '', count: 0, display: '' };
          }
          
          // Extract dose from treatment name (everything after medication name)
          const doseStr = tx.name.substring(med.length).trim();
          
          if (doseStr) {
            // For weight-based doses with calculated value: "0.01mg/kg (3.5mg)"
            // Extract the calculated value in parentheses
            const calculatedMatch = doseStr.match(/\(([\d.]+)(mg|mL|mMol|mcg|g|u|%)\)/i);
            if (calculatedMatch) {
              const [_, amount, unit] = calculatedMatch;
              if (!summary[med].unit) summary[med].unit = unit;
              if (summary[med].unit === unit) {
                summary[med].totalDose += parseFloat(amount);
              }
            } else {
              // Direct dose: "1mg", "300mg", "100mL", etc.
              const directMatch = doseStr.match(/([\d.]+)(mg|mL|mMol|mcg|g|u|%)/i);
              if (directMatch) {
                const [_, amount, unit] = directMatch;
                if (!summary[med].unit) summary[med].unit = unit;
                if (summary[med].unit === unit) {
                  summary[med].totalDose += parseFloat(amount);
                }
              }
            }
          }
          summary[med].count++;
          break;
        }
      }
    });
    
    // Format display strings
    Object.keys(summary).forEach(med => {
      const { totalDose, unit, count } = summary[med];
      if (totalDose > 0 && unit) {
        // Round to 2 decimal places and remove trailing zeros
        const roundedDose = parseFloat(totalDose.toFixed(2));
        summary[med].display = `${roundedDose}${unit} (${count})`;
      } else {
        summary[med].display = `${count}`;
      }
    });
    
    return summary;
  }, [state.treatments]);

  // --- Elapsed time interval calculator ---
  const calcNextIntervalTarget = (elapsedSecs: number, interval: 'evens' | 'odds' | 'half-evens' | 'half-odds'): number => {
    const intervalMap = {
      'evens':      { period: 120, offset: 0   }, // 2:00, 4:00, 6:00...
      'odds':       { period: 120, offset: 60  }, // 1:00, 3:00, 5:00...
      'half-evens': { period: 120, offset: 30  }, // 2:30, 4:30, 6:30...
      'half-odds':  { period: 120, offset: 90  }, // 1:30, 3:30, 5:30...
    };
    const { period, offset } = intervalMap[interval];
    const phase = ((elapsedSecs - offset) % period + period) % period;
    const next = elapsedSecs + (period - phase);
    return next;
  };

  // --- Catchup Handlers ---
  const handleCatchupStart = (overrideWeight?: string) => {
    console.log('handleCatchupStart called', { overrideWeight, weightInput });
    
    // Clear localStorage for a completely fresh start
    localStorage.clear();
    sessionStorage.clear();
    
    let adjustedElapsed = catchupElapsed.mins * 60 + catchupElapsed.secs;
    let adjustedRhythm = catchupRhythm.mins * 60 + catchupRhythm.secs;
    
    // If rhythm check is too short (<= 6 seconds), start with full 2:00 instead
    if (adjustedRhythm <= 6) {
      adjustedRhythm = 120;
    }
    
    // Use override weight if provided, otherwise use weightInput state
    const finalWeight = overrideWeight || weightInput;
    
    // Parse weight, checking for valid number or ">100" special case
    let parsedWeight: any = null;
    if (finalWeight) {
      const weightStr = String(finalWeight).trim();
      if (weightStr) {
        const parsed = parseFloat(weightStr);
        if (!isNaN(parsed) && parsed > 0) {
          parsedWeight = parsed;
        }
      }
    }
    
    console.log('Parsed weight:', parsedWeight);
    
    // Adjust times based on elapsed time since they were entered
    if (elapsedTimestamp) {
      const timeSinceElapsed = Math.floor((Date.now() - elapsedTimestamp) / 1000);
      adjustedElapsed += timeSinceElapsed;
    }
    
    // Only apply CPR timestamp adjustment in CPR timer mode
    if (timingMode === 'cpr' && cprTimestamp) {
      const timeSinceCpr = Math.floor((Date.now() - cprTimestamp) / 1000);
      adjustedRhythm = Math.max(0, adjustedRhythm - timeSinceCpr);
    }
    
    const now = Date.now();
    const startClockTime = now - (adjustedElapsed * 1000);
    
    // Calculate rhythm check target based on timing mode
    let rhythmCheckTarget: number;
    if (timingMode === 'elapsed' && rhythmInterval) {
      rhythmCheckTarget = calcNextIntervalTarget(adjustedElapsed, rhythmInterval);
    } else {
      rhythmCheckTarget = adjustedElapsed + adjustedRhythm;
    }

    const initialTxs: Treatment[] = [];
    const baseClock = new Date(startClockTime);
    
    priorTxs.forEach(name => {
      // Auto-add OPA before BVM
      if (name === 'BVM') {
        initialTxs.push({
          name: 'OPA',
          elapsed: 0,
          round: 0,
          clock: getLocalTime(baseClock),
          clockSeconds: getLocalTimeWithSeconds(baseClock),
          prior: true
        });
      }
      
      initialTxs.push({
        name,
        elapsed: 0,
        round: 0,
        clock: getLocalTime(baseClock),
        clockSeconds: getLocalTimeWithSeconds(baseClock),
        prior: true
      });
    });

    // Auto-add "Pads on" before shocks/disarms in catchup
    if (priorCounts.shock > 0 || priorCounts.disarm > 0) {
      initialTxs.push({ 
        name: 'Pads on', 
        elapsed: 0, 
        round: 0, 
        clock: getLocalTime(baseClock), 
        clockSeconds: getLocalTimeWithSeconds(baseClock), 
        prior: true 
      });
    }

    for (let i = 0; i < priorCounts.shock; i++) {
      initialTxs.push({ name: `Shock #${i+1}`, elapsed: 0, round: 0, clock: getLocalTime(baseClock), clockSeconds: getLocalTimeWithSeconds(baseClock), prior: true });
    }
    for (let i = 0; i < priorCounts.disarm; i++) {
      initialTxs.push({ name: `Disarm #${i+1}`, elapsed: 0, round: 0, clock: getLocalTime(baseClock), clockSeconds: getLocalTimeWithSeconds(baseClock), prior: true });
    }
    for (let i = 0; i < priorCounts.adrenaline; i++) {
      initialTxs.push({ name: `Adrenaline push #${i+1}`, elapsed: 0, round: 0, clock: getLocalTime(baseClock), clockSeconds: getLocalTimeWithSeconds(baseClock), prior: true });
    }
    
    setState({
      ...INITIAL_STATE,
      running: true,
      startTime: now,
      pausedTime: adjustedElapsed * 1000,
      elapsedSeconds: adjustedElapsed,
      rhythmCheckTarget: rhythmCheckTarget,
      cprRound: Math.max(1, priorCounts.shock + priorCounts.disarm),
      shocks: priorCounts.shock,
      treatments: initialTxs,
      catchupElapsed: adjustedElapsed,
      startClockTime: startClockTime,
      patientWeight: parsedWeight,
      patientType: weightType
    });
    console.log('State set with weight:', parsedWeight, 'and type:', weightType);
    
    // Reset all UI states for clean new case
    setShowCatchup(false);
    setDisregardAdrenaline(null);
    setDisregardAmiodarone(null);
    setShowLoggedNotification(false);
    setIsShockForced(false);
    setHasShownForcedShock(false);
    setCatchupStep(1);
    setWeightType(null);
    setPaedWeightMethod(null);
    setWeightInput('');
    setPriorCounts({ shock: 0, disarm: 0, adrenaline: 0 });
    setPriorTxs([]);
    // setPhotoTimestamp(null); // Removed - not defined
    setElapsedTimestamp(null);
    setCprTimestamp(null);
    setTimingMode(null);
    setRhythmInterval(null);
    previousCountdown.current = adjustedRhythm;
  };

  const deleteCase = () => {
    localStorage.clear();
    sessionStorage.clear();
    
    // Unregister service worker and force true hard reload
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(registration => registration.unregister());
      });
    }
    
    // Force hard reload with cache bypass
    window.location.href = window.location.pathname + '?nocache=' + Date.now();
    setTimeout(() => {
      window.location.reload(true);
    }, 100);
  };

  const closeCase = () => {
    addTreatment('Close case');
    setState(prev => ({ ...prev, running: false }));
    setIsCaseClosed(true);
    setShowCloseWarning(false);
  };

  if (isCaseClosed) {
    return (
      <div className="min-h-screen bg-white p-6 max-w-2xl mx-auto space-y-6 overflow-y-auto pb-24">
        <h1 className="text-4xl font-bold text-center text-neutral-900 mb-8">Case Summary</h1>
        
        <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={() => window.print()}
            className="flex items-center justify-center gap-2 bg-emerald-50 text-emerald-700 py-3 px-4 rounded-xl font-bold btn-base border border-emerald-100"
          >
            <FileText size={20} /> Export PDF
          </button>
          <button 
            onClick={() => setShowDeleteWarning(true)}
            className="flex items-center justify-center gap-2 bg-red-50 text-red-700 py-3 px-4 rounded-xl font-bold btn-base border border-red-100"
            data-button="delete-case"
          >
            <Trash2 size={20} /> Delete Case
          </button>
        </div>

        <SummaryStats state={state} pharmaSummary={pharmaSummary} />

        {(() => {
          const v = state.vitals ?? { hr: '', rr: '', gcs: '', bpSys: '', bpDia: '', spo2: '', etco2: '', bgl: '', temp: '' };
          const vitalRows = [
            { label: 'Heart Rate',     value: v.hr,   unit: 'bpm'    },
            { label: 'Resp Rate',      value: v.rr,   unit: 'br/min' },
            { label: 'SpO₂',           value: v.spo2, unit: '%'      },
            { label: 'EtCO₂',          value: v.etco2,unit: 'mmHg'   },
            { label: 'Blood Pressure', value: v.bpSys && v.bpDia ? `${v.bpSys}/${v.bpDia}` : v.bpSys || v.bpDia || '', unit: 'mmHg' },
            { label: 'GCS',            value: v.gcs,  unit: '/ 15'   },
            { label: 'BGL',            value: v.bgl,  unit: 'mmol/L' },
            { label: 'Temperature',    value: v.temp, unit: '°C'     },
          ].filter(r => r.value !== '');
          return (
            <div className="rounded-xl overflow-hidden border border-neutral-100">
              <div className="bg-sky-50 text-sky-800 px-4 py-3 font-bold text-sm tracking-wider">VITAL SIGNS</div>
              {vitalRows.length > 0 ? vitalRows.map(({ label, value, unit }, i) => (
                <div key={label} className={`flex items-center justify-between px-4 py-3 ${i < vitalRows.length - 1 ? 'border-b border-neutral-100' : ''}`}>
                  <span className="text-[14px] font-semibold text-neutral-500">{label}</span>
                  <span className="text-[17px] font-bold text-neutral-900 tabular-nums">
                    {value} <span className="text-[12px] font-medium text-neutral-400">{unit}</span>
                  </span>
                </div>
              )) : (
                <div className="px-4 py-3 text-[14px] text-neutral-400 italic">No vital signs recorded.</div>
              )}
            </div>
          );
        })()}
        
        <div className="bg-emerald-50 text-emerald-800 p-3 rounded-t-lg font-bold text-sm tracking-wider">TREATMENT LOG</div>
        <TreatmentLog treatments={state.treatments} elapsedSeconds={state.elapsedSeconds} catchupElapsed={state.catchupElapsed} isSummary={true} />

        {showDeleteWarning && (
           <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-6">
           <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
             <AlertCircle size={48} className="mx-auto text-red-600 mb-4" />
             <h2 className="text-2xl font-bold text-neutral-900 mb-2">Delete this case?</h2>
             <p className="text-neutral-500 mb-8">All data will be lost and you will return to the start screen.</p>
             <div className="grid grid-cols-2 gap-3">
               <button onClick={() => setShowDeleteWarning(false)} className="bg-neutral-100 p-4 rounded-xl font-bold text-neutral-700 btn-base">Cancel</button>
               <button onClick={deleteCase} className="bg-red-600 p-4 rounded-xl font-bold text-white btn-base">Delete</button>
             </div>
           </div>
         </div>
        )}

        {/* Tutorial Overlay - also show on case summary */}
        {tutorialMode && (
          <TutorialOverlay
            appState={state}
            isShockForced={isShockForced}
            isCaseClosed={isCaseClosed}
            globalNodeIndex={tutorialNodeIndex}
            onNodeChange={(nodeIndex, done) => {
              setTutorialNodeIndex(nodeIndex);
              setTutorialScreen({ index: nodeIndex, complete: done, nodeIndex });
            }}
            onExit={() => {
              setTutorialMode(false);
              setTutorialNodeIndex(0);
              setState(INITIAL_STATE);
              setShowCatchup(true);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div data-main-container style={{ height: 'calc(var(--vh, 1vh) * 100)' }} className="bg-neutral-100 flex flex-col p-4 max-w-2xl mx-auto overflow-hidden relative">

      {/* Disclaimer Modal */}
      {!disclaimerAccepted && (
        <div className="fixed inset-0 bg-black/90 z-[3000] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h1 className="text-2xl font-bold text-neutral-900 mb-1">The Big One <span className="text-sm font-medium text-neutral-400">v1.0</span></h1>
            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-widest mb-6">Important — please read before use</p>
            <div className="space-y-4 text-[14px] text-neutral-600 leading-relaxed mb-6">
              <p><strong className="text-neutral-900">Supplementary cognitive aid only.</strong> This application is a consolidated digital alternative to the pen, paper, and stopwatch a clinician would typically use during cardiac arrest management. The Big One tracks multiple timers, records interventions, and displays pre-configured guideline-derived information. It is a documentation, timing, and situational awareness tool only, not a clinical decision-making system, and does not replace clinical judgement, professional training, or your service's approved clinical guidelines and procedures. This application is intended for use by trained clinicians only.</p>
              <p><strong className="text-neutral-900">Clinical responsibility remains with the treating clinician.</strong> All patient assessment, treatment decisions, and medication administration remain the responsibility of the treating clinician(s). Users must apply their own professional judgement and follow current local clinical guidelines at all times.</p>
              <p><strong className="text-neutral-900">Guideline alignment and verification.</strong> This application is configured to align with ACTAS Clinical Management Guidelines (CMG) v1.0.5.4. Users are responsible for verifying that information displayed by this application aligns with their service's current approved protocols.</p>
              <p><strong className="text-neutral-900">Independent application.</strong> This application is independently developed and is not affiliated with, endorsed by, or approved by any ambulance service, health authority, or regulatory body unless explicitly stated.</p>
            </div>
            <label className="flex items-start gap-3 mb-6 cursor-pointer">
              <input
                type="checkbox"
                checked={disclaimerChecked}
                onChange={e => setDisclaimerChecked(e.target.checked)}
                className="mt-0.5 w-5 h-5 rounded accent-emerald-600 flex-shrink-0 cursor-pointer"
              />
              <span className="text-[14px] text-neutral-700 font-medium">I confirm that I am a trained clinician and understand that this application is a supplementary aid only. Clinical and professional responsibility remains with the treating clinician.</span>
            </label>
            <button
              onClick={handleAcceptDisclaimer}
              disabled={!disclaimerChecked}
              className={`w-full py-4 rounded-xl font-bold text-[16px] transition-colors ${disclaimerChecked ? 'bg-emerald-600 text-white' : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'}`}
            >
              Continue to The Big One
            </button>
          </div>
        </div>
      )}
      {/* Top Controls */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-3 sm:mb-4 flex-shrink-0">
        <button onClick={confirmPause} className="bg-neutral-200 p-2.5 sm:p-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 sm:gap-2 btn-base">
          {(state.running && !state.rhythmCheckPaused) ? <Pause size={14} className="sm:w-4 sm:h-4" /> : <Play size={14} className="sm:w-4 sm:h-4" />} 
          {(state.running && !state.rhythmCheckPaused) ? 'Pause' : 'Play'}
        </button>
        <button 
          onClick={() => {
            const currentCountdown = Math.max(0, state.rhythmCheckTarget - state.elapsedSeconds);
            const mins = Math.floor(currentCountdown / 60);
            const secs = currentCountdown % 60;
            setTimerAdjustValue({ mins, secs });
            setShowTimerAdjust(true);
          }} 
          className="bg-neutral-200 p-2.5 sm:p-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 sm:gap-2 btn-base"
        >
          <RefreshCw size={14} className="sm:w-4 sm:h-4" /> Recalibrate
        </button>
        <button onClick={() => setShowCloseWarning(true)} className="bg-neutral-200 p-2.5 sm:p-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 sm:gap-2 btn-base" data-button="close-case">
          <XCircle size={14} className="sm:w-4 sm:h-4" /> Close Case
        </button>
      </div>

      {/* Top Quick Tools */}
      <div className="grid grid-cols-4 gap-2 sm:gap-3 mb-3 sm:mb-4 flex-shrink-0">
        <button 
          onClick={() => {
            if (isShockForced) return;
            setState(p => ({ ...p, currentOverlay: p.currentOverlay === 'reversibles' ? null : 'reversibles' }))
          }}
          disabled={isShockForced}
          className={`p-4 sm:p-6 rounded-xl text-sm sm:text-xl font-bold btn-base transition-colors text-center ${state.currentOverlay === 'reversibles' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-700'} ${isShockForced ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
        >
          {state.currentOverlay === 'reversibles' ? 'Close' : '4H 4T'}
        </button>
        <button 
          onClick={() => {
            if (isShockForced) return;
            setRoscButtonFlashing(false);
            setState(p => ({ ...p, currentOverlay: p.currentOverlay === 'rosc' ? null : 'rosc' }))
          }}
          disabled={isShockForced}
          className={`p-4 sm:p-6 rounded-xl text-sm sm:text-xl font-bold btn-base transition-colors ${
            state.currentOverlay === 'rosc' ? 'bg-red-100 text-red-800' : 
            roscButtonFlashing ? 'bg-red-600 text-white animate-pulse' :
            'bg-orange-100 text-orange-700'
          } ${isShockForced ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
        >
          {state.currentOverlay === 'rosc' ? 'Close' : 'ROSC'}
        </button>
        <button 
          onClick={() => {
            if (isShockForced) return;
            setState(p => ({ ...p, currentOverlay: p.currentOverlay === 'phea' ? null : 'phea' }))
          }}
          disabled={isShockForced}
          className={`p-4 sm:p-6 rounded-xl text-sm sm:text-xl font-bold btn-base transition-colors ${state.currentOverlay === 'phea' ? 'bg-red-100 text-red-800' : 'bg-purple-100 text-purple-700'} ${isShockForced ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
        >
          {state.currentOverlay === 'phea' ? 'Close' : 'PHEA'}
        </button>
        <button 
          onClick={() => {
            if (isShockForced) return;
            setState(p => ({ ...p, currentOverlay: p.currentOverlay === 'vitals' ? null : 'vitals' }))
          }}
          disabled={isShockForced}
          className={`p-4 sm:p-6 rounded-xl text-sm sm:text-xl font-bold btn-base transition-colors text-center ${state.currentOverlay === 'vitals' ? 'bg-red-100 text-red-800' : 'bg-sky-100 text-sky-700'} ${isShockForced ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
        >
          {state.currentOverlay === 'vitals' ? 'Close' : 'VSS'}
        </button>
      </div>

      {/* Main Center Display */}
      <div data-green-box className={`flex-1 bg-white border-4 rounded-3xl relative overflow-hidden transition-colors duration-300 min-h-0 ${
        state.currentOverlay === 'reversibles' ? 'border-blue-400' :
        state.currentOverlay === 'rosc' ? 'border-orange-400' :
        state.currentOverlay === 'phea' ? 'border-purple-400' :
        state.currentOverlay === 'vitals' ? 'border-sky-400' : 'border-emerald-500'
      }`}>
        <div className="h-full flex flex-col items-center px-2 sm:px-3 pt-4 pb-2 sm:pb-3 relative">
          {/* Corner Cards */}
          <div className="absolute top-3 sm:top-4 left-3 sm:left-4 right-3 sm:right-4 flex justify-between gap-3 sm:gap-4">
            <div className="bg-neutral-100 border border-neutral-100 shadow-sm rounded-xl sm:rounded-2xl py-4 px-4 sm:py-7 sm:px-8 flex flex-col items-center min-w-[100px] sm:min-w-[140px]">
              <span className="text-[10px] sm:text-[12px] font-bold text-neutral-900 tracking-widest mb-1.5 sm:mb-3">Total time</span>
              <span className="text-[22px] sm:text-[43px] font-bold text-neutral-400 tabular-nums leading-none">{formatTime(state.elapsedSeconds)}</span>
            </div>
            <div className="bg-neutral-100 border border-neutral-100 shadow-sm rounded-xl sm:rounded-2xl py-4 px-4 sm:py-7 sm:px-8 flex flex-col items-center min-w-[100px] sm:min-w-[140px]">
              <span className="text-[10px] sm:text-[12px] font-bold text-neutral-900 tracking-widest mb-1.5 sm:mb-3">CPR round</span>
              <span className="text-[22px] sm:text-[43px] font-bold text-neutral-400 tabular-nums leading-none">{state.cprRound}</span>
            </div>
          </div>

          {/* Rhythm Check - Centered vertically and responsive size */}
          <div className="flex-1 flex flex-col items-center justify-center w-full pt-14 sm:pt-16">
            <div className="relative flex items-center justify-center w-[240px] h-[240px] sm:w-[320px] sm:h-[320px]">

              {/* ROSC Mode - full circle is tap target */}
              {state.isROSCMode ? (
                <button
                  onClick={() => {
                    setState(prev => ({
                      ...prev,
                      isROSCMode: false,
                      rhythmCheckPaused: false,
                      frozenCountdown: undefined,
                      rhythmCheckTarget: prev.elapsedSeconds + 120,
                      rhythmCheckOvertime: 0,
                      currentOverlay: 'treatment'
                    }));
                    setRearrested(true);
                    setIsShockForced(true);
                  }}
                  className="absolute inset-0 w-full h-full rounded-full btn-base flex flex-col items-center justify-center"
                >
                  <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 300 300">
                    <circle cx="150" cy="150" r="140" fill="none" stroke="currentColor" strokeWidth="6" className="text-neutral-50" />
                    <motion.circle
                      cx="150" cy="150" r="140"
                      fill="none" stroke="currentColor" strokeWidth="6"
                      strokeLinecap="round" pathLength="1"
                      className="text-emerald-500"
                      animate={{ strokeDashoffset: 0 }}
                      style={{ strokeDasharray: 1 }}
                      transition={{ duration: 0.5, ease: "linear" }}
                    />
                  </svg>
                  <span className="z-10 text-[36px] sm:text-[60px] font-bold tracking-tighter leading-none text-emerald-600 text-center">PRESS IF REARREST</span>
                  <span className="z-10 absolute bottom-[35px] sm:bottom-[51px] text-[13px] sm:text-[16px] font-bold tracking-widest uppercase text-neutral-400">ROSC</span>
                </button>
              ) : (
                <>
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
                <motion.circle
                  cx="150"
                  cy="150"
                  r="140"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="6"
                  strokeLinecap="round"
                  pathLength="1"
                  className={
                    state.rhythmCheckPaused ? 'text-emerald-500' :
                    state.rhythmCheckOvertime > 0 ? 'text-red-500' :
                    (state.rhythmCheckTarget - state.elapsedSeconds) <= 10 ? 'text-red-500' : 'text-emerald-500'
                  }
                  animate={{ 
                    strokeDashoffset: state.rhythmCheckPaused
                      ? 1 - Math.max(0, (state.frozenCountdown || 0) / 120) // Show frozen progress
                      : state.rhythmCheckOvertime > 0 
                        ? 1 - (state.rhythmCheckOvertime / 6) // Count down from 6 to 0
                        : 1 - Math.max(0, (state.rhythmCheckTarget - state.elapsedSeconds) / 120)
                  }}
                  style={{ strokeDasharray: 1 }}
                  transition={{ duration: 0.5, ease: "linear" }}
                />
              </svg>
              
              <div className="flex flex-col items-center z-10 translate-y-3 sm:translate-y-4">
                <div 
                  className={`text-7xl sm:text-[120px] font-bold tabular-nums tracking-tighter leading-none ${
                    state.rhythmCheckPaused ? 'text-neutral-900' :
                    state.rhythmCheckOvertime > 0 ? 'text-red-600' :
                    (state.rhythmCheckTarget - state.elapsedSeconds) <= 10 ? 'text-red-600' : 'text-neutral-900'
                  }`}
                >
                  {state.rhythmCheckPaused 
                    ? formatTime(state.frozenCountdown || 0)
                    : state.rhythmCheckOvertime > 0 
                      ? formatTime(6 - state.rhythmCheckOvertime)
                      : formatTime(Math.max(0, state.rhythmCheckTarget - state.elapsedSeconds))
                  }
                </div>
                <div className={`text-[14px] sm:text-[18px] uppercase tracking-widest font-bold mt-4 sm:mt-8 ${
                  state.rhythmCheckOvertime > 0 ? 'text-red-600 flash-red' : 'text-neutral-400'
                }`}>
                  Rhythm Check
                </div>
              </div>
              </>
              )}
            </div>
          </div>

          <AnimatePresence>
            {state.currentOverlay && state.currentOverlay !== 'tutorial' && (
              <Overlay 
                key={state.currentOverlay}
                type={state.currentOverlay as OverlayType} 
                onClose={() => setState(p => ({ ...p, currentOverlay: null }))}
                addTreatment={addTreatment}
                state={state}
                pharmaSummary={pharmaSummary}
                isShockForced={isShockForced}
                toggleChecklistItem={toggleChecklistItem}
                onVitalsChange={(v) => setState(p => ({ ...p, vitals: v }))}
              />
            )}
          </AnimatePresence>

          {/* Tutorial Overlay - renders on top of real app */}
          {tutorialMode && (
            <TutorialOverlay
              appState={state}
              isShockForced={isShockForced}
              isCaseClosed={isCaseClosed}
              globalNodeIndex={tutorialNodeIndex}
              onNodeChange={(nodeIndex, done) => {
                setTutorialNodeIndex(nodeIndex);
                setTutorialScreen({ index: nodeIndex, complete: done, nodeIndex });
              }}
              onExit={() => {
                setTutorialMode(false);
                setTutorialNodeIndex(0);
                setState(INITIAL_STATE);
                setShowCatchup(true);
              }}
            />
          )}

          {/* Adrenaline & Amiodarone Status - Always rendered, visibility controlled */}
          <div className="flex gap-2 sm:gap-3 w-full max-w-[560px] justify-between mb-0">
            {/* Adrenaline Warning */}
            <div 
              onClick={() => {
                if (!adrenalineRoundStatus.show || disregardAdrenaline === 'confirmed') return;
                if (disregardAdrenaline === 'pending') {
                  setDisregardAdrenaline('confirmed');
                } else if (disregardAdrenaline !== 'confirmed') {
                  setDisregardAdrenaline('pending');
                }
              }}
              className={`flex-1 p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl flex flex-col items-center justify-center border-2 transition-all duration-300 min-h-[90px] sm:min-h-[120px] ${
                !adrenalineRoundStatus.show || disregardAdrenaline === 'confirmed' 
                  ? 'opacity-0 pointer-events-none' 
                  : 'opacity-100 cursor-pointer'
              } ${
                disregardAdrenaline === 'pending'
                  ? 'bg-red-200 text-red-900 border-neutral-100'
                  : adrenalineRoundStatus.isDue 
                  ? 'bg-red-200 text-red-900 border-neutral-100 animate-pulse' 
                  : 'bg-neutral-100 text-neutral-900 border-neutral-100'
              }`}
            >
              {disregardAdrenaline === 'pending' ? (
                <span className="text-xl sm:text-2xl font-bold tracking-tight text-center">Disregard?</span>
              ) : (
                <>
                  <span className={`font-bold tracking-widest text-center mb-1.5 sm:mb-3 ${
                    adrenalineRoundStatus.isDue 
                      ? 'text-[10px] sm:text-[12px] text-red-900'
                      : 'text-[10px] sm:text-[12px] text-neutral-900'
                  }`}>
                    {adrenalineRoundStatus.text.split(':')[0] + ':'}
                  </span>
                  <span className={`font-bold text-center leading-none tabular-nums ${
                    adrenalineRoundStatus.isDue
                      ? 'text-[22px] sm:text-[43px] text-red-900'
                      : 'text-[22px] sm:text-[43px] text-neutral-400'
                  }`}>
                    {adrenalineRoundStatus.text.split(':').slice(1).join(':').trim()}
                  </span>
                </>
              )}
            </div>
            
            {/* Amiodarone Warning */}
            <div 
                onClick={() => {
                  if (!amiodaroneStatus.show || disregardAmiodarone === 'confirmed') return;
                  if (disregardAmiodarone === 'pending') {
                    setDisregardAmiodarone('confirmed');
                  } else if (disregardAmiodarone !== 'confirmed') {
                    setDisregardAmiodarone('pending');
                  }
                }}
                className={`flex-1 p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl flex flex-col items-center justify-center border-2 transition-all duration-300 min-h-[90px] sm:min-h-[120px] ${
                  !amiodaroneStatus.show || disregardAmiodarone === 'confirmed'
                    ? 'opacity-0 pointer-events-none'
                    : 'opacity-100 cursor-pointer'
                } ${
                  disregardAmiodarone === 'pending'
                    ? 'bg-red-200 text-red-900 border-neutral-100'
                    : amiodaroneStatus.flashRed
                    ? 'bg-red-200 text-red-900 border-neutral-100 animate-pulse' 
                    : 'bg-neutral-100 text-neutral-900 border-neutral-100'
                }`}
              >
                {disregardAmiodarone === 'pending' ? (
                  <span className="text-xl sm:text-2xl font-bold tracking-tight text-center">Disregard?</span>
                ) : (
                  <>
                    <span className={`font-bold tracking-widest text-center mb-1.5 sm:mb-3 ${
                      amiodaroneStatus.flashRed
                        ? 'text-[10px] sm:text-[12px] text-red-900'
                        : 'text-[10px] sm:text-[12px] text-neutral-900'
                    }`}>
                      {amiodaroneStatus.text.includes(':') ? amiodaroneStatus.text.split(':')[0] + ':' : amiodaroneStatus.text}
                    </span>
                    {amiodaroneStatus.text.includes(':') && (
                      <span className={`font-bold text-center leading-none tabular-nums ${
                        amiodaroneStatus.flashRed
                          ? 'text-[22px] sm:text-[43px] text-red-900'
                          : 'text-[22px] sm:text-[43px] text-neutral-400'
                      }`}>
                        {amiodaroneStatus.text.split(':').slice(1).join(':').trim()}
                      </span>
                    )}
                  </>
                )}
              </div>
          </div>
        </div>
      </div>

      {/* Bottom Main Controls */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 mt-3 sm:mt-4 flex-shrink-0">
        <button 
          onClick={() => {
            if (isShockForced) return;
            setState(p => ({ ...p, currentOverlay: p.currentOverlay === 'summary' ? null : 'summary' }))
          }}
          disabled={isShockForced}
          className={`p-3 sm:p-5 rounded-2xl text-base sm:text-xl font-bold flex items-center justify-center gap-2 sm:gap-3 btn-base transition-colors ${state.currentOverlay === 'summary' ? 'bg-red-100 text-red-800' : 'bg-emerald-600 text-white'}`}
          data-button="summary"
        >
          {state.currentOverlay === 'summary' ? <XCircle size={18} className="sm:w-6 sm:h-6" /> : <FileText size={18} className="sm:w-6 sm:h-6" />}
          {state.currentOverlay === 'summary' ? 'Close' : 'Summary'}
        </button>
        <button 
          onClick={() => {
            if (isShockForced) return;
            setState(p => ({ ...p, currentOverlay: p.currentOverlay === 'treatment' ? null : 'treatment' }))
          }}
          disabled={isShockForced}
          className={`p-3 sm:p-5 rounded-2xl text-base sm:text-xl font-bold flex items-center justify-center gap-2 sm:gap-3 btn-base transition-colors ${state.currentOverlay === 'treatment' ? 'bg-red-100 text-red-800' : 'bg-emerald-600 text-white'}`}
          data-button="add-tx"
        >
          {state.currentOverlay === 'treatment' ? <XCircle size={18} className="sm:w-6 sm:h-6" /> : <Plus size={18} className="sm:w-6 sm:h-6" />}
          {state.currentOverlay === 'treatment' ? 'Close' : 'Add Tx'}
        </button>
      </div>




      {/* Catchup Modal */}
      <AnimatePresence>
        {showCatchup && (
          <div className="fixed inset-0 bg-black/90 z-[1000] flex items-center justify-center p-4">
            <motion.div 
              key={catchupStep}
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '-100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 30, stiffness: 280 }}
              className="bg-white rounded-[28px] p-6 max-w-md w-[90%] shadow-2xl overflow-hidden absolute"
            >
              {catchupStep === 1 && (
                <div className="text-center space-y-6">
                  {/* Header with gradient accent */}
                  <div className="space-y-4">
                    <h1 className="text-4xl font-extrabold bg-gradient-to-r from-emerald-600 to-emerald-500 bg-clip-text text-transparent">
                      It's The Big One!
                    </h1>
                    <p className="text-lg font-medium text-neutral-600 whitespace-nowrap">
                      Your cardiac arrest management tool
                    </p>
                  </div>
                  
                  {/* Buttons with improved styling */}
                  <div className="space-y-3 pt-2">
                    <button 
                      onClick={() => {
                        setCatchupStep(2);
                        setUseManualEntry(true);
                        setCatchupRhythm({ mins: 0, secs: 0 });
                      }} 
                      className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white p-5 rounded-2xl text-lg font-bold shadow-lg shadow-emerald-500/30 transition-all duration-200 hover:shadow-xl hover:scale-[1.02]"
                    >
                      Calibrate
                    </button>
                    <button 
                      onClick={() => {
                        // Enter tutorial mode - start app with preset values
                        const now = Date.now();
                        setState({
                          ...INITIAL_STATE,
                          running: true,
                          startTime: now,
                          pausedTime: 0,
                          elapsedSeconds: 0,
                          rhythmCheckTarget: 120,
                          cprRound: 1,
                          shocks: 0,
                          treatments: [],
                          catchupElapsed: 0,
                          startClockTime: now,
                          patientWeight: 100,
                          patientType: 'adult'
                        });
                        setShowCatchup(false);
                        setTutorialMode(true);
                      }} 
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-2xl text-base font-semibold shadow-md shadow-blue-500/20 transition-all duration-200 hover:shadow-lg hover:scale-[1.02]"
                    >
                      Tutorial
                    </button>
                  </div>

                  <div className="text-[11px] text-neutral-400 text-center pt-2 space-y-0.5">
                    <p>The Big One v1.0</p>
                    <p>ACTAS CMG v1.0.5.4</p>
                    <p>Last reviewed May 2026</p>
                  </div>
                </div>
              )}

              {catchupStep === 2 && (
                <div className="space-y-6 px-4 max-w-md mx-auto">
                  <div className="text-center space-y-2">
                    <h2 className="text-2xl font-bold text-neutral-900">Patient Details</h2>
                    <p className="text-neutral-500 text-sm">Select patient type for dosage calculations</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    {/* Adult Card */}
                    <button 
                      onClick={() => {
                        setWeightType('adult');
                        setPaedWeightMethod(null);
                        setWeightInput('');
                      }}
                      className={`relative p-6 rounded-2xl transition-all duration-200 ${
                        weightType === 'adult' 
                          ? 'bg-emerald-500 text-white shadow-lg scale-105' 
                          : 'bg-white text-neutral-700 border-2 border-neutral-200 hover:border-emerald-300'
                      }`}
                    >
                      <div className="flex flex-col items-center gap-3">
                        <div className={`text-5xl ${weightType === 'adult' ? 'opacity-100' : 'opacity-60'}`}>
                          👤
                        </div>
                        <div className="text-center">
                          <div className="font-bold text-lg">Adult</div>
                          <div className={`text-xs mt-1 ${weightType === 'adult' ? 'text-emerald-100' : 'text-neutral-400'}`}>
                            35-200 kg
                          </div>
                        </div>
                      </div>
                    </button>
                    
                    {/* Paediatric Card */}
                    <button 
                      onClick={() => {
                        setWeightType('paed');
                        if (!paedWeightMethod) setPaedWeightMethod('age');
                        setWeightInput('');
                      }}
                      className={`relative p-6 rounded-2xl transition-all duration-200 ${
                        weightType === 'paed' 
                          ? 'bg-pink-400 text-white shadow-lg scale-105' 
                          : 'bg-white text-neutral-700 border-2 border-neutral-200 hover:border-pink-300'
                      }`}
                    >
                      <div className="flex flex-col items-center gap-3">
                        <div className={`text-5xl ${weightType === 'paed' ? 'opacity-100' : 'opacity-60'}`}>
                          👶
                        </div>
                        <div className="text-center">
                          <div className="font-bold text-lg">Paediatric</div>
                          <div className={`text-xs mt-1 ${weightType === 'paed' ? 'text-pink-100' : 'text-neutral-400'}`}>
                            Newborn-11 yrs
                          </div>
                        </div>
                      </div>
                    </button>
                  </div>
                  
                  {/* Weight Selection - Adult */}
                  {weightType === 'adult' && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className="bg-emerald-50 rounded-2xl p-6 border-2 border-emerald-200"
                    >
                      <label className="block text-sm font-bold text-emerald-900 mb-3">Patient Weight</label>
                      <select
                        value={weightInput}
                        onChange={(e) => setWeightInput(e.target.value)}
                        className="w-full bg-white border-2 border-emerald-300 rounded-xl px-4 py-4 text-base font-semibold focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                      >
                        <option value="">Select weight</option>
                        <option value="35">35 kg</option>
                        <option value="40">40 kg</option>
                        <option value="50">50 kg</option>
                        <option value="60">60 kg</option>
                        <option value="70">70 kg</option>
                        <option value="80">80 kg</option>
                        <option value="90">90 kg</option>
                        <option value="100">100 kg</option>
                        <option value="110">110 kg</option>
                        <option value="120">120 kg</option>
                        <option value="130">130 kg</option>
                        <option value="140">140 kg</option>
                        <option value="150">150 kg</option>
                        <option value="160">160 kg</option>
                        <option value="170">170 kg</option>
                        <option value="180">180 kg</option>
                        <option value="190">190 kg</option>
                        <option value="200">200 kg</option>
                      </select>
                    </motion.div>
                  )}
                  
                  {/* Weight Selection - Paediatric */}
                  {weightType === 'paed' && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className="bg-pink-50 rounded-2xl p-6 border-2 border-pink-200 space-y-4"
                    >
                      <div>
                        <label className="block text-sm font-bold text-pink-900 mb-3">Select weight by age</label>
                        <select
                          value={paedWeightMethod === 'age' ? weightInput : ''}
                          onChange={(e) => {
                            setPaedWeightMethod('age');
                            setWeightInput(e.target.value);
                          }}
                          className="w-full bg-white border-2 border-pink-300 rounded-xl px-4 py-4 text-base font-semibold focus:ring-2 focus:ring-pink-400 focus:border-pink-400 outline-none transition-all"
                        >
                          <option value="">Choose age</option>
                          {[
                            ['Newborn', 3], ['3 months', 5], ['6 months', 7],
                            ['12 months', 11], ['2 years', 13],
                            ['3 years', 15], ['4 years', 17], ['5 years', 19], ['6 years', 21],
                            ['7 years', 23], ['8 years', 25], ['9 years', 27], ['10 years', 30],
                            ['11 years', 33]
                          ].map(([age, weight]) => (
                            <option key={age} value={weight}>{age} ({weight} kg)</option>
                          ))}
                        </select>
                      </div>
                      
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-pink-200"></div>
                        </div>
                        <div className="relative flex justify-center">
                          <span className="bg-pink-50 px-3 text-xs font-bold text-pink-400">OR</span>
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-bold text-pink-900 mb-3">Custom Weight</label>
                        <div className="relative">
                          <input
                            type="number"
                            placeholder="Enter weight"
                            value={paedWeightMethod === 'weight' ? weightInput : ''}
                            onChange={(e) => {
                              setPaedWeightMethod('weight');
                              setWeightInput(e.target.value);
                            }}
                            className="w-full bg-white border-2 border-pink-300 rounded-xl px-4 py-4 pr-12 text-base font-semibold focus:ring-2 focus:ring-pink-400 focus:border-pink-400 outline-none transition-all"
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 font-bold pointer-events-none">kg</span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                  
                  {/* Navigation Buttons */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <button 
                      onClick={() => setCatchupStep(1)} 
                      className="bg-neutral-100 text-neutral-700 py-4 rounded-xl font-bold hover:bg-neutral-200 transition-colors"
                    >
                      Back
                    </button>
                    <button
                      onClick={() => weightInput && setCatchupStep(3)}
                      disabled={!weightInput}
                      className={`py-4 rounded-xl font-bold transition-all ${
                        weightInput
                          ? weightType === 'adult'
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md'
                            : 'bg-pink-400 text-white hover:bg-pink-500 shadow-md'
                          : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                      }`}
                    >
                      Continue
                    </button>
                  </div>
                </div>
              )}

              {catchupStep === 4 && (
                <div className="text-center space-y-6">
                  <h2 className="text-xl font-bold text-neutral-900 px-4">Enter elapsed time</h2>
                  <p className="text-neutral-600 text-sm px-4">This is the time at the top right corner of the monitor</p>
                  <TimePicker value={catchupElapsed} onChange={setCatchupElapsed} />
                  
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => {
                        setCatchupStep(timingMode === 'elapsed' ? 7 : 6);
                        setUseManualEntry(false);
                      }} 
                      className="bg-neutral-100 text-neutral-700 p-3 rounded-xl font-bold btn-base"
                    >
                      Back
                    </button>
                    <button 
                      onClick={() => { 
                        setElapsedTimestamp(Date.now());
                        if (timingMode === 'elapsed') {
                          handleCatchupStart();
                        } else {
                          setCatchupRhythm({ mins: 0, secs: 0 });
                          setCatchupStep(5);
                        }
                      }} 
                      className={`p-3 rounded-xl font-bold btn-base text-white ${timingMode === 'elapsed' ? 'bg-blue-600' : 'bg-emerald-600'}`}
                    >
                      {timingMode === 'elapsed' ? 'Start Case' : 'Next'}
                    </button>
                  </div>
                </div>
              )}

              {catchupStep === 5 && (
                <div className="text-center space-y-6">
                  <h2 className="text-xl font-bold text-neutral-900 px-4">Enter current CPR timer</h2>
                  <p className="text-neutral-600 text-sm px-4">This is the countdown above the diamond on the monitor</p>
                  <TimePicker 
                    value={catchupRhythm} 
                    onChange={setCatchupRhythm} 
                    maxSeconds={120}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => setCatchupStep(6)} className="bg-neutral-100 text-neutral-700 p-3 rounded-xl font-bold btn-base">Back</button>
                    <button 
                      onClick={() => {
                        setCprTimestamp(Date.now());
                        handleCatchupStart();
                      }}
                      className="bg-emerald-600 text-white p-3 rounded-xl font-bold btn-base"
                    >
                      Start Case
                    </button>
                  </div>
                </div>
              )}

              {catchupStep === 7 && (
                <div className="space-y-6 px-4 max-w-md mx-auto">
                  <div className="text-center space-y-2">
                    <h2 className="text-2xl font-bold text-neutral-900">Rhythm Check Timing</h2>
                    <p className="text-neutral-500 text-sm">When are rhythm checks due?</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {([
                      { key: 'evens',      label: 'Evens',      example: '2:00, 4:00...' },
                      { key: 'odds',       label: 'Odds',       example: '1:00, 3:00...' },
                      { key: 'half-evens', label: 'Half evens', example: '2:30, 4:30...' },
                      { key: 'half-odds',  label: 'Half odds',  example: '1:30, 3:30...' },
                    ] as const).map(({ key, label, example }) => (
                      <button
                        key={key}
                        onClick={() => setRhythmInterval(key)}
                        className={`p-4 rounded-2xl transition-all duration-200 ${
                          rhythmInterval === key
                            ? 'bg-blue-500 text-white shadow-lg scale-105'
                            : 'bg-white text-neutral-700 border-2 border-neutral-200 hover:border-blue-300'
                        }`}
                      >
                        <div className="font-bold text-base">{label}</div>
                        <div className={`text-xs mt-1 ${rhythmInterval === key ? 'text-blue-100' : 'text-neutral-400'}`}>{example}</div>
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <button onClick={() => setCatchupStep(6)} className="bg-neutral-100 text-neutral-700 py-4 rounded-xl font-bold hover:bg-neutral-200 transition-colors">Back</button>
                    <button
                      onClick={() => rhythmInterval && setCatchupStep(4)}
                      disabled={!rhythmInterval}
                      className={`py-4 rounded-xl font-bold transition-all ${
                        rhythmInterval
                          ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md'
                          : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                      }`}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}

              {catchupStep === 3 && (
                <div className="text-center space-y-5">
                  <h2 className="text-xl font-bold text-neutral-900">What treatments have you already applied?</h2>
                  <div className="space-y-2 py-3 px-2">
                    <CounterItem label="Shock" value={priorCounts.shock} onChange={v => setPriorCounts(p => ({ ...p, shock: v }))} />
                    <CounterItem label="Disarm" value={priorCounts.disarm} onChange={v => setPriorCounts(p => ({ ...p, disarm: v }))} />
                    <CounterItem label="Adrenaline" value={priorCounts.adrenaline} onChange={v => setPriorCounts(p => ({ ...p, adrenaline: v }))} />
                    <div className="grid grid-cols-3 gap-2">
                      {['BVM', 'LMA', 'IO'].map(tx => (
                        <button 
                          key={tx}
                          onClick={() => setPriorTxs(p => p.includes(tx) ? p.filter(t => t !== tx) : [...p, tx])}
                          className={`p-3 rounded-xl font-bold text-base ${priorTxs.includes(tx) ? 'bg-amber-100 text-amber-900 ring-2 ring-amber-400' : 'bg-neutral-100 text-neutral-600'}`}
                        >
                          {tx}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => setCatchupStep(2)} className="bg-neutral-100 text-neutral-700 p-3 rounded-xl font-bold btn-base">Back</button>
                    <button onClick={() => setCatchupStep(6)} className="bg-emerald-600 text-white p-3 rounded-xl font-bold btn-base">Next</button>
                  </div>
                </div>
              )}

              {catchupStep === 6 && (
                <div className="space-y-6 px-4 max-w-md mx-auto">
                  <div className="text-center space-y-2">
                    <h2 className="text-2xl font-bold text-neutral-900">Timing Method</h2>
                    <p className="text-neutral-500 text-sm">How are you tracking rhythm checks?</p>
                  </div>

                  <div className="flex flex-col gap-3">
                    <button
                      onClick={() => setTimingMode('log')}
                      className={`w-full rounded-2xl transition-all duration-200 overflow-hidden ${
                        timingMode === 'log'
                          ? 'ring-4 ring-emerald-500 shadow-lg scale-105'
                          : 'border-2 border-neutral-200 hover:border-emerald-300'
                      }`}
                    >
                      <div style={{ background: '#309959', padding: '10px 16px' }}>
                        <div className="flex items-center justify-between">
                          <span style={{ fontFamily: "'Roboto', 'Helvetica Neue', Arial, sans-serif", fontSize: '1.4rem', fontWeight: 700, color: 'white', letterSpacing: '0.03em' }}>
                            Tx Log Only
                          </span>
                          <svg width="22" height="26" viewBox="0 0 22 26" fill="none" xmlns="http://www.w3.org/2000/svg" style={{marginRight:'8px'}}>
    <rect x="2" y="3" width="18" height="22" rx="2" stroke="white" strokeWidth="2" fill="none"/>
    <line x1="6" y1="9" x2="16" y2="9" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
    <line x1="6" y1="13" x2="16" y2="13" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
    <line x1="6" y1="17" x2="12" y2="17" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
    <rect x="8" y="1" width="6" height="4" rx="1" fill="white"/>
  </svg>
                        </div>
                      </div>
                      <div className={`py-2 text-sm font-bold ${timingMode === 'log' ? 'bg-emerald-500 text-white' : 'bg-neutral-50 text-neutral-600'}`}>
                        No timer — record keeping only
                      </div>
                    </button>

                    <button
                      onClick={() => setTimingMode('cpr')}
                      className={`w-full rounded-2xl transition-all duration-200 overflow-hidden ${
                        timingMode === 'cpr'
                          ? 'ring-4 ring-emerald-500 shadow-lg scale-105'
                          : 'border-2 border-neutral-200 hover:border-emerald-300'
                      }`}
                    >
                      {/* Zoll-style CPR timer display — purple bar flush fill, black text */}
                      <div style={{ background: '#9690cc', padding: '18px 16px' }}>
                        <div className="flex items-center justify-between">
                          <span style={{ fontFamily: "'Roboto', 'Helvetica Neue', Arial, sans-serif", fontSize: '1.4rem', fontWeight: 700, color: 'black', letterSpacing: '0.03em' }}>
                            CPR Time
                          </span>
                          <span style={{ fontFamily: "'Roboto', 'Helvetica Neue', Arial, sans-serif", fontSize: '1.4rem', fontWeight: 700, color: 'black', letterSpacing: '0.05em' }}>
                            {(() => {
                              const secs = Math.max(0, 120 - (demoTick % 121));
                              return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
                            })()}
                          </span>
                        </div>
                      </div>
                      <div className={`py-2 text-sm font-bold ${timingMode === 'cpr' ? 'bg-emerald-500 text-white' : 'bg-neutral-50 text-neutral-600'}`}>
                        CPR Timer
                      </div>
                    </button>

                    <button
                      onClick={() => setTimingMode('elapsed')}
                      className={`w-full rounded-2xl transition-all duration-200 overflow-hidden ${
                        timingMode === 'elapsed'
                          ? 'ring-4 ring-blue-500 shadow-lg scale-105'
                          : 'border-2 border-neutral-200 hover:border-blue-300'
                      }`}
                    >
                      {/* Zoll-style elapsed timer display — battery left, time right */}
                      <div className="bg-black px-4 py-3">
                        <div className="flex items-center justify-between gap-0">
                          <img src="data:image/png;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAOxBoEDASIAAhEBAxEB/8QAHQABAQACAwEBAQAAAAAAAAAAAAECCAYHCQMFBP/EAGoQAAECAwMDCwwNBQsLAwQCAwABAgMEEQUGIQcxQQgSGDJRVWFxkZXSExQ3UlZ1gZOUsdHTCRciNlRXc3ShsrO04zNCU3LBFRYjNUZiZHaCkqIkJSYnNDhDY2WFwkSE4ShFg6NH8GbD8f/EABsBAQADAAMBAAAAAAAAAAAAAAABBQYDBAcC/8QAPREBAAECAgQKCQMEAwEBAQAAAAECAwQRBQYxYRIVFiFBcZGhscETMjM0UVJTgeEictEUQoLwI0PC8SRi/9oADAMBAAIRAxEAPwDTIAAAAAAKBAABdBAAAAAAAAAAAAAAAAUgABAABSAAAAAAAAAAAAABagCAAAAAAAAAAAAAAAApC40AgAAFGggAAAAAAAAFIAAAAAAAAAAAAAAAAAAAAAAAAAABaEAAAAAABSAAAALQgAAAoEAAAAAAAAAAAAAAABUCkAAAAAABSAAAAAKQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAqgQpAAAAAAAAAAAAAAAAUgAAAAAAAAAAoEAAAAAWpAAAAAAAAAAAAAqkKQAAAAAAAAAAAAAAFIAAAAAAAAAAKQAAUCAF4gIAAAAAAAAAAAAAApAABQIAAALhQgAAoEAAAFIAAAAFIABUIAKQAAAAAAAFIAAAAAACkAAAAAAAAAAAAAABVQgAAAAAAAAAApAAAAFIAAAKBAUgAAAAABSAAAABSAAAAAAAAAAAAAAKBAUgAAAAAAKCAAAAKABAAAAAAAAAUgFIAAAAAFUgAAAUgAAAAC4EAAAAAAABUCgQAAAAAAAAAAAAAAAAAAAAAAAAAAAABSAAAAAAAAAAAAAAAAAoEAAApAAKQAAAAKQAAAAAAAFIAAAAAAAAAAKBAAAAAAAAAUgFIAAAAAFwIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACkAAAAWoIAAAAAAAWpAAAAAAAUEAAqEKBAAAAAAAACkAAAAAAAKQAAAAAAFIXAgAAAAAAAAAAAACqBACgQAAAAAAAAAAAAAAAAqBQBAAAAABCqQACoQAVSFIBfCQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAApALoIAAAAAAAAAAAAAAAAAAAKAIAAAAAAAAAAAAAAAUgAFIAAAAAoIBaAgAAFAgAApAAAAAAAAAAABQIAAAAAAAAUgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAgAAAAAAAAAAAAAAAAAAuggAAAAAAAAAAAACkAAAAAAAAAAAAAABQQAAAAAAAAAUgAAAACqQAAAAAAAAAAAAAAAAAAUgAAAAAAAAAAAAUgAAAAAAAAAAAAAAAKgEAAAAAUgAAAAAAAAAAAAAABSAAAAAAAAFIAAAAAAAAAAAAAAAAAAAAAAAAAAAFIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACqQAAAAAAAAAAAAAAFIAAAAAAAAAAAAAAAVCAAAAAAAAAAAAAAAAAAAAAAAAAAUgAAAAAUgAAAWoFABAAAAAAAAAAAAP0bv2Ja1v2tL2TYtnzNoT8w7WwZeBDV73rxJo3VzJpA/PP6JGRm56bhykpLRpiYiLRkKDDV73LwNTFTcHI1qOkVkC1MploPRy+6/ciRiUpwRIyfSjP7xtXc25d1LnyDZK7F37OsmCiY9bwEa5/C522cvCqqB5rXfyC5XbchsiyNw7YSG9aI6ZY2WT/8AarVOSJqV8tVK/vThc5S/TPSXWtzpUuAHmwupXy19yULnOX6Y2LGWvuRh85y3TPScAebGxXy19yULnOW6Y2K+WvuSh85y3TPScuAHmtsWMtfcjD5zlumNixlr7kYfOct0z0pw0EWgHmvsWMtfcjD5zlumNixlr7kYfOct0z0o0BAPNnYrZau5ODznL9MbFfLX3Jwuc5fpnpNQKB5sbFfLX3JQuc5fplTUr5a+5OEn/c5fpnpNQtAPNjYrZau5SDznL9Mx2LGWvuRh85y3TPSkioB5sbFfLX3JQuc5fpl2K+WvuShc5y/TPSYAebKalfLV3Jwuc5fphdSvlq7k4POcv0z0mAHmxsV8tfclC5zlumNivlr7koXOcv0z0nQAebC6ljLX3JQuc5bpk2LGWvuRh85y3TPSgJnA82E1K+WvuThc5y/TMtitlq7lIPOcv0z0mwJmA82ditlq7lIPOcv0xsVstXcpB5zl+mekyADzZ2K2WruTg85y/TGxXy19ycLnOX6Z6TBAPNhdSvlr7koXOcv0xsWMtfclC5zlumek+bOXiA82E1K2WruThc5y/TLsVstXcpB5zl+mekoA82V1K2WruUg85y/TJsV8tfcnC5zl+mek+cLuAebWxVy1dysDnOX6QXUrZau5WBznL9M9JRgB5srqVstXcpB5zl+mTYr5a+5KFznL9M9J6F0AebCalfLX3Jwec5fpjYr5a+5ODznL9M9JioiAebGxXy19yULnOX6ZNixlr7koXOcv0z0nWgoB5spqVstXcpB5zl+mNitlr7k4XOcv0z0nJgB5s7FfLV3Jwec5fpjYr5au5ODznL9M9JgicIHmwupXy19ycLnOX6Y2LGWvuRhc5y3TPSdc4A82U1K+WvuTg85y/TGxWy1dycHnOX6Z6TUAHmzsVstfcnB5zl+mTYr5a+5KFznL9M9JwB5spqVstXcpB5zl+mXYrZau5SDznL9M9JdAA82ditlq7lIPOcv0xsV8tXcnB5zl+mekwA82divlr7k4POcv0ybFfLX3JQuc5bpnpOqCgHmyupXy1U96cHnOX6ZNivlr7koXOct0z0nGAHmzsVstXcnC5zl+mTYr5a+5KFznL9M9KMCUA819ixlr7kYfOct0ypqV8tfclC5zl+mek4pwAebOxXy19ycLnOX6ZNixlr7koXOct0z0nGAHmzsVstXcpB5zl+mNitlq7lIPOcv0z0mFOEDza2K2WqnvVgc5y/SGxWy1dykHnOX6Z6SqE4QPNrYrZau5WBznL9ImxWy1dykHnOX6Z6TKMAPNrYrZau5WBznL9ImxWy1dycHnOX6Z6TIAPNnYrZau5SDznL9MbFbLV3KQec5fpnpMPCB5tbFbLV3KwOc5fpmOxXy1196cLnOX6Z6TjADzZ2K+WruThc5y/TGxXy19ycHnKX6Z6TDSB5sbFjLX3JQucpfpjYr5au5OFzlL9M9J1oMAPNlNSvlq7k4POcv0xsV8tXcnB5zl+mek2BQPNjYr5a+5ODznL9MbFfLV3Jwec5fpnpMoA82Nivlr7k4XOcv0xsV8tdfelC5zlumek4wA82U1K+WruTg85y/TGxWy1dycHnOX6Z6TBcAPNnYrZau5SDznL9MLqV8tfcnB5zl+mek2AwA82ditlq7lIPOcv0xsV8tXcnC5zl+mek3hAHm1sVstXcpA5zl+mRdStlq7lIPOcv0z0moMAPNhdSvlr7k4XOcv0y7FfLV3Jwec5fpnpMAPNnYr5au5ODznL9MmxXy19yULnOX6Z6T0wFOEDzZ2K+WvuTg85y/TJsV8tfcnC5zl+mek+BaJQDzY2K2WruUg85y/TGxWy1dykHnOX6Z6TADzZ2K+WruTg85y/TJsWMtafyRhr/3OW6Z6T4ADzY2K+Wtf5JQuc5fpl2K+WvuShc5y/TPSZQB5s7FbLV3Jwec5fpjYr5a+5OFznL9M9JkSooB5sbFfLX3JQuc5fpjYr5a+5OFznL9M9J8AB5s7FfLX3Jwec5fpjYr5a+5OFznL9M9JglAPNnYrZau5SDznL9MmxYy19yULnOX6Z6TgDzaTUrZau5SAn/c5fpjYrZau5SDznL9M9JRxgebOxWy1dykHnOX6Y2K2WruUg85y/TPSYYAebWxVy1dysDnOX6Q2K2WruUg85y/TPSUAebWxWy1dykHnOX6ZNitlq7lIPOcv0z0nIB5s7FbLV3Jwec5fpjYrZau5SDznL9M9JvAMAPNnYrZau5ODznL9MmxXy19yULnOW6Z6TgDzZ2K+WvuTg85y/TJsV8tfcnC5zl+mek/hUoHmxsV8tXcnB5zl+mTYr5a+5KFznL9M9JwB5r7FjLX3Iw+c5bplTUr5a+5KFznLdM9J6CgHmzsVstXcpB5zl+mNitlq7lIPOcv0z0mRBQDzZ2K+WruTg85y/TC6lfLX3Jwec5fpnpNQAebGxXy1U96cLnOX6YXUr5a+5KHznLdM9J8KCm4B5r7FjLX3Iw+c5bphdSxlr7kYfOct0z0oAHmumpYy19yMPnOW6Zdivlr7koXOcv0z0nKB5sbFbLV3KQec5fpl2K2WruVg85y/TPSUAebWxWy1dykHnOX6ZNitlq7lIPOcv0z0mHGB5s7FbLV3KQuc5fpjYrZau5SFznL9M9JsAtAPNnYrZau5SDznL9MbFbLV3KQec5fpnpMExA82V1K+WvuTg85y/TJsWMtfclC5zlumek/gAHmxsV8tfclC5zl+mNivlr7koXOct0z0nCoB5spqV8tfcnC5zl+mTYr5a0/klCX/ALnL9M9JwB5sbFfLX3JQuc5fpjYr5a+5OFznL9M9J/CKAebOxXy19ycHnOX6Y2K2WvuThc5y/TPSYAebOxXy19ycLnOX6ZNivlr7koXOcv0z0nCgebGxXy19yULnOX6Y2K+WvuShc5y/TPSfAAebKalbLV3KQec5fpjYrZau5SDznL9M9JgB5s7FfLX3Jwuc5fpk2K+WvuShc5y/TPSfwCnCB5sbFjLX3JQuc5fpnym9S7lql5d0Zbn9URqVVsK0Jdzl4k1+J6WBc2YDyUvRk5vzdiC+NeC6dt2bBhrR0aPJPSGn9umt+k4qrVRK0w3T2RfDa9isVqK1c6LiinUmUvU65Mb8Qo0WNYcOxrSfVWz9mNSC/XbrmImsf4UrwoB5kA7my56nu+WTB0SfiwktiwK+5tOVhrrWJoSKzFYa8NVbw1wOm3tVq0VAMQAAAAAAACkAAAAAAAKQAUgAAAAWgFQBAAAAAF8ABAAB/TZ8pMzk1BlpOC+PMR4jYUKExtXPe5aNaiaVVVRAP3smtyrev7eyTu3dyU65nJlauctUZAYm2iPd+a1K4rxIlVVEPSjIXkju1kru5DkbKgw5q1IrE6/tSJDRI0w7SidqxNDEXhWq1VfytTJkjkcllx4UCLChPvHPsbFtaZTH3edITV7RlacK1XSdtpgmCAZIlEoSgAAeAtEIoBAAABQBFAUqgQDAAUhSAFAAFxBCgTSXiAqAxIC4gRCk0gAAoQC4kHhAAVFFGYBXhKTOUCAYgAUgAYKUlQvAAC5yoTSAHEBmAUUFJQAAMAGkKFCAVaERCqhALgKkRAAAUAC4UIACF4yYgCghQIMSgCDEeEugATOUATSVSAABUAFBSAABiAGkLUIAKoJiA0ApAKoTAiqoAqkKE3AGdSLnKAIXQTMXOBBUABnFAoAuYAAQYgAUlAAAVBmKBBQaQBRxhM5FAcQLiTEAgx3AVAICgCFwIqUzgACkAAABTELwloQAXjJoCAKcJcKEFEApEChAKCULmADAmYKBRShBUAUiF0gEIpQBBiAlQCcJSABnLmJxFAhaETEKBSLnKQAEAAAoAnhBUIAFBQcIBQUAQIMw8ABagKEAYgoAiCoUZwAUpACcQ0guYCKKlUgAUAUAVRoIBQRRiAFAgUAZGKAD5TcCBMQIkCPDZFgxGqyJDe1HNe1UoqKi50NF9Vrqc23XZNX5uLLPWwkVYloWbDRVWR3YjN2Fup+Z+rtd7FRVPlMQGRIL4cSG2Ix6K17HJVHIuCoqbgHji9qtxVFRFMTvTVc5H1yY3469smWiJdm11WLIrnbLxM74CrwZ27rVpjrVU6MciouOABM4UgAAAAAAABQIAAAAAAAAAAAAAAACkAAAACtzpU2f1A+TqFb1+pu/NoS/VZCwKNlEcnuXzb0wXh1jau4FcxdBrJBaio6p6dalW6kO52Q+7lnLDRszOy6WhNLSirEjIj8eFGqxv9kDtaGiKmupSpVFaIEWoEKhlRCKtE4QIU60yu5bLiZMmrAvBabotpOZr4dmybOqzDkXMqpVEYi7rlTgqdBz2rbgNm4iSNwIsSXRf4N0e1UY9U3VakNUTiqoG4+gUNMdm7E+LxvPP4Q2bsX4vG88/hAbmlNMdm5F+LxnPH4RNm7F+LxnPH4QG54NMNm7F+LxnPH4QTVuxfi8Zzx+EBucuIxNMl1bsX4vGc8/hE2bsX4vGc8fhAbnk8Bpjs3IvxeM55/CGzcjaMnjOePwgNz0JQ0x2bkf4vIfPH4QTVuxvi8Zzx+EBuchVqaYbNyJ8Xjeefwi7N2J8XjeefwgNzieA0x2bsb4vGc8fhDZuR/i8h88fhAbn1HCaYbN2N8XjOePwhs3Y3xeM54/CA3OKaY7NyL8XjOePwhs3IvxeN55/CA3OFDTHZuxfi8Zzz+ENm5G+LxnPP4QG53EMTTBdW7H+L2Hzwvqhs3Y/wAXsPnhfVAbnihpfs3I/wAXsPnhfVGWzdjfF4znj8IDc7EKaYbN2N8XjOePwhs3Y3xew+eF9UBueKGmGzcjfF5D54/CGzdjfF7D54/CA3PoQ0x2bsb4vGc8fhDZuxfi8Zzz+EBucmctOA0w2bsb4vGc8fhF2bsT4vG88/hAbnKhPAaZbN2L8Xjeefwhs3X/ABeJzz+EBudTdHgNMtm4/wCLxOefwhs3ImjJ43nn8IDc0GmOzdiacnjeefwi7N13xeJzz+CBuYKbppkurciaMnjeefwibNyN8XjOePwgNzqVBpjs3I/xew+ePwgmrcjfF4znj8IDc4qGmOzci/F4znn8IbN2L8XjOePwgNzVKaYbN2N8XsPnj8IJq3I3xeM54/CA3OFDTLZuxfi8Zzz+ETZuRvi8Zzx+EBucU0x2bkX4vG88/hEXVuRvi8Zzx+EBueQ0w2bkxXsewueF9UXZuxtOTxnPH4QG52INMdm7F+LxnPH4Rdm7FX/+PGc8/hAbnUIaY7NyNXseM54/CGzcjfF5D54/CA3PpgQ0y2bkbTk8Zzz+EE1bkT4vG88/hAbnZkCZjTHZuxfi8Zzz+ENm7F+LxnPP4QG5yZwpphs3I3xeM54/CGzdjfF7D54/CA3OLRTTDZuRvi8Zzx+ENm7G+L1nPH4QG5yVKaYbN2N8XjOePwi7N2LoyeN55/CA3OJnNMV1bsX4vGc8fhDZuxvi8h88fhAbnogQ0w2bkb4vGc8fhGWzcifF4nPP4QG5owNMF1bsb4vWc8fhDZuxvi9Zzx+EBufiENMU1bkb4vGc8fhFTVuP05PE55/BA3NUhpls3InxeN55/CGzcifF43nn8IDc7EcZphs3IvxeM54/CLs3Iq//AMeM55/CA3OIaZbNyL8Xjeefwgurci/F4znj8IDc1QaY7N2L8XjOePwhs3Y3xeQ+ePwgNz04Ahphs3I/xew+ePwi7NyN8XjOePwgNziUwNMV1bkXTk8Zzx+EXZuxadjxvPP4QG53gFDTDZuRtGTyHzx+EE1bsVM+TxnPH4QG54NMdm4/4vG88/hDZuP+LxvPP4QG5oXgNMV1bsavY8Zzx+ENm7F+LxnPH4QG5wx0GmOzdjaMnsPnhfVDZuxdOTxnPH4QG5xUNMdm7F+LxnPH4Q2bkX4vGc8/hAbnUBphs3YvxeM54/CGzdjfF4znj8IDc8lMTTHZuxvi8Zzx+ENm7F+LxnPP4QG52YqIaYLq3I3xeQ+ePwgmrdi/F4znj8IDc7SXSaY7NyJ8XjeefwibN2L8XjOefwgNzycRpls3I3xeM54/CGzci/F4znn8IDc4eA0w2bsb4vGc8fhDZuRvi8Zzx+EBueENMNm7G+LxnPH4Q2bsb4vWc8fhAbnqEQ0w2bkf4vIfPH4Q2bsf4vYfPH4QG59Ahpfs3Y/xew+eF9UNm5H05PYfPC+qA3QBphs3I/xew+eF9UNm5G+LyHzx+EBueoQ0w2bkf4vYfPH4Q2bkX4vGc8fhAbnKMTTHZuxvi9Zzx+ETZux/i9h88L6oDc8GmOzcj/F7D54X1RNm5H+L2HzwvqgN0OMGmGzdjU7HkPnj8IbNyP8AF5D54/CA3PIhphs3Y/xew+eF9UXZuRfi8Zzx+EBucpTTDZuRtGTyHzwvqhs3Y/xew+eF9UBueKGmCatyP8XsPnj8IbN2L8XjOePwgNzyYmmOzci/F4znn8IbNyP8XjOePwgNzyU3TTHZuR/i8h88fhF2bkb4vGc8fhAbmoU0w2bkb4vGc8fhF2bkb4vGc8/hAbmogNMdm7G+L1nPH4Rdm5F+LxnPP4QG5w4zTDZuxvi8Zzx+ENm5G+LxnPH4QG54oaYpq3IvxeN55/CLs3H/ABdpzz+CBuaMTTFdW5E0ZPG+G2fwibN2Poyew+eF9UBueFNME1bsb4vYfPH4Rdm5G+LxnPH4QG5xMTTDZuxtGT2Hzwvqhs3ZivY9hc8L6oDdAGmGzcjfF5D54/CJs3Y/xew+eF9UBugKGmCat2P8XjOePwi7N2N8XjOePwgNzgaY7NyKn/8AHjOefwhs3Itex4znn8IDc7OShpjs3IvxeM54/CGzcjfF7D54/CA3OLnNMNm7F+LxnPH4Q2bkX4vGc8fhAbnU4CrXcNMNm7H+L2HzwvqibNyP8XsPnhfVAbnoU0v2bsx8XsLnhfVF2bkf4vYfPC+qA3OxLTA0v2bsf4vYfPC+qLs3I/xew+eF9UBueSmk0xTVuxvi8Zzx+EXZuRfi8Zzx+EBuapTTDZuxvi9h88L6oi6t2Y0ZPoXO6+qA3QGGk0tXVuzdcMn0vzsvqzk9xNWZdW1J6HKXqu/PWE17qdcwYyTUFu4rkRrXInEigbVVQVPz7EtSzrZsyXtOyp6XnZKZYj4MeA9HsiNXSiofoIm6BWlIFXADr7L3cKXyh5LrYu5EYx046Esez3u/4cyxFWGtdCKvuV4HKeV8zBjQ4sRkdjocSG5WPa5KK1UWioqbp7GRG69yHmnqxLqMupl5t6BLw2w5S0lZacBqLojIqv8A/wBjYgHTIKuC0IAAAFIUgFIAAAAAAAAAAAAAAAAAAAAAAAft3Isr9275WJY2teqT9oQJZUamNHxGtWngU9docJsNGsaiI1qI1ETQiYHlrqcmo7LtchFRFT92IC/4j1OTEBQZjIipiAVyIlTqzVLZTm5McmczbUqjHWzNv60syG+ip1VyKqvVNKMRFdwrrU0naLloaNeyP2rMvv5dWxlX/JpezIk01P58WK5jvohNA1ity1LQte1Jm07UnI05PTURYsePFernxHqtVVVXOfnLnK9auUxAApAAAAAAAAAAAAFIAAQAAAAAAAAAAAABSAAAAAAAAAAAAAAAAAAAAAAApAABSAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABUIAKpAUCAAAXQQAAABSAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKQAAAAAAAAAAAAAAAAAAAAAAAAAAABSAAAAABSACkAAAAAAAAAApAAAAAAAUgAApAAAAFIUgAyZgudUMQBsPqNcr07cm/cndO0Jp7rt23MNgOhxHVbKzD8GRW12qKtEdoVFrnRD0NY5ETW1qp45yznNTXNVUc1yKi7ioeu11JmNPWFZs7MOrGmJSFFiKiUq5zGuX6VUD9dVqMTLWoEAxVKNVdw0m9kas2l5rpW0kJP4eTjyzomlepva5E/xrym7T/yamn3sjX8VXK+XnPqwwNLIm3UxMom3UxAAAC0IAAALgBChSAAAAAAAAAWgIABSAAAAAAA7H1OHZ3uR34gec9TkzJxHllqb0rl4uT33gec9TUxoBRxjSAMX6DQz2RtP9btgd4GfeIxvo/QaGeyOdly76/9Bb94jAavOzjEO2wAgK1KnPLk3Ssq2LBbOzazKRViuZ/BxERKJTgOG/fps08Kp1MZjbWDt+kubNjgQO2UyfWDXF8941vRKuT+7/bT/jW9E6nGdneq+UmC39jqahDth2T+7+h8/wCNb0Se1/YHbz3jW9EnjOzvOUmC39jqgHbHtfWB20941vRL7X1gdtPeNT0DjOzvOUmC39jqYHbPtfWB28941PQPa+sDt5/xreiOM7O85SYLf2Opgds+17YHbz/jW9EntfWB28/41vRHGdnecpMFv7HU4O2FyfXf/ST/AI1vRJ7X1gfpJ/xreiOM7O85SYLf2OqAdspk+u/Tb2h41vRJ7Xtg/pJ/xreiOM7O85SYLf2Opwdse17YH6Sf8a3olTJ7YGmJP+Nb0RxnZ3nKTBb+x1MDtr2vbvdvP+Ob0Se17d/t5/xreiOM7O85S4Lf2Opgds+17d/t5/xreiPa+u/28/41vRHGdnecpMFv7HUwO2fa+u/28/41vRJ7XtgV28/41vRHGdnecpMFv7HVBDtn2vrv9vP+Nb0R7Xt3+3n/ABreiOM7O85SYLf2Opgds+17d/t5/wAa3oj2vbA7ef8AGt6I4zs7zlJgt/Y6mB2z7Xt3+3n/ABreiPa9u/8ApJ/xreiOM7O85SYLf2Opgds+17d/9JaHjW9Ee17d/wDST/jW9EcZ2d5ykwW/sdTA7Z9r27/bz/jW9EntfXf7ef8AGt6I4zs7zlJgt/Y6nB2v7X1gfpJ/xreiEyfWBpiT/jW9EcZ2d6eUeC39jqgHbKZPrv8Abz/jW9Evte3e7ef8c3ojjOzvRykwW/sdSg7Z9r27/wCkn/Gt6JPa9sDt5/xreiOM7O85SYLf2Opyna3tfWD28/41vRHtfWB28/41vRHGdnecpMFv7HVAO2Pa+sCm3n/Gt6I9r6wND5/xreiOM7O85SYLf2Opwdr+19YP6Sf8a3olTJ9YHbz/AI1vRHGdnenlJgt/Y6nB2ymT67/bz/jW9Ee19d/t5/xreiOM7O9HKTBb+x1MDtn2vrv/AKSf8a3oj2vbv9vP+Nb0SOM7O85SYLf2Opgdsrk+u/28/wCNb0Se17YH6Sf8a3ojjOzvOUmC39jqcHbPte3f/ST/AI1vRHte2B+kn/Gt6JPGdnecpMFv7HUwO2va9u/28/41vRJ7Xt3/ANJP+Nb0SOM7G85SYLf2Opgdte17d/t5/wAa3ok9r27/AOkn/Gt6I4zs7zlJgt/Y6noQ7Z9r27/bz/jW9Ee17YHbz/jW9EcZ2N5ykwW/sdTA7Z9r27/bz/jW9EiZPbA/ST/jW9EnjOzvOUmC39jqcHbPte3f/ST/AI1vRHte3f8A0k/41vRHGdnecpMFv7HUwO2va9u928/45vRMfa+sDt5/xreiOM7O85SYLf2OqCHbHtfWB28/41vRHtfWB28/41vRHGdnecpMFv7HU4O2fa9u/wBvP+Nb0Se17YH6S0PGt6I4zs7zlJgt/Y6nB217Xt3/ANJP+Nb0Se17YH6Sf8a3ojjOzvOUmC39jqYHbaZPbvdvaHjm9Ee17d7t5/xzeiRxnZ3nKXBb+x1IDttcnt3u3n/HN6JPa+u928/41vRHGdnejlLgt/Y6lB2z7X13u3n/ABreiT2vrv8Abz/jW9EnjOzvTykwW/sdTg7Z9r67/bz/AI1vRJ7X1gV/KT/jW9EcZ2d5ykwW/sdTg7Y9r67/AG8/41vRL7X13+3n/Gt6I4zs7zlJgt/Y6mB20uT673bz/jW9Ei5Prv8Abz/jW9EcZ2d5ykwW/sdTA7Z9r27/AOktDxreiPa9u/8ApLQ8a3ojjOzvOUmC39jqYHbPte3f7e0PHN6JPa+u/wBvP+Nb0RxnZ3nKTBb+x1ODtj2vrA7ef8c3oj2vrA7af8a3ojjOzvOUmC39jqcHbPte3f7ef8a3oj2vrA7ee8a3ojjOzvOUmC39jqfEh2z7X13+3n/Gt6JPa+sDt5/xreiOM7O85SYLf2OpwdsLk+sDt5/xreiT2v7A7ee8a3ojjOzvOUmC39jqgHbCZPrv6Xz/AI1vRMva+u928/41vRHGdnecpMFv7HUwodsLk+u928/41vRIuT+7+h8/41vRHGdnecpMFv7HU4O2EyfWB+kn/Gt6I9r6wO3n/Gt6I4zs7zlJgt/Y6nB2z7X13+3n/Gt6JPa+sDt5/wAa3ojjOzvOUmC39jqcHa/tfWB+kn/Gt6ITJ7YH6S0PGt6I4zs708pMFv7HVAO2Pa+u/wDpJ/xreiX2vrv9vP8AjW9EcZ2d6OUmC39jqYHbC5Prv/pJ/wAa3oj2v7A7ef8AGt6I4zs7zlJgt/Y6nB2x7X1gdvP+Nb0R7X1gdvP+Nb0RxnZ3nKTBb+x1ODtf2vrA7ef8a3ok9r6wf0k/41vRHGdnenlHgt/Y6pB2v7X9g/pJ/wAa3ok9r+wf0k/41vRHGdneco8Fv7HVIO1/a+sHQ+f8a3ok9r6wf0k/41vRHGVneco8Fv7HVIO1va/sH9JP+Nb0R7X9g/pJ/wAa3ojjKzvOUeC39jqkHbCZPrA0xJ/xreiPa+sDt5/xreiOM7O9HKTBb+x1RiKHazsn1gp+fP8AjW9Ew/eBYXbz3jW9EcZWd6Y1jwe/sdVg7XZcGwdLp7xreiZfvAu/20941PQOM7O9E6yYPf2OpgdsLk+sFGRHI6eq2G9yfwqZ0aq7h1SqYVOxYxNF/PgdDv4HSVnG8L0WfNlt3sQAdhYAAAAAACkAFIAAAAAqEAAAAAAKQAAAAAAAAuBAAAAAAAAAAAAAAAAAKQAAAAAAA+8ttV4z1zuThdiyPmEv9k08jZba+E9crkr/AKMWP8wl/smgfuqpKhQBH/k14jUD2Rr+KblfLzn1YRt+/wDJuNQPZGv4puV8vOfVhAaVxNupiZRNupiAAAAAAAAAAAF8BAAABQIAAAL4ABAAAAAAAAdl6mvs9XJ77Qf2nqUh5Z6mzDLzcnvvB86nqYmgC8ZSACP0GhvsjnZbu/3hb94jG+T9Bob7I52W7v8AeFv3iMBq67bEK7bKQDJp2/kvRP3oQl/58TzodQNznb2TD3oQvl4nnQrdKexjrZzWb3SP3R4S5OpitSqChYRKbpaIKioBAtRWoqSAzAgFMVLUAQAZwKhcDEoGSAlQgFFSVFQAAVQIUhagAKggMxcSKCQpgTSUAAQIAFFKAJQUKgABE4QMAKYgqIBEClVAoCmBKFXMQAgCkAuZQEqXOABUUAY0KBQgOMqoTQKgCkqhQAXgAABQAINAVQAoMQgxAFBKgAASKQlS4AAEAF0heAlQMkCkLpIEqCIuI0gOIUFRWgChSFAlQiAqqAwJUijOAVQCgKFIEGQFoQAKICkACiFJUCKgqWqkpQAooCqAzAVAACmIRAIVMCk0gBUZwAzgV3BVQA4hUgEBQEikpulIBSGSIQISgpiWoCULUhUQC0qTW7hRVQhjRUFaGRiqBMPpDf7iKi/oX/VU17dtUNgUT3MX5GJ9VTX1dqW+iv7vt5tbqtHPd/x82IALhsAAAAAAAAAAAAAAAAAAAAAABSAAAAAL4AIAAAAAAAACkAAAAAAAAApAAABQIAAP6Jba+E9c7lJS7NkJ/QIH2TTyMltr4T1zuZ727J+YwPs2gftgvETOBHfk1NQPZGk/zRcpf+fOfVhm379opqD7I1/E1y/nE39WGBpVE26mJlE26mIAAAAAAAAFIAAAAAAAAAAAAAAAAAAAAHZOpu7PFyO+8Hznqamg8stTd2eLk994PnPU1NABaALiAI/QaG+yOdlq73eFv3iMb5P0GhvsjnZau93hb94jAauu2xCu2ykAyaduZLvejD+XiedDqNp25kv96MP5eJ50K3Sfsfuzus3ukfujzcoqRVLnMVwKFhBVCEBIyFSAIWpBpACoAXAJASoRAKAgqgAtSAlAATSBlgOMgIBQRQBUUtTEoMlBCgCqQugAAQCipKgCkwCkAteEIQAZBCVKBSAAQUFAgDAilzClcxIABCBQhEwKgFAIABAALUmYIBQQuggUhABVJUAkCkzDSBSBSAWu6KkAAIAgFBABRoICRa1FSAgAoFUUAEzhQBS1MQBakHhACpFCgJBXcCACjjBUQIXiICKBVXgCKSukhJkyrUhU4gQJpLUgALiApAlUBCgVBXgIhahBUYbhAoAAVCQVIAKAQCkAAAAkAAAABAIVCFQErQi4FqQlARVCk3CEskX3EX5F/wBVTX1dqbA/mRfkn/VU1+XalvorZV9mu1W/7f8AHzYgAuGvAAAKQAAAAAAAAAAAAAAAFAEAAAAAACgCFIABQBAAAKQAAAAAKoEAAAAAAAAAAH9EttfCeudzPe1ZPzCB9m08jJbarxnrncv3tWR8wgfZNA/cUgAEf+TU1B9ka/ia5fzib+rDNvnfk1NQ/ZGv4kuZ85m/qQwNKIm3UxMom3UxAAuggAAAUgAAAAAAAAAAAAAAAAAAAAAAB2TqbezzcnvvB86nqamg8sdTf2eLkd+IHnPU3cAoAAj9Bob7I52Wrvd4m/eIxvk/QaHeyOdlm73eJv3iMBq47bKQrtsQDJp27kv96ML5eJ50OomnbmTD3owsf+PE85W6T9j92d1m90j90eblCmKqVTHSUTCAGkIALoAAICFTEIANICShEC4loAAxKA0AZgShNASgqCEigBQIC0AExAAFQAACkKEKY6SgCAFJAKRcwQACFISqCpKioFHCQBAEACVGAqAhQYrnLoAAAC5gQoEC4lqhAJQpOIoBCkLiAAxJiBKYloCBJ4QAAUIF4SVAoQDwgM4AABAUCeAAAUgHEEABUJEQoxBAgBKBMA8IBIeEVSoC5yA0gACl0EAF0EFQAHEQqAVKigQKEC0qBgQAQAJFAABKlIALUigAEKhCgEHhIUAQIAKgUgJAAANAGAAIACBaFJUqhAgICQoRSqQhK/mRfkX/AFVNfV2psG1PcxPkn/VU18XaoW+iv7vs12q3/b/j5sQAXDXgLgQAAAAAAAAAUhdAEAAFIAAAAFIAAAAAFQgFBAAAAAAACkAFqQAAAAAKQAUgAAAAAAP6Jbarxnrncv3tWT8wgfZtPIyW2q8Z653K97NkfMIH2TQP21GI0gCO/JrxGoPsjX8S3L+cTf1YZt8/8m41B9ka/ie5fzib+rDA0qibdTEyibdTEAAAAAAtCAAAAAAAAAAAAAAAAAAAAABaEA7I1N/Z3uT33gec9TUPLLU4dne5PfiB5z1NTQBQAgEfoNDfZHOy1d7vC37xGN8n0wNDfZHOy1d7vC37xGA1ddtlIV2dSAZNO3cmHvRhfLxPOdRNznbmTCv70Yfy8TzlbpP2P3Z3Wb3SP3R5uTmPgMiKUTCIoQAABQaSQKQqZyAAKoQlAAAAKBAUlSUoAUgBUAApCqQAAAKEIUAAAAIoqoFGIFdwBUKhMS1JEBVCoQIWoQAAooAIWoAApAAABKDHcHhFAQlQpAELxgBACFIUAAAJXhCheIgAAAUhSEgShQQlBXEACgIAGYVACBAAgSAIVAgQUA4gKQuBFAgAAgBQlAWhACgBOAAUmNQABQoELgQAZAiZggQABAlAVSAAUnEAQVAAAACkAQAEXcGctAAUU3CKAHEQoAEzlJDRUEKQLoFCIpagMwCqQCjEIAgVANBQlW7WL8i/6qmvbtqhsI3NF+Sf9VTXt21Qt9FbKvs1uq227/j5sQAXDYAAAAAAAAAAAApAAAAFIAAAAAACkAApAWgAhaEAAAAAAAAAAAAAAAAAAAAAXECAAD+iW2q8Z65XJ97FkfMJf7Jp5Gy218J65XJ97Fj/ADCX+yaB+5pAVcQBH/k3cRp/7I0v+arlJ/z5z6sI3Af+TXiNP/ZG/wCK7k/LTn1YQGlkTbqYmUTbqYgAAAAAAAAAAABSAAUgAAAAAAAAAAqgQAAdkam/s8XJ77wPOepyHljqbuzxcjvvA856mpoAq5wABH6DQ32RzsuXf7wt+8RjfJ+g0N9kc7LV3u8LfvEYDV12chXbZSAZNO3smHvQhfLxPOdQtO3cmHvQhfLxPOhW6T9j92d1m90j90eEuTEMiUUomDQhcSBIAAKgAAqVIAEAqCBKgiYACkqFAFFSAAM4AAAAAoBIADAgCkAAAqgQAoDEeApQhioXEpAkwFAAAKQIFAQoEAASFIAhSAAXSAgAIXjIUABUAOEDAKoEwqFKqkAgClAgLQUoBAASICrmIQkKQoFIUEoCAVIAEASoFS0wCDSUhQIQyMQBCigAAYAQGVNwi1CUBQAwCCgQABUACpQiioQqkApwhIpEKQAAAAFCgQAAAABQgFAHhIpRgBAAAJ4S0IAqUgAoIZaAAAxAACoFzZiExLpAyYmET5J/1VNe3bVDYVmaJ8k/6qmva7VC40Vsq+3m1uq227/j5sAAW7YAAAAAAAAAAAoIAAAAAAAAAAAAAACkAAAAAAAKQAAAAAAAApAKQAC1ICgQAAAAB95barxnrpcn3s2R8wgfZNPIyW2q8Z65XK97FkfMJf7JoH7mkAAR/wCTXiNQPZGv4puV8vOfVhG37/yamoHsjSf5ouV8vOfVhgaVxNupiZRNupiAAAAAAAABSAAAAAAAAAAAAAAAAAAAAB2RqbuzxcnvvA856mpmQ8s9Td2eLk994PnPUxFwQC6QNIAj9Bob7I4v+tu7/eFv3iMb5P0GhnsjnZcu/wB4W/eIwGrztspCu2xAMmnb2TD3oQvl4nnQ6hadu5L/AHoQ/l4nnQrdKex+7O6ze6R+6PCXKDEyMVKFg0BVISACDOEpQAYAEKpCoAAXAgAAKA0ioQANIUAkAAQFRiKFRAFCcRkKBDGgppM6IXWgzYjEyoQDGgMqCgGNMS0MqEAuglSkoQBChCRiXQVUFAJgRQoqAqCAJVSkTEoQhVHEAICqgUCZikAFFSFQAKk04AC1CkAADjASFIAhkSgQtQIAoAgqgAAAmYJZVFSIF4AgIpUUKEpTAIilQyBmxzFKuYioEKCULRRkBKGSIZUQhGb5lKvASmBKShKUMk4i0IRmx4gFzglLFRUoAxLnBFCVAIoFBELUCkAUApAF4ACFUgAFJnLpADgFCqm6EMUKWiBQJiAZIgEIuctBQDHSDKgVoGJKGVBTdCWJfCVUQKgzEoWihMM4qhAhVwFTEkXAhcwAJmLoxIpKgZNX3MT5J/1VNfV2psB+ZEX/AJT/AKqmv67UuNFbKvs12q3/AG/4+bEAFu14AAAAAAAAAAAAAAAAAAAAAAFAgBQIAAAKQAUgAAugAQuJAAAAAAAAC6AIAALiQAAAAP6Jba+E9c7le9myPmED7Jp5GS21XjPXO5XvZsj5hA+yaB+3hUaQoAj/AMm41C9ka/iW5fzib+rDNvX16mpqF7I1/Ety/nE39WGBpTE26mJlE26mIAAAAAAAAAAoELmIAKQAAAAAAAAAAAAAAA7J1NvZ4uT33g+dT1MTQeWmps7PNye+8HzqepaYIgFCAAYv0GhvsjnZcu/3hb94jG+b9Bob7I52W7v94W/eIwGrrtspCuzkAybnO3sl+F0IXy8TzodQsznb2TD3nwvl4nnK3Sfsfuzus3ukfujzcnUxXOFIULBigEJSqUJUqCoEAFABcAqVJoApAAAAqAAxAAIUoGJkiFoSlCQKiCDDjRo7IMCDEixXrRkOG1XOcvAiYqdnXOyJ34t9jY8zJw7GlnJVIk6tHqnBDTHlofdFquucqYzc9jC3r85W6Zl1lQKmt22CcOBtDdvU6XblWsiW5ak9acRNsyF/AQl5PdfSdjWFk+uXYjU/c67VnQnp/wAR0JHv/vOqp3bejbtXrZQurGrWKr565inv8Gk8hZc/O06zkJuZrm6jLvfX+6in7MG4l8phtYF1rYdXdlXN89DeODBhQWo2FDZDRMyNaiJ9Bn4VOxToqnpqWFGqtEetcnsaRMyX5Q3oitujaVF3UYn/AJGS5K8obUq66No04EYv/kbt0SuKVCNTQh98V2/jLn5MYf5p7mjMzcG+cslY91bYaibkq531an5M7ZNoyKKs7Z85KomdY0u9lP7yIb+mEWEyK3WxGtem45qL5z4q0VT0VOC5qrbn1bk9jz2o1y+4VHcS1MVatTem2rhXOtrXraV2rMjxHZ4nUEa/+8mKHX15dT5dOdY51jTk/ZMVU9y3XdWhIvE7HkU69zRl2n1ZiXQvas4mjntzFXc1WzA7OvhkMvzYevjSUCDbcq3HXya0iInDDdjyKp1vGlJmVmHy81AiwI0PB8OKxWPbxouKHRuWq7c5VxkpcRhL2GnK7Tk+KpUUofSlCKlTjdTN81BkqGK4EvpFIWqhAIQqkJSVKTMCBlUVIAhScAKgDDSQqKFAigECVxBCgAMaBQCgFoBEKQVJQpAKkCkIoSpKRVABAFoQqACFVaAAgoVEKqKEMMyl16H1lZWYmphkvKy8WPGiLRkOExXvdxImKnY91Mht+7da2NMycGx5dfz519HqnAxtV5VQ5bdqu5OVMZu1h8JdxE5W6Zl1nr0M21XQtDZW72pssKA1H23bs9OxNLJdiQWftd9Jz6yMkGTuzUTqV2JSOqJtplXRl/xKp26dG3atuULe1q3iq/Wyp6/w0wa2GqYvYn9pD6axlNs1fCb5Sl3LvybEZK2JZsFqZkZKsSn0H9iSUqiUbLwUTcSE30HLGiZ6au52Y1Urnbd7vy8+40SGz85OU+HV2qtNc3+8h6Eus+Ueio+Ul3IudFgtX9h/DM3Uu3NIqTVg2ZGRc+vlWL+wniqY2VPvkrMRzXO5oUxFdiiKqH0SHhmN1LTyT5PZ5F6pdaQhKv50uiwV/wANDhtv6nu7Ey1zrJtS0bOfT3LHqkeGi/2vdfScFzRt6PVyl0r+rWLp56Jifv8Ay1cciIYKqna17MhF97KR0WzmyttQEx/yZ+si/wBx3pOs5+zbQs6bWTtGSmZOYTPDjwlY7kXPxodSuzXb9eMlPfwV/De1pmH8mcUPqsNUzmDjhzdXPNhQYFVDGhL6QKASlCgnGAAopQGcAiYhCqhBmASFpUUKEImAMqoFQCVC4lRqqFauhAInGZUwP1Ls3ZvBeSZ6hYdkTk+6tFdCh+4bxvX3Kcp2xdzU7XknEbFty1ZKzIa4rDhIseJxaGp9JzW8PcuerGbuYfR+JxHs6Jnw7XSKNqtEPr1NWpV2CcOBtZYOp9uTJa11oRLRtR6Z0ixups5GUObWXk5uNZrU61utZTVT858BHu5XVU7dOjLs7ZiFvb1ZxVfrVRDRh8SG1cHtX+0hGPa5c6HoDAsWyJfCXsqRhJ/Ml2J+w+7ZGVTNLQE4oTfQc0aK/wD67nbjVacue53fl5/I2GiVc9qcaoYOczM1yO4lRT0Dj2ZZ8ZutjSUtFTcdBav7D8W0rjXOtGvXt1rHj10ulW15aHzOiquip8Vaq1x6tzu/+tFfoL1NVxU3CtLIdk7nWu6lZEWReuZ8rMvbTwVp9BwS8mpzejXPu/eJHKie5gz0GlV/XZSnIde5o+/TsjN0L+ruNt89MRV1T/OTXfW0IqnLr45N77XY177SsKO+Wb/6mV/hoVN2rcU8KIcPZVyVTNwHTqoqonKqMlTdw9yzOVyMp3i8Qop9EYqZ0IqHy4c4YIgwMlVDFU3QlApFWhSUoUIgUIFT3EX5J/1VNfl2psCu0i/JP+qpr8u1LfRWyr7ebXarf9v+PmxABcNeAAAAAAAAFIAAAAAAAWhAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAf0S21XjPXO5fvasj5hA+yaeRkttfCeudy/ezZHzCB9k0D9saQFAj9opqD7I1/E9yk/pE39WGbfO/Jqag+yNJ/me5a/0ib+rDA0qibdTEyibdTEAAAAAAAAAAAAAApAAAAAAAAAAAAAqUCkAHZOpt7PFye+8HznqYh5Zam7s8XI77wPOepyABoAoBH6DQ32Rzst3f7wt+8RjfJ+g0N9kc7Ld3+8LfvEYDV122UhXbYgGTM529kw96EL5eJ5zqFuc7dyYe9GF8vE86FbpP2P3Z3Wb3SP3R4S5OpiUhQsGilQKgJSgKACDQAgECFAECgACkAAqZghkBipUKiH91g2NaVvWtAsqyJSJNTcd2tYxicqquhE0quYmIznKE0UzXPBja/khtV7ka1Fc5VoiJiqqdwZNshduW+2FaF4nvsaz3Ythq3/ACmKnA1cGJwrjwHbGSDI9ZF0IUG0rUSFaVu62qxXNrCl13IaLp/nLjxHaqIiVpylvhtHR613sa7RursZRcxPZ/P8OL3KuDda6EBG2LZUGFFVPdTMRNfHfxvXHwIcooOMULWmmKYyphqrdqi1TwaIygCgH05AAAAAAAADwgcQAURTj97rm3bvXKrAtyyoE0qJRkamtis4WvTFDkAqfNVMVRlMPiu3Rcp4NcZw1XymZDLasLqtoXcfEtizm1c6FT/KYScSYPThTHgU6eiN1iq1UVHItFRUxRT0JclcdJ1VlgyQWZfCDFtGy0g2dbiJVIqJSFMcERE0/wA5MU4SpxOjY9a12MppPVymYm5hubd/DUdzkMFQ/ttuyLSsK1piyrWk4kpOS7tbEhvTFNxU3UXQqYKfyKlComJicpZCqiaJ4M7WFCGSkCEwUigBIAUAmcAEoMQVU4QQIMaBQABUAECgBIMwoAKQFqEGAqPAQAAFAmkABIAABQhdIChKYlP17n3ati9luQbIsSUdHmImLlzMht0veuhqf/8AD6iJmcofVu3Vcq4NMZzL8+UgRZmOyBLwnxosRyNYxjVc5yroRExVTuzJzkBtS00hT97Y77LlVo5JSFRZh6fzlzM+leI7cyUZLLDuNKsjtYyethzKRZ57cW7rYafmt+ldJ2EmBb4fRsR+q72Nho7VyinKvE88/D+X4F0bmXaurK9QsKyZeUqnuoqJror/ANZ64qfv0RCFLWmmKYyiGoot026eDRGUAAzEvsogHEACZyqpNAAirUmtMhpAiNTcPzrwWBY1vyLpO2bNlZ6Cv5sZiOVOFFzovCh+kEImImMpfNVNNUZVRnDXXKRkCjw2xJ65cwsZqe6Wz5l/uuKHEXPxO5ToS05Ces2eiyNoykaUmYS0iQozFa5vGi+fMp6C4ZjieUW4VgX1s1YFqyyMmWNVJedhoiRoK8C6U3WrgpV4jRtNX6rXNPwZrSGrlq5E14f9M/Do/DR1UMVOV5R7iW7ce1+s7UhJEl4qr1tNw2r1KOnBuO3WrjxocVVKFNVRNE5VbWMu2a7Nc0VxlMMVIZKhCHwiAABoAKShAAQFAABUTAKC1JEoWtDJtDtfIzkfnL4LDti2ljSNhItWUSkWa4Gbjf53Jun3bt1XauDTDsYXDXcVci3bjOXA7m3VvBe20kkLCs6LMuRU6pE2sKEm69+ZOLPwGxmT/INd+yWQpq8r0tqdTFYVFbLMXc1ud/hw4Dta79iWVYNmQrMsiRgyUpCT3EOE2ica7q8Kn6KpuF3Y0fbo56+eW3wGgLGHyqu/qq7ux8JKUlZKWZLSctCl4LEo2HCYjWp4EPvhTQAWGxfRERGUFAPCFCUoCgCKhRThGgARW1KAMVhtVFRUwXOm6cFvxkoufehIkaNZ7ZCfcmE5JojH1/nJtXeFDnihMT4rt03IyqjNw3sPav08G5TEw0zym5LbzXK6pNRIKWjZSLhOy7Vo1P8AmNzs48U4UOvFXXZj0Miw2PY5jkRWuSjkVKoqbiodC5Z8h8Cchx7cuXLsgTaIr41mtwZG3Vhdq7+bmXgKfE6O4EcK1z7mS0jq76OJuYbnj4fw1qXjItTJ8GPCjPgx4T4UVjla9j2q1zVTOiouKLwGWsVExKueZlpjgzlL5ohaFpQlQgqRVIqgJVV9xF+Sf9VTX5dqbAKn8HF+Sf8AVU1/XalvorZV9mt1W/7f8fNiAC4a8KQAAAAUAACkAFIUgAAAAAAKABFAAAAAAAAAAAAAAAAAAFICqBAUgAAAAAAAAAAAf0S218J66XM97dk/MIH2TTyLltr4T10uZ727J+YQPsmgftKAoAj9otDUH2RlUWx7lMRUr1ebzrT82Gbf50PxLz3Tu3eZkFl4bCs21WwFVYKTku2KkNVpWlc1aJyAeRERi69c3KhjrHcHKh6upklyaJ/IK7PN0P0GSZJ8mvcHdrm6H6APKDWO4OVBrHcHKer/ALU2TTuDuzzbD9BUyUZNU/kJdnm2H6APKBIb1zJXiIrFTOioeq87keyXTcB0GYuBdtzHZ9bIMavgVMUOvL4ak/JTbUF/7mSdoWBMOpSLJzKvan9h9WgedINhsrWpTv5dGBHtGwdZeezIfuldKMVsyxvDCx139lV4jX2NBiwYjocVjmPY5Wua5KK1UzoqaFA+YAAAAAAUCAFAgAAAAAAAAAA7I1N3Z4uR33gec9TkPLHU39ni5HfiB5z1O3AAGkIBH6DQ32Rzst3e7wt+8RjfJ65jQ32Rzst3f7wt+8RgNXXbYhXbZSAZNznbuTD3owvlonnOomnbuTD3owvlonnK3Sfsfuzus3ukfujwlyZSFIULCAAJDwgDQAqQAABiABVIAAKEAZioRExMs4Nr++wbLnrbteWsmzJd8xNzMRIcOG3Su6u4iZ1XQiG4+SPJ1ZtxbGRkNsKZtWYanXk3TFV7Rm4xPpzqcb1OeTpLsWCy8Fpy9LatCGio17fdS0FcUZwOXBXeBNB28iImYvcDhIoj0lW3wbrQeiYsURfuR+qdm6P5KUSiCgHhLJozjFcAAHgCAAAAA4wKgAMw8AADwhM40gAAA4hSuCoBVQOBZX8nVn35sZWqkOWteXavWc3rc38x+6xfozoadW3Zs9Y1qzNlWnLPlpyWiLDiw352r+1FzoulD0CXE6b1SOTtLx2Gt4bLg1tiz4arEaxMZiAmKt4XNzpwVTcKzH4SK6ZuUxzwzmnNE036Jv24/VG3fH8tVFVDFc5UaRUUo2FQAATFNBSACitAVEwCBBQqFIGNBRKFoKEiUBVFAMQhaDEAExAzAQpRmAmYZyhQJQnAMVCgQBRmCQUBUUAiGSKQ+slLx52cgycrBfHjx4iQ4UNiVV7lWiIhMRmmImqcofr3Iutat8Lwy9i2RB10WItXxHbSEzS9y7ifSuBubk4uTY9ybBZZllw6xFo6ZmXNTqkw/tnLubiZkQ/MyOXBk7jXaZKqxr7UmWo+emE/Of2ifzW5k5TnejEv8FhItRwqtvg3+h9FRhaIuVx+ue7d/JmzAA769AOMABQeEAUg8I8AAZwAACgAAMQAQAD8q9VgWXeSxZiyLXlWzUrHSjmrnauhzV0OTQpprlWuHalxLwLJTVY8jGq6Tm0SiRmpoXcemlPCbwHHr+XVs2993JixLShJ1OImuhRUT3UGIm1e3hT6Uqh08XhYv05x60KjS2i6MbbzjmrjZPk0QJQ/WvbYFo3ZvFOWJakNGTEs/WqqJ7l7V2r28Cpih+XQzkxMTlLzquiaKppq2wwIZKTEIQAAUgKECZxVKjQKAEopk1tTGh2NkJyfRL73l6rOscliSKo+bdm6q7RCReHTuIfdu3Vcqimna58Ph68Rci3RtlyPIHkjW8UWFeW8cFW2Ox2ulpd+Czbk0r/y0/xcRtJBhMhQ2sYxrGtRGta1KIiJmRE0ISVgw4ECHBhQocOHDajYbGNojWpgiIm4fU0mHw9NinKNr0jR+At4K1wKdvTPxOIJVBgDsO+AAAEAAFIAKTSPCAAQBAAAAGKsRTIVA6ky45KZe9UvFtqxITINvQm1e1Eo2can5q/z9x3gU1TmIb4MV8GNDfDiMcrXsclFa5MFRU0KinoO5tUpU1+1TuTlI8vFvrYkBEjQm/5zhMbt26IyJupmdupjoKjSGDiYm7RHP0srp3Q8XInEWo54279/W1weu4fNVIiuVcUMqFPsY3LJCimABmuHU4vyT/qqa+u2qGwSIqsi/JP+qpr6u1Qt9FbKvt5tbqt/2/4+bEAFw14AAAAAAAAAAAAUAUgAAAAAAAAAAAAAAAAAAAAAAABQIAAAAAAACqQAAAAAAA/olc3hPXS5vvcsn5jA+zaeRcttfCeudyl/0Zshf6BA+zaB+3hUpFUZwC4gvEQAAhcAJxgKEACgCgKIqbh0Xqj9T7YGUmQj2rZEGXsm9bG1hTLG62FNqiYMjIm7mR+dOFMDvQOSqUA8fbzWHal3bbnLFtqSiSNoycVYUxLxEo5jk86ZlRUwVFRUwU/LPQfVp5HoF8boRb5WHKot5LGgq+KjG+6nJVuLmLuuYlXN4KppQ8+4rFataotdwDEUIAAAAAAAAAAAAAFAgAA7I1N3Z4uT33gec9TkPLHU3dne5HfeB5z1NTQBQAgEfoNDfZHOy3d/vC37xGN8n6DQ32RzstXe7wt+8RgNXXbYhXbZSAZNO3cmHvRhfLxPOdRNO3cmHvRhfLxPOVuk/Y/dndZfdI/dHm5MSoUhRMIoIAKBiQIUIChKChacAoEICqECUKAgQIdm6ne5bb2X3ZNzsLXWZZWtmJhFTCI+v8HD8KpVeBvCdZ+bSbpZCbqJdPJ7IyseBrJ+cTrucqmKPeiUav6raJ4DuYGx6W5z7IXWg8F/U4mJq9Wnnnyhz1qInut0ukZswNG9EBpCZhpAABcAH0hQMQAItEzqiHzjx4MCEsWM9sOG1Kq96o1qeFcATOT6g/Gj3suxBWkW8VkQ13HTsOvnMpe9F3JpaS1vWXGXNRk5DVfOfPDp2ZuP01v5o7X64QwbEarUcm1XMuhTJMc2Y+nIoApUAAOIAAACIYxESirSqmWgAacaoK56XRvxFiSsHqdmWnWZlURPcsWvu4fgXFE3FQ63Vam5GqDur++jJ3O9RhI6ds6s5LLTFdanu2+FtfCiGmzW0SqZtBmsbY9FdnLZPO8503gowuJng7KuePNFQlDJUJgdRUIqFQVISKUiVKECFwCDjIAgKAGgDwgQUQVKiEiUFCggAMQAWpCmJILUlDIAY0FOAqpuBKgKICihIqUNgtStcNr4j772jCqjVWFZrXJpzPi/+KeE6TuXd+bvPemz7ClEVHzcZGOcn5jM7neBK/Qb12HZslZVlStmSMJIUtKQmwYTUTM1qUQsdHYfh18OdkeLS6u4CLt301Wynx/D+1uCUUqhRQvW5FAUcQADEcQAAAABiAH0CgADSAAUpFruDjABBgAAVKpQVFQOodUpcdl4brrbkhA11qWUxXKjUxjQM7m8Kptk8JqiqJopTdPQqM1HMVusRyLgqLmVDS/LldFbn37mpWBD1tnzdZmT3EY5cWf2XVTwoUmksPlPpY6drG6yYDKYxNEbeafKfJwNyGBlUxXEqoZNAETEtEJShcajSUICUxMq4ZwB/XYtnzdrWrK2ZIQVjTU1FbChMTS5V82nwG8OTy68ldG6snYUo1FSC2saLTGLFXbPXjX6EQ6Q1J1zerzc3fKchVbAVZaRqn56/lHpxJ7lONTZFqUaXmjbHBp9JO2fBuNXcBFq16erbVs6vyqgAs2mNAAUAKhBUAAUCAUXdC4AAExKqAQaRoCKBSAAAoAA+cxDbFhuhvY17HIrXNclUci50U+lQqYAnnaVZbbkLcq+0eWgQ1SzJusxIu0IxVxZxtXDiVDgrkoboZc7mtvdcaYl5eGjrTkqzMkulXomLOJyVTkNLX1RytVFTgXBU4+EzWNw/obmUbJ2POtNYD+lxGdPqzzx/COXcMalVo1qHUVCovuIvyT/AKqmvq7U2DbtIvyT/qqa+u2qFxorZV9mt1W23f8AHzYAAuGvAAAAAAAAAAAAAAAAAUgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB9YT9aipp0HqHqab8SF+skVh2tBis68lpdklPQUXGFGhNRq1TRrkRHJwO4Dy4SqLVDnGR7KhenJheNbXu7NNVkWjZuTjVWBMsTQ5E0pocmKAeriLUyRDV26+rLuFMSGvt+w7es6bSiLDl2MmWLhiqOq1USuhUP111YmSb9Bebm9nrANihoNc9mJkn+D3n5vZ60uzFyT/AAa9HN8P1gGxiIooprnsxck/wa9HN8P1g2YuSf4Nejm9nrANjBQ1z2YmSf4Nefm9nrBsxMk/wa8/N7PWAbGEqdXZL8vGTnKLPJZ1hWw6DaTkVWSU9C6hGeidqlVR3Ei14Ds5jtcBnUVFAqUA+cXWoiqrUdXCinl9qmLiwrg5ZLcsaWhdSs+M9J2QbSiJBi+6RqcDXa5n9g9RHojkoaY+yTWHCZN3OvDDgu6rFhzElGiaNa1WPhp/iiAacAyelFoYgAAAAAAAAAABSAoEKoQgHZOpt7PFye+8HzqepiZjyy1N3Z3uR33gec9TW6AKpdBBQCP0GhvsjnZau93ib94jG+T9Bob7I52W7v8AeFv3iMBq67bKQrtsQDJh27kx96EL5eJ5zqJuc7dyY+9CD8tE85W6T9jHWzusvukfujwlyVSFUhRQwgAAKgoEAAtSGSIECDjFQBFKQtACFoQyYBy3I3YCXlyj2PZkRmul0j9XmE0dTh+6VF41RqeE3gYqKlUShrjqQLHbEtO3Lde38jBhysJaaXqrn/QjDY5qUShfaNt8G1wvi32rmH9HhfSZc9U+HMtdwAFi0BiBwBQBVJUZgLgcdv1fKwrnWStoW3OJAYtUhQm+6ixnbjG6ePMhb+3okLpXamrbtJawoLaQ4bVo6NEXasbwqvIlV0Gld9ryWvfC341s2zH18V+EOG1fcQWaGNTQifTnU6OMxkWY4MbVLpbS1OCp4NPPXPdvdhX3y/XrteJEgXeZDsSUxRHoiRI7k4XLg3wIdW2pbFs2rHfHtO1Z2civ2zo0dzq/Sfy61ELgUVy/cuTnVObDYjSF/ETncqmXyRlc6IZMhtRa0x4MDJXUMdcpxurwplyS7V77yXdipEsi3J6UotVYkVXMXjatUU7myfaoVOrw5G+csxrHLRJ+VZRE4Xw/2t5DXVVVTHqauU5rOIuWp/TU7uD0jiMLVnRXOXw6HoRZ9oSloycGdkZmFMy0dqPhRYTtc17d1FP6UxNPchmUScuTa7JKemIkWwJl9JiEuPUFX/is3KaUTOnChuBLxYcaEyJCe2JDe1HNe1ao5FxRUUv8LiacRTnG1vdGaSox1vhRzTG2P96GYLgQ7SzAAACAZgMI9NbRWoqLnRdJotlJsNbuX7tmxkaqQ5ead1Kv6N3umfQqG9ioi5zVfVbWY2Tv3JWoxq62fkkR67r4aq36utKzSdvO3FXw82c1lscPDRcjbTPdP+w6ZUwUta4kUooYTJAASkKmAoAhRThAqhAYjOExKA0EKqEQChAAAAzqA4gWlCBAShQSlAiCgqAKSvAUAVFRAiVMoMKJFjMhQm6+I9yNY3dcq0ROVUBEZy2G1JV2FbDtC90zBxcvWkmqpoTGI5PDRvgNhUPwMn1hQbtXPsuw4af7LLta91KK56pVyr4VU5AafDWvRWopen6NwsYXDU2+np65NI0gHYd8AAAUBQCIfGcm5aUl4kxMxocGDDSr4kR6NaxN1VXBD8a/N6rKulYEa17WjayCzBkNq+7iv0MamlV+jOaf5Ssol4b82gr5+MsvZ7HKsvIwnL1Nibru2dwqdPFYyixzbZVOktLWsFGU89Xw/lsLevLzc6yIr4FnLM21GatFWWbrYaL+u7P4EOAWjqkrWWKvWF2ZKGyuHV5h7l/w0OiaqgrUqK9IX6p25Mle0/jLk5xVlG6HeEpqk7dbGas1dqznwtKQo8RruVVVDm919ULdS0orYFrSk7Y73YdUfSNCTjc3FOQ1YRlTOGiNdUU4+/T05vm3rBjLc58LPrh6AWTadn2rJQ52zpuBNy0RPcRYL0c1fCmngP61Q0VubfW3LnWk2dsWddCxTqsB2MKMm45unjTFDbXJXlAsu/lg9eSX8BNwFRs3KOdV0Jy5lRdLV0KWuFxtN/mmMpavRembeOjg1Rwavh8epzSpakaiqhcx3l0AYgAUgw3QGc6l1Tt11tvJ8+1YMNHTdkP64RdKwlwiN5KL4DtrMfzz8vDm5aLKx2I+BGY6HEaulqpRU5DivW4u0TRPS6+KsRiLNVuemHnum5WpT9m+diRLuXrtOxIqYycy6G1d1latX+6qH4zlMrVExOUvK7lM0VzTO2EJmFaqUh8pUULTEqYAEQ/qsySjWhPy8jLNV8xMRWwoTU0uctEP5VU7V1L93/3YykNtGKzXQLJgrMY5liO9yzkxU5bVublcU/F2cHh5xF6m3HTLaC5dgy92rs2dYkoiJDk4DYaqn5zs7neFan7VamMNutbRTI1VMRTGUPUqKIopimnZAFGgKS+wAAMCpQhHLrUqBVomKnGb536uxdGFrrctaDLxVSrICe7jP4mJj4Voh1zl1ywLd2JFu5dmLDiWtSkzM0RzZWv5qJmWJ9CcZrBPzE1PTsWdnpmLMzMVyuiRYr1c96rpVVKzFaQi3PBo55Z3SWnqMPVNu1GdXdDZC2dUbZ6RHMse7szMNRcIkzHSHX+ylV+k47F1RV5kVdZYFja3Qiviqv1jo9jlRDLXVKyrHYiZ9ZmLmnMdVVnw8uqId+WRqk4rImtti67Vb20pMqip4HVqdqXFysXNvdEZLSFpJLzrs0rNp1OIq7iaHeBa8BpVEbU+KNc1yOaqoqLVFRcUU5rWkL1M/qnN3MNrDibc/rnhRv8Aw9FNcilNYsiGWics6PL2De+afM2e6kOBPRFrEl9xHr+czhzpxGzkJ7IjGva5qtclWuatUVN1C5w+Iov050tfgcfaxtHConn6Y+DIBRoOd3jAIE4hgAoAAMX0T3VMTTXVC3XS7WUacWBD1knaKdeS9EwTXL7tqcTsf7RuZSqUOm9VZd5tpXEhW3BYizFkxkc9aY9Rf7l3gRdavgOjpC1w7Mz0xzqbTuF9PhZmI56ef+e5qkuBiqkxVVTcMqYGdyyeeTGSNxbF+Sf9VTX5dqhsJD/Pr+if9VTXx21QuNFbKvt5tbqttu/4+bAAFw166AQAAAAAAApAAAAAAAAD6wUTFVQDBGrStU5UGtXdbyoeimo+utdq0dT7dubn7v2TNTERJjqkWNJse91I70SqqlVwQ7e/eNc9f5LWH5BD9AHkajV3W8qBWrut/vIeuS3EudT3q2H5BD9Bj+8S53cpYfkEP0AeR+sXdb/eQa1d1v8AeQ9cUuNc7uUsLyCH6Crca5q/yWsLm+H6APIxWqm5yoQ9OsvNy7pymRK+s3LXasaDMQrEmnw4sOSY1zHJDcqKiomC1PMh6UVeMDAAAAUgAAoEAAAAAVSAAAABSAAAAAAAApABaruiq7qkAFqu6oqu6pABaruqKruqQAWq7qiq7qkAH9lmzk5JT0CdkpmJLzMtESLBiw3Ucx6LVFRdCop6vZKLxR70ZNrtXhmWtSYtGzYMePRtE6orU16omhNdWh5NQM6nqNqbOwVcqu9MH9oHZldwigoEQ1e9kWxyS2Cq4ql4GInk8Y2iwNXfZFuxJYP9YGfd44Gh0f8AKHzPpMbc+YAAAAAAAAAAAVCAAACgdkam7s8XJ77wfOepm4eWeptT/XzcnvvB86nqYgFACgR+g0N9kd7Ld3+8LfvEY3yfoNDfZHOy1d7vE37xGA1ddtlIV22UgGTTt7Jh70YPy0TznULTt3Jh70YXy0TzlbpP2MdbO6y+6R+6PCXJzFTIlCiYNiWoUgStQhCoBUKRChAQBABkYioGRitUzGSKZa2uKaMRnkROUtudTHZySOSmUmKUfPzEWYdxa7WN/wALUO1ExOMZLbOSzcnN3pPW610OzoOuT+crUVfpU5MiKmBqbFPBtUxuep4G36PDUU/CIXEYBFLnOZ20HgLQigXOYvVESi4Cqn8lrTcORs+YtCYwgysF8aJ+q1quX6EImcozRVOUZy1Z1Ud73WvfZLuysZVkrITWvRFwdHcnul/spRvgXdOouqVP6LRjR7StOatGZer401GfGiOXS5yqqr9J/OrKGVu3PSVzXPS8txuJ/qb1VyelNcRVUEqcbqlFUyREIhc4QyREMmqiGA1yEIf0seiJU2j1L97nWzdCPd+YiK6ZsdzUhqq4rAdXWf3VRW8SIapOc7Qdk6mO132dlZkpZXKkO0YMWVelcK017V5WrynbwNfo70T8eZb6CvTh8XTPRPNP3/LcXXVoVDCHih9EQ0r0gGJSKBUoQZyKBXZlOhNWBIpFutYloU91AnXwq8D2Iv8A4nfS5jqLVUy6RclnVNMG0IL05HJ+06uNjOxUrdL08LB3OrwamolEKqGS7hiqmZeZ55sVUVwKpjUkVFLxGNFKiAFSoopalqBEwKiofo3csebvDbsnYtn9S66nIvUoXVHa1uuoq4rRaJgp2Lse7/KtEjWH5Y7oHLRZuXIzpjN2sPgb+Ip4VumZh1Uiooodsw9T3fxNtHsRP/du6J9k1Pt+Kf7RYnlTuifU4S/8suadE4zoty6goVGnby6n+/OiPYnlTuiY7H+/miPYnlbuiP6S/wDLKOKcb9OXUaoY4VO3k1P1+lzx7E8qd0Qup7vyuaYsTyp3RH9Jf+WUxonGfTl1EmfOZ607WXU+X6auEexFX527onWNqy0ay7Vm7MmtZ1eVjOgxNYtW65q0Wi6UPi5ZuW/WjJwYjBX8PETcpmH8qoYqZK9FC4nFDqRmwVQWhMxL6EKhKhAhanO8gdifu/lRsmDEYjoEo9ZyNXtYaYf4lTkODNSpsRqQrERIVuW+9uLlhycJVTQia930qieA7GEt+kvUws9EWIv4uiifjn2c7YRqJtt0pGpRtFKad6YIAEADAVC8IFofOYiNhw1e5zWtalXK5aIiaVUzqdW6pG8z7AuBGk5aMrJy1ndbQ1RcUZSsR3Jh4TjvXItUTXPQ6+Kv04ezVdq2RDX3LdfmPfW+MZ8GI79ypNzoMkzQrUWixONy/RQ4KiUQ+msRiYJgfNymWrrm5VNU7ZeX4jEVYi5NyqeeVHhMFcNcfDgyZ66iGKuJWoRAZMHNVxybJpee0Ll3plraknOVrF1sxBRcI0JV901fOm4qHHUQ+mvREwU+ormmYmHJbvV2qoqonKYb/WJaUpatlS1qSMZsaVmoTYsF6aWqh/ZWp0LqTb1OnbInrqzMRXPkVSYlar/wnLRzU4nec76ZilUNRh70XrcVw9PwGKjFWKbsdPj0qNABzO4DMKgCkdg1VQKM6AatarexFlL3WfbsKGqMtGW6nFdTDqkNeiv0HSiIptzqoLFS08mcWdYxHRbLjsma7jNq/wChTUpyUrwGbx9vgXp387zvT9j0OLmY2Vc/+/d89aXBCOUwqdNSslcEqREM2IhJPMrYauw3Ta/Ut2B+5WTz91HspHtWOsau7Db7ln7VNWJaG+PHhy0JKxIr0hsT+c5aJ5zfK61nQrHu9Z9kwmIxspLQ4VE3UalfpqWWjLfCuTVPR5tLqxYmu/VcnZTHfP4fqVIUF63JoAADSKAqcYERaJXcOv8ALjfhLl3OiTMpEalqTlYEk1caOp7p6puNTHjoc/iOoqJumnOqLvV++PKNNQIEVHyVmf5JAouCuTGI7wuw/snTx1+bVrm2yqdM42cLhpmn1p5o/l11FiRo0eJHjRHxIkRyve961c5yrVVVdKqpiTXYipm3nFUzMqqGKrQiqRUqTkhki1KqIYolAqgfRqoiGxupcyhPnoT7l2rHV8eWhrEs571qroabaHXSrc6cFdw1u12B/fdi1pq794pC25J2tjyUdsZvCiLii8CpVDmw16bNyKlhozF1YS/FyNnT1PQBHa4qH8FgWjL2vZMpacm5HS01BbGhrWuDkrTwZvAfoIaiJzjOHplNUVREwUC5gWpL6RBmAzgD8+8NlwLYsOfsuYajoU5LvguRf5yUP0KGEWtEoRVETGUvmqmKomJefVoScSQnpiSjpSLLxXQYn6zXK1fpQ/lVcTsDVEWT+42Vm12MajYU2rJyGiZkSI3H/E1eU69pUydyjgVTTPQ8sxVmbF6q3PRMqyq9U+Sf9VTX521Q2EhJ+U+Sf9VTXx21QtdFbKvt5tLqttu/4/8ApgAC4bAAAAAAAAAAUAACgQAAD6wMynyPrAzKB6V6iymxxuxxTH27zubMdM6iz/dxuxxTH27zuZQBSZwBVxMVaUAcA1Q2GQm/XeGb+yceVb1z8Z6q6obsEX67xTf2TjyqfnXjAwAAAAAUgAAAoEKQAAAAAAFwGBAAAAAAACkAAAAAAAKQAAAB9IG2U9SNTd2C7k96IPmU8t4G2U9SdTd2DLk96IPmA7KzkKpNAFNXvZFuxJYP9YGfd45tAhq/7It2JLB/rAz7vHA0NmNufM+kx+UPmAAAAAAAAAAAAAAAAB2Vqa+zzcnvvB86nqXuHllqbsMvFye+8Dznqa3QBVGjMFzgCP0Gh3sjvZZu93ib94im+L9Bod7I72Wbvd4m/eIwGrjtspCu2ykAyadu5MfehB+Wiec6iadu5MfejB+WiecrtJ+x+7O6y+6R+6PCXJgoIpQsIKQF8AELmIEAuG6WvAQtQgQeAEAoXgIZJiBiZS7nPmGQu2VG8uBUQmtoqObVFTFFTQM4TEx0vQmR1sOVhQkRURkNrUw3EQ++vaaIwL+X2l/yV7LaanBNuP7IWU2/zcP332x4ZipdRpSiP7ZbWNZ7ER6k9zeFVboVDHXomlOU0sZlZyhNajUvXPYdsjV/YZQ8r+UmC9HtvPGfTREgscnJQ+o0ra+EuSnWfCztpnu/lukkRN0yRUXGqGm8LLllLY6rrWkoibj5CHT6EP0JfVAX9honVUsiKu6spTzKfcaTs73NGseDn49n5bcUQ4dlmnescld4o6PVqpJuZVP56o3/AMjomX1R97IbNbFsaxYy7tIjfMp+XfjLfbN7Lpz935qwrPl4c41rXRoMV6ubR7XYIuH5p83cfZqt1RE8+UvjEadwldmummqc5iejc6uWM2lEPmrlUwaxTOlChyyYLKI2Mc+cUMjFVUkKULUikCclqCUUyaiBColTlGSd6S2Um7sdVoiWjCSvGut/acaamJyDJ61Yl+7AhsSrltOXonFEavmRT6tz+uOuPFz4WqYvU5fGPFvXCSiu4zJV0GLV907jLnNbD1eFBE4S0AAVACmB1VqoKe1NNfOoHnU7VXaqdPaq2OkLJa2HrqLGtGCxE3aI9f2HWxnsKup0NKTlg7nVLVNypUwVRUlamYeX5Iq7oqUUJSIVKEoZIoDW1QusrpKilqHzzuZZEUamVi7Xz5PqPN12U1y4Gk+RPHKzdr58n1Hm7DNsqF3or2dXX5Q3Oq/u1XX5Qz5CL4Cog8BaNOYEohloCAYolNBapuIVTEDGMicGY0hy0ysOXyq3jhwWIxnXzlRE0VRFU3di5l4jSrLY6uVi8nz1fMhVaV9nT1svrROViid/k4Q1KFqZuMKFIxGea1QmkhQFOAIVAuckVq4puG5Wp8stbJyVWM1yUiTbXTb8NMRap9FDTiSgPm5uDKQ9vHiNhN43ORqec3+siTZIWZKSUNqNZLwWQmomZNa1ELTRdGddVXwjxarVizndrufCMu3/AOP7B4BnCqXban0jwDAKAAKBjERVbganaqK8C2llDSy4cRHQbKl2wlRFw6o73TvCmCG1szGZBY+LFcjYbGq5yroRMV+g0Jvbar7bvRalrRH6903NxIuu3UVy0+hEKvSlzKiKfizWs1/g2Kbcf3T3Q/Oe+p8nKqqFCIUbDZRCBDKgJM0Qz0GOBFUDJVMFRVXAqVMkBsc2yF21+97KXZE3EfrYEaL1rH/UiYeehuw1Na3W1qeerI0SA9sWC5WxGKj2KmhUWqfShvlc61GW1dqy7VhvVzZuUhxarpVW4/TUuNF3JmKqZ62y1YxE1U12p64fs6ABgW7WCgAAEz0AQD8i9tmw7Wu5almRW69k1KxIVOFWrT6aGhMRroTlhv2zFVruNMF+lD0MeqNSqmieVCzUsjKJb9nt2sKfiK3icuuT6xT6Uo9Wpk9aLOdNu5G+PNxtcRrTJMAU7G5pRCa6hVXAxXEmCIc4yFWZ+7WVSwpZ0NHw4MdZmIi5tbDTXeehuwxKYrnXOat6kOzEjXwtW1XsVUlJJIbHaEdEdj9CG0rVq2pfaMo4NqZ+Mt9q7Zi3hZq+M/hQOIJwli0AoGkeEAK7gAH4d+baZYF0bVtl9f8AI5V8RKdtSifSqGiEXqkaK+NGcror3K967rlWqryqptTqrLV6wyeQrObXX2lOMYqov5rPdr5qGqmuqUGk7k1XYp+EeLDazX5qv024/tjxRUoYqqBzjFSuhmog0mWYxKSCkXOCoBjSpkxdatSkVAnNtfqV7wOtLJ7FsqI9XRbKmVhNrohP9036dcdxJtUNU9STa3Wd/Z2ynK5WWhJKrUrhr4a67zVNq0VFzGjwFzh2Y3cz0fQl/wBNg6d3N2fhRxgHcWwAMwCoXNiM6Bcyga2aseykbO2BbcNiJ1RkWUiOpnVKPb9CO5TX9uY231U1mJO5K4k2javkJyFHTDM1V1jvocalK2hndIU8G9O/nef6wW4oxcz8cp8mUNdun/Kf9VTXpdohsJCT3Tvk3/VU18dtUO1orZV9vNYarbbv+P8A6YAAuGwAAAAAAAAAAAAAAAAD6wMynyPrAzKB6Wai3/dxuv8AqzH27zuVc501qLv93G6/6sx94iHcqgB4BgEzAAFzADgGqG7BF+u8U39k48q36eM9U9UT2B78945r7NTysfnXjAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAXQQAAAAKQAUgA+sDOp6jamzsF3J70wf2nlzA2y8R6jamvsF3K70wv2gdlqAoUAhq/7It2I7B/rAz7vHNoUzGr3sivYisL+sMP7vHA0NmNufM+kxtz5gAAAAAAAAAAAAAAAAdk6m7s8XJ77wfOp6mJoPLLU39ne5HfeB5z1NQCqAoVFAj9Bob7I52W7vp/0Fv3iMb5P0GhnsjvZdu/3hZ94jAavO2xCu2xAMmnbuTL3oQflonnOomnbmTJf9EIPy0TzlbpP2P3Z3WX3SP3R4S5MAChYQoQKFJFCEKgDwgABgAXjAIEFdweEIZIoqYjMMhVxMVqVF3RgBKmSLgQlQMlcYqSoCVoVFJxCoGauMVcQBAuKigASIhaEFQKmBa1MQlVCH01yIczyFyL7SytXfgtrSHMrHctMyMY5fPQ4SjVVMEO/9SJdqIto2peuYhqkKFD6zlnKmd7qOiKnEiNTlOxhbfDu0xCx0TYm9iqKY+Phztj4WZamdAiIKGnemwYbgwChAFUFQvAEALtVNf9WFOoyxLBs3XproszFjubXGjWoiLyuU7/eutNT9VZazJ/KPCs5jkVLOk2Q3UX899Xr9CodHSNfBsTvU2nr0W8HVvyh1BoJQyUxM887kCABChFCYgClICEOaZEV/1s3Z+fJ9R5uxD2zjSTIkv+tq7Pz5PqPN24e2cXmivZ1dflDc6se7VdflDMIMAWjTA4wAGAGYIB842Y0ny1L/AK17y/PneZDdmN+w0my1dle8vz5/mQqtK+zp62X1p93o6/KXDqkBCkYgGkKAFQExAHLcjVnJamVG70oras68bFfxMRXfsQ3ghOVyLU1K1K8l1zlTZMK2rZSRjRK7irRqftNtYaUShfaMp/4pn4y3urVGWGmr4z4MgoFSyaIAppAAALmA4zlStBbJyf27aLaa6FIxNbXdcmtTzmizWa1KLoSht3qnrQfKZKJmCx1FnJqDLrwoqq5fMajvWqlDpOvO7FO5htZrueIpojojxl86BMApFUrmaWpFUVIACZy5x4QKiUKQKoCvukXcNxtTVaCz+SSy2vVFdKOiSvga7D6FNOqGzGpBnXRLrW3IudVJedY9qbiPZj9KHe0dXlfy+MNBq3cmnF8H4xP8u986DdDV9ygwNC3wAACjMABjFSrDUjVQ2ekrlUjTKNRGzknBjYaVRFavmQ24XE1u1Ykk5lr3ftJERGxJeLLqvCjkcn7Sv0lTnYz+Ewo9YbfCwVUx0TE+ToNxgq1UyrUxVMTPvPY5k0maISlCtX3ScZKY52z+pFs3qFzLVtFUxm57WJhohtp51O724Idd6nKTSSyR2LXbTLYkwv8AaevoOxdJp8JTwbNMbnpui7fo8Hbjd484ADsLAAGcAR60SpUMY+0wBLWjVe2ksa8diWU1662XlXx3t0a57kRPoRTopyIdl6pmf67ytz8NFwlZeBATgo1XL5zrJyqZfF1cK9VO/wAOZ5npeubmNuVb8uzmSmJURCIDrq1SKTPpFFJAqBC0AYkqXOFTEDl+RS0lsvKrd6ZWJrGOm0gvX+a9FavnN3YNcUU8+rLjulLUlJpjla6DHhxEXco5FPQSTisjQGR2bWI1HpxKlf2lzour9NVP+/7zNrqxczt10fCYnt/+PqAoLZqQIMwAKAEA4xlVs5LUycXgkEpWLIRdbXQqNqi/QaL1R1HdsiLynoNaMJJiWjS7kq2LCcxU3atVDz+m4HWs7HlVrWDEfCx/muVv7Cl0pT+qmrcx2tFv9VFe6YYwkTXqm6x/1VNeHbRDYqRTXTsNqJWqOSn9lTXZ6USi50PrRX9328zVXbd/x/8AT5gAuGxAAAAAAAAAAAAAAAAD6wNJ8j6wMygelmotX/6cbr/qzH27zuVTprUW/wC7jdf9WY+3edy6QAAAAaQBwDVD9gi/XeKb+zU8q3514z1U1Q/YIv13im/s1PKt+njAwAAAAAAAAAAAAAAABcSAAACoBCkAAAAAAAAAAAoEAKBAAB9YG2U9RtTZ2C7ld6YX7Ty5gbZT1G1NnYLuV3pg/tA7MUmgqoQAav8AsivYjsL+sEP7vHNoENX/AGRXsR2D/WCH93jgaGzH5Q+Z9Jj8ofMAAAAAAAAAAAAAApAAOyNTf2eLkd94HnPU1NB5Zam/s8XI77wPOepqaALVQBiBH6DQz2RzsuXf7wt+8RjfN+g0N9kc7Ld3+8LfvEYDV122UhXbZRQCtO3MmSf6IQflonnOo2Zzt7Jl70IHy0TzlbpP2P3Z3WX3SP3R4S5KgIChYQUhV4giISATOAAUFQBCDEBAKCFJDEKKkUgKgEAqiuBEXABIAAGO4CgBUpEMgiWKihlQqIDNjQIZOwQ+euRNITHOzREM20qfFXH6l1rvW3ei1odl2JIRpuYeqVRqe5Ym652ZqcKn1FMzOUPqi1VXPBp2v6brWPPXhtyUsey4PVpqZiIxiaG7rl3GomKm7ly7BlLsXZkbCkmosGVhI1X0xiPzuevCq1U4pkayY2fcOzXRoj2TdszDESZmkTBqdozcbXTnU7ERKF7gcJ6GOFVtlvNB6J/o6JuXPXnuj4fytQECcBYL8+kAIAx3C0CEcqIlQP5bVm5aRs+YnpuIkOXlobosV241qVX6ENDL02rMW/eS0bbmV/hZ2YfGVNxFXBPAlDY7VU3yh2XdqHdaTi/5Zanupii4sgNX/wAnJTiRTV+qlFpO9wq4ojoYnWTGcO7FmmfV29c/hAoxCqVrLouAQhUAqCowIigZJmGkiF0gcyyIp/rZuz8+T6jzdqHtnGkuRHss3Z+fJ9R5u1D2yl3or2dXX5Q3GrHu9XX5QzFKFpiTSWjTAQpAA0gIBhGzeA0my14ZWLy/PneZDdmNm8BpRlup7bF5Pnq+ZCq0r7Onr8mX1p93o/d5S4WoUqmKlIxEJVCriAgBELoCKNBMEbXfeo7lEda94Z5W7SXgwWrTNVznL+w2Tw0HROpCgdTurbc1+ln2MT+zDT0ne2hDR4CMrFP+9L0nQdHBwVH38TSBmB3FsDiA4gAXaqMAqLQDofVfTfU7p2JKV/LTz303UYz/AOTWhFO+tWLMKtp3ck64Ngx4tONyIdCIhm8fOd+r/eh53p+qKsZVuy8BSFVBQ6ilShQiACUBahAIVApaUAaDvjUezSpa94pKuDpeDGROJytOh1O4NSVHWHlIm4FcI1mvT+69FOzg6sr9PWtdC1cHGUdfk2ubtUKAaZ6SAhQC5hxgAEOitWDLrFulYs5TGBPuZ4Hsp+w710HUWqngJGyUxYlMYM/AfyqqftOrjYzsVQrtK08LB3I3NTG5i1CJRBnM1O15nVtFMHrRFVNCL5iqZS8PqseHD7d7W8rkQJo2t68m0k2z7i2DJtbrUh2fBw4VbVfOckP5LLg9QkZaCiU6nBYzkaiH9fGa2iODTEPV7NHAtxT8IBUaajOfTlAAACprm0UtTFV90Bo9lmmkncqd45itU6/cxOJqI39hxE/TvXHWavTa0wuKxJ+O7/8AY70H5pkq6uFVMvKMVXNd2qqfjPiGKlWpifLgNJSUKAKYlRQKhVINIBUwU31uPNpOXOsWaRa9VkYLlXh1iIv0oaFm6mQuYdM5JrtxXLVetNav9l7k/YWmi5/XVG5qNV6pi9XG7zc7BdBOMu22M4AAAADFyfwiKaKZSJTrDKBb8rRPcWjH/wATld/5G9i4ml+X6WSXyu3gRG0R8dkT+9DbX6UKrSsfopnezGtFOeHoq3+ThlkJW1ZdN1y+ZTXOPg5yfzl85shd9qPt6SZ20Sn0Ka4TaUiRETQ9U+k49Ff3fZ09VfXu/wCP/p8AAXLZgAAAAAAAAAAAAAAAB9YGZT5H1gaQPSvUWf7uN1+KY+3edzHTWot/3cbr8Ux9u87lUAOIDMACAaAOAaofsEX67xTf2SnlW/Txnqpqh+wRfrvFN/ZqeVb868YGAAAFIAAAAAAC0IUgAAAAAAAAAAAAAAKpAAAKoEAAFBCgCAAfWBtl4j1G1NXYKuT3phftPLmBtl4j1F1NPYKuV3qhftA7NVcSVLpIAQ1f9kW7Elg/1gZ93jm0KZjV72RXsR2F/WCH93jgaGzH5Q+Z9JjbnzAAAAAAALgAIAAAAAAADsnU3dne5PfeD5z1MaeWWpu7PFye+8Hznqa3QBVqAK4AR6ZjQz2RzsuXf7wt+8RjfN+g0N9kd7Ld3u8LfvEYDV12chXbZSAZMznb+TL3nwPlonnOoGZzt/Jl7z4Hy0TzlbpT2MdbO6ze6R+6PCXJFIVc5FKJhDMAoAFThJxlwCDABMwTiAKQvhIAAxCEpAoUgABMwIAAAAg0jDdAFRAhklAMVwxMNetaUVVPqtFwUyloTXTML9dPOhMJpy6X60G7F5nU/wBHbXp8yieg/pbdO8qp73bXX/2UT0G9Mui6yEmudTWJp4D6uw3eUuOKqZ/ubDktbq5/ST2flovCuHfKbwl7q2u9eGWVvnochsTIblCtJ6dVsmFZ7Fzum47Up4G1U3GpuqvKZIjUzIclOjLcbZlz2tWcPT61cz3OgLpanCQgRGx7y20+dRueXk2LCYvArlx5KHdF2ruWNduz2yFiWbLyMumdsJtFcu65c6rxn7CqQ7lrD27XqwucNgMPhvZ05T8ek0BADmdwUcQAABCgSlD8i91vSF27Bm7ZtOKjJWWhq5cfdPXQ1u6qrgh/Za1oydl2fHn5+ZhS8rLsV8aLEdRrGppU07y05S5q/ludRlOqS9iSj1SVgrgsRcyxXpuroTQh1MXiosU823oVelNI04K1n/dOyPPqcZvrb87eq807btpKnVpl9UYi4Q2Jg1icCJRD8XALmzmJm5mZnOXm9ddVyqaqpzmWSmKlIHyIKFFQJQICoBkgWhKqESuBCHMciLqZWrtfPk+o83bh7ZVNJMizWsyq3aiOcjUSeRVVVpRNY83TbOSrXL/lEHxrfSXeipj0dXX5Q3GrNUf09XX5Q/sUh/L1/J6ZqB41vpH7oSS/+qgeOb6S04UNLw6fi/qB/N1/JfCYPjW+kfuhJfCYHjW+kZwcOn4v6Soh/ItoSXwqB41vpH7oyXwyX8c30jhQcOn4vvG/YaTZa3IuVi8vz53mQ3OjWjIrh15LY/8APZ6TSbKxNwLQymXhnJWIkSBEn4msemZyJhVOQqtKzE0UxvZjWeqmbFERPT5OMELUiqUrEovCUgTOEqhdBFK1aqgQ2w1K8skLJesemMe0Izl4aKjU8x29oOsdTVD1mSGzF7eNHfyxFOztBqMJGVmnqh6houMsJb6oAAdh3wcQ0gBgK6ApFwUDVvVezCRL92VLp/wbNqvG6IqnStaHa+qqi9UyrOh/orPgt5aqdUGXxc53qut5npirhYy51lcQKDQddWlRgQEgXAhagCkzlCEU7S1LURIeVuWYq/lZKYb9CL+w6tOxdTdE6nlhsb+e2OzlYc2H5rtPXDv6LqyxdvrhuUijSYsx5DLSal6gUAXMAHgFdAAA651REokzkgt1V/4LWRk/svQ7GOF5bIfVck95WIlf8hevIqKcOIjO1V1S6uNp4WHrjdPg0kdg5U4SFVaqq7pEMq8rRc5+jdWB1zeaypan5Wegs/xofnZjkmS2B1zlIu5AX860oPnqfdEZ1RHU58NTwrlMb48W9iJj4Shv7Qa16uDMEHhAaQMwAqH807E6lLxonaQ3O5EU/oPzrwP6nY1oxO0lYruRikVTlD5rnKmZaDTcTqs5Hi59fFe7lcq/tPkRi1Y1V0tRQqmQeSVZ8KczgMaFUhKFUgAApC1AFAoATOirum4WprmOr5IrHb+hdGhcj1X9pp6ptnqVHq/JXDav5loTDU/wr+0sNGz/AMuW7+Gi1bnLE5bp8nbugAF+3gMN0JnAAheIgFXBtVNRNVFBSFlYmXomEaTgRPocn7Dbp+0U1R1V7NZlKgRO3syF9Dn+krtJxnZjrUOscZ4P7w6zuun+kch8r+xTW2dwjxflHedTZC6y/wCktnfLp5lNcLQ/2mP8q76ynX0V/d9lVqt6937eb+UAFy2YAAAKpAAAAAAAAAAAAH1gZlPkfWBmUD0s1Fv+7jdfimPt3ncqnTWot/3cbr/qzH27zuVc4AcAGO6AAzE4gOA6ofsEX67xTf2anlW/OvGeqmqIRVyD357xTX2anlZEbRXJwgfMAAAAAAAAAAAABSAAAWgAEAAAAAUgAAAAAAABQBAAAAA+svtlPUbU19gq5PemF+08uYGdT1F1NXYKuT3qhftA7MUIFzjdAIaveyLdiWwf6wM+7xzaFKGr/sivYksH+sDPu8cDQ2Y258z6R/yh8wAAAAAAAAABUzAQAoEAAHZOpt7PNye+8HzqepiaDyz1Nq0y8XI77wfOepm4BkSoQUAj9Bob7I72W7v94W/eIxvk/QaG+yO9lu7/AHhb94jAauu2ykK7bKQDJmc7fyZe8+B8tE851AzOdwZMvedA+WiecrdKexjrZzWb3SP3R4S5GqEUyUxVCiYQJgUU4AkKQpKDMAPCAzE4S4ZxiBFUiFUgSqkFQgAJQBAAClAgBNIFzlQleAqECofaWVEmIf66edD4mUt/tUL9dvnQnIiM5ehMviyF+onmPsqVPjLbSF+o3zH30mth63TsRUAVeAEvoAH0ABxUAw3QGkUUU3Aq0TMAqiZ1Pwr53tsO6llOtG2pxsGFikNiYxIru1Y3Oq/Qdf5Y8r6XRWLZ1mWVMR59FViTE1BdDlmLuoq/lF4EwNXrxXiti8NqxLStufjTk0/8564NTtWpmanAhXYnH0286aOeWf0npyjDZ27XPX3Q5ZlbylW1fqdWE+slZEN9YEk11a7jnr+c76E0HX6YZj667XGKsKOuuqueFVOcsPexFy/XNd2c5ljrgq1CtJQ+XCFQBQKKErwBOMDJEFUIMVAKpKqilpujADNkRyKioqou6i0PoszGX/ixfGO9J8cw4gRMxsfXq0X9NF8Y70k6vF/SxPGO9J8lUKuATwqvi+nV436WL4x3pKkeN+lieMd6T4qpKhPCq+L79WiL/wAWL4x3pMXRYi/8WJ4x3pMEcWgzRwqviySJET/iRF/tr6QqmPgGO6QiZmdqOIZEJBSIAiUAqGcPbN4zBDJi+7TjA3P1P0LqeSC7+G2gOfyuU5+cLyIM1mSS7Lf6AxeWqnNPAaqxGVqnqh6rgoyw9uN0eBQLwjSDldk8A5BpC0AUI8phEzAagap1+uyw2g3tJaWb/gqdZHYuqRdrssdsruMgN/8A1oddIZXETndq658Xl+k5zxlzrlSKFzkU4XRUxLQVJEKC4UABMxELUIVc5znIHEWHlfu6qfnR3t5WKcFOaZDHUyuXa+eU/wADjks+0p648XbwM5Ym31x4t2YZkYQjM1b1ODOAOMJBoHENABDjmUuEkbJ9b8NUqjrPjfVU5GfkX1h9UufbMPtpCOn/AOtT4uxnRPU4r0Z26o3S0FZixte1TzGRjD2jP1E8xkZJ5PUxU5hkRbr8rd2UXRPtXkapxA5tkFZr8r93E3JlzuRinNZj/kp648XbwHPiKOuPFuvCqrDPQYQPyZmmY1T1GNhpHIBhuhIEAAIfi30f1O6ltPTRIRl/wKftIceyiP6nci3n7lnRvqqcd31JcV6crdU7paHQvybP1G+YyMYSfwbP1U8yGRlJeUV+slcSAB8oOMKoCVUIQqAZYlIPCECm1upJfrsmswyu0tOL9LWmqSm0mpCfW4tpM7W0nLysQ72jvbR1Sv8AVyf/ANcdUu7AgUaTQt+AZxnACoUAR+0U1d1XkPW3zsiLSmvs5U5In/ybRPX3Cms+rCYn7vXefuyUZOSI06GkfYz9lNp6M8HV9vF03db3yWd8unmU1wtHCbjp/wA1/wBZTY66qf6TWb8unmU1ytJKTkf5V/1lOror+77KbVf17n2838gALlsgFCIARFXMXWrupyod+6hy7FgXoyqz8jeGyJK1JaHZMSKyFNQte1Ho9qI6m7ipu3BySZM0b7xbuJ/7BoHlPrV4OVBrV4OVD1b9qTJov8hbu+QtCZIsmncLd3yFoHlJrV4OVCa1eDlQ9Xvajya9w13fIGj2pMmvcNd3yBoHlFrV/m8qE1q8HKh6ve1Jk1z/ALxru+QNL7U+TenvHu75A0Dyh1q7qcqE1q8HKh6urkkyarnuLd1f/YNMUyRZM+4W7vkLQPKXWrwcqH0gNVapVv8AeQ9WEyR5NO4a7vkDSpkkyatxS413U/8AYNA4lqL263U43WrpbML/APviHch/HYll2bYlmQbNsmSl5KTgoqQoECGjGMqtVoiZsVP7KgCkHhADMABwLVCKntE36T/oM59k48q31cqrVuftkPYe1bPk7Us+Ys60JaFMykzDdCjQYrdcyIxUorVTSinEPaiyZp/IW7vkLQPKTWrupyoNav8AN5UPV32pcmyZrjXd8gaT2pcmq/yGu75A0Dyj1q8HKg1q8HKh6uLkjyaLnuLd3yBo9qPJon8hru+QNA8o9avByoTWrwcqHq77UmTXRca7vkDS+1Jk17hru+QNA8otau6nKhNavByoeri5Isma/wAhbu+QNHtR5NETC4t3fIGgeUmtXg5UGtXg5UPVxMk2TZP5DXd8gaImSTJqrVVbjXdX/wBg0DyiVKENiNXNdmwrtZVLLkrAseSsyWiWNDivhSsJGNc9YsRFcqJpoiGvDsHKBAUgFIAAAAAAAAABQQoEAKBAUgAAAfWX2ynqNqa+wVcnvTC/aeXMDbKeo2ps7Bdye9MH9oHZaqAucKAQ1f8AZFexFYX9YYf3eObQpwGr3sivYisL+sMP7vHA0NmNufM+kxtz5gAC+ECAAAAAAAAAtCKAKQAdk6m7s8XI77wPOepiaDyy1OHZ3uT33gec9TUwoBdIArwAR+g0N9kd7LV3u8TfvEY3yfoNDfZHey3d/vC37xGA1ddtlIV2cgGTM52/ky958D5aJ5zqBmc7gyZe86B8tE85W6U9jHWzms3ukfujwlyRc5C8ZKlEwgpCgAAOMCFThIoApC0QKSMVBeMEJQFoSiABQuYgAKoBIVA8AAFRVAzgNJ9Jb/aYX67fOh86GcpXruD8o3zoH1TtehMvtIf6jfMfbSfGX2sNf5jfMfZVQ1sPWadhmAGJL6ANAQABgAAqKCm4B/JadnydpyrpWflYE1AelHQ40NHtXwKdMZQdT5YlopEnLqRksiaxd1s+rpd67iaWeDA7zC00nFdsUXYyqh1cTg7OJpyuU5+LQ29F17Zuraa2dbkhElI6V1iriyIm6xyYOT6T8WIrU0m+d6rv2PeSyolmWzIwpuWem1emLF7Zq52rwoamZZclNrXHjOtGUc+0LCe6jJjW+7gKuZsVEzcDsylHisBVa/VTzwxOk9A3MNnctznT3x/vxddqpi4wZrlzn0RFTOdHYossmNFHGZDQEIiFpQgAoAAYAAAOIACCooFAiZyqgFcQImBklKEGbSBkgMa44FALiTQWgoBMQhaBMACcBk3bIQM2yAhvDkaSmSq7Kf8AToXmOXcZxLI72Lbtd7oXmOW04TV2fZ09UPVsJ7CjqjwBiAcjsAAqAMY2YyMIubwAlptqiuzDbn/4fs0OvFOw9UX2Ybb/APw/ZodeGUv+1q658Xlukfe7nXJQFoRTidNEChd0ZyQqCKpdADDdLoJQyAinM8h3Zbu189T6jjhinMsh/Zbuz89T6rjks+0p648XZwXvNvrjxbtQs6mZhCzma4mreqQDAAJAAAQ/NvX72LV+ZRvs3H6R+bev3r2r8yjfZqfNfqy+LnqS0Ah7Rn6qeYyMYe0Z+qnmMjIxseTVbUU55qekrlhsH5SJ9RTganPNTz2YbB+UifUU58P7SnrjxdzRvvNHXHi3SgfkzIxgfkzJTUvUIBQJnADiAADScZym+8G8Pe6N9U5MhxnKb7wbw97o31TjveznqcOI9lV1S0Uh7Rv6qeYqiHtG/qp5irumUna8pq2sVIhVIHyUJmKSihIucugcQAuCFRSJUqUCBTZ/Ufr/AKG2sn/Uf/BDWBTZ7Ufe8+1++P8A/rO7o728fdfau++R1S7yUaQoQ0T0AA8AAcQAAkTaKa16sL+OLufNY/12GykTaKa26sJP86XcX+jR/rsOjpH2E/bxU2nvcqvt4w6Xuqifvms75dPMprhan+2THyz/AKymx11lpeWzl/56eZTXC0/9smPlX/WU6miv7vspdVvaXPt5v5AAXLZhakAGynselfbktKm8sX67Df6ElUNAvY8uzHafeWL9dhv9BzAZgZgAUAAB4RiAA4wMwACiKAChBgAAAABOEcAAKKgAEFByBQKQAAOMAAEoPCNIBUMX1RqmWJH7VQNCfZDHf64rJb/0KF9rFNYX7ZTZ32QxP9cVkL/0KF9rENY37ZQMQAAALUCAoAgBQBAAAKQCkAAApAAAA+svtlPUbU1dgq5XemF+08uZfbLxHqLqaewVcrvVC/aB2aucihVxCgENX/ZFexHYX9YIf3eObQJQ1f8AZFexHYX9YIf3eOBobMbc+Z9JjbnzAAFAgAAuAIAAAAFIAAAA7H1OHZ3uRTfiB9Y9Ttw8sdTh2d7kd+IHnPU5MaAUDSAI/QaG+yO9lu73eFv3iMb5P0GhvsjnZbu/3hb94jAauu2ykK7bEAyZnO4MmXvNl/lon1jp9mc7fyZe86B8tE85W6U9jHWzms3ukfujwlyTSMAvECiYQGAoUCBeAAABxBUAhfAAtd0AQVCAPARS0qRQlSDEoEBSEioQAgEABIyRUPrKuZ13B+Ub50PgqVMoTepxWPz61yLTiWoTGWb0Kl8YcOnaN8x90TdNdYWqSaxrW/vTd7lET/bU0JxGTtUo6nubp1/96noNDxhY+bxeiRpzAxHr90/w2JGBrmmqWei+6uitOCd/+D9ay9UfYEZ7W2jYFqSiLtnQ3siongwUmMfYn+5906awVU+v4u9cAcEu1lYuJb0RsGVt6DAjOzQ5tFguX+9h9JziFGhRYbYkKI17HJVrmrVHcSpnOzRcor56ZzWFq/avRnbqiepmgFNwKh9uUA0AAq4AADFUqfGdk5eblYstMwIceDFYrIkN6Va9q50VNKH9ClSlBtRMRMZS1By6ZNFuRazbQsyG51hTj1SCudZZ+fqTl3NLV3MNB1g9E0G+96bDs68NhzdjWnA6tKzcNWPTSm45NxyLRUXdQ0lv9dmfufembsKfTXOgu10KLSiRoa7V6caZ9xaoZ7HYT0VXDp2SwOndFf0tz0tuP0z3T/uxx5UUYpnM1UxU6CgzTAVAJAAAPACBAALmHDgA8AFQBFIUZ1AhaChUQACruAAFAAeAEUJwAUiL7pCkZi9OMEN4cjK1yU3ZX/p0LzHLzhWQ9/VMkl2Xf0BiciqhzVTVWfZ09UPVsJ7CjqjwAKhTldgGgDQAMYuYy0mMTHAEtNdUWn+uG2//AMP2aHX2g7H1SkPqeWG1sNtCgO5YaHW6mUv+1q658Xl2koyxdzrkIAcTpGBKFzEJEopkgGYAUgqEFTmWRBa5W7s/PU+q44ac0yFtrldu187Vf8Dj7s+0p648XawPvNvrjxbsQv2GZhDQzzGseqQFUgCQFVSaAB+ZezC69rL/AEGN9m4/TPxr8REhXLtuIv5tnx/qKfFyf0y47s5UT1NB4W0Z+qnmMlMIe0Z+onmQzMl0PJ6trE55qelplhsCumJE+opwRTm2QV2syv3cWueZc3lYpzWPaU9ceLt6OnLEUdceLdeAn8GZmMCvU0MlNVD1CDhAQBIAAGk41lNxuFeFP+nRvqnJdJx/KEzqlyreZu2fG+opx3vUnqcOI9lV1S0Ph7Rv6qeYyMYW0Z+qnmKZSdryiraikXiMiLnCEoKcIog0gSgTALnKlAkQyQxroKiBDI2f1IKUuZay7to/+CGr5tLqRGUuDaD6ba03/QxDvaOj/nj7r7VyP/2R1S7qUBQaF6AAZwACgLQCRNoprZqwXf52u4n9Fjr/AI2Gyb9oprNqwXIt4bAh6WyUVeWI30HR0j7Cft4qbT3uVX28XTd2vfHZ9P0yeZTXK0/9smPlX/WU2Ju87WXgkHKuCRUryKa62iqLNx1TMsV9P7ynU0Vtq+yl1W9pd6o838oALlswAAbKex59mS0u8sX67Df+DtVNAfY8krljtJdyxYv12G/0HMoGecAcQDjACgBxAIAAADMKKFAAAAABgAFAEAcAAzAMQOIAAAAA4woDADwgAR20UtSO2igaE+yGdmGyO8UP7WIawv2ym0Hshqf63rHX/oUP7aIavv2ygQAAWikAAFIUCFIAAAAFIAAAAAAAAAPrA2ynqLqauwTcnvVC/aeXUDbKeo2pr7BVyu9ML9oHZhNJTECoav8AsivYjsH+sDPu8c2gQ1f9kV7EVhf1hh/d44Ghsx+UPmfSY258wKQAAAAAAAAAAAAABQOx9Tf2eLkd94HnPU1NB5Zam/s8XI77wPOepqaAKucYAAR+g0M9kc7Lt3+8LfvEY3zfoNDfZHOy3d9f+gt+8RgNXXZwHbYgGTM52/kx950D5aJ5zqBh3Bkx950D5aJ5yt0p7GOtnNZvdI/dHhLkikKqLUmkoWEUigJxkgozhCgApBxgFIVSVAilqQKErjQgAFBCgAQAAQqEghaEwAFKiqQpCFRC5iIoUC64a7gIEQCqiuwVcDltxr9XpujGatkWrFbAr7qVjKsSC7+yubjQ4kjkQy160wUmKqqZzpnJ927ty1Vwrc5TubhZKsrljXwVlnTSNs22FzS73VZG+Tcuf9VcTsvXV0Hng2NFhxGxWPcx7FRzXNVUVFTMqKmZTaXU8ZVHXogJdu349bagMrAjuzzcNM9f+Y3Tupjul1gsdNcxRc2/FtdD6bm/MWb/AK3RPx/LunEucjcUwMqULRpk4AFoAChOIIAC1VDqLVMXMbb1zVtyVha60bJRYlUTF8Bdu3wbZOJTt3gPlMwIcaG+HFY2JDe1Wva7FHIqUVF40OK9ai7RNE9Lr4vD04mzVaq6XnvThMVOS5TLvuurfm1bEoqQoEZXQFX86E73TF5FQ43nMrVTNMzEvLLluq3XNFW2OZiqgq0IHwEKAIXAACFBAKQKEogDRiEBUAF0EqK+ECkFQiaQLXADwAAAAAbt0XhAzLUDc7U9xki5H7Ax2kFzOR6odg6Dq7UyxUiZIbObX8nMR2L4IinaJqMNOdmnqh6lo+rhYW3O6PAUUHGDndwAQACOzoZEXOBqDqn263K7OqqbeUl1/wAFDq87b1VsHqeVBkSn5WzoS8iqh1LQy2KjK9X1vMNKxljLnXLGgKuci0OBXgUmYVrnJSFJhoH0gC0wIhloCEpwnPtT3D6rlfsHTrYkR/IxTgS0OyNTRD1+WGysNpBju/wHLY57tPXHi72jY4WLtxvhuJDMjFpkap6jCkFMM4AAKABxjKnF6hk4vDE3LPjfVocnOEZcYvUckl5n1ovWTmp4VRDivzlbqndLr4qcrFc7p8GkrUo1qbiIn0GShUo5QZR5TMsVQ5jkRekPKzdl27PtbytVDh6nIsl0frfKPd2Mq0RlpQVr4aHJanKunrjxdrBVcG9TO+PFvZBSjDJQn7VBrHqgAMAAAAqH4t826+61st3ZCN9RT9nSfnXhZ1SxrRh9vKxW8rFPiuM6Zhx3YzomHn/B/JM/Ub5kMjGGlGNT+aifQZVMm8nr2pUYAEPkCEBIaQowADAqEQyRACm12pNZrMmUV/6S0430I01RXcNtdS1DVmSiVd285MOTlRP2Fho2P+b7T5NDq3H/AOr7T5O2s4QLmCF+3oEAAAcYAj9opq3quYtb72XC/R2dXlf/APBtI5PcrQ1M1VsTX5T2w6/k7OgIqbiqr1K/SU5Wfuo9YZywc9cOr7FxtqT+U/YprtPf7TG+Ud51NhrGXW2xKLuRP2Ka7za1jRF3XuX6VOtorbV9vNUarR/yXeqnxqfApAXLZgBUA2U9jyWmWK0+8sX7Rhv7BX3KnnxqCbVsix8q9pzVr2nJWfBdY8RjYk1HbDa5yxGYIq6cDeJl/rlNRdde67yf9yhekDlIRMTiy5Q7jIuN8Lv84w/SEyi3G7sLv84w/SBylQhxf2w7jL/K+73OMP0j2wrjp/K+7/OML0gcoGg4t7Ydxu7C73OMP0j2xLi19+F3ucYfpA5SMTi3th3G7sLvc4w/SVModx0/lhd7nGH6QOUA4wmUO5C/yvu/zjC9JUygXIVaJe676r3xhekDk3gHEfy2baElaclDnbOm4E3LRKqyNAiI9jqLRaOTBcan9IFAAAAYgAfKcmZeTk4s3Nx4UCXgsV8WLFejWMamKqqrgiImk467KBchq43vu8n/AHGH6QOTjE4x7YNyNF77v84wvSEyg3IT+V93+cYXpA5ONJxhcoNyO6+7/OUL0l9sG5Hdfd/nGF6QOTUBxj2wrkd193+cYXpJ7YNx6+++7/OML0gcoBxf2wbj9193+cYXpKmUG5Hdfd/nGF6QOUUMIldapxv2wbkd193+cYXpC3/uU5tG3tu+q98oXpA0w9kNd/rbsVP+hs+2iGsD9spsjq9bWsq2MqljzNlWnJT8FljMY58rHbFa13VXrRVaufE1tdtlAgAAApAKCAAUEAFIAAAApAAAKQCkAA+svtlPUbU19gq5XemF+08uZfbKeo2pq7BVyu9ML9oHZYCgAhq/7Ir2IrC/rDD+7xzaFDV72RXsRWF/WGH93jgaGzG3PmfSY258wAAAAAC8oIAAAAAAAAAOx9Tj2d7kd+IHnPU5OA8sdTh2d7k9+IHnPU9AGkFIBH6DQ32R3stXe7xN+8RjfJ+g0O9kd7LV3u8TfvEYDVx22UhXbZSAZMzncGTH3nQPlonnOn2ZzuDJj7zoHy0TzlbpT2MdbOaze6R+6PCXJFAUnEULCAUAkKggJFAUhAAKAAoAAGkAkMSFIqEJAC0JEABAAAAVCFQkUVIKkIyWoxIVAGkhagkESp/fYc5NWTaktachHWBNy0RIsGIn5rkzeDQqbiqfwofRHoiEZz0Jiqqmc4lvdcO8ctei6dnW5KtRqTUJFiMRa9TiJg9q8SoqH76muOpEvM/rm17rxnqrXMSdlkXQqUbET6i+FTYti65Kmnw130tqKul6fo3Ff1WGpuTt6etlVKgUB2HeFzApABHpVtC5gBrZqv7DZCtCxLfhto6Ox8pGomdW+6aqrxOVPAdCaDbzVO2ctpZKJ6MxE11nxoU0mGNEdrV+h/0GoSaTO6Qt8G9M/Hnefaw2PR4uao2TET5BCqY1OiolQKSoUkUmfOECAACgSgKpFAaAhEKtQBSIUAUAAAQC0CkqVeMAg0EQLmHSRtbV6lCZSLk1jwK1WBaMRF/tIjjuXQdB6j2Y1937fk64w5yFFRP1oaJ+w790GlwU52KXpmiKuFg7c7kAB2lkUFB4RiAQpFC4NA1d1XkLW34smNT8pZqpXhSIp0od+asKWpP3dne2hR4XIqOOg9BmcbGV+r/eh5tpunLG3OvyhFzkKQ6qpQApKUGBSAVApCpmIQKdq6lWH1TKvDfT8lIR3ctEOqXZjufUiSyvv5ac0qYQLN+tERP2HZwkZ3qetaaIp4WMt9baimBQuKVCGnelgwGkoEpuBQACHWeqQmeoZIbYb+mdChcr0OzTpvVXTXUMmcOXRcZm0YSeBtXHWxc5Waup0NJ1cHCXJ3S1VVUVVUxUJmBmHmE80pwn6F2YvULx2ZHrTqc5BdXieh+epZeIsGYhxe0e13IqL+wmJy531bnKqJehqLjhumR/HZMfriz5SOmPVYLH8rUU/sXOa6JzetUzwozAE3RnJfRpAAA/mtBmvlZhmfXQnJ/hU/pQxVKrjmXAiYzhExnDz2mWdTmY0PNrYj28jlQ+R+jeaD1teO05en5Odjs5Ijj84yMxlLyW5GVUwAEUh8ikAJQoCAClqYlRQKlKpxm4upxgJAyQWGtKdVSLE46xF9Bp0qadw3byLyiyeS27cu7O2RY7+8qu/aWejI/5J6ml1YjPEVT8I84c0UJmKpFwLxuQAAFAQAFU041S011zletRP0MODB5GV/8AI3GdnRN00iy1TKTmVa8cZFqnXqsReBrWt/YVelKsrdMb/Jm9Zq+DhqY+M+UuMWMlbYla9v8AsU11mvysT9d3nU2JstaWnAXhXzKa6R9s79ZfOcWittX283Q1W9e71U/+nyABctmAADJFVOHjQa5dxvIhiAMtdwJyCq8HIhiWoDXLwcgqu4nIQAZVXg5EGuXcTkQxAGWuXcTkQa5dxORDEAXXLwch9IS1Rao1fAh8j6wMygelmoudXU5XXwzNmEwT+kRDuU6a1Fif/TjdjimPt3ncoALnAQAFCjQBwPVBOpkKv13gnPsnHlS9cFwbyIequqE7BV+u8M59k48qX6eMCa5dxvIg13AnIhiALXi5Brl4ORCADLXLwciDXLwciGIAuuXcTkQuuXg5EMS4AXXLuJyISq8HIQAWq/8A9QEAAAoEAAAAAACgQAAAhdBAAAAAAAAAPrL7ZT1F1NXYKuV3phftPLqBtlPUbU19gq5XemF+0DstQFAA1f8AZFOxFYSf/wCQw/u8c2gNX/ZFuxHYP9YGfd44Ghsx+UPmfSY/KHzAAAAUEAtAQAAFAAAAAAB2RqcOzvcjvxA856nIeWOpu7PFyO+8DznqamgC0KlCYgDF+dDQ72Rzst3e7wt+8RjfJ+g0N9kd7Ld3+8LfvEYDV122IZO2xAKzOdv5MvefA+Wiec6gZnO3smXvPgfLRPOVulPYx1s7rN7pH7o8JclUV3CKQomDyZEUYkCV0hCAkWpSAgVQQqBCFKhFAnhLSpMSoSFC0Mm4maMqmCEPmasnzoSin1cxUTMfNXUziCJzYqlCFqijWkvtjRSlTWl1ulAjNjQYGSpQxICiELVdwhKVBAqkC6RgQAZIq0ItVCGTUSoQ51qf7QdZuVmwomuVGRozpd6JpR7FSnKiG6yUTBMDQ64sXre+ViTCKqdTtGXcqpnp1VtfOb3192pdaKqzoqje22q92a7NdPwnxj8MzFM5VUFq1AtAgHEACFFQONZSJRs5cK8Ms5EXX2dHpVNKMVU+lDRNu0bxIegFvwUj2HaEFc0SWisXwsVDz+RaJrdzD6Sk0rH66ZY3Wmn9durrFUhVIpVsoVBCoAKNACFAzhUAZiVKqCm4BAnCZaBQZmZRARcCVAteAVCKAFQKbiFoBM4xBc4AUIWuAHfGo6mkZb94JNXflJWDFRP1XORfOhsvWpqHqWZ5JXKtBgOdRJuSjQUTdVKOTzKbdQlqlTQaNqzsZfCZehavXOFgoj4TP8+bIAHfXggAAEdi1S4hcUA6H1Xssr7rWHNI2qQp97FXc1zP/g1rphgbc6p6z3zmSabisRF6zmYMwvEiq1frGo78MNwzukacr878nn+slE04zP4xH8PmucVKqmJ0VAoIKkpXHdAQhAucUUmBkgQIhsFqP5P3d455UzJAgIvK41+qhtFqSpF0G4loTqpRJq0FROJjUad3R8Z34+671fp4WNp3Zz3O6m7VBXENTApo3ogB4AAw0DhAAHQWrDm2tsm78gi4vmYsZyfqsonnO/HrRDV/VfTyRr5WRItdXreQc9yVzK9/oQ6OkauDYn7KfTtzgYGvflHe6SWlMDFQKmdecpUjsUpuopkET3SLwkw+qZylvRktnltK4F351yoqxJCFXwJrf2HKV4jrPU0T3XmSOzGqtXSj4stxa11f2nZfCanD1cK1TVuh6lgq/SYeir4xHgfQADmdoAABAtESo0mMb8mBo1lclescpt45ZEojbRiKnE6jv2nFlOytUxJJJ5XLReiUbNQYMwnDVqov1TrRTK36eDcmN8vLtIW/R4munfPiikVQDidNQqkAFXjAQoQIplgREFFqB9GMV7ta1MXYJ4cDfm6sr1ldqy5TW61YEnBhqm5RiGit1pV0/eWzJBiVdMTkKGnhehv1DVEq1EoiYIW+i6eeqepr9VreXpK+qPF9K8BNBClw15QaQFAAcJQPnEWj0VcyYmgt8JxZ291sTVfys/Hci8HVHU+hEN6r0TbLOu/aNoRH61kvKxYiruUapoAqq92vcqq53unLwriv0qU+lJ56aetk9Z64yoo658H3kHIk9Ccq4JXzKa8xlRVcqZqr5zYKVVUmWqm476qmvj8W1Gio9b7ebi1Wj9V2f2/+nzABcNiAACkKQAAAKQAAAAAAAvgPpAzKfI+sDMoHpZqLf93C6/FMfbvO5TpvUW/7uF1/1Zj7d53IAGkBQCjQABwLVCdgq/XeCc+yceVL8y8Z6q6obsE367xTf2Tjyqfp4wMAAABSAAAAAAAAAAUgAAAAAAAAAAAAUgAAoEKQAAVSACkAH1gbZT1G1NnYLuT3pg+ZTy4gbZT1I1NnYLuT3pg+ZQOylChc40AU1e9kV7Edg/1gh/d45tCmY1e9kV7Edhf1hh/d44Ghsxtz5n0mNufMC+AhQAxIAAAAAAuAEAAAAAdj6nDs73I78QPOep6Hljqb+zvcjvvA856m7gGQUgUCP0GhvsjvZbu/3hb94jG+T8yGhvsjnZbu/wB4W/eIwGrrtsQrtspAMmZzt/Jn7z4Hy0TznUDM529ky950D5aJ5yt0p7GOtndZvdI/dHhLki5yVoVSFEwhUVICRRUYAgFQqEKgDSAWgEqVFFCo0IZM1qrQ7OuVkVvDey7crbsjaFmQJaZ12tSK5+uTWuVq1om6h1gjaLVDcDUxzfV8kcjDXPBmZiGnF1RV/advBWaL1zg1fBb6EwdnF4iaLuzLP78zq+Dqbrxri+8VkM/VhxHH90DU42iifw96pVF/mSjl86myKKlCK1FLeNHWPh3tbGr+B6aO+Wv8HU4QFb/D3sj1/wCXJt/apmmpqspVrEvTaC/qyrE/ad+UpoKiH1GAsR/b4uSNB4GNlvvn+XR0vqb7rs/K21bET+439h/fB1PNzG/lJ22Xp8s1P2HcmG4RVpmJ/orHyuTifBfTh1LD1PuT5q+6h2rEX+dOqnmQ1TtmAkpbE5KwkVIcGYiQ2Iq1WiOVExPQRXomc0SygwWSd+rek0ZrEhWjHajV0Jr1K/SVmi3FPAjLaz+sWDtWKLc2qIjnlx2u6ReMyemkwXkKpk4AAEhQuYhIFQgIGaIMTFFoVHVUIyfrXUcv75rKb/Tpf7VpvwmL1NFsmcl+6N/rAk6KqRLRg1RNxrtcv1TevW+7UudFR+mqWz1WpmLdyd8KAqAtmrANAAZwAnGB/JajkbZs0q5kgvVf7qnn0uKqqbq+dTfi+MXqN1LZja6nU5CO6u5SG40HZXWpXcKTSs/qpjrY7Wmr9VuOvyRUBVJQqmSYlpUYjTnJSqIKcQxCouglAi0Kj2nJ8lFmydq5R7As60ZaHMykxOtZGhPSrXt1rlovIhtkzJXk+1yp+9KyUp/yl9J2sPhKr9MzE7Fxo/Q9zHW5roqiMpy52lTWo4Kyhux7VtwEzXTsrxS+kqZLrgqnvTsnxK+k5+K7nzQ7vJbEfPHf/DSRcCa5DdtclmT9f5J2V4pfSYrkqyfdyVleKX0k8V3PjCeS9/5o7/4aS0qYuRWm7iZLMn6L70bK8UvpM0yWXAVPenZPiV9JPFdz4wnkxiPmjv8A4aPtfifVKKhuvEyWZPke1FulZKoqp/wl9JppeSXbLXitKBAYjIUKbisY1uZrUcqIiHVxOEqsZZztV2kdE3MFFM1zHO/kVDHExRV0l1x1FTkEqVMS0JGCLiZIWlAByvI9aCWTlOu/OuWjWzrYbuJ6Kz9qG8UNutReM895OYfKTcGahrSJAiNitXhaqOTzG/tiT0O0bJk56E9HsmYDIrVTTrmopc6Lr5qqfu2erF7Oiu38Mpf2gU3RhuFs1YMBhujwgRSoPAEzgccymWelrXEtyzaIqxpGLSu6jdcn0oaLIqqiKulD0IjQ2REc17UcxyUci5lRcFNDr6WW6xL22tZERERZWciQ0pmprqp9CoU2lKOemr7MfrTa9S51x5/y/FWpEzn0VDFUKjNkM2KigXDMSvASlSoRVJXwAZYBV3DFHKZtSqhGxgirrkrmN1MgNn/uZkpsOC5KPjwVmHYaXuVTTizpB8/aErIwU/hJmMyC3jc5E/ab72VJss+z5WShoiMl4LITaJRKNRE/YWmi6M65r+ENXqva4Vyu78Iy7f8A4/t00BKlLttAYgABpATOBhH2mFTTbVG2iloZXbWRu1lUhSqcbG4/S43IjxYcKG+JEcjWMRXOXcRMVNB70zz7XvNadqvesRZqbixUculFctPooVWlK4immn/f952Z1mvRTZoo+M+H/wBfmKhjrVPoRVKRhs2ObOZIqGK7qEVcBtTlm2X1IFprFu5blluiV63m2RmN3Ee3H6UO+W4tQ1S1JVppLX+nbMXaz8itMfzobtd5lU2tRKNRKmj0fVwrER8OZ6NoO5w8HTHwzhQAd1cAGJQCmL0qlCjMBrPqw7OSFeCwbTbCokeViwHvpnVrkcn0Kp0OiG2Oqosd1pZOEtFjVWJZc2yOtE/Md7h30LU1TVtEopm8fRwb8z8XnmsFr0eMqn45S+LkMVUydnMTqKUQAAAKlAVMkcY0TjIrVzoDLN2FqfrNS1MrViN1tWy0R007g1jVVPpobmwm0NZ9R/ZDolv2zbsRiKyWl2SzFXt3rrlp4ENnEoqVQv8ARtHBs5/Gfw32rtn0eE4U9Mz/AAYDMB4KFgvziFUAzAAAqYAcA1QFqfubkkt2Im2jwUlW8cRyN/aaWKnulU2c1XtqLLXWsix2xFR81OOjPamlkNq/+Soay1SnCZ/SNWd7qhgtY7s14rgx0Rl5spaiRq7jXfVU16dtTYOHVHqqdo76qmvi7RDsaK/u+3m7uq227/j/AOmABS4bBAAAAKBAAABSAACgQFIAPrAzKfI+sDMoHpXqLP8AdxuvxTH27zubgOmtRZ/u43Y4pj7d53KAAqAFRoAA4DqhewTfrvDN/ZOPKp+njPVTVD9gi/XeKb+zU8q4mdeMDAAAUgAFUEAAAAAAABSAUgAAF8BAAAAAAAAABQFAgAAAFqBAAB9IG2U9SNTd2DLk96IPmU8t4G2U9SNTb2C7k96IPmUDssi5go4QCGr/ALIr2IrC/rDD+7xzaFDV72RXsRWF/WGH93jgaGzH5Q+Z9Jj8oYIAICgQAAAAAAAAAAFAAHZGpv7PFye/EDznqah5Y6nDs73I78QPOep6aAAAUDF+dDQ72RxP9bl3+8LfvEY3yfoNDfZHOy1d7vE37xGA1ddtiFdtlIBkzOdu5MvehB+Wiec6ibnO3cmXvQg/LRPOVuk/Yx1s7rL7pH7o8JckBaEKJhAcIGcBnARBgBc4AxAFoAikoUyauBiVMxCH0RyUNntSPNti3EtSUrV0C0lVE4HQ2L56mrbjvbUd2kjbdt6x3KuumJaFMM/sOVrvoe07mAng343rrQFUW8ZTPxzjubMNqZhqUQZjRvRQVC4gC1JWo4xTcA+cVPc4GmuqOsh1mZWrUe1jkhzqQ5tirp17U11P7SONzV4TonVZXadN2PIXql4aq+Sd1tM/JPWrF4kdVP7R0NI25qs5x0c6k0/Ym7hJqp208/8ALWZK0xCn2eiUPi7gM887ic0VCDEtKkvpjiFLShFAAJiWhIIiKXWKuYlcTOG9KogOfodp6lyx4loZToU65q9SsyXiTDlphrnJrGp9LuQ27a6ra6TqHUvXY/ca5L7amYStmbZekRqKlFSA3BnLi7wnb1KZjQ4C3wLMZ9PO9F0Hh5s4SM456uf+O5kiqRVBTurhB4QABUHgCrRAOGZZJ79z8mN5JnHCRfD8L1Rn/kaRptabiG1mqxtRsnk6g2cyI5sW0Jxjdan5zGIrnfTrTVFKopQaSqib2XwhhNZbkVYmKPhHiKYmS4hUK9nGIopS5wKhmlD5ohcQhzPIqirlYuyn9OT6jzdhm2XjNKMiHZZuz8+T6jzdiHt1LvRXs6uvyhudV/dquvyh9EThIoBaNMYgAC0QioqBRxgfKIq9UbXdTzmhV6X1vXa6f06N9dTfaL+UZxp5zQe9baXstf5/G+upUaV2U/fyZTWj1KPv5PzXJuGNDOpjnKZi4lBUEUlJUqKYlQDJEqqVzG5Wp3tRbWyVWQrnIsWSR0pExqvuFolfBQ01rQ2D1H9upr7du+96Yoydgoq/2H05EU72j7nBvRHxX2rt/wBHi4pnZMZebYxQRi1ail0mhegAAAAADGJtaIar6qi77pG/cC2YbKQrTl0VyolE6rD9yvhVKKbVZ1Ousv8AdZ957gTXW8FHz9n/AOVS1ExXWp7tvhbXkOnjrU3LMxG2OdVaZws4nCVU07Y54+zTp7aHzVSxIlcDDBTNRzPNYpmNp4COQqhEJSwxKiIZ60mtoTmZoiH0autU+S1QxWJwk5ZpinN2nqb7DW3MpkpMPh66XstizkTDDXJ7licq/Qbfsqrcc51DqX7qOsO4/wC7E1BVk7bDki0clFbBTBieHFfCdwIaHAWvR2Yz2zzvRNBYX+nwkZ7auf8AjuShQWh3VygAoAUAOWjagcSytWuthZPLctLXtbEbKOZCrpe/3KInKaRtTWtRu4lDZfVbW51C7Fl2FDiIj52ZWNFbp1kNMP8AEqGsr3Y5zP6Sr4V7g/CGC1lv+kxUW4/tjvnnYuMFVTJXGCrU6EM9EGuULiSiqZNTdBscryPWolh5SrBtB7lbDbNthxKdq/3K+dDeSGvulbuYHnvBe6G9sSGtHsVHNXcVFqn0ob33EtiHb10LKtqG5XddyrHuVe2pR30opb6Kr9aj7tjqviM4rtff+fJ+3xgKvhBcNaVATELQABpKoH5d57LgWzd6fsiYajmTku+CqLwph9NDQq0oMWSnY0nMJrY0CI6FERdDmqrV+lD0GelcV0Go+qdui+xb+utmXh0krYTqqKiYNjIlHt8ODuUqtJ2s6YufBmNZcJw7dN6P7eb7T+XU6qEQ+iQ1RCLnKRiM4YLnIpXDDdJSgMipQIzY4ofSG5K45tJGtqchydXXj3svnZ1iQkd1ONFR0w9E2kJuL3cmHhJpp4U8GH3atzdriinbLabU7Xe/cPJjIuis1kxaDnTkRFSiojtqn91EXwnZFKJQ+EnAhS8CHBgNRkKGxGMan5rUSiJyIffE1Vq3FuiKY6HqmFsRYs0246IyKAVGY5HODOCgQj1RtCoYRlYjFe91GtSrlXQiZwiWqmqwtdJ/KLAsxj0cyzZNrVRND4i6530I3lOnHYKfvZQbZW8F97ZtjXI5s1ORHMVO0Rda3/C1F8J+EuYyt6vh3Jq+MvL9IX/TYmu58ZYo6iPx/wCG/wCqpr6u1NgH+5hxF/5b/qqa/rtSz0Vsq+3m0Wq3/b/j5sQAW7XgCFUCAACghQIAAABaARCkAA+sDMp8j6wMygeluotT/wCnC6/6sx9vEO5DpvUXf7uF1v1Zj7eIdyKACDAAOAaBpAHANUR2B7894pr7NTyrfnXjPVPVEdge/PeKa+zU8rH514wMCkAAAAAAAAAAAAAABSAAAAABdBAKQACggApAAAAApAAAAA+kDbKepOpv7Blye9EHzHlvA2ynqRqb+wZcnvRB8wHZSk0Bc4AIav8AsivYisL+sMP7vHNoENX/AGRXsRWF/WGH93jgaGzG3PmfWY258gAAAAAAAAAAApAAAKQDsjU39ni5PfiB5z1NTRxHllqcOzvcnvvA856mpo4gKAAI/RiaHeyO9lm73eJv3iMb4v0Gh3sjvZYu93ib94igauO2wDtspAMmZzt/JlT958D5aJ5zqBmc7fyY+8+B8tE85W6U9jHWzms3ukfujwlyVTFTJc5ipQsKnhAUEioo4iFAU4RmCgABXgAFKhiVAgXE7A1PFrpY+Vqx3viayFNufJxOHqjfcp/ea06/U+shMxpKfgTks5WxoERsWGqaHNVHJ9KIfdurgVRV8HYwt2bN2m5HROb0LY6qqhcT827Npy9tWBIWzKrWDPS7I7OJzUWh+kauJzjOHqlNUVUxMdJxjiAJfQOMCgCiKfw2/ZcrbNkTVkz0JIsrNwnQoreBUphwpnThRD+9COxw0ETETGUoqpiqMpaFZQLtWndC9U3YVoIqugurCi0wjQl2r0405FRUPxGoqpibrZWsntmX8sTreNrZa0ZdFWTnEbVYbu1cn5zF0p4UxNR723Vt26NrOs23ZF8vEr/BxExhRk3WOzKn0mdxeEmzOcbHnmltFV4OqaqYzonZu3S/D1tCLgfSIlD5aTpKSOditSUU+iNLRETElObBEKqEc9DHX1JyTETL6IypzfI1cCYvxeyHLPRzbLlVbFn4tMEZXBifznZuKqn8mTG4VvX7tRIFmwFhSMNydcT0Rq9ShJuJ2ztxENxbjXVsq6N34NjWTA1sGGmuiRHbeM/S9y6VX6Mx3sHhKrtXCq9XxX2h9EV4muLlyMqI79z9mWgw4EBkGFDbDhw2oxjWpRGtRKIiH1JxA0DfRGSgAJOIDwABiSJtFMqHwmo8OXhvixnoyExque9VojWolVVfAETOW1rFqtba67vfZliQ4mubISqxYjdyJEWv1UadKuop+1fu3Yl5L52tbcRXUmplzoaKtdbDRaMTwNRD8RTK37npLk1fF5fpHEf1GJrufGe7oYKM+kpNJxOkZsxUJpKgGRFAUgcyyI9lm7Pz5PqPN2oe2U0lyI9li7K/09PqPN2oe2cXmivZ1dflDcase71dflDPEDMC0aYHGB4AAAQD5xduzjTzmhN7PfZbHz6N9dTfaL+UZxp5zQm9nvstj59G+upUaV2U/fyZTWj2dH38n5bs5iZqpgpTQxcIqkqFFCUiFxIUAtVOcZCbbS72U+yJqJERkCYiLKR1XtYmCf4kacHqGvc17XMcrXItWuTQqZl5T6oqmiqKo6HPh7tVm5TXHROb0QaqbVNBcTiuSq8UO9NxLKtvXJ1WLARkdE/Nit9y9OVDlRq6KoqpiqOl6nauRcoiunZPOcQQEPpyLxKKDAqYAEVDGImuTPgXOReADUXVC5OYl17xvtqzYNLFtGKrma1MJeKuLoa7iLnTkOrupKiG/lu2TI23ZcxZlqSrJqTmGK2JCemCp+xdxdBqxlUyPW7dWPGn7GhRrXsWuuRzG66NLpuPamdE7ZPCUONwVVE8OiObwYfTWhrluqb1iM6Z2x8Pw6p1pFoZue2qppRcUXOh83LUrWYiJ6SuOYVRc5GuRVopm5jdbWtCUnU0chzfItk7mb7XshpGY5tjyTmxJ6LTBUzpCT+c76EPtkvyU3lvjOQ4z4MWzLHR38JOxoaprk3IbVxcvDmQ24ujd6yrsWJAseyJdIErBTNnc92lzl0uXdLHB4Oq5PCq9XxaLQ2h7l6uLt2MqPH8P0YEJsKEyHDajIbERrWtSiNREoiIffBEKqGNKl83cRkoIUJACgTOR6omBkfkXuteXsG7toW3MuRIclLvirXSqJgnhWhFUxTGcvmuqKaZqnZDVPVK2+lsZUJuVhPV0Cy4bZRn622f9KpyHWTlqfefmY09aExPTKq6PMRXRYi/znLVfOfBUMpcr9JXNU9LyzF35v3qrk9M5sVRSUMhgfDrAIpKgyfRHI3FM5tDqTrwpaFypuwokSsazJmrGquPUomKeBFqnhNWXKqnY+puvF+9/KdKQosXWStptWTi1XDXLjDVf7SfSdrBXPR3on48y30LfjD4qmZ2TzT925aYlzGMNVpjnMjSvRwZgF4QGI+kACLjoOL5TbpS187pzVjRkbDjU6pKxlT8lFTarxaF4FOUpiFaipRT5roiumaZ2S47tum7RNFUZxLz/t2RnLHtSZsy0pd0vNy0RYcWG781yedNKLpQ/MV9dJuRlnyV2ZfuV67gOhyFuQma2DNU9zFRMzIiJnTcXOhqdee6lvXUtJ0jb9nRpOIi0a9yVhxE3WPzOQzmJwlVid3xeeaR0TXgqpnLOnon+X5KIql1p92w6IYPwOqqM85fNWhG4mLnrWiH9NkWfaVrz0ORsuSmJ2aiLRsKAxXuXkzeEmKZl9026quaHza6iojUVyqtERMVU211Otwn3Vu861rVl9Za9pMRXscmMCFnazjXOvgPwsieRL9xJiBeK9jYUa0oa6+Xk0XXQ5ddDnLmc/gzId6I1ELnA4KaJ9JXHP0NloPQ02avT3o5+iGSURKIBQFq1IANIDEAAVDhOWi3XXdyb21PsfrI74HW8v8AKRPcp5zmjlVG1Q1x1Xd5WvmbJutBiV6kizsy1NCrVsNF/wAS+A62MuejszPSr9KYj+nwtdfTllHXLX2mtwTMmCEVVU+jqKfNUoZl5lnmxifkI1f0T/qqa/rtTv8AmHa2VjuTOkF6/wCFToBdqXGitlX2a/VbZd+3mxAKW7XIAABSACkKQAXwEAAAACkAFPpAzKfI+sDMoHpbqLv93G636sx94iHcinTeou/3cbrfqTH3iIdyAOIVAQAAAOv9UR2CL894pr7NTysfnXjPVTVD9gi/XeKb+zU8q4mdeMDAAAACgQAACkAAAoAgAAAAACgQpCgCAoAhSAXwAgAAAAAUAQAD6QNsp6k6m/sGXJ70QfMeW8DbKeo+psxyF3K70wfMoHZa8RAucoA1e9kV7Edg/wBYIf3eObQoau+yLdiSwf6wM+7xwNDpjbnzPpMflD5gAUgApABfCBUAQAoEKQAAAB2Rqb+zvcnvvA856moeWWpw7O9ye+8DznqamjiAoArgBH6DQ72R3ssXe7xN+8RTfF+g0O9kc7LN3u8TfvEYDVx22UhXbZSAZMznb+TH3nQPlonnOoGZzt/Jl7zoHy0TzlbpT2MdbOaze6R+6PCXJVMVMlMShYQIFBKQDwkJFKQEBpKu6QAKlrQhU4ghRxYAKu4SRLaPUn3mS0rpTV2o8X/KLLi9Ugoq54ERVVKcTtcnAlDu5FQ0byQ3qdcy/UjbDnqkoq9RnETTAdTXciojv7PCbvy0WFEgsiQYjYkOI1Hsc1ao5FxRUL/R97h2uDO2HoWgcZF/DRRM89PN9uj+H2wJUIoO+vAcIABRoA4wGtQ/gt2xbKtyzn2fa8hLzsq/bQ4zKpxpuLwofoVC4kTETGUoqpiqMpjOHQd89TtZ8zFfHuva75CuPW001YkNOJye6ROOp1paeQ/KHZ73Kyy4E+xFwdKzDXV8C0U3Fohdam4h0rmjrNXPEZdSlv6Awd2c4jg9TSSNk1v1BWkS6drV/mwNd5lPgmTW/kw/WwLpWuq/zoGtTlU3ho3h5SKicfGcMaKoz9aXRjVaxE58Oe5p3YmQfKFaMRnXMjKWbDXO+ZmEqn9luJ2rcjU7WBZ0RkzeWdiWxFateoMRYUCvD+c76DvFEREwRBU7FvAWaJzyz61jh9BYSzOeWc7381myEnZsnDk5CWgysvCSjIUJiNa1OBEP6FUuIO5HMt4iIjKAaQAk0gCgDSMwQoBVwOqNUre1LBuE+zIETWz1rqsuyi4thJ+UdyUb4VO0pmK2DCfFe9rIbEVz3OWiNRMVVeA0qyz3xdfS/MzaEJXfufL/AOTySL+jaq+643LVfCdDSF/0drgxtlS6cxsYbDTTE/qq5o85cKVE0YGOO4ZKYqtDPQ87RxAqgkVCmKFAyqAgzAc0yIdli7Xz5PqPN2Ie2U0myI9lm7Pz9PqPN2Ye2UutFezq6/KG41Y92q6/KGY0FwIWrTAQhVAYFJoAHzi/lGcaec0KvZ77bY+fxvrqb6xfyjONPOaF3tSl7LY+fRvrqVGldlP38mU1o9S39/J+S4xWpk5cTFSmhi4YhS4VC0oSlEKiERdwuu4AKiDW1JUqVJHf+pKvMkGdn7ozUajZhOupRF7dMIjU40ovKbIoqKmB5/XcteesC3pK2bPfrZmUjNiw9xaZ2rwKlU8JvTdG3ZG8d3ZG27OfrpechJEb/NXS1eFFqhd6NvcKjgTtjwbrV3G+lszZqnnp8Pw/YqAiChZtIJwCoAAaQAL4SORFxzcKAcYHDb25MrlXmiOjWnYUssw7PMQU6lE5W5/Chwed1Ot04j1WUtO15dtcGq9j/Oh3UpDguYWzcnOqmHSvaNwt6c67cS6Uk9TldNr9dM2pa8dNxHMZ5kOZXXyTXFu7FbGk7Cgxo7cUjTarGen97D6DnSCpFGFs0c8UotaMwlqc6bcf71sWMa1EREwRMOAyFRQ7DvGIwAQABpAAUAAKqIh0Jqs7zLL2VI3TlYv8JNu65mkRc0Nq+4avG7HwHeNpzkrIyMecm4rYUvLw3RYr1XBrUSqqaN5RLzTF7b42hbsaqNjxKQWdpCbgxvJj4Su0je4FvgRtln9YMZ6HD+jpnnq8Ol+A7AwV2Ic+pipQQwK1JUgUlJUUCgCoh9Jd0WBHhx4L1ZFhvR7HJ+a5Fqi8p8qlRykpiZic29mTO8rL2XMsy24aor40JEjt7WK3B6L4cfCcmXOas6le+q2ZeKLdSdja2VtNdfKqq4MmETN/aT6UNpGr7nOaXCXvTW4np6Xpei8ZGKw9NfTsnrZcYTAiYFOysQBQA4hXdAAioin8lpWXI2nKOlLRk4E3Lvzwo8NHtXwL5z+zSBMZ80omImMpdY2xkMuDPRHRYEhMWc9dEpHVrf7q1Q49F1Ol23uX/PVrI3c1rDvBTHE61WDsVTnNMK+vRGCrnObceHg6hsjU9XDlXo+c/dK0FT82NH1rV8DUOybuXasK7st1vYtlSkhDpRUgw0RXcbs6+FT9VCnJbsW7fqxk57GCw9jnt0RCKVAgOV2gAAAPAOJAACCuAHwn5qDJysaamYjYcCDDWJEe5aI1qJVVNEL+3hjXpvjaduxa0mo6uhIv5sNMGJ/dROVTYjVUXydZd2YV1ZSKnXdqIrpmi4sl0XFP7S4cVTV11VKLSV/hVxbjo8WK1kxsV3IsU7I556xCKlTHwipWsvk+c0lJKZ+QifVU6CXanfNqV/cqd+bxPqqdDLtS50Xsq+zYarR+m5PV5sQAWzWgAAAFAgAAAAAAAAAAqH0gZlPkfSE5ErUD0u1F3+7hdb9SY+8RDuSpqRqZcveTK5eRew7t3gt6NK2lKJG6tCSTiPRuuiucnukSi4Kh2Q7VTZGE/lPMLxWfF9AHd6riDo9NVRkY7pphP+3RfQZJqp8jHdRH5vjegDu7wEqdILqqMjHdNM83RvQTZTZGFxS8szzdG9AHM9UKlchF+u8U39k48q4qKiqnCb45YtUjkpvFkrvVd+yremos/aFlR5eXY6z4rUc9zFRE1ypRM5oY51VXHSBiAAAAAAAAAUCAFAgAAFUgAAAAUgAAAAAABSAAAAAAAAAD6y+2U9RtTZ2C7k96YP7Ty4gbZT1I1NyUyF3J70QfMoHZWI8IVSAVDV/2RXsR2D/WCH93jm0KZjV72RXsRWF/WGH93jgaGzG3PmfSP+UPmAAAAAAWoIAAAAAAAAAOyNTf2eLk994HnPU1p5Y6nHs73I78QPrHqcmgC4gACPNDfZHOyzd7vE37xGN8n6DQ72R3ss3e7xN+8RQNXHbYhXbYgGTM52/ky958D5aJ5zqBmc7eyZ+8+B8tE85W6U9jHWzus3ukfujwlyWpApChYQACkgEUhSQqAVCAoAAgoUgAoIMSRa6TZzUuX+baVk/vNtKL/lsizXSDnLjFgJnZxs+qqbimsZ/ZYloztj2tLWpZ0w+Xm5aIkSFEbna5POmhU0oqnNh782a4qhYaNx1WDvRcjZ09T0ETFCnC8k1/LPvzd5s5BVsK0IKIydla4w39sm6xc6L4M6HNeI0tFdNymKqdj0mzeovURXROcSgAPtyiADQA4goxCABiUgAIgCAMAMBpAAAAgUAACigEDna1KlXA64y05SZO49kLCl3MjW3NMXrWXVaoxM3VXp2qaE0r4T4uXKbdM1VbHDiL9vD25uXJyiHCdU9lF6xlH3LseP8A5VMsraMRi4woa5ofG7OvBxmtmOk/pnpqPOzkacm4z48xHesSLFetXPcq1VVP5lVDMX78365ql5rpDHV429NyrZ0boTFSKVVIqnE6LEFJ4CUqhSJnLQIZIFJxqVKIuJCHMsiOu9tm7K6Ovk+o83ah51NErkW6l3L0WdbjZdJl0lG6qkJX61H+5VKV0ZzuN2qPmUqqXUg1X+nL6CywGKt2aJiucufyanQOk8NhbNVF6rKc/hPwbGqgRFNbtklO6Lpy/lzvQXZJzncnA8tXolhxhh/j3SvePsD8/dP8NkaEVDXDZJzfcpA8uXol2SU33KQPLV6JHGOH+PdJx/gfn7p/hscVDW9dUhO9ycv5a7okXVJTifyTgeWr6CeMMP8AHuk4/wAD8/dP8NjY35RvGnnNCb3uVb3Wx8/jfXU7q2SEyqoq3Tg1Rfhq+g6Ltic6/tWbn+ppDWZjviqxFrrdctaVK/H4m3eiOBObP6e0jh8XRRFqrPLPol/I4wxMlUlalbDMoRSqRVD6QqcJCgVEMkoYJUKqqEM9ch3fqWr/ACWba77n2jGpKzz1fJOcuEOPpZwI5MeNOE6MxU+kv1SFHZGhRHQ4kNyOY5i0VqotUVF3UU5bN2bNcVw7mBxVWEvRdp6HoexcMc4VTrfIblCg30sDqE5Ea225JiNmoaYdVbmSK1NxdO4p2Oaa1cpu0xVTsemYe/RiLcXKJ5pChELRTkcyAVAADQEAAAAAAFAFzDABnzAIKAAMRiBSOWjalOE5XL9SdyLtPnXa2JaMZFZJS6rt302y/wA1udV8B8XLlNumaqtkOK9eos0TcrnKIdY6qe/jYUBtybOi/wAJFRIlpOau1bnbC8OdeChrmqpU+9qTc3aFoTFoT0d8eZmIixIsRy4ucq1VT+Wpmb96b1c1y800hjKsZem5P26mSoYqhEUtThdJKkqFBKTOC0GYIEQqU0k0BKkD7yUzFk5uDNS0V0GNBekSHEbna5Fqi8pu1kkvnK31uhL2q1zUnGUhTsJF/JxUTHwLnTjNIESpzTJBfebuJeqHPIr4lnR6Q56A38+H2yJ2zc6eFDt4PE+gr59krnQ2kf6O9lVP6Z2/y3e0EU/jsm0JS0rOl5+SmGTEtMMSJBiMXB7VzKf1pWpo4nOM3ocTFUZwoQBCUg8A8IAIAowAClRpGAAAAAAAAHEAAGcAfn3htaQsSx5u1rRjpBlZSGsSK5dxNHGuZD+96oiURUReE1S1SWUb98dq/vasaPrrKkYlY8Vi4TMZMPC1ujdXHQdbFYiLFGfT0K/SWOpwdma529Eb3Xl+7yzl7b1ztuzq0fMP/g4dcIUNMGMTiT6VU/BXFTBMC5zNTM1TnLzS7XVcrmqqc5lHIQqopKYkPl8LUVEsmdVc3W0T6qnQq7U75tZP80T3zaJ9VToZcxc6L9Wr7Njqt6lzrjzYgAtmsAAAAAAAucCAAAAAKQAAUgAyR7kzKvKFe5dK8piALV26vKXXO7ZeUxAF1zu2XlMke5NK8pgAMlcq6TEAAAAAAAAAAAAAAAAFAgAAAAANAAAAoEBUSubOcyyT5Nb1ZTLytsS7MkkR7ER8zMRV1sGWZ2z3aOBM66AOGFopvVdLUYXSlrPal5bxWtPzqtTXrJo2BCYulG1RVVOFaH6ztRxkyrhaV5E/9yzogefwPQHYb5M1/wDud5PKIfRKmo2yZ0/jK8nlMPogefoPQFdRtk03zvJ5Qzok2GuTRf8A7peTyiH0QNAKKKG/+w2yaJntS8flEPomTdRvky02leRf/cs6IGhFnSk1NzcGVk5eLMTEd6Q4UKG2rnuVaIiImdVU9Xckt3Zm6+TO7N35unXVn2ZAgTCIqLrYiMTXpVNCOqngOM5KsgWTrJ1aKWrY1mRpm02pRk5PxerRIW7rMERvGiVO1WtRuZAIqLUUVC+EiqgEVaGrvsi0Vjck9gQlc3Xut9jkbXFUSXjIq/SnKbQvwbU0r9kjtqDEtW6N3Ib0WPAgR56M3SjYjmsh8vU4nIBqHH258zJ61WpiAAAAAAAAAAAAAAAXAgHY+pw7O9yO/EDznqduHllqb+zxcnvvA856mpoAoUcAAj9Bob7I52W7vd4W/eIxvk/QaG+yOdlq73eJv3iMBq67bEK7bEAyZnO38mfvOgfLRPrHUDM52/ky958D5aJ5yt0p7GOtnNZvdI/dHhLkQMlQilEwqABcwAAaSQRCjwggUEAQAEXOBVFBgKkpVDJMMxBUhD9y595rVupbcG2LGmVgzEPBUXFsRuljk0tX/wCUNvslmUSxb9WT1aTekvaEFE66knuq+GvbN7Zi6FTwmkan9FjWlaNjWnBtKypyNJzcB2uhxYTqOb6U3UXBTt4XFVWJ+MLjRWlbmCqy20ztj+HoQi1xMjpDJVl2s21mQrNvf1KzZ/atnESkvGXh/Ru+g7shRYcaG2JDe1zHJVrmrVHJuoqZy/s36L0Z0S3mFxlnFUcK1Vmz8IXEKorU5XaAKgAAMN0B9IwGAAeAZxiMwAAANJQgVUAEVUalVP5bUtCSsySiTtoTUGVloSVfFjPRrWpwqprzlUy+RI/VbKuNrobMWvtOI33S/JNXN+svgQ4L+Jt2Yzql0sZj7OEp4Vyft0uw8seVay7lSr5GTWHP269v8HLovuYFczoqpm4G51NSLctS0bcteYta1puJNTkw/XRIj1z8CbiJoTQfCYixY8Z8eYjPixojlc973K5znLnVVXFVPiq7pn8Riq79XPs+DBaR0pdxtfPzU9EKpiqFQVOurEoKBeAlQKBUgFLWmgxLoAootQmcpKFSplVTEVIQyUhK7hFUgWtCo4wFaE5D61MVcY1GcZBrlLWpiAllTAioKqSoEXOQqkUJAASKlCmOkIBkhkj6GFApCMn6V3rw2nd22Ze17HmXS05Luqx6YoqaWuTS1dKG4eSLKPZV/bH6rBVstakBqdeSauxYvbt7Zi7ujMppTSq4n6d3LStCwrVgWpZM3Fk5yA6rIsNcU3UXdRdKLgp2sNi5w87lvozStWAqy20zth6ANzVC8J1Jkoy0WTeVINl28+FZlsURrVVaQJhf5qrtXfzV8B2zrkU0Fq9Rdp4VEt/hsVaxVHDtTnDLiBEUpyuwAKAAAADwgAB4QKAFAUlQMsxFqhEcnhOssq2V6xbow4kjIPh2nbVKJAhvrDgruxHJm/VTFTju3aLVPCrnJwYjE2sNRNdycocgyl36se49hutC036+O9FSVlWO/hI79xNxu67Qac3yvZa977fj2zbEbXxYmDIbdpCZoY1NCJ9Oc+F7Lbta81sRrWtqdiTc1FXbOwRqaGtTM1qbiH5CYZjP4rF1YictkMDpTS1WOngxzUx0ecvo51T5uQqKRVOopkqTOFQUJfQUIUIQhVAScRkhihcxCGVaFSJQwVSDJGTtnIXlZi3PnG2NbER8WwY789KulHL+e1O13W+FDbORmpeclYUzLR4ceDFYj4cRjqte1cyoulDzzRuOGB2Xkfyo2xceM2Tj6+0LEetXyiu91CXS6Eq5l/m5l4CxwmO9F+ivZ4NNojTf9PEWr3q9E/D8NySH4l0L02Hemym2jYs6yZgrt25nwl7V7c7VP2q4YKXlNUVRnE8za0V03KYqpnOJUYkQuc+n2ZxxhQAAABQoHCBSAABxFQKnCBCK5G4VP4rZtWz7Is+LP2nOQZSUhJV8aK7WtT0rwGr+WTLfP3h6tYl1urSFlOq2LML7mNMp/wCDF3M68B18RiaLMc+34OhjdIWcHTnXPP0R0uR6oDK66KkxdO6k3VuMOfnoS59Cwoap9LvAhry5FQrHqiUCrUzt69Xer4VTz3G467i7s13J6tzDEIplrTFUocTp5rUtTCpUUGT4Wp/FM982ifVOhV2p31an8UT3zaJ9VToVdqXOi/VqbHVb1LnXHmxABbNYAAAAAAAAFoQIAAAAAACkAFIAAAAAAAAAAAAAAAAAAAAAAAAABSAAAABSAAUVIAPpDYrmqqZ0zHp3qWLjSVyMjViSbZdIdo2hLsn7QiK2j3RYjUcjXfqtVG04F3VPMiW2vhPXK5fvYshP6BA+yaB+5mShipaFRAIiFLoIAFQKABQACkqFCACKmBklCPWjcM4HxjvhMhudFiIxjEVznOWiIiZ1U8ttUNfv2wcrVu3hhvV8i6N1vIYrTreH7lipXNrqK+m69TbPVw5XoV2LqxLhWHMIlvWzBVJ17HYyso7BUXcdEzJ/N1y7hoREcrqIugDFc5AAAAAAAC+AEAAAAAAABSAdkam7s8XJ77wPOepqaDyz1N3Z4uT33g+c9TE0AXSFUACP0Ghvsji/627vd4W/eIxvk/QaGeyOdly7/eFv3iMBq87bKQrtsQDJmdTt/Jn7z4Hy0T6x1AzOdvZM/efL/LRPrFbpT2MdbO6ze6R+6PCXJakUq8RNJRMIgCgAAgAF0EKgAABAUgApAigB4QDEJZJiVDEqKoGSOVDl9xcpl7bmvayy7RdEk0X3UnMViQV4kzt8HIcOrUqJUmiqaKs6ZylyWb1dmrh0TlLaq5WqBuxazWQLegRrEmlwV6p1SAq/rJinhQ7Zsm1LOtaWbM2ZPS05BVKo+BER6fQef7F1q4Zz+6y7Wn7Lj9cWZOzMlG7eXirDVeOmfwlha0pcp5q4zaHDazXqOa9Two+OyW/7VRcy1MjTqxcuOUGzGox9pwLShp+bOQEcv95tFObWNqk47XI217rMc2mLpSax5HonnO/RpKxVt5l5Z1gwdzbMx1x/GbY5R4DpqztUPcyOn+VydsSa/wA6AkROVqn7Urlxycx1RHW3FgV/TSkRv7DnjF2J/uh3qdJ4SrZcjtdlg4I3K/k3clf31yPhR3oMX5Ycm7U99UmvE1y/sPr+otfNHa5P63DfUjthz0HWc5lzycy6qjbaix/kZSI/9h+HaGqMudAr1pIWzOLopBbDT/Ep8zi7Mf3Q469J4Snbcjtd0CrUzria32xqk5qIxzbIuxBhOx1r5qZV1P7LU/acDvDlmyhWwjmJbSWfCclFhyUFIeH6y1U69ekrNOzndC9rDg7fqzM9Ufy26t23bHsOVdM2vaUpIwkSuujxUb9GdTp2/GqDsyUbEl7qyD7RjZkmZhFhwU4UbtnfQhrXNzs5OzKzE9Nx5qMueJGiK93KqqYdUVdJ0L2krtXNRzKLF6y37n6bMcGO2X7V9L4XlvdOdXt61Isy1FrDgp7mFD/VYmHhWqnH0Whmq1UwcmJ0Jqmqc5Z+5druzwq5zlagxJUjJ8ZKpBUYgACgQpCgKFIALUpiAhkCVABSY7oxAFrQxVa5ikJSFQleEoFRRnMfCWpCMlIKgkTEAEJBxFqKAQpABaghUJEqp9GvVEMUKpCJ52MRyuOysm2Wa9l1VhSc3FW2bLbgkCZeuvhp/MiZ04lqh1qZsWh90XKrc50zk7OHxV3DVcK1OUt07jZVLoXqhsZL2g2SnHJjKTapDfXgXM7wHPEc1WotUouY89WxEpRcUOSXeyj30u4jW2TeCcZBbmgRXdVh8VHV+hULKzpSqOa5HY0mD1nn1b9H3j+G86qSpq3YOqSvDARrLasGQnkTPEl4joLuRap9JzmydUTc+Zok9Z9ryDtP8EkVE8LVO9Tj7FX92S9t6Zwdz+/Lrd1g67kss+TmZRF/fEyDwRoD2U5UP0m5U8njkq291leGLQ5oxFqdlUdrtU47DVbLkdsOZBeI4ZEyrZO4aKrr32VhuRVX9h+XOZbsm0BF/wBIWxVTRCgPeq8iCcRaj+6O0nG4aNtyO2HY6KVOM6VtTVEXNl1VJGRtefXQqQkhIv8AeU4Vb2qNt+NVtiWDIyTa4PmIixnU4kon0nDXjrFP92bqXdNYK1/fn1Nnlc2iqmjOcGvvlRuddVIkOctNszONTCUlP4SJXhpg3wqar3jylX2vDrm2neCbWE7/AIMBeow+KjaKvhU4ssWqKm6dK7pSdluntUmL1nnZh6PvP8fl2ZlFy33qvGkWSspf3Ds51Wq2C+saIn86Jo4m8p1e17lVVcqqqrVVVdIdiYLUrLl2q5OdU5s1icXdxNXCuznLNXVMHIEUa6p8OsxoKhSUCQozCu4SkJgC0AICAChCFCFFAhlVCARKGbXqhhUlVIyzRlm/UsG8Fr3ftFlo2LPx5Gab/wASE6muTccmZycCne2T7VEwInU5O+UisB+br6UYqsXhfDzpxpU1zx4wjcanPZv3LPqS7+D0hfwc/wDHVzfDob/3et+xrfk2zdjWnKz8FyV10GIjqcaZ0P1EVFTBTz6sqem7MmUmrPm5iTmEzRYERWO5Uz+E7Hu/lzv3ZLWQ5idl7WgtztnISa5U/XbRfoUs7WlaZ5rkZNNhtZ7VXNepmJ3c8NvlUi5zX2xtUnJqiNti7MxDXS+Tjo9OR1FOYWXl3yfzdEjTs7Jqv6eUciJ4Uqh3KcbYq/uXFvS+DuRzXI+/N4u00CHB4GVvJzFzXrkGfKK5vnQzXKrk7T+WNk+O/wDg5fT2vmjtdiMZh554uR2w5qqA4NGyuZOYSVW9tnv+TVXeZD8m0MumT2WRep2lNzSomCQJR6ovhVKHzOJsxtqjtfNWPwtHrXI7YdoUUjqIlVWh0Na+qTsaGissu7toTLu2jxWQm8iVU4Jb2X2+1otiQ5DrGyITs3UIXVIiJ+s70HBXpCxT05uje09grUc1WfVDai07SkbMlXTdozkCUl2pV0SNERjU5Tpy/uqEsGzuqSl15d1sTKVTrh9WS7V3U0v8GBrhb1sWrbkwse17Tm5+LWqOmIqvovAmZPAh+WrKLU6F3SddfNRzKHFay3bkcGzHB37ZcovjfO373TnXVuWhEmKLWHBT3MKF+qxME48V4TjcREU+dVQuuqV0zNU5zPOzVddddU11TnMoqDMZEVCHzma4mclAhKchUFBUYED+a1VpZM982ifVU6HXanfFqpWyZ75tE+qdDrtS50X6tX2bLVf1LnXHmxABbNWAAAAAAAAAq0IAAAAAAAABSAACkKBAABSAAWpAAKQFAgL4CAAUgFUhSAAUAQAAAABaEAApAAP6JbarxnrncrG7NkfMIH2TTyLltqvGeulyfexZHzCX+yaB+5TEKtCVJUC1qAiJSqn5N47y3fu7DgxLctmz7NbHVUhLNzDYaPVM9K56VQD9dECocLflWycM21+LuJ/3Bh8VyvZM0/l7dtP/AH7AOdKuBMTgyZXcmi/y8u35ewyTK1k1XNfu7fODAObFocIi5W8mkNixIl+7tta1Kqv7oMwOC3t1U2SOw4cTrW3I9tR2tdrYNny7nI9U0a91GpXdqB3erqKdE6pDVDWHk2ko1k2NEl7WvW5utZLtdroUnVNvGVNO4zOumiGuOV/VY31vTDj2bdaE269mxKtV0F+vmojV3YmZmHa8prnHjRY8Z8WLEfEiRHK57nOVVcq4qqqudV3QP0LzW5ad4rbnLZtmdiT1oTkVYseYiLVz3L5txETBEREQ/LAAAAAAAAAAAAAAAAL4SAAAB2TqbuzzcnvvB86nqYmg8stTf2eLkd94HnPU1NAGRBiAI/QaG+yOdlu73eFv3iMb5P0GhvsjnZbu/wB4W/eIwGrrtspCu2ykAyZnO38mXvOgfLRPOdQMznb2TFf9EIKf86J5yt0p7GOtnNZvdI/dHhLkqkUq8RFKFhUUIASBCgkAAQBeIiAChSFAEAADOAAwCAANJkimIAyqDEpKGaUMsKHyrQa4jIfSpFe7Qq8pjUVIyGXVH9s7lKkV3bO5THOReAD6a6uepFophiXEZC03CYioVQCqY1CrUlSUskUKtTAVBkoGIQkQoCgAoIBSkQAACkCFCkQC1BABQFIBSAAAAoApPCEJAFJgBRxkKQICkAtOEEAFCEx3SqSFRVSFCBDIicQUApKFQEGYjTNtEMakqDa+3VVT85eUwdFculeU+a1qErUZERkyqq51XlFK51XlIXXIE5yqIiBVMVcTOEZCriXEiIWoGVcDFVIpBkZCkSpQSk0gDEgCFBIhdBBxBIKBECKAKg0jMBSDEBBVSoQtVAIZIpgK4ED6VMVUxFRkKfRrqZjBFFRkiX0c9ypi5eU+KpXOq8pa1L4RsTEzCsVzdK8p9Neq51qfMiqoRPOydTOYkxAFqu6XXVMcBUAuIpTSSqglK1FSeAAXBSAqZgIDKhiDN8bRStlzqf0aJ9VToRdqd92h/Fk782ifVU6EXalvorZV9mx1W9W51x5sQAW7WAKQAAAAAAAAAAAAAAAoAgKhAABQIAAKQAAAUCFIAAAAAFAgAAAAAAAABQIAAAAA/oltqvGeudyvezZHzCB9k08jJbarxnrlcjG69j975f7JoH7ihEQoAkT8mpqF7Iy9EsW5baJXribzpX82GbePX+DXiNQfZGk/zPctf6RN/VhgaWRHLr1wTkQx1y8HIgibdTEDJHLwciGXVF3E5EPmAMte5FrhyIHOc7bOVTEAUgAAAAAAAAAAAAAAAAAAAAAAB2TqbUrl4uT33g+dT1MTCh5aamzs83J77wfOp6lpoAo0AUAj9Bob7I52W7v94W/eIxvk/QaG+yO9lu76/wDQW/eIwGrrtspCu2ykAyZnO3cmKf6IQPlonnOomZzt7Jn7z4Hy0TzlbpT2MdbO6ze6R+6PCXJFUlQqgoWEAASBSAAACQQAAAAABSAAAAA8BALUVIAlcNwVAADSQuYIWqkUKEAqCpAQM6kqQAyFqTMWpCQ8AGbQAICqQJUEKEAUACFAzgBpAAKACAKQAFKTQAABQIACQxAxAAAuYgQpKgAACQABAAAAACRQgJnAtQgJiBeIJwggFGgVAQVFUIECVqpK1GITACqWpiEIF04AgACgoAAKQAoAJAmgpAkBVIoAAAELxABAACAAAAgFSUiKWpiUC1FSIAheIqEqKkC1IUmYkBVQpK8AMlBMBUJUECIBU4wAQgLUABiFBAPlaH8VzvzWJ9VToNdqd82p/FU981ifVU6GXalxorZV9mx1W9S51x5sQAW7WAAAFIAAAAtSAAWpAAAAAAAAAAAAAAACkKQAUgAAACkAAAAAAAAAAFIAAAAFIAAAA/oltr4T1yuSn+jFj/MJf7Jp5Gy+1XjPXK5PvYsdf+ny/wBk0D93SFC8ZMAI/aLxGoPsjP8AE1y/nE39WGbfP2jjUH2Rr+Jrl/OJv6sMDSqJt1MTKJt1MQAAAAAAAUCAAAAAABVAgAAtAQAAABRQgAAADsnU29ni5PfeD51PUxDyy1N3Z4uR33gec9TWgXSMCrUgEfoNDvZHeyzd7vE37xGN8XpmNDvZHeyxd7vE37xFA1cdtlIV22IBkzOdu5M1/wBEIHy0TznUTTtvJn70YPy0TzlbpP2MdbO6y+6R+6PCXJlGAUFEwgAMAABCRRxgIBC4DAAAAhADwAEgBgQJAABQAEAACUAKBCoMKAIEAUAACpmIBAoCgEIpVqAMdIUpFJSFQhUALiAoCEBSBKghdIQIACABcCAUgAAAAAUnEAABIAFIEBScZIilAAFBCAAACm4ACRUoCFAAgAYApCAACVQkMQuYVUAOMEASFQxKBa4ghQAAIQAAAoAQkAUgAcYAAUKAJWgzjiABAAQGKKFCBQIACUoUgAZy5gKgBnGIAqUCqYlQGQEAAACgApBUCoACEKgIUCYloCEj+a11RLGn13JWJ9U6HXane9uLrbBtFyaJWJ9U6H0Fxor1amy1Wj/judcIAC2asAAAAAAAAAAFIAAAAAAAAUgAAAAAALgQAWhAAAAAAAAUgAAAAAABSAAUgAFUgAAAD+iX2vhPXK5HvXsf5hL/AGTTyMltqvGeudyfexZHzCB9k0D91SFUigR/5NxqD7I1/E1y/nE39WGbfP2imoXsjSf5luWv9Im/qwwNKYm3UxMom3UxAAAAUhUAgAAtSAAAAAAAAFIABcABAFAAAAAAB2TqbuzxcnvvB856mN0HlnqbuzxcjvvB856mIBQMdwLmAj9GJod7I72WLvd4m/eIpvi/QaG+yOdlq73eJv3iMBq67bEUrtspAMmnbmTOn70IPy0TznUbM527kz96EH5aJ5yt0n7KOtndZfdI/dHhLkgzheIhRsIpMwQoAEUugAMAAKlCDEEAAWoEA0hQBC6CEpC6CaSqgQYgBUAKBoAEKoASUCABCk0gAUEKABC1AKQpEAVAoNASAJmAEUFoAIC4AINIAIAAoEBdJAAAroAAFQCDiKtBQCApCRSAoEzjAAAAAAAIAYgaQBSBSQBSVAAFAgKQBUDEAKgYaQAIUKBFoAg0h9AqQoQqKEIAhlgQheMCipFUVADSNAALUAJiAKQKAShSBAAC1BADQAAIUKSlKAKAAIUBSgIAAGACVBChAUgUCkBUQCGSYghCFAGYAgwJWpaYkj+G8Sql27TX+iRPMdFaDvK9Ko27FqKq0/yV/mOjdBc6K9SrrbTVaP8AhuTv8kABatSpAABSAAXQQAAAAAAFoAOAANBAAAAFIAAAAAAAAAAAAAuBAAAAAAACjwkAAAAAAKQAAUgA/oltqvGeuVyvexZHzCB9k08jZba+E9crk+9ix/mEv9k0D9xVGJSboB+0cag+yNfxNctP6RN/Vhm3rvyamoPsjX8T3L+Xm/qwwNKom3UxMom3UxAAAAAAAAAAAAAABSACkAAAAAAAABUAgAA7J1NvZ4uR33g+dT1MTQeWept7PNye+8HzqeprdADSM4KBi/QaG+yOdlq73eFv3iMb5P0GhvsjnZbu/wB4W/eIwGrrtspCu2ykAyZnO3Mmi/6IQPlonnOo25ztvJn70YPy0TzlbpP2UdbO6y+6R+6PCXJgQFEwoACUKAFQBQIAQHhAADEDOUBgC+AgE0gAkMAKAACkAoUgAAAgAASLQBCkCUBSZiQVAgIBVA0EApAMwAAJnAADMAGJQQAQAAPAChARQMQlCig0AE4RnFFIBdIImcpIDwFIAUVFSYECggAVBdBAAAABAAKMCAkUgAAAEAAUkMSAYkAUgADjAzkiZwpSKEihCgCAYgAEAAAhQKAUhAQpCQGkE0AUEBAoAQBiAUCCgKhIxKABKDQUaAlCKUAQBQEgBQCcJaEQoQADSEBSAgFKQpIJwhSoRQh+Ve9f9FbT+buOkVO7L4+9W0/m7jpNS60X7OrrbfVf2FfX5QgALRpwAAAAAAABQAAAAAFIAKQAC1IAAAAAAAXAgAFIAAAAAAAAUCAAAAAAAAAAAAAAAA/oltqvGeuVyF/0Xsf5hL/ZNPIyX2q8Z65XH96tjd75f7JoH7xFKpNIEftFNQfZGv4nuX8vN/Vhm3z/AMmpqD7I1/E9y/nE39WGBpVE26mJlE26mIAAAAAAAAAAAACgQAAAAAAAAAAUgAAAAdlamzs83J77wfOp6lomY8s9Tb2ebk994PnU9TE0AUBABH6DQz2R3st3e7wt+8RjfN6ZjQ32Rzst3e7wt+8RgNXXbYhXbZSAZMznbmTT3oQPlonnOo2Zzt3Jn70IHy0TzlbpP2P3Z3WX3SP3R4S5IKFUhRMIUCAEikQpCAAAABUKgDEuchSUCChAAUAgSq4kxAIFIMQSAAIAAAAASKgCFIAKCKpIEClAhSAATMUAVCAAAhQQBSAGRpHEUgQFIUC0IKitQBAFoEgCFAUIUmglCmIzhQlSIAQAGAApNIAApAABRnABSAC6CFIBcRQBABCqQAK0AAZ9AAAAKOMBQKSoQkAhfCQJWgUAITQCgJAmYnGVAAAIQtCAAFIVSUJSAAC1BCgCkBCFQmkCpIBAFALukA0hIoJpKnKAACAEKQAXEiio0gC1IAKgAIQqFMSkoFCgUA/Jvkn+ilp/IKdJKd2X0X/RS0vkFOk108ZdaL9nV1tvqv7Cvr8oQAFo06kAAAAC4AhQBCkAFIAAAAAFAgAAAIAAAAAAAAAAAAAACkAAAAAAAAAAAAAAAAAA+8ttV4z1zuRRLr2On/T5f7Jp5Gy218J65XI969j13vl/smgfuKuIKpAI78mpqF7I1/E1y/nE39WGbev/ACamoPsjX8TXL+cTf1YYGlUTbqYmUTbqTACAAACkAAAAAABdBAAAAAAAWgIAAAAAAAAAOydTb2eLk994PnU9TE0UPLPU29ni5PfeD51PUxNAFBSAR+g0O9kd7LN3u8TfvEY3xfoNDvZHeyxd7vE37xFA1cdtiFdtiAZMznbmTP3oQPlonnOo25zt3Jp70IHy0TzlbpP2UdbO6y+6R+6PCXJAVAUTCAoQoAEKBC0BQhABoACpFxBKVFAAgzEKTSQlSFFACBUQhUAAAIKEKQJAABQEAFzEUpFQlCLUeEpAlcAgoAGYgADwAVBAABAKNBABc4QDiAcQqQZwKCF0AQAAM2gqErQqAUhSBARS6QEoSpVJUkUAAAAhADEDEAAUCJiVcASoDEAAC1IM+YCquIUgApAKkgFAAhSAJACAUqZiULUANAIgQvhIAEhUFQEAwAQgVSAZwACUFSRAFASIhUAxAAAIKjQPAAGgUFAAIUKBBiUYBKAVxAAuBCgKAAhAAAAGkAAhSEihSAD8i+a/6KWl8gp0ounjO6r6e9S0vkV850qpd6L9nV1tvqv7vX1+UIACzaYAAAAAAABSAAAAABUIAAAAvEQACkLUCAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAD+iW2vhPXK5WF2bI+YQPsmnkZLbVeM9dLl+9myPmED7JoH7i0IBpAj/AMmpqD7I1/E9yvl5v6sM2+f+TU1B9kZ/ie5fy839WGBpVE26mJlE26mIAAAAAAAAApAAAAAAAAAAAAApAAAAAAAdk6m3s83J77wfOp6mbh5Z6m3s8XJ77wfOepiaKAZE4xmCgR+g0O9kd7LN3u8TfvEY3xfoNDfZHOy1d7vE37xGA1ddtlIV22UgGTTt3Jn70YHysTznUTM529kz96ED5WJ9YrdJ+y+7O6y+6R+6PCXJAUhRMGYABQlCgYBAAVAIChAIAoAV3CcZSEpF4ACkAWgRN0qBCUBaEAgAAcYBfABMBQuBAkLQgCFAHESFCFTEKQBiUgSABQAAJFIMQQBUIALiAgAnGCigExGJSABnGIoBUAFAHgIZYkCCnCCkCUAAE0lwAoABRQCF0ZyFoAAJpAtMCAAABxAAAAAUKA4gFwISKUgIAilUUCWIKNIBCihABcQAgIUEiFQBCAAAADwgAAAGIAAZsQKAkPAEKQgOMUAAAAAAAAAAKMwIAKASAxAQgCkqM4BShAApUULQtAhiiBTJM5HAfjX096lpfIr5zpRf2ndV9PepaXyK+c6VXTxl5ov2dXW3Gq/u9fX5QgBULNpkAAAAAAAAAAFUEAAAAAAAKQAAAAAAAAAAAAAAAAAAABSFUgAAAAAAAAFIAAAAH3ltqvGeuly/e1ZHzCB9m08jJbarxnrncr3s2Qv9AgfZNA/bUBeEboEf+TXE1B9kZ/ie5fy839WGbfP/ACamoPsjX8UXL+Xm/qwwNKom3UxMom3UxAAAACkAAAAAAAAAAACkKhAAAAAAC0IAAAAHZOpu7PFye+8DznqYmg8s9TZ2eLk994PnU9TE0AUAAR+g0N9kc7LV3u8TfvEY3yfoNDvZHOyzd7vE37xGA1cdtiFdtiAZMznb2TL3oQPlYn1jqFmc7fyZNX958uv/ADYn1it0n7KOtnNZvdI/dHhLklAMSlEwiUBQBMEAFAIoLRSABXhKKECBS0WooSJxjwFoKAShaFooAiFUBABPCWgoBjpBlTgJQCFAQAC0FAIQooBNIzFopUQCBSogoBKClEMqEpwkDFSUMqEVFJShCloBE4gWgooEBaCgEMiIhaBAKihaATSMxaChAxBRQCFLQUJEQpacAoQMVIZKm4KEjEIZa0UUgQKWgAxUIWhKBOYoLQUUlCVHGZUJRSBCUMqChJmxBkqEVAnNAKFoBKKDIlAJmJpKAHgALQCKCqhKAQqFRBmAgMqERCBKAqoKEoQFUUCUAxLRQIMxaCgEBaCigQFVBQCAqIXWgQF1pNIQmIKpAkUKOMUABS0FAIUUKiBCEoZUFAMQWgVOAJQVCoMwDjAAAFRKhEAUxMkCIFCDAAKEIqkXEtBrVqEvxr5p/opaXyKnSrju2+jV/elafyCnSTs6l3ov2dXW2+q8/wD56+vyhiAC0acKQAAAAAAFQKQAUEABQAAAKBAAAAAAAoEAAAAAUgAAAoEAAAAAAAAAAAAAUgAAAAf0S21XjPXK5PvYsf5hL/ZNPI2W2q8Z65XK97NkfMIH2TQP3FIhkpMNAEf+TU1B9ka/ii5Xy859WGbfO/JqageyNfxTcr5ec+rCA0ribdTEyibdTEAAAAAAAAACkAAAAAAAAAAAACkAAAACoQDsrU2dnm5PfeD51PUxNB5Y6m9aZeLkd94HnPU1NAFwCgAR+g0O9kd7LN3u8TfvEY3xfoNDvZHey1d7vE37xGA1cdtlIV22UgGTM53DkyjyjbnS7Ik3Lw3pFiVa+KiLttxTpwqLTcOtisN/UUcHPJW6T0fGPtRbmrLnzbCrHkfh8n49vpJ1eRT/AO4SXj2+k17rwJyCvAnIdDimPn7lFyUj6vd+WwfXEjotGR8ob6S9Xkd8ZLyhvpNe68CcgrwITxVHzdxyUj6vd+WwnXEjvhI+UN9I6vJb4SXj2+k17rwJyCvAnIOKY+buOSkfV7vy2C65kd8JLx7fSEmZJc1oSfj2+k19rwIK8Ccg4qj5u5PJSPq935bB9Xkt8JLx7fSOuJLfCS8e30mvleBBXgTkHFMfN3I5KR9Xu/LYPriR3wk/Ht9I64kvh8n49vpNfK8CcgrwJyDiqPm7k8lI+r3flsH1zI/D5Tx7fSTrmR+HSvjm+k19rwJyCvAnIOKo+buOSlP1e78tgVm5H4fKeOb6TFZ2RT/10p45vpOgK8CCvAnIOKo+buTyVp+r3fl38k7I/DpTxzfSZpNyPw6V8c30mv1eBBXgTkHFUfN3HJWn6vd+WwCzsh8PlPHN9JOvZD4fKeOb6ToCvAnIK8CDiqPm7jkrT9Wez8tgOvJH4fKeOb6SdeyHw+U8c30nQFeBBXgTkHFUfN3HJWn6s9n5d/8AXkh8PlPHN9I68kPh8p45vpOgK8CCvAnIOKo+buOStP1Z7Py2A68kPh0p45vpHXkj8OlPHN9Jr/XgTkFeBOQcVR83cclafq935d/9eSFf9vlPHN9JevJD4fKeOb6TX+vAnIK8CDiqPm7jkrT9Xu/LYDryQ+Hynjm+kvXkh8PlPHN9Jr9XgTkFeBOQcVR83cjkpT9Wez8tgevJD4fKeOb6S9d2f8PlPHN9Jr7XgQV4EHFUfN3HJSn6s9n5bA9eSG+Ep45vpHXsh8PlPHN9Jr9XgTkFeBOQcUx83cclKfqz2fl3+s7IfD5TxzfSOvZD4fKeOb6ToCvAgrwJyDiqPm7k8lafqz2fl3/17Z/w+U8c30jryQ+HSnjm+k6ArwJyCvAnIOKo+buOStP1Z7Py7/WckPh0p45vpHXkh8OlPHN9J0BXgTkFeBOQcVR83cclafq935d/9eyHw6V8c30jr2Q+HSnjm+k6ArwJyCvAnIOKo+buOStP1e78u/8AryQ+Hynjm+kdeyHw+U8c30nQFeBOQV4EHFUfN3HJWn6vd+Xf/Xsh8PlPHN9JevJD4fKeOb6TX+vAgrwJyDiqPm7jkrT9Xu/Lv/r2Q+Hynjm+kvXsh8PlPHN9Jr/XgQV4EHFUfN3HJWn6s9n5bAdeSHw+U8c30jr2z/h8p45vpNf68CcgrwJyDiqPm7kclafqz2flsB17Z/w+U8c30jr2Q+Hynjm+k1/rwJyCvAnIOKo+buOSlP1Z7Py2B69kPh8p45vpIs7IfD5TxzfSa/14E5BXgQcVR83cnkrT9Wez8u/+vZD4fKeOb6S9eyK/+ulPHN9Jr/XgQV4EHFMfN3HJWn6s9n5bAdeyPw+U8c30hZyR+Hynjm+k1/rwIK8CDimPm7jkrT9Xu/Lv/r2R+HSnjm+knXsh8PlPHN9J0DXgQV4EHFUfN3HJWn6vd+XfyTkh8PlfHN9JevJD4fKeOb6ToCvAnIK8Ccg4qj5u45K0/V7vy2A67kPh8p45vpHXkh8PlPHN9Jr/AF4E5BXgTkHFUfN3I5KU/Vns/LYDryQ+Hynj2+kdeyHw+U8e30mv9eBOQV4E5BxVHzdyeStP1Z7Py2A69s/fCU8c30jr2z/h8p45vpNf68CCvAnIOKo+buRyUp+rPZ+Xf/Xsh8PlPHN9I68kPh8p45vpOgK8CCvAnIOKo+buTyVp+r3fl3917IfDpTxzfSXr2Q+Hynjm+k6ArwJyCvAnIOKo+buOStP1e78u/wDryQ+HSnjm+kxWckPh0r45vpOgq8CcgrwJyDiqPm7jkrT9Xu/Lvzr2Q+HyvjmlSdkfh0p45vpOgq8CCvAnIOKo+buTyWp+r3fl3917Z/w6U8c30jryQ+Hynjm+k6BrwJyCvAg4qj5u5HJWn6s9n5d/deyHw6U8c30jryQ+HSnjm+k6BrwJyCvAnIOKo+buOStP1Z7Py7+68kPh0p45vpL15IZuvpXxzfSdAV4EFeBBxTHzdxyVp+r3fl3/ANeSPw6V8c30jryQ+HSnjm+k6ArwJyCvAg4pj5u45K0/V7vy7/68kPh8p45vpHXkh8PlPHN9J0BXgTkFeBBxVHzdxyVp+r3fl3917IfD5TxzfSOvJD4dKeOb6ToGvAnIK8Ccg4qj5u45K0/Vns/Lv3r2Q+HSnjm+kqT0h8PlPHN9J0DXgTkFeBOQcVR83cclafqz2fl3/wBeSHw+U8c30jr2Q+Hynjm+k6ArwJyCvAnIOKo+buOStP1e78u/+vZD4fKeOb6Qk7IfD5TxzfSdAV4EFeBOQcVR83cclafqz2fl3/15IfDpTxzfSTryQ+HSnjm+k6BrwJyCvAnIOKo+buOStP1Z7Py7/wCvZD4fKeOb6R17IfD5TxzfSdAV4E5BXgTkHFUfN3HJWn6s9n5d/wDXsh8PlPHN9JevZD4fKeOb6TX+vAnIK8Ccg4qj5u45K0/Vns/Lv5Z2Q+HSnjm+kdeSHw6U8c30nQNeBOQV4E5BxVHzdxyVp+rPZ+XfvXln/D5TxzfSVJ2Qr/t8p45vpOga8CCvAhPFUfN3HJWn6s9n5d/9eSHw+U8c30k68kPh8p45vpOga8CcgrwJyEcVR83cclafqz2flsAk7IfD5TxzfSOvZD4dKeOb6TX+vAnIKruIOKo+buOStP1Z7Py2A69kPh8p45vpJ17IfD5Tx7fSdAV4E5BXgTkHFUfN3HJWn6s9n5d/rOyHw+U8c30hZyQ+Hynjm+k6ArwIK8Ccg4qj5u45K0/Vns/Lv1Z2Q+Hynjm+knXsj8OlPHN9J0HXgTkFeBCeKo+buOStP1Z7Py7869kPh8p45vpKk5IL/wCulfHN9J0FXgQV4E5BxVHzdyeStP1e78u/uvJD4dKeOb6R17Ip/wCulPHN9J0DXgQV4E5COKo+buRyVp+r3fl3/wBeyHw+U8c30l68kPh8p45vpNf68CcgrwIOKo+buOStP1e78tgOvJH4dKeOb6R15I/DpXxzfSa/14E5BXgTkHFUfN3I5K0/V7vy2ASbka/7dKeOb6SunZBP/XSvjm+k1+rwJyCvAnIOKY+buOSlP1e78u6L4zso+6tpMZNyz3OgKiNbFaqr4DpdcaivEQ72Fw0YemYic813ozRsYC3NEVZ5zmAA7KzAAAAAAAAUgAAAAACoBC1IAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD+iW2vhPXK5PvYsj5hL/ZNPI2W2q8Z65XJ97FkfMJf7JoH7gChAI/8mpp/7I1/FVyvlpz6sI3Bifk3GoHsjX8T3L+cTf1YYGlUTbqYmUTbqYgAAAAAAAAUgAApAAAAAAAAAAAAAAAAUgHY2pyVEy7XIVd+Zf6x6oIeReTq1UsS/wDd22Fi9SbI2nLTDn7jWxWqq8iKeuDIiORrmrVHJVFQD64BSKoqBHGifsj8vHblMuzOLDckCJYywmP0K5seIrk8CPbym9ioqpgdB6tPJnN37yYttSyoHXFs3fiOm4MJravjQVSkWG3hojXImnWUzqB5zu2ykPtFb7pVVKHyUCAAAAAABQIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSAAAAAAAAAAAAAAAAAAAAAAAApAAAApAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACkAAAAAAAABQIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAApAABdIH9Eoiuo1EVVVyIibp663SgxJewLMgRobocWHJQWPY5MWuSG1FRfCebWpdycTeULKvZsusu6JY1mxWTtqRMdYkNrqpDruvVEaicKrmRT05gpjr9KgfXwEUyIoGD9opqF7I1/E9yvnE39WGbfuT3KoaWeyNWki2rc+xkVuuhQJmZclcU1zmNT6qgafRNupiZRNupiAAAAAAWpAAAAAFIAAAApAAL4AQAAAAAAAAAfWDraOqepWpyvUl9cjd2redH6rMrJtlptXLV3V4X8G9V4VVuu4lQ8sW56LmNtPY+soLLOvBaWTqdmUZAtP/LLORy4JMMbSIxOFzERf/xrugbwomkpGYN1q4qgVwFMHUVa0xKVEA1oy86lexL52jMXhufNQbAtiMqvjy74arKTD+2o3GG5dKoiou4hrvOalDLFAm4kGHY9mTMNq0bGh2pBa1/CiOVHcqIej+tQa1vapyAebuxSyybyWcn/AHWB0hsU8se8lnc6wOkekWtTtW8hKN7VvIB5vbFPLJvHZ3OsDpE2KmWTeKz+dpfpHpFRvapyDWt7VOQDzd2KmWTeGz+dpfpDYqZZN4rO52gdI9Ita3tU5C0b2reQDzc2KeWTeKzudoHSLsU8sm8dnc6wOkekNG9qnIWje1TkA83Niplk3is7naB0i7FPLJvHZ3O0DpHpErW9qnIEanapyAebmxTyybx2dztA6Rdinlk3ks7nWB0j0i1re1TkFGrobyAebuxTyybx2dzrA6Q2KWWPeSzedYHSPSLWt7VvINa3tU5APN3Yp5ZN5LO51gdIbFPLJvJZ3OsDpHpDrW7icgo3tU5APN3Yp5ZN47O52gdIuxTyybyWdzrA6R6Q0b2reQtG9qnIB5u7FPLJvHZ3OsDpDYpZZN5LO51gdI9Ida3tU5C61ulqcgHm7sU8sm8dnc6wOkNinlk3ks7nWB0j0h1re1TkLRvat5APN7YpZY95bN51gdImxSyx7yWbzrA6R6Qo1ulqchaN7VOQDze2KWWPeWzedYHSJsUssm8lm86wOkekOtb2qcgo2u1TkA83tinlk3ks7nWB0hsU8sm8lnc6wOkekWtb2reQlG12reQDze2KWWPeWzedYHSLsUsse8tm86wOkekFG6WpyFo3tU5APN7Yo5Y95rM51g9IuxRyx7z2ZzrB9J6P61vapyDWt7VOQDzg2KOWLeezOdYPpIupRyx7zWYv/dYPSPSHWt7VCK1vapyAeb2xTyybyWdzrA6Q2KeWTeOzudYHSPSHWt7VOQutan5qcgHm7sU8sm8dnc7QOkNinlk3js7nWB0j0io3tW8go3tW8gHm9sUsse8tm86wOkE1KWWPeWzedYHSPSHWt0NTkFG9qnIB5v7FDLFvRZfOsH0hdSjlj3nsznWD0j0g1re1QionapyAeb+xSyx7y2bzrA6Q2KWWPeWzedYHSPSFEb2qcg1qJ+a3kA83tillj3ls3nWB0hsUcse81m86wOkekOtb2qchKN7VOQDzf2KWWPeWzedYHSJsU8sm8lnc6wOkekNGp+anIXWt7VOQDzd2KeWTeSzudYHSLsUsse8tm86wOkekKtb2reQmtb2qcgHm9sUssm8tm86wOkXYpZY95bN51gdI9IaN7VOQI1ulqcgHm9sUsse8tm86wOkNillj3ls3nWB0j0ho1fzU5CI1O1TkA839illj3ms3nWB0hsUsse8tm86wOkekNG9qnISje1TkA8301KOWPeazOdYHSLsUMsW9Fmc6wfSej6I3tU5AqN0NTkA839ijlj3ms3nWB0hsUsse8tm86wOkekGtb2qcgRre1TkA839illj3ls3nWB0ibFLLJvLZvOsDpHpFRO1TkJrW9qnIB5v7FLLHvNZvOsDpBdSllj3ls3nWB0j0go3tU5C61q52pyAebuxTyybyWdzrA6Q2KWWTeSzedYHSPSLWt7VOQio3tU5APN/YpZY95LN51gdImxSyx7y2bzrA6R6Q61u4nINa3tU5APN/YpZY95bN51gdIbFLLHvLZvOsDpHpBrU7VvIXWtptU5APN7YpZY95rN51gdIbFLLHvNZnOsDpHpDRvapyCjabVOQDze2KWWPeWzedYHSJsU8sm8lm86wOkekNG9q3kCo3tU5APN/Yo5Y95rM51gdILqUsse8tm86wOkekNGr+anIKN7VvIB5u7FPLJvJZvOsDpDYpZZN5LN51gdI9IlRvat5CUb2qcgHm/sUsse8tm86wOkNillj3ls3nWB0j0g1re1TkKiN7VOQDze2KOWPeazOdYHSGxSyx7zWbzrA6R6QK1uhqcgo3tU5APN7YpZZN5LN51gdIuxSyx7y2bzrA6R6QUb2qchda3tU5APN7YpZY95bN51gdImxSyybyWbzrA6R6Ra1vaoKJ2qcgHm9sUsse8tm86wOkTYp5ZN5LO51gdI9Ida3tU5BRO1byAeb2xSyx7y2bzrA6Q2KeWTeOzudYHSPSLWppanITWt7VOQDze2KeWTeSzudYHSGxSyyby2bzrA6R6RUb2qchKNrtU5APN/YpZY95bN51gdImxTyybyWdzrA6R6Q0TS1OQutbTat5APN3Yp5ZN5LO51gdIuxSyx7y2bzrA6R6QUTtW8hda3tU5APN3YpZY95bN51gdIuxSyx7y2bzrA6R6QKidq3kFG9qnIB5vbFLLJvJZvOsDpF2KWWPeWzedYHSPSHWt7VOQmtTtU5APN/YpZZN5bN51gdImxTyybx2dzrA6R6RUTtU5Ca1vapyAeb2xTyybx2dzrA6Rdijlj3ms3nWB0j0hRrabVOQmtauZqcgHm9sUsse8lmr/wB1gdIbFPLJvJZ3OsDpHpEjW9qnITWt7VOQDze2KeWTeSzudYHSGxTyybyWdzrA6R6Ra1vapyBGs7VOQDze2KWWPeazedYHSIupSyx7yWbzrA6R6Ra1O1TkJrU7VvIB5vbFLLJvJZ3OsDpDYp5ZN47O51gdI9IURvapyF1re1TkA83tillj3ls3nWB0hsUcse81mc6wekekFG9qnIXWt3E5APN7YpZY95rM51gdIbFLLHvLZvOsDpHpBrW9qnIKJ2reQDze2KeWTeOzudYHSGxTyybx2dztA6R6Q61O1byFo3tW8gHm7sUssm8lnc6wOkNinlk3ks3nWB0j0io3tW8hNa3tU5APN7YpZZN5LO51gdIbFPLJvJZ3OsDpHpDrW9qnINa3tU5APN7YpZZN5LN51gdIbFLLJvJZvOsDpHpCiN7VOQutTtU5APN3Yp5ZN47O51gdIbFPLJvJZ3OsDpHpDRvapyF1rdxvIB5vbFLLHvLZvOsDpE2KWWPeSzedYHSPSGje1TkKjWdqnIB5u7FLLJvJZvOsDpF2KWWPeSzedYHSPSDWt7VvIWje1TkA83tillj3ls3nWB0hsUsse8tm86wOkekFG6GpyDWt7VOQDzf2KWWPeWzedYHSGxRyx7zWZzrA6R6QI1vapyF1re1TkA83tillj3ls3nWB0hsUsse8lm86wOkekCInapyF1re1TkA83dinlk3ks7nWB0hsU8sm8dnc6wOkekOtb2qchUa3tU5APN3Yp5ZN5LO51gdIbFPLJvHZ3OsDpHpFrW9qnIEa3tU5APN3Yp5ZN5LN51gdIuxSyx7y2bzrA6R6Q61vapyBUb2qcgHm9sUsse8tm86wOkTYp5Y95LN51gdI9Ida3tW8g1re1TkA839illj3ks3nWB0hsUcse81mc6wekekFG02qchUa3tU5APN7YpZY95bN51gdIbFLLHvLZvOsDpHpBRu43kFE7VvIB5v7FHLHvNZnOsDpEXUp5ZN5LO51gdI9IVa3tU5BrW9qnIB5vbFPLJvJZ3OsDpDYp5ZN5LO51gdI9Ika3tU5CKje1TkA83tinlk3ks3nWB0hsUssm8lm86wOkekVG6WpyEonat5APN/YpZY95bN51gdIbFLLHvLZvOsDpHpDrWdqnINaztUA83dinlk3ks7nWB0hsVMsm8Vnc7QOkekOtTPrU5C0b2reQDzd2KWWTeSzedYHSGxSyx7yWbzrA6R6RK1vapyDWt7VvIB5vbFLLHvLZvOsDpDYpZY95bN51gdI9INa3tU5Cqje1TkA83tijlj3msznWB0gupSyx7y2bzrA6R6Q61q6G8hKJm1qcgHm9sU8sm8lnc6wOkXYpZY95bN51gdI9INa3tU5BrW7jeQDzf2KWWPeazedYHSGxSyx7y2bzrA6R6Q61vapyCje1TkA83tillj3ls3nWB0iLqU8se8lnL/3WB0j0io3tU5BrW9qnIB5ubFTLJvFZ/O0v0jluT/UcX3tKchxL2WtZtiSSO/hGS8RJmYVOBG+4Su6rvAb7a1napyClM1PABxPJfk8uxk5u1CsG7Ej1tARddGiOXXRZh9Ka+I7Sv0JoRDli0TMFIiVAmkqVMkbQoHyiPo5E3TzY1Z96UvRl8tp0vFSLKWS1lmQXJm/g0VYieMdETwG+eWy/Upk+ya2zeiYVixpaCrJOG5adVmHe5hs/vKiruIiroPKqfm5qbmo8zORXxpiPEdEixHrVz3OWrnKu6qqqgfzKtVqQAAAAAAAAooAFSAAAAAKQAAAAAAAAAAAAAAH6V3bXn7DtmSteyph0tPyUdkxLxm52PatUXlTMfmlRVTMB6o5CspllZT7hSl4ZJ8OHPNRIVpSjVqstMInuk/VXO1dKLu1OwWKq6DypyKZTrw5L73Q7csKI10GIiQ56SiOpCm4Va6124qY61yYtXdRVRfSvJZlAu1lEutAvBdqc6tBdRsxBeqJGlYlMYcRuhU3cypiiqigcuRC5kCKi4pigVQBKgAAoKgBAoUgAAV4QKKEGYAoQpFABAXQBACpmAiZygmcAqBAAGFSqCZwHEBpKBOMpMRiBcNBAAA8BSKA8ALoIASoKQAVU4SFAg0AAEFBmAFzkWgAFGchQGYigucCJwlJgM4ApMAAFC6CYgXMMAFAICeAAPCUgAUAUAXAIqExFQLxAgAAABUYBC4IBKAJxFAYaCAZwABQCcRAACUBSaQAKRcUAABOEBnBUoRFAAUADiGJSACkxCUAFAAgooqhQAIACFWgQigNJRUKBEGNQEVQKQFAnEWm4NBMACgqkAIAOICkGYJnAFQi5y5wJpxGBcxACgYF0ATCoUFAilJUvgAlcMxSBeEBwjwjwjBAKRcVHEAAzaSkAqEBQImBSIUACY7gAaS1A8AErwFQVUAACAM4UVFQKlCAAAmIx3AAwAAAKpSKBUUgGgABiAGG6KAAUhRRAIuYJmAAqEqAoDSMAFApNIHEBakqUiLugAEAFTgCEXAAWhMxalXEDBXUMYj/AHODkRUxWqiKqNRaqnGppnqudUXBjy85cG4U6j4cRHQbVtWC7BUzOgwnadxz04k0qgdd6s7K4zKFfdLBsea193rDe6HBex1WTUfM+NuKibVq7lVTbGvrlVVxK9yrhoQxAAAAAAAKQAAACgAAAAAAAAAC1BAAAAAAAAAAAAGTXUOVZN7/AN5sn94Ydt3XtOLIzLaJEbtoUdldpEZmc36UzoqLicTAHoNkh1WVybzS8CSvhrbr2sqa10SIqukoq7qRPzOJ9ETdU2FkJ2VnpWHNSczBmYERqOZFgvR7XJuoqYHjq1ypmWhya5d/L33OmEjXZvHadlKi65WS8wqQ3L/OYtWu8KAetyGSU3UPOuwtVxlbs5rGzk5ZFro1KL15IIirw1huZ5j9fZn5SN4bqeTRvWgb+4bqEqm6hoFszspO8V1PJY3rRszspO8V1PJY3rQN/apuoMN1DQPZn5SKfxDdTyaN60Lqz8pG8V1PJY3rQN/MN1KDDdQ0C2Z2UreO6fkkb1o2Z2UreO6fkkb1oG/uG6hapuoaA7M7KTvFdTyWN60bM/KTvFdTyWN60Df1abqBabqGgezPyk7xXU8ljetGzOyk7xXU8ljetA388KCu6qGgWzOyk7xXU8kjetGzPyk7xXU8ljetA39w3fpLVK50NAdmdlJ3iup5LG9aXZn5Sd4rqeSxvWgb+qqbqBFTdQ0B2Z+UneK6nksb1o2Z+UneK6nksb1oG/1U3U5RVODlNAdmdlJ3iup5LG9aNmdlK3jup5JG9aBv7hupyiqbqGgWzOylbx3U8kjetGzOyk7x3T8kjetA39w3UGG6hoFszspW8d1PJI3rRszspW8d1PJI3rQN/cN1BhuoaBbM7KTvHdPySN60bM7KVvHdPySN60Df7DdQmFc6GgWzOyk7xXU8ljetGzOylbx3T8kjetA3+w0KhFVN1DQLZn5Sd4rqeSxvWjZn5Sd4rqeSxvWgb+4Vz/SXDdQ0B2Z+UneK6nksb1pdmflI3hup5LG9aBv7huoTDdQ0D2Z+UneK6nksb1oTVnZSd4rqeSxvWgb+YbqFw3fpNAtmdlJ3iup5LG9aTZnZSt47p+SRvWgb+1TdQYbqGgWzOylbx3T8kjetLsz8pO8V1PJY3rQN/KpuoMN1DQPZn5Sd4rqeSxvWjZn5Sd4rqeSxvWgb+4bqDBdKGgOzPyk7xXU8ljetGzPyk7xXU8ljetA39w3fpGFM6cpoFszspO8d1PJI3rRszspO8d0/JI3rQN/cN1OUYbv0mgWzOylbx3U8kjetGzOylbx3U8kjetA3+w3UGG6hoBszcpe8l0/I43rS7M7KVvHdPySN60Df7woSqaFQ0C2Z2UreO6fkkb1o2Z2UreO6fkkb1oG/uGlfpFeFDQLZnZSd47qeSRvWjZn5Sd4rqeSxvWgb/V4UJVN1DQLZnZSt47qeSRvWjZnZSt47p+SRvWgb/VTdQYcHKaA7M7KVvJdPySN60bM7KTvFdTyWN60Df1FTdQuG6hoDszspW8d0/JI3rS7M/KTvFdTyWN60DfyqUzoMN1OU0C2Z2UreO6fkkb1o2Z2UreO6fkkb1oG/uHAXDQqGgGzOylbyXT8kjetLsz8pO8V1PJI3rQN/cNKoXDdQ0B2Z2UreO6fkkb1o2Z2UreO6nkkb1oG/tU3UGG6hoFszspW8d1PJI3rRszspW8d0/JI3rQN/cN1BhuoaBbM7KVvHdPySN60bM7KVvHdPySN60Df5KbqEw3UNAtmdlK3jup5JG9aNmdlK3jun5JG9aBv6tN1BhuoaBbM7KVvHdPySN60bM7KVvHdPySN60Df7DdQlU0KhoHszspO8V1PJY3rRsz8pO8V1PJY3rQN/FpupyiqcBoHsz8pO8V1PJY3rRsz8pG8N1PJY3rQN/KpuoXDdQ0B2Z2UneO6nkkb1pdmflJ3iup5LG9aBv7hukw0KhoHszspO8V1PJY3rSbM7KTvFdTyWN60Df1KbqDDdQ0C2Z2UreO6nkkb1o2Z2UreO6nkkb1oG/uG6gw3UNAtmdlK3jup5JG9aNmdlK3jun5JG9aBv7VN1OUVTdQ0C2Z2UreO6fkkb1o2Z2UreO6nkkb1oG/uG6gw3UNAtmflJ3iup5LG9aNmdlK3jup5JG9aBv7hpVBhuoaBbM7KTvHdPySN60bM7KVvHdPySN60Df3DdQtU3UNAdmdlJ3iup5JG9aNmflJ3iup5LG9aBv7huoXDdNAdmdlJ3iup5LG9aXZn5Sd4rqeSxvWgb+4bqEWm6nKaBbM/KTvFdTyWN60bM7KVvFdTySN60Df2vCgw3UNAtmdlK3kun5JG9aNmdlK3jun5JG9aBv8lN1BhuoaA7M7KVvHdPySN60bM7KVvHdPySN60Df5abqEw3UNAtmflJ3iup5LG9aNmflJ3iup5LG9aBv7guZUHud00C2Z2UneK6nksb1pdmflJ3iup5LG9aBv7huoRKbqGgezPyk7xXU8ljetJsz8pO8V1PJY3rQN/sN1CYf/1TQLZnZSt4rqeSRvWjZnZSt4rqeSRvWgb+4bqCqJpNA9mflJ3iup5LG9aTZnZSt47qeSRvWgb/ACqm6hMN1OU0C2Z2UreS6fkkb1o2Z2UreO6fkkb1oG/yU3UJhXOhoFszspW8d1PJI3rRszspW8l0/JI3rQN/sN1CYbqGgWzOyk7x3U8kjetC6s7KVvHdTySN60Df3CudBVOA0D2Z+UneK6nksb1o2Z+UneK6nksb1oG/lU3ULhu/SaBbM7KTvFdTyWN60bM/KTvFdTyWN60DfzDd+kJTdQ0D2Z2UneK6nksb1pNmdlK3jun5JG9aBv7hupyjwoaB7M/KTvFdTyWN60bM7KTvFdTyWN60Df3woTDdQ0C2Z2UneO6nkkb1o2Z+UneK6nksb1oG/uG6nKVFTd+k0C2Z+UneK6nksb1o2Z+UneK6nksb1oG/uG6hF1u79JoEurOylbx3U8kjetGzOylbyXT8kjetA3+9zukqm6aA7M7KVvJdPySN60yTVn5SdNhXU8ljetA39w3U5RVNCoaBbM/KRvDdTyaN60Lqz8pOiwrqeSxvWgb+VTdQLTdQ0C2Z2UreO6fkkb1o2Z2UreO6fkkb1oG/1U3UJVN1DQLZn5Sd4rqeSxvWjZnZSt5Lp+SRvWgb+4bv0jDdQ0C2Z2UreS6fkkb1o2Z2UreO6fkkb1oG/wBhuoKpuoaA7M7KVvJdPySN60bM7KVvHdTySN60Df3woKppVDQLZnZS95Lp+SRvWjZnZSt47p+SRvWgb/YbqCqbqGgGzOyl7yXT8kjetLszspW8d1PJI3rQN/sN1CLrd1DQLZnZSt47p+SRvWjZnZSd47qeSRvWgb/YbqDDdNAdmdlK3kun5JG9aNmdlK3jup5JG9aBv7huoMN1DQLZnZSd4rqeSRvWjZnZSt5Lp+SRvWgb+4JpQYbqGgWzOylbx3T8kjetGzOylbyXT8kjetA3+9zu/SMN1DQHZnZSt47p+SRvWjZnZSt47qeSRvWgb++FBhuoaBbM7KVvHdPySN60bM7KVvHdTySN60Df7DdQVTdQ0B2Z2UreO6fkkb1o2Z+UneK6nkkb1oG/2C7hEpXOhoHsz8pO8V1PJY3rRszspO8V1PJY3rQN/PCgWm6hoFszspO8d1PJI3rQurNylbyXT8kjetA3+w3UJ4UNAdmdlK3kun5JG9aXZnZSt5Lp+SRvWgb+4bqDDd+k0C2Z2UreS6fkcb1pNmblL3lun5HG9aBv/hTOhPChoFszspW8l0/JI3rRszspO8V1PJY3rQN/UpuoVVTgNAdmdlJ3jup5JG9aNmdlK3kun5JG9aBv9huoRabpoDszspe8l0/JI3rT5zOrIynxYLmQrOutLOXNEZIxVcnFWKqAegCvopwzKPlTuNcCUdGvPeGUkomtqyWa7qkxF4Gw21cvHm3Tz4vdqicrt5IT4E1fGblZd6UWFIMbLU/tMTX/AOI6sm5qYm5qJNTMaJGjxXK6JEiPVznqudVVcVXjA2Ey/ap28d/IUew7sNj3eu7ERWRGtif5TNtX9I5Nq1e0avGq5jXZ6qq58CEAAAAAAAAAAAAAAAAAAAAXQQAAAABfAAIAAAAAAuggAAAAWpABSACkAAAAAAAAAAAAAAAAAApAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC4ggAAAAAAAAAApAAAAAACggAAAAAAAAAAAAAAKQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC0IAAAAAAAUgAAAAAAAAAAAAAABQpAAKQAAAAAAAAoEAAAAAAAAAAAAAAAAKQAAAAAAAAAAAAAAAAAAAAAAAAACkAAAAAAAAAAAAAAAAKoEAAAAAAAAAAAAAAABSAAAABQQAUgAAAAAABVzEAAAAAAAAAAAAAAAABQIAAAAAAAAAAAAApAUCAAAAAAAAAAAAAAAAAAAAAAKQCgEAAAAAABSAAAAABaAQAAAAAKhAAAKBAAABaEAAAAAAAAAAAAC+EgAAAAAAAAAAAAAAAAAAAAWpAAKQAAAKQAAAAABQIAAAAAAAAAAAAAAAACoQAAAAAAAAAAAAKQAAAKQAAAUCAAAAAAAApAAAAAAAAAAAAAApAAAApAAAAAAAAUgAAqACAAAUgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACgAAoAAAAAAAAAAAAAABQQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKQAAAAABdAEAKoEKQAAAAAAFICgQFIABVIAAAApAAAAApAACAAAAAAAAAAAAAAAAFIoAqkAAFIAAAAAAAAAAAAAAACgQAAAAAAAAFIBSAAAAAAAAAAAAAAAAAAAAAKQAACgCAAAAAAAAAAAABSAoEAKBAAAAAAAAAAAAAAAAAAAAAAAAUgAAAAAAAAAAAAAAAAAAAACggAuYgAAACkAAAAAAAAAAAAAAUCAFAgAAAAAAALgQAAAAKQAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQIC4EAAAAAAAAApCkAAAAAUCApAAAAAAAAAAAAAAAAAAKQAAAAKQAAAAKQAAAAAApAAAAAAAAAAAAAFIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAgAAAAAAABdBAAAAApCoBAAAAAAAAAAAAAAAAAAAAAAAACkAApABSAAAAAAAAAAAAAAAAAoEAAFIAAAAApCgQAAAAAAAAAAAAAKQAACgQAAAAAAAAAoEAKBAAAAAApCgQAAAAAAAAAAAUgAAAAAAAAAAAAAAAAAAAAABVIAABSAAAAAAAAAAAAAAAAAAAAAAAAACkAAAAC4EAAAAAAAAAAAAAAAAKAIAAKQAAUgAAoDAEAAAAUiAAVSAAAAAAAAAAAAAAAAAAAAABfAQCkAAAAAUgAApAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAgAAAACqQpEAAAAAAAAAAFAgAAAAAAAAKnCQACkAAAAAAABQIUgAAKABSAAAAAAApAAAAAAAAAAAAAAFAhaEAFWhAUCAAAAABSAAAAAKFAgAAAAC4EAAAAAAAAAAAACkAAAAAAAAAAAAAAAABVAgAAAAAAAAAAAAAAAAAAApAAAAAAAAAABQIAAAAAAAAAUCAAAAUCAAAAAKQAAUhdAEAAFIUYACAAAAAAAAAAAAAKQAAAABQBAAAAAApAAAAFIAAAAAAAUgAApAAAAAAtQIAAAAAAAAAAAAApC1IAAAFIAABSAAAAAAAAACoQAAAAKQAAAAAAApAAAAAAAAAAAAAAAAAAAAFqQAAAAAAAAAAUgAAAACgCAAAAAAAAFIABSAAAAAAApCkAAAAAAKQAAAAAAAAAAAAABQIAAAKQAAAAAAAAAAAAAApAUCAAAAAAAAAAAAAKhAABSFAgAApAAAAAAAAVSAAAAKQAAAAAAAAAAAAAAAAAAAAAKQAAAAAAAAAAAAAAAAAAAAAAAAAAABSAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUgAAAAAAAAAAFAgAAAAAAAAAAAAAAAAAAAAAAAAAAFxIXQBNIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAuYgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAApAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKQAAAAAAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAZAAD/2Q==" alt="" style={{ height: '2.6rem', width: 'auto', objectFit: 'contain', marginRight: '-14px' }} />
                          <span style={{ fontFamily: "'Roboto', 'Helvetica Neue', Arial, sans-serif", fontSize: '1.5rem', fontWeight: 700, color: 'white', letterSpacing: '0.08em' }}>
                            {(() => {
                              const total = 120 + (demoTick % 3600);
                              const h = Math.floor(total / 3600);
                              const m = Math.floor((total % 3600) / 60);
                              const s = total % 60;
                              return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
                            })()}
                          </span>
                        </div>
                      </div>
                      <div className={`py-2 text-sm font-bold ${timingMode === 'elapsed' ? 'bg-blue-500 text-white' : 'bg-neutral-50 text-neutral-600'}`}>
                        Elapsed Time
                      </div>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <button onClick={() => setCatchupStep(3)} className="bg-neutral-100 text-neutral-700 py-4 rounded-xl font-bold hover:bg-neutral-200 transition-colors">Back</button>
                    <button
                      onClick={() => {
                        if (timingMode === 'cpr') setCatchupStep(5);
                        else if (timingMode === 'elapsed') setCatchupStep(7);
                        else if (timingMode === 'log') handleCatchupStart();
                      }}
                      disabled={!timingMode}
                      className={`py-4 rounded-xl font-bold transition-all ${
                        timingMode
                          ? timingMode === 'cpr'
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md'
                            : timingMode === 'elapsed'
                            ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md'
                            : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md'
                          : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                      }`}
                    >
                      {timingMode === 'log' ? 'Start Case' : 'Continue'}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* Warning Modals */}
      {showCloseWarning && (
        <div className="fixed inset-0 bg-black/80 z-[2000] flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
            <h2 className="text-2xl font-bold text-neutral-900 mb-2">Close this case?</h2>
            <p className="text-neutral-500 mb-8">This will end the timer and show the final summary.</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setShowCloseWarning(false)} className="bg-neutral-100 p-4 rounded-xl font-bold text-neutral-700 btn-base">Cancel</button>
              <button onClick={closeCase} className="bg-emerald-600 p-4 rounded-xl font-bold text-white btn-base">OK</button>
            </div>
          </div>
        </div>
      )}

      {showPauseWarning && (
        <div className="fixed inset-0 bg-black/80 z-[2000] flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
            <h2 className="text-2xl font-bold text-neutral-900 mb-2">Pause timer?</h2>
            <p className="text-neutral-500 mb-8">The arrest timer will stop until you resume.</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setShowPauseWarning(false)} className="bg-neutral-100 p-4 rounded-xl font-bold text-neutral-700 btn-base">Cancel</button>
              <button onClick={togglePause} className="bg-red-600 p-4 rounded-xl font-bold text-white btn-base">Pause</button>
            </div>
          </div>
        </div>
      )}

      {showTimerAdjust && (
        <div className="fixed inset-0 bg-black/80 z-[2000] flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
            <h2 className="text-2xl font-bold text-neutral-900 mb-2">Adjust Rhythm Check Timer</h2>
            <p className="text-neutral-500 mb-6">Match the app's rhythm check timer to the monitor's CPR timer</p>
            
            <div className="mb-8">
              <TimePicker 
                value={timerAdjustValue}
                onChange={setTimerAdjustValue}
                maxSeconds={120}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => {
                  setShowTimerAdjust(false);
                  setTimerAdjustValue({ mins: 2, secs: 0 });
                }} 
                className="bg-neutral-100 p-4 rounded-xl font-bold text-neutral-700 btn-base"
              >
                Cancel
              </button>
              <button 
                onClick={applyTimerAdjustment} 
                className="bg-emerald-600 p-4 rounded-xl font-bold text-white btn-base"
              >
                Set Timer
              </button>
            </div>
          </div>
        </div>
      )}

      {showResetWarning && (
        <div className="fixed inset-0 bg-black/80 z-[2000] flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
            <h2 className="text-2xl font-bold text-neutral-900 mb-2">Reset 2-minute cycle?</h2>
            <p className="text-neutral-500 mb-8">This resets the current rhythm check countdown to 2:00.</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setShowResetWarning(false)} className="bg-neutral-100 p-4 rounded-xl font-bold text-neutral-700 btn-base">Cancel</button>
              <button onClick={resetTimer} className="bg-red-600 p-4 rounded-xl font-bold text-white btn-base">Reset</button>
            </div>
          </div>
        </div>
      )}

      {/* Treatment Logged Notification Banner */}
      <AnimatePresence>
        {showLoggedNotification && (
          <motion.div 
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="fixed top-0 left-0 right-0 bg-emerald-600 text-white py-3 px-4 text-center font-bold shadow-lg z-[2000]"
          >
            ✓ {loggedTreatmentRef.current} logged
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Sub-components ---

function TimePicker({ value, onChange, maxSeconds }: { value: { mins: number, secs: number }, onChange: (v: { mins: number, secs: number }) => void, maxSeconds?: number }) {
  const adjust = (type: 'mins' | 'secs', delta: number) => {
    const newVal = { ...value };
    if (type === 'mins') {
      newVal.mins = Math.max(0, newVal.mins + delta);
    } else {
      const totalSecs = newVal.mins * 60 + newVal.secs + delta;
      if (totalSecs < 0) return; // Don't go below 0:00
      newVal.mins = Math.floor(totalSecs / 60);
      newVal.secs = totalSecs % 60;
    }
    
    // Enforce max limit if provided
    if (maxSeconds !== undefined) {
      const totalSeconds = newVal.mins * 60 + newVal.secs;
      if (totalSeconds > maxSeconds) {
        return;
      }
    }
    
    onChange(newVal);
  };

  return (
    <div className="flex items-center justify-center gap-4">
      {/* Minutes column */}
      <div className="flex flex-col items-center">
        <button onClick={() => adjust('mins', 1)} className="p-2 bg-neutral-100 rounded-lg text-lg font-bold text-neutral-400 hover:text-neutral-900">▲</button>
        <div className="text-5xl font-bold text-neutral-900 tabular-nums my-2">{value.mins}</div>
        <button onClick={() => adjust('mins', -1)} className="p-2 bg-neutral-100 rounded-lg text-lg font-bold text-neutral-400 hover:text-neutral-900">▼</button>
        <span className="text-neutral-400 font-bold uppercase text-xs mt-2">min</span>
      </div>
      
      <div className="text-5xl font-bold text-neutral-400 mb-8">:</div>
      
      {/* Seconds column with three sets of arrows */}
      <div className="flex flex-col items-center">
        <div className="flex gap-2">
          <button onClick={() => adjust('secs', 10)} className="p-2 bg-neutral-100 rounded-lg text-lg font-bold text-neutral-400 hover:text-neutral-900">▲</button>
          <button onClick={() => adjust('secs', 1)} className="p-2 bg-neutral-100 rounded-lg text-lg font-bold text-neutral-400 hover:text-neutral-900">▲</button>
        </div>
        
        <div className="text-5xl font-bold text-neutral-900 tabular-nums my-2">{value.secs.toString().padStart(2, '0')}</div>
        
        <div className="flex gap-2">
          <button onClick={() => adjust('secs', -10)} className="p-2 bg-neutral-100 rounded-lg text-lg font-bold text-neutral-400 hover:text-neutral-900">▼</button>
          <button onClick={() => adjust('secs', -1)} className="p-2 bg-neutral-100 rounded-lg text-lg font-bold text-neutral-400 hover:text-neutral-900">▼</button>
        </div>
        
        <span className="text-neutral-400 font-bold uppercase text-xs mt-2">sec</span>
      </div>
    </div>
  );
}

function CounterItem({ label, value, onChange }: { label: string, value: number, onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between bg-neutral-50 p-2.5 rounded-2xl border border-neutral-100">
      <span className="text-base font-bold text-neutral-800 ml-2">{label}</span>
      <div className="flex items-center gap-4">
        <button onClick={() => onChange(Math.max(0, value - 1))} className="w-9 h-9 bg-white shadow-sm border border-neutral-200 rounded-xl font-bold text-xl flex items-center justify-center">−</button>
        <span className="text-xl font-bold tabular-nums w-4 text-center">{value}</span>
        <button onClick={() => onChange(value + 1)} className="w-9 h-9 bg-white shadow-sm border border-neutral-200 rounded-xl font-bold text-xl flex items-center justify-center">+</button>
      </div>
    </div>
  );
}

function Overlay({ type, onClose, addTreatment, state, pharmaSummary, isShockForced, toggleChecklistItem, onVitalsChange }: { 
  key?: string,
  type: OverlayType, 
  onClose: () => void, 
  addTreatment: (n: string) => void,
  state: AppState,
  pharmaSummary: Record<string, { totalDose: number, unit: string, count: number, display: string }>,
  isShockForced: boolean,
  toggleChecklistItem: (checklist: 'reversibles' | 'rosc' | 'phea', label: string) => void,
  onVitalsChange: (v: AppState['vitals']) => void
}) {
  const isTop = ['reversibles', 'rosc', 'phea', 'vitals'].includes(type);
  
  return (
    <motion.div 
      initial={{ y: isTop ? '-100%' : '100%' }}
      animate={{ y: 0 }}
      exit={{ y: isTop ? '-100%' : '100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 220, mass: 0.8 }}
      className="absolute inset-0 bg-white z-50 flex flex-col"
    >
      <div className="flex-1 overflow-y-auto">
        {type === 'reversibles' && <ReversiblesOverlay checkedItems={state.reversiblesChecked} onToggle={(label) => toggleChecklistItem('reversibles', label)} />}
        {type === 'rosc' && <ROSCSelection checkedItems={state.roscChecked} onToggle={(label) => toggleChecklistItem('rosc', label)} patientType={state.patientType} patientWeight={state.patientWeight} />}
        {type === 'phea' && <PHEASelection checkedItems={state.pheaChecked} onToggle={(label) => toggleChecklistItem('phea', label)} />}
        {type === 'vitals' && <VitalsOverlay vitals={state.vitals ?? { hr: '', rr: '', gcs: '', bpSys: '', bpDia: '', spo2: '', etco2: '', bgl: '', temp: '' }} onChange={onVitalsChange} />}
        {type === 'summary' && <SummaryOverlay state={state} pharmaSummary={pharmaSummary} />}
        {type === 'treatment' && <TreatmentSelection addTreatment={addTreatment} state={state} isShockForced={isShockForced} />}
      </div>
    </motion.div>
  );
}

function VitalsOverlay({ vitals, onChange }: { vitals: AppState['vitals'], onChange: (v: AppState['vitals']) => void }) {
  const update = (key: keyof AppState['vitals'], val: string) => onChange({ ...vitals, [key]: val });
  const fields: { key: keyof AppState['vitals'], label: string }[] = [
    { key: 'hr',   label: 'Heart Rate'    },
    { key: 'rr',   label: 'Resp Rate'     },
    { key: 'spo2', label: 'SpO₂'          },
    { key: 'etco2',label: 'EtCO₂'         },
    { key: 'bpSys',label: 'BP Systolic'   },
    { key: 'bpDia',label: 'BP Diastolic'  },
    { key: 'gcs',  label: 'GCS'           },
    { key: 'bgl',  label: 'BGL'           },
    { key: 'temp', label: 'Temperature'   },
  ];
  return (
    <div className="h-full overflow-y-auto">
      <div className="p-2.5 px-4 font-bold text-[16px] tracking-wide border-b uppercase sticky top-0 text-center bg-sky-50 text-sky-800 border-sky-200">Vital Signs</div>
      <div className="p-3 space-y-2">
        {fields.map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between bg-neutral-50 rounded-xl px-4 py-3 border border-neutral-100">
            <span className="text-[15px] font-bold text-neutral-800">{label}</span>
            <input
              type="text"
              inputMode="decimal"
              value={vitals[key]}
              onChange={e => update(key, e.target.value)}
              className="w-24 text-right text-[18px] font-bold text-sky-700 bg-transparent border-b-2 border-sky-200 focus:border-sky-500 outline-none py-1 tabular-nums"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function ReversiblesOverlay({ checkedItems, onToggle }: { checkedItems: string[], onToggle: (label: string) => void }) {
  return (
    <div className="h-full">
      <SectionGroup title="PREHOSPITAL CORRECTABLE" color="blue" items={['Hypoxia', 'Hypovolaemia', 'Hypothermia', 'Hyperkalaemia', 'Tension Pneumothorax', 'Some toxins']} checkedItems={checkedItems} onToggle={onToggle} />
      <SectionGroup title="HOSPITAL ONLY CORRECTABLE" color="blue" items={['Hypokalaemia', 'Hydrogen Ion Excess', 'Thrombosis Coronary/Pulmonary', 'Tamponade']} checkedItems={checkedItems} onToggle={onToggle} />
    </div>
  );
}

function ROSCSelection({ checkedItems, onToggle, patientType, patientWeight }: {
  checkedItems: string[];
  onToggle: (label: string) => void;
  patientType: 'adult' | 'paed' | null;
  patientWeight: number | string | null;
}) {
  const isPaed = patientType === 'paed';
  const weight = typeof patientWeight === 'number' ? patientWeight : parseFloat(String(patientWeight));

  // Ventilation rate by weight (paed)
  const rrTarget = isPaed
    ? weight <= 12 ? '30–45/min (once every 1–2 seconds)'
    : weight <= 19 ? '20–40/min (once every 1.5–3 seconds)'
    : '20–30/min (once every 2–3 seconds)'
    : '8–10/min (once every 6–8 seconds)';

  // SBP target by weight (paed) or adult
  const sbpTarget = !isPaed
    ? 'Maintain SBP ≥100mmHg'
    : weight <= 3 ? 'Maintain SBP 60–100mmHg'
    : weight <= 12 ? 'Maintain SBP 70–110mmHg'
    : 'Maintain SBP 90–110mmHg';

  const teamLeaderItems = isPaed
    ? ['Confirm roles', 'Monitor ECG for rhythm changes', 'Review reversibles', 'Aggressively check and address correctable causes']
    : ['Confirm roles', 'Monitor ECG for rhythm changes', 'Review reversibles'];

  const airwayItems = isPaed
    ? [
        'Do not perform RSI (not authorised)',
        'If ETT placed during arrest — maintain sedation, prevent dislodgement',
        'Confirm spontaneous ventilations',
        'Maintain SpO₂ 94–98%',
        'Maintain EtCO₂ 35–40mmHg',
        `Ventilate at ${rrTarget}`,
      ]
    : [
        'Response — consider sedation',
        'Confirm airway secured',
        'Confirm spontaneous ventilations',
        'Maintain SpO₂ 94–98%',
        'Maintain EtCO₂ 35–40mmHg',
        `Ventilate at ${rrTarget}`,
      ];

  const goferItems = isPaed
    ? ['Confirm radial pulse', 'Set BP to automatic cycling', 'Attach SpO₂', 'Temp (32–37.5°C acceptable)', 'BGL', 'Prepare extrication']
    : ['Confirm radial pulse', 'Set BP to automatic cycling', 'Attach SpO₂', '12-lead ECG', 'Temp (actively correct if <32°C or >39°C)', 'BGL', 'Prepare extrication'];

  const drugsItems = isPaed
    ? [sbpTarget, 'Confirm bilateral IV/IO access', 'Prepare sedation medications if required', 'Prepare adrenaline infusion if required']
    : ['Confirm bilateral IV/IO access', 'Maintain SBP ≥100mmHg', 'Prepare sedation medications if required', 'Prepare adrenaline infusion if required'];

  return (
    <div className="h-full">
      <SectionGroup title="TEAM LEADER" color="orange" items={teamLeaderItems} checkedItems={checkedItems} onToggle={onToggle} />
      <SectionGroup title="AIRWAY" color="orange" items={airwayItems} checkedItems={checkedItems} onToggle={onToggle} />
      <SectionGroup title="GOFER" color="orange" items={goferItems} checkedItems={checkedItems} onToggle={onToggle} />
      <SectionGroup title="DRUGS & ACCESS" color="orange" items={drugsItems} checkedItems={checkedItems} onToggle={onToggle} />
    </div>
  );
}

function PHEASelection({ checkedItems, onToggle }: { checkedItems: string[], onToggle: (label: string) => void }) {
  return (
    <div className="h-full pb-10">
      <SectionGroup title="PREPARATION" color="purple" items={['Adequate hands and skills mix?', 'Assign roles', 'C-spine immobilisation required?', 'Optimise patient position', 'Optimise environment', 'Optimise equipment placement']} checkedItems={checkedItems} onToggle={onToggle} />
      <SectionGroup title="PRE-OXYGENATION" color="purple" items={['Nasal prongs 15L/min']} checkedItems={checkedItems} onToggle={onToggle} />
      <SectionGroup title="MONITORING" color="purple" items={['ECG', 'BP — cycling', 'SpO2', 'EtCO2']} checkedItems={checkedItems} onToggle={onToggle} />
      <SectionGroup title="DRUGS & ACCESS EQUIPMENT" color="purple" items={['IV/IO access ×2 if possible', 'IV fluids', 'Ketamine drawn up', 'Suxamethonium drawn up', 'Post PHEA sedation medication/s drawn up']} checkedItems={checkedItems} onToggle={onToggle} />
      <SectionGroup title="AIRWAY EQUIPMENT AND BRIEF" color="purple" items={['Sufficient oxygen available?', 'Suction', 'OPA/NPA', 'LMA', 'BVM', 'Airtraq', 'ETT', 'Syringe', 'Securing method', 'Laryngoscope checked', 'FONA scalpel', 'External laryngeal manipulation discussed', 'Fall back plan discussed']} checkedItems={checkedItems} onToggle={onToggle} />
      <SectionGroup 
        title="POST-INTUBATION" 
        color="darkPurple" 
        items={[
          { label: 'Confirm ETT placement', subItems: ['EtCO2', 'Visualise cords', 'Auscultation', 'Misting', 'Chest rise'] },
          'Colleague confirms placement',
          'Secure tube — Thomas block / tube tie',
          'Reassessment — ABCs and VSS',
          'Sedation plan discussed',
          'Deterioration plan discussed',
          'Extrication and transport plan discussed'
        ]} 
        checkedItems={checkedItems} 
        onToggle={onToggle}
      />
    </div>
  );
}

interface CheckItemProps {
  label: string;
  key?: React.Key;
  subItems?: string[];
  color?: string;
  checked: boolean;
  onToggle: (label: string) => void;
}

function CheckItem({ label, subItems, color = 'emerald', checked, onToggle }: CheckItemProps) {
  const colorMap: Record<string, { bg: string, text: string, border: string, checkBg: string }> = {
    orange: { bg: 'bg-orange-50', text: 'text-orange-900', border: 'border-orange-500', checkBg: 'bg-orange-500' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-900', border: 'border-purple-500', checkBg: 'bg-purple-500' },
    darkPurple: { bg: 'bg-purple-50', text: 'text-purple-900', border: 'border-purple-500', checkBg: 'bg-purple-500' },
    blue: { bg: 'bg-blue-50', text: 'text-blue-900', border: 'border-blue-500', checkBg: 'bg-blue-500' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-900', border: 'border-emerald-500', checkBg: 'bg-emerald-500' }
  };
  
  const colors = colorMap[color];
  
  return (
    <div>
      <label onClick={() => onToggle(label)} className={`flex items-start p-2 rounded-lg cursor-pointer transition-colors ${checked ? colors.bg : 'hover:bg-neutral-50'}`}>
        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center mr-2.5 mt-0.5 transition-colors flex-shrink-0 ${checked ? `${colors.checkBg} ${colors.border}` : 'border-neutral-300 bg-white'}`}>
          {checked && <CheckCircle2 size={12} className="text-white" />}
        </div>
        <div className="flex-1">
          <span className={`text-[17px] font-medium ${checked ? colors.text : 'text-neutral-700'}`}>{label}</span>
          {subItems && subItems.length > 0 && (
            <ul className="mt-2 ml-0 space-y-1">
              {subItems.map((item, idx) => (
                <li key={idx} className={`text-[16px] flex items-start ${checked ? colors.text : 'text-neutral-600'}`}>
                  <span className="mr-2 font-bold">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </label>
    </div>
  );
}

function SectionGroup({ 
  title, 
  color, 
  items, 
  checkedItems, 
  onToggle 
}: { 
  title: string, 
  color: string, 
  items: (string | { label: string, subItems: string[] })[], 
  checkedItems: string[], 
  onToggle: (label: string) => void 
}) {
  const colorMap: Record<string, string> = {
    orange: 'bg-orange-50 text-orange-800 border-orange-200',
    purple: 'bg-purple-50 text-purple-800 border-purple-200',
    darkPurple: 'bg-purple-800 text-white border-purple-900',
    blue: 'bg-blue-50 text-blue-800 border-blue-200',
    emerald: 'bg-emerald-50 text-emerald-800 border-emerald-200'
  };
  return (
    <>
      <div className={`p-2.5 px-4 z-10 font-bold text-[16px] tracking-wide border-b uppercase sticky top-0 text-center ${colorMap[color]}`}>{title}</div>
      <div className="p-1 space-y-0.5">
        {items.map((item, idx) => {
          if (typeof item === 'string') {
            return <CheckItem key={item} label={item} color={color} checked={checkedItems.includes(item)} onToggle={onToggle} />;
          } else {
            return <CheckItem key={idx} label={item.label} subItems={item.subItems} color={color} checked={checkedItems.includes(item.label)} onToggle={onToggle} />;
          }
        })}
      </div>
    </>
  );
}

// --- TREATMENT LOG (EVEN COLUMNS) ---
function TreatmentLog({ treatments, elapsedSeconds, catchupElapsed, isSummary = false }: { treatments: Treatment[], elapsedSeconds: number, catchupElapsed: number, isSummary?: boolean }) {
  // Helper to split treatment name into medication and dose
  const splitTreatmentName = (name: string): { med: string, dose: string | null } => {
    // Match dose patterns at the end: numbers followed by units (mg, mcg, mL, mMol, g, kg, %)
    const doseMatch = name.match(/^(.+?)\s+([\d.]+(?:mg\/kg|mMol\/kg|mL\/kg|mcg|mg|mL|mMol|g|kg|%|\/\d+mL))$/);
    if (doseMatch) {
      return { med: doseMatch[1], dose: doseMatch[2] };
    }
    return { med: name, dose: null };
  };

  return (
    <div className="bg-white rounded-b-xl border border-neutral-100 overflow-hidden shadow-sm">
      {/* Balanced columns: More space for name, even space for times */}
      <div className={`grid ${isSummary ? 'grid-cols-[2fr_1fr_1fr]' : 'grid-cols-[2.1fr_1fr_1.4fr_0.9fr]'} bg-neutral-100 border-b border-neutral-200 px-4 py-3`}>
        <div className="text-[11px] font-black text-neutral-800 uppercase tracking-widest text-left">Treatment</div>
        <div className="text-[11px] font-black text-neutral-800 uppercase tracking-widest text-center">Time</div>
        <div className="text-[11px] font-black text-neutral-800 uppercase tracking-widest text-center">Elapsed</div>
        {!isSummary && <div className="text-[11px] font-black text-neutral-800 uppercase tracking-widest text-right">Ago</div>}
      </div>
      
      {/* Table Body */}
      <div className="divide-y divide-neutral-100">
        {treatments.length === 0 ? (
          <div className="p-12 text-center text-neutral-300 italic">No treatments recorded</div>
        ) : (
          [...treatments].reverse().map((tx, i) => {
            const timeVal = isSummary ? tx.clockSeconds : tx.clock;
            const timeDisplay = tx.prior ? `< ${timeVal}` : timeVal;
            const elapsedDisplay = tx.prior ? `< ${isSummary ? formatTimeWithSeconds(catchupElapsed) : formatTime(catchupElapsed)}` : (isSummary ? formatTimeWithSeconds(tx.elapsed) : formatTime(tx.elapsed));
            const agoVal = tx.prior ? elapsedSeconds : (elapsedSeconds - tx.elapsed);
            const ago = tx.prior ? `> ${formatTimeHMM(agoVal)}` : formatTimeHMM(agoVal);
            const { med, dose } = splitTreatmentName(tx.name);
            
            return (
              <div key={i} className={`grid ${isSummary ? 'grid-cols-[2fr_1fr_1fr]' : 'grid-cols-[2.1fr_1fr_1.4fr_0.9fr]'} px-4 py-4 items-center gap-1`}>
                <div className="pr-1">
                  <div className={`text-[15px] font-bold ${
                    tx.name.toLowerCase().includes('shock') ? 'text-red-600' : 
                    tx.name.toLowerCase().includes('disarm') ? 'text-blue-600' : 
                    'text-neutral-900'
                  }`}>{med}</div>
                  {dose && <div className="text-[13px] text-neutral-500 font-medium mt-0.5">{dose}</div>}
                </div>
                <div className="text-[16px] text-neutral-800 font-medium tabular-nums text-center">{timeDisplay}</div>
                <div className="text-[16px] text-neutral-800 font-medium tabular-nums text-center">{elapsedDisplay}</div>
                {!isSummary && <div className="text-[16px] text-neutral-800 font-medium tabular-nums text-right">{ago}</div>}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function SummaryStats({ state, pharmaSummary }: { state: AppState, pharmaSummary: Record<string, { totalDose: number, unit: string, count: number, display: string }> }) {
  const disarmCount = state.treatments.filter(t => t.name.includes('Disarm')).length;
  const patientLabel = state.patientType === 'adult'
    ? `Adult · ${state.patientWeight === '>100' ? '>100' : state.patientWeight}kg`
    : state.patientType === 'paed'
    ? `Paediatric · ${state.patientWeight}kg`
    : null;

  return (
    <div className="space-y-6">
      {patientLabel && (
        <div className="rounded-xl overflow-hidden border border-neutral-100">
          <div className="bg-neutral-50 text-neutral-500 px-4 py-3 font-bold text-xs tracking-wider">PATIENT</div>
          <div className="bg-white px-4 py-3">
            <span className="text-[17px] font-bold text-neutral-900">{patientLabel}</span>
          </div>
        </div>
      )}
       <div>
        <div className="bg-emerald-50 text-emerald-800 p-3 rounded-t-lg font-bold text-sm tracking-wider">ARREST SUMMARY</div>
        <div className="bg-white border-x border-b border-neutral-100 rounded-b-lg divide-y divide-neutral-50 shadow-sm">
          <StatRow label="CPR Rounds" value={state.cprRound} />
          <StatRow label="Shocks given" value={state.shocks} color="text-red-600" />
          <StatRow label="Disarmed" value={disarmCount} color="text-blue-600" />
        </div>
      </div>

      <div>
        <div className="bg-emerald-50 text-emerald-800 p-3 rounded-t-lg font-bold text-sm tracking-wider">PHARMA SUMMARY</div>
        <div className="bg-white border-x border-b border-neutral-100 rounded-b-lg divide-y divide-neutral-50 shadow-sm min-h-[60px]">
          {Object.keys(pharmaSummary).length === 0 ? (
            <div className="p-4 text-neutral-300 italic text-sm">No medications given</div>
          ) : (
            Object.entries(pharmaSummary).map(([name, info]) => (
              <StatRow key={name} label={name} value={info.display} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryOverlay({ state, pharmaSummary }: { state: AppState, pharmaSummary: Record<string, { totalDose: number, unit: string, count: number, display: string }> }) {
  const v = state.vitals ?? { hr: '', rr: '', gcs: '', bpSys: '', bpDia: '', spo2: '', etco2: '', bgl: '', temp: '' };
  const hasVitals = Object.values(v).some(val => val !== '');
  const vitalRows = [
    { label: 'Heart Rate',     value: v.hr,   unit: 'bpm'    },
    { label: 'Resp Rate',      value: v.rr,   unit: 'br/min' },
    { label: 'SpO₂',           value: v.spo2, unit: '%'      },
    { label: 'EtCO₂',          value: v.etco2,unit: 'mmHg'   },
    { label: 'Blood Pressure', value: v.bpSys && v.bpDia ? `${v.bpSys}/${v.bpDia}` : v.bpSys || v.bpDia || '', unit: 'mmHg' },
    { label: 'GCS',            value: v.gcs,  unit: '/ 15'   },
    { label: 'BGL',            value: v.bgl,  unit: 'mmol/L' },
    { label: 'Temperature',    value: v.temp, unit: '°C'     },
  ].filter(r => r.value !== '');

  return (
    <div className="space-y-6 pb-20">
      <SummaryStats state={state} pharmaSummary={pharmaSummary} />
      <div className="rounded-xl overflow-hidden border border-neutral-100">
          <div className="bg-sky-50 text-sky-800 px-4 py-3 font-bold text-sm tracking-wider">VITAL SIGNS</div>
          {vitalRows.length > 0 ? vitalRows.map(({ label, value, unit }, i) => (
            <div key={label} className={`flex items-center justify-between px-4 py-3 ${i < vitalRows.length - 1 ? 'border-b border-neutral-100' : ''}`}>
              <span className="text-[14px] font-semibold text-neutral-500">{label}</span>
              <span className="text-[17px] font-bold text-neutral-900 tabular-nums">
                {value} <span className="text-[12px] font-medium text-neutral-400">{unit}</span>
              </span>
            </div>
          )) : (
            <div className="px-4 py-3 text-[14px] text-neutral-400 italic">No vital signs recorded yet.</div>
          )}
        </div>
      <div>
        <div className="bg-emerald-50 text-emerald-800 p-3 rounded-t-lg font-bold text-sm tracking-wider">TREATMENT LOG</div>
        <TreatmentLog treatments={state.treatments} elapsedSeconds={state.elapsedSeconds} catchupElapsed={state.catchupElapsed} />
      </div>
    </div>
  );
}

interface StatRowProps {
  label: string;
  value: string | number;
  color?: string;
  key?: React.Key;
  stacked?: boolean;
}

function StatRow({ label, value, color = "text-neutral-900", stacked = false }: StatRowProps) {
  if (stacked) {
    return (
      <div className="p-2 px-3">
        <div className="text-neutral-500 text-[16px] font-medium">{label}</div>
        <div className={`text-[14px] font-black tabular-nums ${color} mt-0.5`}>{value}</div>
      </div>
    );
  }
  return (
    <div className="flex justify-between items-center p-2 px-3">
      <span className="text-neutral-500 text-[16px] font-medium">{label}</span>
      <span className={`text-[16px] font-black tabular-nums ${color}`}>{value}</span>
    </div>
  );
}

function TreatmentSelection({ addTreatment, state, isShockForced }: { addTreatment: (n: string) => void, state: AppState, isShockForced?: boolean }) {
  const [customTx, setCustomTx] = useState('');
  const [selectedMed, setSelectedMed] = useState<string | null>(null);
  const [customDose, setCustomDose] = useState('');
  const [expandedSection, setExpandedSection] = useState<string | null>(isShockForced ? 'rhythmCheck' : null);
  const [customInputValues, setCustomInputValues] = useState<Record<string, string>>({});
  
  const handleMedClick = (med: string) => {
    if (DOSE_CONFIG[med]) {
      setSelectedMed(med);
      setExpandedSection('medications'); // Keep medications section expanded
    } else {
      addTreatment(med);
    }
  };
  
  const handleDoseSelect = (dose: string) => {
    if (selectedMed) {
      console.log('handleDoseSelect - selectedMed:', selectedMed);
      console.log('handleDoseSelect - dose:', dose);
      const displayDose = calculateDose(dose, state.patientWeight);
      console.log('handleDoseSelect - displayDose:', displayDose);
      let cleanDose = cleanDoseForLog(displayDose);
      console.log('handleDoseSelect - cleanDose:', cleanDose);
      
      // For Glucose 10%, add gram calculation
      if (selectedMed === 'Glucose 10%') {
        console.log('handleDoseSelect - formatting Glucose 10%');
        cleanDose = formatGlucose10Dose(cleanDose);
      }
      
      // For Sodium Bicarbonate, add mls calculation
      if (selectedMed === 'Sodium Bicarbonate') {
        console.log('handleDoseSelect - formatting Sodium Bicarbonate');
        cleanDose = formatSodiumBicarbonateDose(cleanDose);
      }
      
      // For Calcium, add mg and mL calculation with max cap
      if (selectedMed === 'Calcium') {
        cleanDose = formatCalciumDose(cleanDose, state.patientWeight);
      }
      
      // For Amiodarone paed, apply max dose caps
      if (selectedMed === 'Amiodarone' && state.patientType === 'paed') {
        const weight = typeof state.patientWeight === 'number' ? state.patientWeight : parseFloat(String(state.patientWeight));
        const mgMatch = cleanDose.match(/([\d.]+)mg/);
        if (mgMatch) {
          const calculated = parseFloat(mgMatch[1]);
          const doseOpt = DOSE_CONFIG['Amiodarone'].doses.find(d => d.dose === dose);
          if (doseOpt?.indication?.includes('repeat')) {
            const capped = Math.min(calculated, 150);
            cleanDose = `${capped}mg`;
          } else if (doseOpt?.dose?.includes('/kg')) {
            const capped = Math.min(calculated, 300);
            cleanDose = `${capped}mg`;
          }
        }
      }
      
      console.log('handleDoseSelect - final cleanDose:', cleanDose);
      const finalTreatment = `${selectedMed} ${cleanDose}`;
      console.log('handleDoseSelect - adding treatment:', finalTreatment);
      addTreatment(finalTreatment);
      setSelectedMed(null);
      setCustomDose('');
    }
  };
  
  const handleCustomDoseAdd = () => {
    if (selectedMed && customDose && DOSE_CONFIG[selectedMed]) {
      // Use customUnit if specified, otherwise extract unit from dose options
      const customUnit = DOSE_CONFIG[selectedMed].customUnit;
      let unit = '';
      
      if (customUnit) {
        unit = customUnit;
      } else {
        // Extract unit from dose options
        const doses = DOSE_CONFIG[selectedMed].doses.map(d => d.dose);
        const unitMatches = doses
          .filter(d => d !== 'Other')
          .map(d => {
            const match = d.match(/(mg\/kg|mMol\/kg|mL\/kg|mcg\/kg|u\/kg|mg|mL|mMol|mcg|g|u|%)$/i);
            return match ? match[1] : null;
          })
          .filter(Boolean);
        
        unit = unitMatches.length > 0 ? unitMatches[0] : '';
      }
      
      let doseWithUnit = unit ? `${customDose}${unit}` : customDose;
      
      // For Glucose 10%, add gram calculation
      if (selectedMed === 'Glucose 10%') {
        doseWithUnit = formatGlucose10Dose(doseWithUnit);
      }
      
      // For Sodium Bicarbonate, add mls calculation
      if (selectedMed === 'Sodium Bicarbonate') {
        doseWithUnit = formatSodiumBicarbonateDose(doseWithUnit);
      }
      
      // For Calcium, add mg and mL calculation with max cap
      if (selectedMed === 'Calcium') {
        doseWithUnit = formatCalciumDose(doseWithUnit, state.patientWeight);
      }
      
      addTreatment(`${selectedMed} ${doseWithUnit}`);
      setSelectedMed(null);
      setCustomDose('');
    }
  };
  
  const handleBackFromMed = () => {
    // Update both states atomically to prevent flash
    setSelectedMed(null);
    setCustomDose('');
    setExpandedSection(() => 'medications');
  };
  
  if (selectedMed && DOSE_CONFIG[selectedMed]) {
    const allDoses = DOSE_CONFIG[selectedMed].doses;
    const filteredDoses = state.patientType 
      ? allDoses.filter(d => d.population === 'both' || d.population === state.patientType)
      : allDoses;
    
    // Check if a dose is a unit-only custom input (e.g., "mg/h", "mg")
    const isCustomInput = (dose: string) => {
      return dose === 'mg/h' || dose === 'mg' || dose === 'mL/h' || dose === 'mcg/h';
    };
    
    const regularDoses = filteredDoses.filter(d => d.dose !== 'Other' && !isCustomInput(d.dose));
    const customInputDoses = filteredDoses.filter(d => isCustomInput(d.dose));
    const doses = filteredDoses.map(d => d.dose);
    const showOther = doses.includes('Other');
    
    const handleCustomInputAdd = (doseOpt: DoseOption) => {
      const key = `${doseOpt.dose}-${doseOpt.indication}`;
      const value = customInputValues[key];
      if (value) {
        // Check if this is the shared morph/midaz infusion treatment
        if (doseOpt.indication === 'Post intubation sedation morph/midaz infusion') {
          addTreatment(`Morph/midaz infusion ${value}${doseOpt.dose}`);
        } else {
          handleDoseSelect(`${value}${doseOpt.dose}`);
        }
        setCustomInputValues({ ...customInputValues, [key]: '' });
      }
    };
    
    // Display dose on button — applies max caps and special formatting
    const getButtonDisplayDose = (doseOpt: { dose: string; indication?: string }) => {
      const base = calculateDose(doseOpt.dose, state.patientWeight);
      const weight = typeof state.patientWeight === 'number' ? state.patientWeight : parseFloat(String(state.patientWeight));
      // Calcium: show mg and mL with 1g max cap
      if (selectedMed === 'Calcium' && doseOpt.dose.includes('/kg')) {
        return formatCalciumDose(base, weight);
      }
      // Amiodarone paed: cap display at 300mg for arrest, 150mg for VT with output
      if (selectedMed === 'Amiodarone' && doseOpt.dose.includes('/kg') && state.patientType === 'paed') {
        const mgMatch = base.match(/\(([\d.]+)mg\)/);
        if (mgMatch) {
          const calculated = parseFloat(mgMatch[1]);
          if (doseOpt.indication?.includes('cardiac arrest') && !doseOpt.indication?.includes('repeat')) {
            const capped = Math.min(calculated, 300);
            return `5mg/kg (${capped}mg${calculated > 300 ? ' — 300mg max' : ''})`;
          }
          if (doseOpt.indication?.includes('repeat')) {
            const capped = Math.min(calculated, 150);
            return `2.5mg/kg (${capped}mg${calculated > 150 ? ' — 150mg max' : ''})`;
          }
          if (doseOpt.indication?.includes('VT with output')) {
            const capped = Math.min(calculated, 150);
            return `5mg/kg (${capped}mg${calculated > 150 ? ' — 150mg max' : ''})`;
          }
        }
      }
      return base;
    };

    return (
      <div className="h-full overflow-y-auto pb-4">
        <div className="p-6 mb-4">
          <h2 className="text-2xl font-bold text-neutral-900 mb-2">{selectedMed}</h2>
          {state.patientWeight && (
            <p className="text-neutral-500 text-sm mb-2">
              Patient weight: {state.patientWeight === '>100' ? '>100' : state.patientWeight}kg
            </p>
          )}
          {state.patientType && (
            <p className="text-neutral-500 text-sm mb-6">Patient type: {state.patientType}</p>
          )}
          
          <div className="space-y-3">
            {regularDoses.map(doseOpt => (
              <button
                key={`${doseOpt.dose}-${doseOpt.indication}`}
                onClick={() => handleDoseSelect(doseOpt.dose)}
                className="w-full bg-emerald-600 text-white p-4 rounded-xl font-bold btn-base flex flex-col items-start gap-1 text-left"
                data-dose={doseOpt.indication || getButtonDisplayDose(doseOpt)}
              >
                <span className="text-lg">{getButtonDisplayDose(doseOpt)}</span>
                {doseOpt.indication && (
                  <>
                    <span className="w-full border-t border-white opacity-30 my-1" />
                    {doseOpt.indication.split(' / ').map((ind, i) => (
                      <span key={i} className="text-[11px] font-normal text-white opacity-90 leading-tight block">
                        {"- "}{ind.split(/(pVT)/).map((part, j) =>
                          part === 'pVT'
                            ? <span key={j}>pVT</span>
                            : part
                        )}
                      </span>
                    ))}
                  </>
                )}
              </button>
            ))}
            
            {customInputDoses.map(doseOpt => {
              const key = `${doseOpt.dose}-${doseOpt.indication}`;
              return (
                <div key={key} className="w-full">
                  {doseOpt.indication && (
                    <label className="block text-xs text-neutral-600 mb-1 font-medium">
                      {doseOpt.indication}
                    </label>
                  )}
                  <div className="flex gap-2 items-center">
                    <div className="flex-1 relative flex items-center bg-white border-2 border-emerald-500 rounded-xl focus-within:ring-2 focus-within:ring-emerald-600 min-w-0">
                      <input
                        type="text"
                        value={customInputValues[key] || ''}
                        onChange={e => setCustomInputValues({ ...customInputValues, [key]: e.target.value })}
                        onKeyPress={e => e.key === 'Enter' && customInputValues[key] && handleCustomInputAdd(doseOpt)}
                        placeholder={`Enter dose...`}
                        className="flex-1 bg-transparent px-4 py-3 text-base outline-none min-w-0 text-right"
                      />
                      <span className="pr-4 text-neutral-400 text-sm font-medium whitespace-nowrap">{doseOpt.dose}</span>
                    </div>
                    <button
                      onClick={() => handleCustomInputAdd(doseOpt)}
                      className="bg-emerald-600 text-white px-4 py-3 rounded-xl font-bold btn-base disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                      disabled={!customInputValues[key]}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13"></line>
                        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
            
            {showOther && (() => {
              // Extract common unit from dose strings
              const getUnitFromDoses = (doses: string[]): string => {
                const unitMatches = doses
                  .filter(d => d !== 'Other')
                  .map(d => {
                    // Match common patterns: mg/kg, mL, mg, g, etc.
                    const match = d.match(/(mg\/kg|mMol\/kg|mL\/kg|mcg\/kg|u\/kg|mg|mL|mMol|mcg|g|u|%)$/i);
                    return match ? match[1] : null;
                  })
                  .filter(Boolean);
                
                // Return most common unit or first found
                if (unitMatches.length > 0) {
                  return unitMatches[0] as string;
                }
                return '';
              };
              
              const doses = filteredDoses.map(d => d.dose);
              // Use customUnit if specified, otherwise extract from dose options
              const unit = DOSE_CONFIG[selectedMed].customUnit || getUnitFromDoses(doses);
              const placeholder = unit ? `Custom dose (${unit})...` : 'Custom dose...';
              
              // Calculate secondary unit for live display
              const getSecondaryUnit = () => {
                if (!customDose || isNaN(parseFloat(customDose))) return null;
                const value = parseFloat(customDose);
                
                if (selectedMed === 'Glucose 10%') {
                  const grams = Math.round(value * 0.1 * 10) / 10;
                  return `/ ${grams}g`;
                }
                
                if (selectedMed === 'Sodium Bicarbonate') {
                  const mls = Math.round(value * 10) / 10;
                  return `/ ${mls}ml`;
                }
                
                return null;
              };
              
              const secondaryUnit = getSecondaryUnit();
              
              return (
              <div className="w-full flex gap-2 items-center">
                <div className="flex-1 relative flex items-center bg-white border border-neutral-200 rounded-xl focus-within:ring-2 focus-within:ring-emerald-500 min-w-0">
                  <input
                    type="text"
                    value={customDose}
                    onChange={e => setCustomDose(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && customDose && handleCustomDoseAdd()}
                    placeholder={placeholder}
                    className="flex-1 bg-transparent px-4 py-3 text-base outline-none min-w-0 text-right"
                  />
                  {(unit || secondaryUnit) && (
                    <span className="pr-4 text-neutral-400 text-sm font-medium whitespace-nowrap">
                      {unit}{secondaryUnit ? ` ${secondaryUnit}` : ''}
                    </span>
                  )}
                </div>
                <button
                  onClick={handleCustomDoseAdd}
                  className="bg-emerald-600 text-white px-4 py-3 rounded-xl font-bold btn-base disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                  disabled={!customDose}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                  </svg>
                </button>
              </div>
              );
            })()}
          </div>
        </div>
        
        <div className="p-6 pt-0">
          <button 
            onClick={handleBackFromMed}
            className="text-emerald-600 font-bold flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
            Back
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="h-full overflow-y-auto pb-4">
      {isShockForced && (
        <div className="bg-[#b91c1c] text-white p-4 text-center font-bold sticky top-0 z-[100] animate-pulse">
           RHYTHM CHECK: SELECT SHOCK STATUS
        </div>
      )}
      
      <TxSection 
        title="Rhythm Check" 
        color="pink" 
        sectionId="rhythmCheck"
        expandedSection={expandedSection}
        onToggle={(id) => setExpandedSection(expandedSection === id ? null : id)}
        items={[
          { name: 'Shock - VF', color: 'red' },
          { name: 'Shock - pVT', color: 'red' },
          { name: 'Disarm - Asystole', color: 'blue' },
          { name: 'Disarm - PEA', color: 'blue' },
          { name: 'Disarm - ROSC', color: 'emerald' }
        ]} 
        onSelect={addTreatment}
      />

      {!isShockForced && (
        <>
          <TxSection 
            title="Medications" 
            color="emerald" 
            items={MEDICATIONS} 
            onSelect={handleMedClick}
            sectionId="medications"
            expandedSection={expandedSection}
            onToggle={(id) => setExpandedSection(expandedSection === id ? null : id)}
          />
          
          <TxSection 
            title="Airway" 
            color="blue" 
            items={['ETT', 'FONA', 'IGT', 'LMA']} 
            onSelect={addTreatment}
            sectionId="airway"
            expandedSection={expandedSection}
            onToggle={(id) => setExpandedSection(expandedSection === id ? null : id)}
          />
          
          <TxSection 
            title="Other Tx" 
            color="neutral" 
            items={['Corpuls', 'Extrication', 'IO', 'IV access', 'Pacing', 'Reassurance provided']} 
            onSelect={addTreatment}
            sectionId="otherTx"
            expandedSection={expandedSection}
            onToggle={(id) => setExpandedSection(expandedSection === id ? null : id)}
          />
          
          <div className="p-6 border-t border-neutral-100 bg-neutral-50 px-2 sm:px-6 mb-4">
            <div className="flex gap-2">
              <input 
                type="text" 
                value={customTx}
                onChange={e => setCustomTx(e.target.value)}
                placeholder="Custom treatment..."
                className="flex-1 bg-white border border-neutral-200 rounded-xl p-4 text-base focus:ring-2 focus:ring-emerald-500 outline-none"
              />
              <button 
                onClick={() => { if(customTx) { addTreatment(customTx); setCustomTx(''); } }} 
                className="bg-emerald-600 text-white px-6 rounded-xl font-bold btn-base"
              >
                Add
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function TxSection({ 
  title, 
  color, 
  items, 
  onSelect, 
  initiallyExpanded = false,
  sectionId,
  expandedSection,
  onToggle
}: { 
  title: string;
  color: string;
  items: (string | { name: string; color?: string })[];
  onSelect: (n: string) => void;
  initiallyExpanded?: boolean;
  sectionId?: string;
  expandedSection?: string | null;
  onToggle?: (id: string) => void;
}) {
  const [isCollapsed, setIsCollapsed] = useState(!initiallyExpanded);
  
  // Use controlled state if provided, otherwise use internal state
  const collapsed = sectionId && expandedSection !== undefined 
    ? expandedSection !== sectionId
    : isCollapsed;
  
  const handleToggle = () => {
    if (sectionId && onToggle) {
      onToggle(sectionId);
    } else {
      setIsCollapsed(!isCollapsed);
    }
  };
  
  const colorMap: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-800 border-emerald-100',
    pink: 'bg-rose-50 text-rose-800 border-rose-100',
    blue: 'bg-blue-50 text-blue-800 border-blue-100',
    neutral: 'bg-neutral-100 text-neutral-800 border-neutral-200'
  };
  
  const textColorMap: Record<string, string> = {
    red: 'text-red-600',
    blue: 'text-blue-600',
    emerald: 'text-emerald-600'
  };

  return (
    <div>
      <div 
        onClick={handleToggle}
        className={`flex items-center justify-between p-4 cursor-pointer font-bold select-none text-left ${colorMap[color]}`}
      >
        <span>{title}</span>
        <ChevronDown className={`transition-transform duration-300 ${collapsed ? '-rotate-90' : ''}`} />
      </div>
      <motion.div 
        initial={{ height: collapsed ? 0 : 'auto', opacity: collapsed ? 0 : 1 }}
        animate={{ height: collapsed ? 0 : 'auto', opacity: collapsed ? 0 : 1 }}
        transition={{ duration: 0.3 }}
        className="overflow-hidden bg-white"
      >
        <div className="p-3 grid grid-cols-1 gap-2">
          {items.map(item => {
            const itemName = typeof item === 'string' ? item : item.name;
            const itemColor = typeof item === 'string' ? null : item.color;
            const textColorClass = itemColor ? textColorMap[itemColor] : 'text-neutral-700';
            
            return (
              <button 
                key={itemName} 
                onClick={() => onSelect(itemName)} 
                className={`w-full text-left p-3 bg-neutral-50 rounded-xl font-bold text-sm hover:bg-neutral-100 btn-base ${textColorClass}`}
                data-medication={itemName}
              >
                {itemName}
              </button>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
