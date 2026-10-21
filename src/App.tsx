/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { registerSW } from 'virtual:pwa-register';
import { APP_VERSION, LAST_SEEN_VERSION_KEY, pendingReleaseNotes } from './releaseNotes';
import { motion, AnimatePresence, useIsPresent } from 'motion/react';
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
  AlertTriangle,
  XCircle,
  X,
  ShieldCheck,
  Stethoscope,
  Sliders,
  RefreshCw,
  Hand,
  User,
  Check,
  ClipboardList,
  MoreVertical,
  NotebookPen,
  Pencil,
  Timer,
  Hourglass, MessageSquareText } from 'lucide-react';
import { AppState, Treatment, OverlayType , HandoverFields } from './types';
import InteractiveTutorial, { ModeAboutSlide } from './InteractiveTutorial';
import TutorialOverlay, { getTutorialNodes, TUTORIAL_FLASH_CLASSES } from './TutorialOverlay';

// --- Constants ---
const INITIAL_STATE: AppState = {
  running: false,
  reversiblesChecklistOpened: false,
  caseOpenedAt: null,
  caseClosedAt: null,
  startTime: null,
  pausedTime: 0,
  elapsedSeconds: 0,
  rhythmCheckTarget: 120, // 2 minutes
  rhythmCheckOvertime: 0, // Counts up from 0 to 6 after rhythm check hits 0:00
  rhythmCheckPaused: false, // When true, rhythm check stays frozen even while running
  rhythmCheckDelayedAt: null, // Elapsed second a delayed rhythm check fell due (null = not delayed)
  cprRound: 1,
  adrenalineWipedAt: null,
  amiodaroneWipedAt: null,
  treatments: [],
  currentOverlay: null,
  catchupElapsed: 0,
  startClockTime: null,
  patientWeight: null,
  patientType: null,
  patientAge: null,
  infusionDoses: {} as Record<string, string>,
  reversiblesChecked: [],
  roscChecked: [],
  pheaChecked: [],
  isROSCMode: false,
  timingMode: null,
  rhythmInterval: null,
  vitals: { hr: '', rr: '', gcs: '', bpSys: '', bpDia: '', spo2: '', etco2: '', bgl: '', temp: '' }
};

const MEDICATIONS = [
  'Adrenaline push', 'Adrenaline infusion', 'Amiodarone', 
  'Atropine', 'Calcium', 'Glucose 10%', 'Heparin', 'Ketamine push', 'Ketamine infusion', 'Levetiracetam (Keppra)', 'Lignocaine',
  'Magnesium', 'Midazolam push', 'Morph/midaz infusion', 'Naloxone', 'Normal saline', 'Ondansetron', 'Oxygen', 'Sodium bicarbonate', 'Suxamethonium'
];

type DoseOption = {
  dose: string;
  population: 'adult' | 'paed' | 'both';
  indication?: string;
  calculated?: boolean;
  minWeight?: number;
  maxWeight?: number;
};


const DOSE_CONFIG: Record<string, { doses: DoseOption[], customUnit?: string }> = {
  'Adrenaline push': { 
    doses: [
      { dose: '1mg', population: 'adult', indication: 'Cardiac arrest' },
      { dose: '0.01mg/kg', population: 'paed', indication: 'Cardiac arrest', calculated: true },
      { dose: 'Other', population: 'both' }
    ],
    customUnit: 'mcg'
  },
  'Adrenaline infusion': { 
    doses: [
      { dose: '3mg/50mL', population: 'both', indication: 'Infusion pump — adult or large paed (≥21kg)', minWeight: 21 },
      { dose: '300mcg/50mL', population: 'paed', indication: 'Infusion pump — small paed (≤20kg)', maxWeight: 20 },
      { dose: '1mg/500mL', population: 'both', indication: 'Gravity fed — adult & paed' },
    ] 
  },
  'Amiodarone': { 
    doses: [
      { dose: '300mg', population: 'adult', indication: 'VF/pVT cardiac arrest' },
      { dose: '150mg', population: 'adult', indication: 'VT/AF/atrial flutter with output / VF/pVT cardiac arrest (repeat)' },
      { dose: '5mg/kg', population: 'paed', indication: 'VF/pVT cardiac arrest / VT with output', calculated: true },
      { dose: '2.5mg/kg', population: 'paed', indication: 'VF/pVT cardiac arrest (repeat)', calculated: true },
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
      { dose: '0.5mg/kg', population: 'both', indication: 'CPR-induced consciousness', calculated: true },
      { dose: '1mg/kg', population: 'adult', indication: 'Intubation induction with suxamethonium / Post-intubation analgosedation', calculated: true },
      { dose: '1mg/kg', population: 'paed', indication: 'Post-intubation analgosedation', calculated: true },
      { dose: '2mg/kg', population: 'adult', indication: 'Intubation when suxamethonium is contraindicated', calculated: true },
      { dose: 'Other', population: 'both' }
    ] 
  },
  'Ketamine infusion': {
    doses: [
      { dose: '400mg/40mL', population: 'adult', indication: 'Post-intubation analgosedation' },
    ]
  },
  'Lignocaine': { 
    doses: [
      { dose: '1mg/kg', population: 'both', indication: 'VT with output', calculated: true },
      { dose: '40mg (via IO)', population: 'adult', indication: 'Conscious IO' },
      { dose: '0.5mg/kg (via IO)', population: 'paed', indication: 'Conscious IO', calculated: true },
      { dose: 'Other', population: 'both' }
    ] 
  },
  'Magnesium': { 
    doses: [
      { dose: '2.5g', population: 'adult', indication: 'pVT secondary to prolonged QT / Torsades de pointes / Pre-eclampsia / Seizures due to eclampsia' },
      { dose: '50mg/kg', population: 'paed', indication: 'With cardiac output / Without cardiac output', calculated: true },
      { dose: 'Other', population: 'both' }
    ] 
  },
  'Midazolam push': { 
    doses: [
      { dose: '0.05mg/kg', population: 'both', indication: 'Post-intubation sedation (adjunct to ketamine)', calculated: true },
      { dose: 'Other', population: 'both' }
    ] 
  },
  'Morphine': {
    doses: [
      { dose: 'Other', population: 'both' }
    ],
    customUnit: 'mg'
  },
  'Normal saline': { 
    doses: [
      { dose: '250mL', population: 'both' },
      { dose: '500mL', population: 'both' },
      { dose: 'Other', population: 'both' }
    ] 
  },
  'Sodium bicarbonate': { 
    doses: [
      { dose: '1mMol/kg', population: 'both', indication: 'Cardiac arrest: Hyperkalaemia/OD / Cardioactive drug OD with output', calculated: true },
      { dose: '0.5mMol/kg', population: 'both', indication: 'Hyperkalaemia with output', calculated: true },
      { dose: 'Other', population: 'both' }
    ] 
  },
  'Suxamethonium': { 
    doses: [
      { dose: '1.5mg/kg', population: 'adult', indication: 'Intubation', calculated: true },
      { dose: 'Other', population: 'both' }
    ] 
  },
  'Oxygen': {
    doses: [
      { dose: 'Nasal cannulae', population: 'both' },
      { dose: 'NRB', population: 'both' },
      { dose: 'BVM', population: 'both' }
    ]
  },
  'Morph/midaz infusion': {
    doses: [
      { dose: '30mg/30mL', population: 'adult', indication: 'Post-intubation analgosedation' },
    ]
  },
  'Levetiracetam (Keppra)': {
    doses: [
      { dose: '40mg/kg', population: 'both', indication: 'Seizure', calculated: true },
      { dose: 'Other', population: 'both' }
    ]
  },
  'Naloxone': {
    doses: [
      { dose: '0.8mg', population: 'adult', indication: 'Suspected narcotic OD' },
      { dose: '0.4mg', population: 'adult', indication: '2nd+ dose increments' },
      { dose: '0.01mg/kg', population: 'paed', indication: 'Suspected narcotic OD', calculated: true },
      { dose: 'Other', population: 'both' }
    ]
  },
  'Ondansetron': {
    doses: [
      { dose: '8mg', population: 'adult', indication: 'Nausea/vomiting' },
      { dose: '0.1mg/kg', population: 'paed', indication: 'Nausea/vomiting', calculated: true },
      { dose: 'Other', population: 'both' }
    ]
  }
};

const INFUSION_DRUGS = ['Adrenaline infusion', 'Ketamine infusion', 'Morph/midaz infusion'];

// When a drug was given, as a time of day: the last dose, or for an infusion when it was started.
// Doses with an unknown time are skipped; catch-up doses show as "< hh:mm". (Shown on screen and in the Handover only.)
const doseTimeNote = (treatments: Treatment[], med: string): { label: string, time: string } | null => {
  const mine = treatments.filter(t => t.name.startsWith(med) && !t.timeUnknown && t.clock);
  if (!mine.length) return null;
  const at = (t: Treatment) => (t.prior ? `< ${t.clock}` : t.clock);       // a catch-up dose is shown as before that time, like the Tx log
  return INFUSION_DRUGS.includes(med) ? { label: 'Started', time: at(mine[0]) } : { label: 'Last', time: at(mine[mine.length - 1]) };
};

// Default unit for a drug's custom ("Other") dose entry: an explicit
// customUnit override, or extracted from its preset doses. /kg is stripped
// since a manually-typed custom dose is always an absolute dose, not a
// weight-based rate.
const getDefaultCustomUnit = (med: string): string => {
  const config = DOSE_CONFIG[med];
  if (!config) return '';
  if (config.customUnit) return config.customUnit;
  const unitMatches = config.doses
    .filter(d => d.dose !== 'Other')
    .map(d => {
      const match = d.dose.match(/(mg\/kg|mMol\/kg|mL\/kg|mcg\/kg|u\/kg|mg|mL|mMol|mcg|g|u|%)$/i);
      if (!match) return null;
      return match[1].replace('/kg', '');
    })
    .filter((u): u is string => Boolean(u));
  return unitMatches.length > 0 ? unitMatches[0] : '';
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
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}m, ${secs.toString().padStart(2, '0')}s`;
};

// For "App recording for" specifically - once a case runs an hour or more,
// hr/min reads more naturally than a large minute count (matches the same
// threshold-switch pattern used for mcg->mg and mL->L in the Pharma Summary).
// Below that threshold, minutes aren't zero-padded either (6min, not 06min) -
// this has its own inline formatting rather than delegating to formatTimeHMM
// for that case, since formatTimeHMM's zero-padded minutes are still wanted
// for the Ago column it's shared with.
const formatRecordingDuration = (seconds: number): string => {
  const totalMins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (totalMins >= 60) {
    const hrs = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    return `${hrs}hr, ${mins}min`;
  }
  return `${totalMins}min, ${secs.toString().padStart(2, '0')}s`;
};

// Case duration, shown on a closed case (this run's summary, or a saved
// case being viewed) - from Elapsed Time's own final value, i.e. the case's
// actual timed duration, not wall-clock time since the app/monitor was
// opened (which starts before Elapsed Time does, during setup, and is what
// "App recording for" used to show). Log mode never tracks Elapsed Time, so
// its closed summary falls back to that same wall-clock figure instead -
// still in this format, just under the "App recording for" label.
const TIMING_MODE_LABELS: Record<'elapsed' | 'log' | 'minimal', string> = {
  log: 'General – Tx log only',
  minimal: 'Arrest – Timers',
  elapsed: 'Arrest – Timers + Tx log',
};

// Order the App Mode cards are stacked in: easiest to use at the top, hardest
// at the bottom (matches the difficulty levels in TIMING_MODE_DETAILS).
const TIMING_MODE_ORDER: Array<'log' | 'minimal' | 'elapsed'> = ['minimal', 'elapsed', 'log'];
// On the start screen the cards sit under "Cardiac arrest" and "Something else", so each card only needs its short name
const MODE_SHORT_NAMES: Record<'log' | 'minimal' | 'elapsed', string> = { minimal: 'Timers', elapsed: 'Timers + Tx log', log: 'Tx log only' };
// (a short name wraps after the "+" if it has to, never in the middle of "Tx log")
const ModeShortName = ({ mode }: { mode: 'log' | 'minimal' | 'elapsed' }) => {
  const parts = MODE_SHORT_NAMES[mode].split(' + ');
  return parts.length === 2 ? <><span className="whitespace-nowrap">{parts[0]} +</span> <span className="whitespace-nowrap">{parts[1]}</span></> : <span className="whitespace-nowrap">{MODE_SHORT_NAMES[mode]}</span>;
};
const ModeGroupHeading = ({ text }: { text: string }) => (
  <div data-mode-group-heading className="text-xl font-extrabold text-neutral-900 text-center">{text}</div>
);

// The icon for each App Mode: the notepad for the Tx log, the stopwatch for the
// timers, and both together. Shared by the setup cards and the Change Mode
// buttons so they always match.
const ModeIcon = ({ mode, size = 40, dim = false }: { mode: 'log' | 'minimal' | 'elapsed'; size?: number; dim?: boolean }) => {
  const fade = dim ? 'opacity-40' : '';
  if (mode === 'log') return <NotebookPen size={size} strokeWidth={1.5} className={`text-neutral-700 ${fade}`} />;
  if (mode === 'minimal') return <Timer size={size} strokeWidth={1.5} className={`text-emerald-600 ${fade}`} />;
  const pair = Math.round(size * 0.85);
  return (
    <div className={`flex items-center gap-1 ${fade}`}>
      <Timer size={pair} strokeWidth={1.75} className="text-emerald-600" />
      <Plus size={Math.round(size * 0.25)} strokeWidth={2.5} className="text-neutral-400" />
      <NotebookPen size={pair} strokeWidth={1.75} className="text-neutral-700" />
    </div>
  );
};

// What's revealed under whichever App Mode card is selected: a one-line
// description and how difficult the mode is to use (1 = easiest, 3 = hardest),
// which is drawn as a low-to-high meter rather than written out. Anything
// longer lives behind the card's "Learn more" (ModeAboutSlide).
const TIMING_MODE_DETAILS: Record<'log' | 'minimal' | 'elapsed', { summary: string; difficulty: 1 | 2 | 3 }> = {
  log: { summary: 'A detailed log of the case', difficulty: 2 },
  minimal: { summary: 'Rhythm check and drug timers', difficulty: 1 },
  elapsed: { summary: 'Timers plus a detailed log', difficulty: 3 },
};

// Timers only is fixed for the whole case: you can't switch into it, or out of it, once the case has started. (Tx log only and
// Timers and Tx log can still be switched between, because both keep a log.) That keeps a case's record, and so its handover, complete.
const canChangeMode = (from: 'elapsed' | 'log' | 'minimal' | null, to: 'elapsed' | 'log' | 'minimal'): boolean =>
  from === null || (from !== to && from !== 'minimal' && to !== 'minimal');

// A mode's name, written so that if it has to wrap it wraps after the dash ("Arrest –" / "Tx log + timers"), not in the middle of a half
const ModeLabel = ({ mode }: { mode: 'elapsed' | 'log' | 'minimal' }) => {
  const [a, b] = TIMING_MODE_LABELS[mode].split(' – ');
  return <><span className="whitespace-nowrap">{a} –</span> <span className="whitespace-nowrap">{b}</span></>;
};

const DIFFICULTY_LABELS = ['low', 'medium', 'high'] as const;
const DIFFICULTY_COLOURS = ['bg-emerald-500', 'bg-amber-400', 'bg-red-500'] as const;

const formatDurationHM = (seconds: number): string => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hrs}h, ${mins}m`;
};

// The browser's print dialog / "Save as PDF" suggests document.title as the
// default filename, so this briefly renames the page to the desired export
// name right before printing, then restores the real title afterwards -
// afterprint fires once the print/save dialog is actually dismissed, with a
// timed fallback in case a particular browser doesn't fire it reliably.
// For on-screen/PDF display specifically - unlike the filename above, slashes
// are fine here since this isn't constrained by filesystem rules.
// Every case date (header and PDF filename) is the date the case was closed,
// never the date it's being viewed/exported. If a case has no recorded close
// time (e.g. archived before caseClosedAt existed), say so rather than
// substituting today's date.
const formatCaseDate = (closedAt: number | null) =>
  closedAt ? formatDisplayDate(new Date(closedAt)) : 'Date not recorded';

const formatDisplayDate = (date: Date) => {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const exportCasePdf = (closedAt: number | null) => {
  const originalTitle = document.title;
  if (closedAt) {
    const closed = new Date(closedAt);
    const dd = String(closed.getDate()).padStart(2, '0');
    const mm = String(closed.getMonth() + 1).padStart(2, '0');
    const yyyy = closed.getFullYear();
    // Hyphens, not slashes: "/" isn't valid in filenames on any OS, so the
    // browser would silently strip or mangle it when suggesting a save name.
    document.title = `Case Summary - ${yyyy}-${mm}-${dd}`;
  } else {
    document.title = 'Case Summary';
  }
  let restored = false;
  const restoreTitle = () => {
    if (restored) return;
    restored = true;
    document.title = originalTitle;
    window.removeEventListener('afterprint', restoreTitle);
  };
  window.addEventListener('afterprint', restoreTitle);
  window.print();
  setTimeout(restoreTitle, 2000);
};

const getLocalTime = (date?: Date) => {
  const d = date || new Date();
  return d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false });
};

const getLocalTimeWithSeconds = (date?: Date) => {
  const d = date || new Date();
  return d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
};

// A rhythm check that came due but whose popup was never answered: nothing was logged
// for it. Rather than leave a gap in the log (while the round count moves on), this entry
// is added when the app moves on - the 0:20 return to the home screen, or the next check
// coming due. It is stamped with the time the check was due, in its place in the log.
const NOTHING_LOGGED_NAME = 'Rhythm check, nothing logged';
const withNothingLoggedEntry = (prev: AppState, newElapsed: number, dueAt: number | null, nowMs: number): Treatment[] => {
  const due = dueAt ?? newElapsed;
  const at = new Date(nowMs - Math.max(0, newElapsed - due) * 1000);
  const entry: Treatment = {
    name: NOTHING_LOGGED_NAME,
    elapsed: due,
    round: prev.cprRound,
    clock: getLocalTime(at),
    clockSeconds: getLocalTimeWithSeconds(at),
    loggedAt: at.getTime()
  };
  const list = [...prev.treatments];
  const i = list.findIndex(t => t.elapsed > due);
  if (i === -1) list.push(entry); else list.splice(i, 0, entry);
  return list;
};

// Medications that carry a dose/detail suffix after the drug name, used both
// for identity-matching (numbering repeats) and for splitting the med from
// its dose in the treatment log display.
const KNOWN_MEDS = [
  'Adrenaline infusion', 'Adrenaline push', 'Amiodarone', 'Atropine',
  'Calcium', 'Glucose 10%', 'Heparin', 'Ketamine infusion', 'Ketamine push',
  'Levetiracetam (Keppra)', 'Lignocaine', 'Magnesium', 'Midazolam push',
  'Morph/midaz infusion', 'Normal saline', 'Suxamethonium'
];

// Identifies the 'type' of a treatment for numbering purposes, ignoring any
// numbering already present (so re-checking an already-numbered entry like
// "Shock #2 - VF" still correctly identifies as "Shock").
// ROSC is its own kind of entry. It used to be stored as 'Disarm - ROSC' (and cases saved that way,
// including numbered forms like 'Disarm #2 - ROSC', still exist), so both are recognised.
const isRoscName = (name: string): boolean => /^(Disarm( #\d+)? - )?ROSC( #\d+)?$/.test(name.trim());

const getTreatmentIdentity = (rawName: string): string => {
  const name = rawName.replace(/#\d+\s*/, '').replace(/\s+/g, ' ').trim();
  if (isRoscName(name)) return 'ROSC';
  if (name.startsWith('Oxygen ')) return 'Oxygen';
  if (name.startsWith('Sodium bicarbonate')) return 'Sodium bicarbonate';
  if (name.startsWith('Shock')) return 'Shock';
  if (name.startsWith('Disarm')) return 'Disarm';
  // Failable interventions: a failed attempt and a later successful one are
  // still both attempts at the same procedure, so they number together
  // (e.g. "IV access - Unsuccessful" then "IV access #2") rather than being
  // treated as unrelated entries.
  const FAILABLE_INTERVENTIONS = ['ETT', 'FONA', 'IGT', 'LMA', 'IO access', 'IV access', 'NPA', 'OPA', 'Suction', 'Reassurance provided'];
  for (const proc of FAILABLE_INTERVENTIONS) {
    if (name === proc || name.startsWith(proc + ' ')) return proc;
  }
  for (const med of KNOWN_MEDS) {
    if (name === med || name.startsWith(med + ' ')) return med;
  }
  return name;
};

// Inserts '#N' immediately after the identity portion of a (never-yet-numbered)
// treatment name, e.g. ('Shock - VF', 'Shock', 2) -> 'Shock #2 - VF',
// ('Adrenaline push 1mg', 'Adrenaline push', 2) -> 'Adrenaline push #2 1mg',
// ('BVM', 'BVM', 2) -> 'BVM #2'.
const insertTreatmentNumber = (name: string, identity: string, num: number): string => {
  if (name.startsWith(identity)) {
    return `${identity} #${num}${name.slice(identity.length)}`;
  }
  return `${name} #${num}`;
};

// Removes an existing '#N' from a name that's already been numbered, so it
// can be correctly renumbered (or left bare) after treatments are re-ordered
// by a deletion, e.g. ('Shock #3 - VF', 'Shock') -> 'Shock - VF'.
const stripTreatmentNumber = (name: string, identity: string): string => {
  if (!name.startsWith(identity)) return name;
  const rest = name.slice(identity.length).replace(/^ #\d+/, '');
  return identity + rest;
};

// Re-derives correct sequential numbering for every treatment, in chronological
// (stored) order, per identity group. Call this any time the treatment list is
// reordered or an entry removed, so e.g. deleting 'Tx #2' out of '#1, #2, #3'
// correctly leaves '#1, #2' rather than a gap at '#1, #3'.
const renumberTreatments = (treatments: Treatment[]): Treatment[] => {
  const seenCounts: Record<string, number> = {};
  return treatments.map(t => {
    // A ROSC saved the old way ('Disarm - ROSC') is renamed 'ROSC' when it's renumbered
    const current = isRoscName(t.name) ? 'ROSC' : t.name;
    const identity = getTreatmentIdentity(current);
    const baseName = stripTreatmentNumber(current, identity);
    const count = (seenCounts[identity] = (seenCounts[identity] || 0) + 1);
    return { ...t, name: count > 1 ? insertTreatmentNumber(baseName, identity, count) : baseName };
  });
};

// Pure pharma summary calculation, usable for both live case state and
// archived previous-case snapshots (neither depends on component state).
// mg/mcg entries always aggregate internally as mcg, regardless of which
// unit was logged first - keeps aggregation order-independent, so the
// display-time formatting below can pick whichever unit reads best.
const toCanonicalUnit = (amount: number, unit: string): { unit: string, amount: number } => {
  const u = unit.toLowerCase();
  if (u === 'mg') return { unit: 'mcg', amount: amount * 1000 };
  return { unit, amount };
};

const computePharmaSummary = (treatments: Treatment[]): Record<string, { totalDose: number, unit: string, count: number, display: string }> => {
  const summary: Record<string, { totalDose: number, unit: string, count: number, display: string }> = {};

  treatments.forEach(tx => {
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
          const [_, rawAmount, rawUnit] = directMatch;
          const { unit, amount } = toCanonicalUnit(parseFloat(rawAmount), rawUnit);
          if (!summary[medName].unit) summary[medName].unit = unit;
          if (summary[medName].unit === unit) {
            summary[medName].totalDose += amount;
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
            const [_, rawAmount, rawUnit] = calculatedMatch;
            const { unit, amount } = toCanonicalUnit(parseFloat(rawAmount), rawUnit);
            if (!summary[med].unit) summary[med].unit = unit;
            if (summary[med].unit === unit) {
              summary[med].totalDose += amount;
            }
          } else {
            // Direct dose: "1mg", "300mg", "100mL", etc.
            const directMatch = doseStr.match(/([\d.]+)(mg|mL|mMol|mcg|g|u|%)/i);
            if (directMatch) {
              const [_, rawAmount, rawUnit] = directMatch;
              const { unit, amount } = toCanonicalUnit(parseFloat(rawAmount), rawUnit);
              if (!summary[med].unit) summary[med].unit = unit;
              if (summary[med].unit === unit) {
                summary[med].totalDose += amount;
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
      // mcg totals of 1000 or more read more naturally as mg
      if (unit.toLowerCase() === 'mcg' && totalDose >= 1000) {
        const mgValue = parseFloat((totalDose / 1000).toFixed(2));
        summary[med].display = `${mgValue}mg (${count})`;
      } else if (unit.toLowerCase() === 'ml' && totalDose >= 1000) {
        // mL totals of 1000 or more read more naturally as L
        const litres = parseFloat((totalDose / 1000).toFixed(2));
        if (med === 'Glucose 10%') {
          const grams = Math.round(totalDose * 0.1 * 10) / 10;
          summary[med].display = `${litres}L/${grams}g (${count})`;
        } else {
          summary[med].display = `${litres}L (${count})`;
        }
      } else {
        const roundedDose = parseFloat(totalDose.toFixed(2));
        if (med === 'Glucose 10%' && unit === 'mL') {
          const grams = Math.round(roundedDose * 0.1 * 10) / 10;
          summary[med].display = `${roundedDose}mL/${grams}g (${count})`;
        } else {
          summary[med].display = `${roundedDose}${unit} (${count})`;
        }
      }
    } else {
      summary[med].display = `${count}`;
    }
  });

  return summary;
};

// --- Previous case backup ---
// Keeps a rolling backup of the last N closed cases in a separate localStorage
// key, so a case survives even if something (crash, tab discard, reload)
// wipes the in-memory "closed case" view before the user exports/deletes it.
const PREVIOUS_CASES_KEY = 'theBigOnePreviousCases';

// Starting and closing a case both wipe local storage for a completely fresh start. These
// survive that: the previous-cases archive (it must outlive any one case), and the record of
// which version's What's New notes were last shown (or they'd be shown again after every case).
const clearStorageForFreshCase = () => {
  const kept = [PREVIOUS_CASES_KEY, LAST_SEEN_VERSION_KEY].map(k => [k, localStorage.getItem(k)] as const);
  localStorage.clear();
  sessionStorage.clear();
  kept.forEach(([k, v]) => { if (v !== null) localStorage.setItem(k, v); });
};

// A few names and checklist labels were respelled in a later version. Saved
// data (a case in progress, or Previous Cases) is read through this, so a case
// saved under the old spelling keeps matching its dose options and ticks.
const LEGACY_TEXT: Array<[RegExp, string]> = [
  [/Levetiracetam \(Kepra\)/g, 'Levetiracetam (Keppra)'],
  [/"SpO2"/g, '"SpO₂"'],
  [/"EtCO2"/g, '"EtCO₂"'],
];
const parseSaved = (raw: string) => JSON.parse(LEGACY_TEXT.reduce((text, [re, to]) => text.replace(re, to), raw));
const MAX_PREVIOUS_CASES = 3;

const loadPreviousCases = (): AppState[] => {
  try {
    const raw = localStorage.getItem(PREVIOUS_CASES_KEY);
    if (!raw) return [];
    const parsed = parseSaved(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Failed to load previous cases backup:', e);
    return [];
  }
};

const savePreviousCase = (caseState: AppState) => {
  try {
    const existing = loadPreviousCases();
    const updated = [caseState, ...existing].slice(0, MAX_PREVIOUS_CASES);
    localStorage.setItem(PREVIOUS_CASES_KEY, JSON.stringify(updated));
  } catch (e) {
    // Storage full or unavailable - don't let backup failure block closing the case,
    // but do log it rather than fail completely silently.
    console.error('Failed to save previous case backup:', e);
  }
};

const calculateDose = (doseStr: string, weight: number | null): string => {
  if (!weight || !doseStr.includes('/kg')) return doseStr;
  
  const match = doseStr.match(/([\d.]+)(mg|g|mcg|ml|mL|mMol)\/kg/i);
  if (!match) return doseStr;
  
  const [_, amount, unit] = match;
  const calculated = parseFloat(amount) * (typeof weight === 'number' ? weight : parseFloat(String(weight)));
  // Round to 2 decimal places, then strip trailing zeros
  const rounded = parseFloat((Math.round(calculated * 100) / 100).toFixed(2));
  
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

const getAdrenalinePushDose = (patientType: string | null, weight: number | null): string => {
  if (patientType === 'paed' && weight) {
    return cleanDoseForLog(calculateDose('0.01mg/kg', weight));
  }
  return '1mg';
};

// doseNumber 1 = first (cardiac arrest) dose, 2 = second (repeat) dose
const getAmiodaroneDose = (patientType: string | null, weight: number | null, doseNumber: 1 | 2): string => {
  if (patientType === 'paed' && weight) {
    const doseStr = doseNumber === 1 ? '5mg/kg' : '2.5mg/kg';
    const clean = cleanDoseForLog(calculateDose(doseStr, weight));
    const mgMatch = clean.match(/([\d.]+)mg/);
    if (mgMatch) {
      const cap = doseNumber === 1 ? 300 : 150;
      const capped = Math.min(parseFloat(mgMatch[1]), cap);
      return `${capped}mg`;
    }
    return clean;
  }
  return doseNumber === 1 ? '300mg' : '150mg';
};

const formatGlucose10Dose = (doseStr: string): string => {
  const mlMatch = doseStr.match(/([\d.]+)\s*(?:ml|mls|mL|mLs)/i);
  if (mlMatch) {
    const mls = parseFloat(mlMatch[1]);
    const grams = Math.round(mls * 0.1 * 10) / 10;
    return `${mls}mL/${grams}g`;
  }
  return doseStr;
};

const formatSodiumBicarbonateDose = (doseStr: string): string => {
  const mmolMatch = doseStr.match(/([\d.]+)\s*(?:mmol|mMol|MMOL)/i);
  if (mmolMatch) {
    const mmol = parseFloat(mmolMatch[1]);
    return `${mmol}mMol`;
  }
  return doseStr;
};

const formatCalciumDose = (doseStr: string, weight: number | null): string => {
  if (!weight) return doseStr;
  const calculatedMg = Math.min(10 * (typeof weight === 'number' ? weight : parseFloat(String(weight))), 1000);
  return calculatedMg >= 1000 ? `1g` : `${calculatedMg}mg`;
};

// Content of the Next adrenaline / Next amiodarone timer boxes.
// Status text arrives as e.g. "Next adrenaline: 2:28", "Next adrenaline: -0:32"
// or "Next amiodarone: unknown". Laid out as two lines -
// drug name above the countdown - in the drug's colours, or dark red when overdue.
// ("Next" is dropped from the display; the status text itself is unchanged.)
const DrugTimerContent = ({ text, flashRed, nameColour, timeColour }: {
  text: string; flashRed: boolean; nameColour: string; timeColour: string;
}) => {
  const hasTime = text.includes(':');
  const label = hasTime ? text.split(':')[0] : text;
  const time = hasTime ? text.split(':').slice(1).join(':').trim() : null;
  const match = label.match(/^Next\s+(.*)$/);
  const drug = match ? match[1] : label;
  const nameClass = flashRed ? 'text-red-900' : nameColour;
  const timeClass = flashRed ? 'text-red-900' : timeColour;
  return (
    <>
      <span className={`font-bold tracking-wide text-center leading-tight text-[17px] sm:text-[22px] mb-1 sm:mb-2 ${nameClass}`}>
        {drug.charAt(0).toUpperCase() + drug.slice(1)}
      </span>
      {time && (
        <span className={`font-bold text-center leading-none tabular-nums text-[25px] sm:text-[47px] ${timeClass}`}>
          {time}
        </span>
      )}
    </>
  );
};

export default function App() {
  // What's New: the notes to show (once) after an update. Worked out once, on load.
  const [pendingNotes, setPendingNotes] = useState(() => {
    const lastSeen = localStorage.getItem(LAST_SEEN_VERSION_KEY);
    // Closing a case wipes the disclaimer flag, so that alone can't tell an existing user from a new
    // one: saved cases, or a case in progress, count as well.
    const hadPriorUse = localStorage.getItem('disclaimerAccepted') === 'true'
      || localStorage.getItem(PREVIOUS_CASES_KEY) !== null
      || localStorage.getItem('theBigOneState') !== null;
    const pending = pendingReleaseNotes(lastSeen, hadPriorUse);
    // Nothing to say (a brand-new install, or this version has no notes): count it as seen
    if (pending.length === 0 && lastSeen !== APP_VERSION) localStorage.setItem(LAST_SEEN_VERSION_KEY, APP_VERSION);
    return pending;
  });
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
        const loaded = parseSaved(saved);
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
      const loaded = parseSaved(saved);
      if (loaded.running) return false; // Actively running -> home screen
      if (loaded.caseClosedAt) return false; // Closed but not deleted -> case summary screen
      return true; // Never started -> catchup
    } catch (e) {
      return true;
    }
  });
  const [catchupStep, setCatchupStep] = useState(1);
  const [catchupTxMode, setCatchupTxMode] = useState(false);
  const [catchupElapsed, setCatchupElapsed] = useState({ hrs: 0, mins: 0, secs: 0 });
  const [weightType, setWeightType] = useState<'adult' | 'paed' | null>(null);
  const [paedWeightMethod, setPaedWeightMethod] = useState<'weight' | 'age' | null>(null);
  const [paedAgeLabel, setPaedAgeLabel] = useState<string>('');
  const [weightInput, setWeightInput] = useState('');
  const [priorCounts, setPriorCounts] = useState({ shock: 0, disarm: 0, adrenaline: 0, amiodarone: 0 });
  const [priorTxs, setPriorTxs] = useState<string[]>([]);
  const [useManualEntry, setUseManualEntry] = useState(false);
  const [elapsedTimestamp, setElapsedTimestamp] = useState<number | null>(null);
  const [timingMode, setTimingMode] = useState<'elapsed' | 'log' | 'minimal' | null>(() => state.timingMode);
  // Which App Mode card is currently expanded. Kept apart from timingMode so
  // tapping the chosen card again can shrink it without un-choosing the mode.
  const [expandedMode, setExpandedMode] = useState<'elapsed' | 'log' | 'minimal' | null>(null);

  const [rhythmInterval, setRhythmInterval] = useState<'evens' | 'odds' | 'half-evens' | 'half-odds' | null>(() => state.rhythmInterval);
  const [demoTick, setDemoTick] = useState(0); // drives animated timers on mode selection screen
  const [isCaseClosed, setIsCaseClosed] = useState(() => {
    const saved = localStorage.getItem('theBigOneState');
    if (!saved) return false;
    try {
      const loaded = parseSaved(saved);
      return !loaded.running && !!loaded.caseClosedAt;
    } catch (e) {
      return false;
    }
  });
  const [showEndWarning, setShowEndWarning] = useState(false);
  const [disregardAdrenaline, setDisregardAdrenaline] = useState<'pending' | 'confirmed' | null>(null);
  const [disregardAmiodarone, setDisregardAmiodarone] = useState<'pending' | 'confirmed' | null>(null);
  const [showCloseWarning, setShowCloseWarning] = useState(false);
  const [showHandover, setShowHandover] = useState(false);
  const handoverViewRef = useRef<'fill' | 'read'>('fill');
  // The Handover's Close / Back / Next buttons are drawn in the bottom bar, outside the box (a portal into this element)
  const [handoverBar, setHandoverBar] = useState<HTMLElement | null>(null);
  // Which Fill in page the crew had reached, so being interrupted (the 0:20 close, another screen) doesn't lose their place.
  // Closing it (or being interrupted) keeps it, so it reopens where they were; a handover that's begun but never opened comes up on Review.
  const handoverResumeRef = useRef<string | null>(null);
  const closeHandover = () => { setShowHandover(false); };
  // The Handover button in the top row: opens the handover in the central box (closing any other screen over it), and closes it again
  const handoverOpen = showHandover && !state.currentOverlay;
  const toggleHandover = () => {
    if (handoverOpen) { closeHandover(); return; }
    setState(p => ({ ...p, currentOverlay: null }));
    setShowHandover(true);
  };
  // The weight box on the Handover page: the same change as the Recalibrate menu's weight, logged the same way
  const setHandoverWeight = (w: number, type: 'adult' | 'paed', ageLabel: string | null) => {
    if (state.patientWeight != null && w !== state.patientWeight) addTreatment(`Weight changed: ${state.patientWeight}kg → ${w}kg`);
    // (Arrest – Timers keeps no patient type, so only the weight is saved there)
    setState(prev => ({ ...prev, patientWeight: w, patientType: prev.timingMode === 'minimal' ? prev.patientType : type, patientAge: prev.timingMode === 'minimal' ? null : ageLabel }));
  };   // which Handover view is open (the Read out view isn't closed at 0:20)
  const [previousCases, setPreviousCases] = useState<AppState[]>(() => loadPreviousCases());
  const [showPreviousCasesList, setShowPreviousCasesList] = useState(false);
  const [viewingPreviousCase, setViewingPreviousCase] = useState<AppState | null>(null);
  // While a saved case is open, flag <body> so print CSS can hide #root
  // (the welcome/catchup screen behind the viewer) and print only the
  // portalled viewer.
  useEffect(() => {
    document.body.classList.toggle('viewing-previous-case', !!viewingPreviousCase);
    return () => document.body.classList.remove('viewing-previous-case');
  }, [viewingPreviousCase]);
  const [showPauseWarning, setShowPauseWarning] = useState(false);
  const [showResetWarning, setShowResetWarning] = useState(false);
  const [showElapsedRecalibrate, setShowElapsedRecalibrate] = useState(false);
  const [showRecalibrateMenu, setShowRecalibrateMenu] = useState(false);
  const [showModeChange, setShowModeChange] = useState(false);
  // A switch to a timer mode waits for Done in the Recalibrate step before it takes
  // effect: only then is the mode changed, saved and logged. Until then the case
  // is still in its old mode, so a cancel - or the app reloading part-way - leaves
  // everything exactly as it was.
  const [stagedMode, setStagedMode] = useState<'elapsed' | 'log' | 'minimal' | null>(null);
  const [stagedElapsedSeconds, setStagedElapsedSeconds] = useState(0);
  const [elapsedManuallyEdited, setElapsedManuallyEdited] = useState(false);
  const [stagedRhythmInterval, setStagedRhythmInterval] = useState<'evens' | 'odds' | 'half-evens' | 'half-odds'>('evens');
  const [showWeightChange, setShowWeightChange] = useState(false);
  // Set while the weight prompt is open because the person is leaving Timers
  // only (which never asked for one) - the mode change carries on once saved.
  const [pendingWeightForMode, setPendingWeightForMode] = useState<'log' | 'minimal' | 'elapsed' | null>(null);
  const [newWeightInput, setNewWeightInput] = useState('');
  const [newPatientType, setNewPatientType] = useState<'adult' | 'paed' | null>(null);
  const [newPaedWeightMethod, setNewPaedWeightMethod] = useState<'weight' | 'age' | null>(null);
  const [newPaedAgeLabel, setNewPaedAgeLabel] = useState<string | null>(null);
  const [roscButtonFlashing, setRoscButtonFlashing] = useState(false);
  const [showLoggedNotification, setShowLoggedNotification] = useState(false);
  const [showPatternSwitchModal, setShowPatternSwitchModal] = useState(false);
  const loggedTreatmentRef = useRef<string>('');
  const patternSwitchNoticeRef = useRef<string | null>(null);
  const [isShockForced, setIsShockForced] = useState(false);
  // The timer's interval can't see this state directly, so it reads this copy
  const isShockForcedRef = useRef(false);
  isShockForcedRef.current = isShockForced;
  // Once a rhythm check popup is answered or closed, it's no longer pending (see
  // pendingRhythmCheckDueAt). Only on a real change, so a restored pending check
  // isn't wiped as the app starts up.
  const wasShockForcedRef = useRef(false);
  useEffect(() => {
    if (wasShockForcedRef.current && !isShockForced) {
      setState(prev => (prev.pendingRhythmCheckDueAt == null ? prev : { ...prev, pendingRhythmCheckDueAt: null }));
    }
    wasShockForcedRef.current = isShockForced;
  }, [isShockForced]);
  const [rearrested, setRearrested] = useState(false);
  const [editingTreatmentIndex, setEditingTreatmentIndex] = useState<number | null>(null);

  // If a rhythm check becomes forced while editing a past entry, the edit is
  // cancelled outright (no changes saved) rather than left running - without
  // this, isShockForced would stay stuck true once the edit completes, since
  // completing an edit goes through editTreatment, which has no reason to
  // know about (or resolve) a real shock/disarm outcome. Cancelling forces
  // the person straight back to the real, now-visible shock/disarm buttons -
  // the same priority the tutorial overlay already gives itself for this
  // exact situation.
  useEffect(() => {
    if (isShockForced && editingTreatmentIndex !== null) {
      setEditingTreatmentIndex(null);
    }
  }, [isShockForced, editingTreatmentIndex]);

  const [hasShownForcedShock, setHasShownForcedShock] = useState(false);
  const lastBeepSecond = useRef<number | null>(null);
  const hasAutoClosedAt10 = useRef<boolean>(false);
  const previousCountdown = useRef<number | null>(null);
  // Elapsed second the most recent timer-forced rhythm check fell due. The
  // tick advances rhythmCheckTarget the moment the popup fires, so this is
  // the only record of the original due time if the check is then delayed.
  const rhythmCheckDueAtRef = useRef<number | null>(null);
  
  // Tutorial mode state
  const [tutorialMode, setTutorialMode] = useState(false);
  // Shown instead of committing a mode change while the tutorial is running
  const [showTutorialModeBlocked, setShowTutorialModeBlocked] = useState(false);
  // The rhythm check interval at the moment the Timers only tutorial asks for it to be changed
  // (when the Recalibrate node is dismissed and the next node starts waiting), so it can wait for
  // a real change, like the weight change in the other modes. Taken then rather than earlier,
  // because the rhythm check walkthrough just before can still update the interval by itself.
  const [tutorialIntervalBaseline, setTutorialIntervalBaseline] = useState<string | null>(null);
  const tutorialInitialWeightRef = useRef<number | null>(null);
  const [showInteractiveTutorial, setShowInteractiveTutorial] = useState(false);
  const [timingNodesComplete, setTimingNodesComplete] = useState(false);
  // Tutorial only: the mode just chosen on the mode page, while the "you've chosen ..." page is showing
  const [tutorialModeIntro, setTutorialModeIntro] = useState<'log' | 'minimal' | 'elapsed' | null>(null);
  // Which mode's "Learn more" slide is open (opened from the link on its card on the mode page, before committing to it)
  const [aboutMode, setAboutMode] = useState<'log' | 'minimal' | 'elapsed' | null>(null);
  // Tutorial: the mode page's Back asks the intro slides to step back one (see InteractiveTutorial)
  const [introRewind, setIntroRewind] = useState(0);
  // Tutorial: bumped whenever a mode's tutorial is started, so its setup notes need reading afresh
  const [setupReset, setSetupReset] = useState(0);
  const [catchupNodeCleared, setCatchupNodeCleared] = useState(false);
  const [tutorialNodeIndex, setTutorialNodeIndex] = useState(0);
  // Which nodes this tutorial is showing and which one it is on. Everything
  // below refers to nodes by their id, so each mode can have its own list
  // without any position ever needing renumbering.
  const tutorialNodeList = useMemo(() => getTutorialNodes(timingMode ?? 'elapsed'), [timingMode]);
  const tutorialNodeId = tutorialNodeIndex >= tutorialNodeList.length ? 'done' : tutorialNodeList[tutorialNodeIndex].id;
  useEffect(() => {
    if (tutorialMode && tutorialNodeId === 'tabs') setTutorialIntervalBaseline(rhythmInterval);
    if (!tutorialMode) setTutorialIntervalBaseline(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorialMode, tutorialNodeId]);
  // The rhythm check walkthrough only exists in the modes that have timers
  const demoStartIdx = tutorialNodeList.findIndex(n => n.id === 'rhythmDemoFirstPopup');
  const demoEndIdx = tutorialNodeList.findIndex(n => n.id === 'rhythmDemoLastPopup');
  const hasRhythmDemo = demoStartIdx >= 0;
  // Two different questions, so two flags:
  //  - tutorialRhythmDemoActive: are we *inside* the walkthrough? Locks the
  //    home screen's other buttons; ends when the walkthrough does.
  //  - tutorialRhythmLive: has the walkthrough *started*? From then on the
  //    real forced popup, the 0:20 return-to-home and Delay all work normally
  //    for the rest of the tutorial instead of going back to being suppressed.
  const tutorialRhythmDemoActive = tutorialMode && hasRhythmDemo && tutorialNodeIndex >= demoStartIdx && tutorialNodeIndex <= demoEndIdx;
  // The Handover button in the top row (not in Timers only, and not in the tutorial)
  const showHandoverBtn = !tutorialMode && (timingMode === 'log' || timingMode === 'elapsed' || timingMode === 'minimal');
  const tutorialRhythmLive = tutorialMode && hasRhythmDemo && tutorialNodeIndex >= demoStartIdx;
  // The tick's own popup-at-0:00 and auto-close-at-0:20 are a third thing
  // again. Inside the walkthrough they must NOT run on their own schedule:
  // a learner who sits on a popup for two minutes would otherwise have it
  // cleared by the *next* interval's 0:20 return-to-home, or get a second
  // popup fired at them. The only countdowns that should fire the popup are
  // the two scripted ones (entering the first outcome slide, and entering
  // the delay slide). Everything goes back to normal once the walkthrough
  // has genuinely finished - past its last slide AND its last real popup
  // answered - and stays normal from then on.
  const [tutorialRhythmDone, setTutorialRhythmDone] = useState(false);
  useEffect(() => {
    if (!tutorialMode) { setTutorialRhythmDone(false); return; }
    if (hasRhythmDemo && tutorialNodeIndex > demoEndIdx && !isShockForced) setTutorialRhythmDone(true);
  }, [tutorialMode, tutorialNodeIndex, isShockForced, hasRhythmDemo, demoEndIdx]);
  // (A mode with no walkthrough, i.e. no timers, has nothing to hold back.)
  const tutorialAutoCloseOK = !tutorialMode || !hasRhythmDemo || tutorialRhythmDone;
  const tutorialPopupAtZeroOK = !tutorialMode || !hasRhythmDemo || tutorialRhythmDone
    || ((tutorialNodeId === 'rhythmDemoFirstPopup' || tutorialNodeId === 'rhythmDemoDelayPopup') && !isShockForced);
  // Which single outcome the walkthrough is currently asking for - every
  // other outcome (including Delay) is disabled while one of these is set,
  // so the buttons on screen match the instruction on top of them exactly.
  //
  // This is state, not a plain derived value keyed to tutorialNodeIndex,
  // because dismissing the *explanatory slide* (its own "Got it") advances
  // tutorialNodeIndex immediately - well before the real outcome has
  // actually been chosen and the real popup has closed. A restriction tied
  // directly to the index would clear the instant that slide closes,
  // unlocking every button underneath for the brief window before the real
  // click happens - exactly backwards. Instead: arm the restriction on
  // *entering* the relevant index (same moment as the fast-forward
  // mutations below), and only clear it once isShockForced itself goes
  // false, i.e. once a real choice has actually been logged.
  const [tutorialOutcomeRestriction, setTutorialOutcomeRestriction] = useState<'redblue' | 'rosc' | 'delay' | null>(null);
  // True only while the walkthrough's visible fast-forward is running, so the ring can keep up with it
  const [tutorialFastForward, setTutorialFastForward] = useState(false);
  useEffect(() => {
    if (!tutorialMode) return;
    if (tutorialNodeId === 'rhythmDemoFirstPopup') setTutorialOutcomeRestriction('redblue');
    else if (tutorialNodeId === 'rhythmDemoDelayPopup') setTutorialOutcomeRestriction('delay');
    else if (tutorialNodeId === 'rhythmDemoRoscPopup') setTutorialOutcomeRestriction('rosc');
  }, [tutorialMode, tutorialNodeId]);
  useEffect(() => {
    if (!isShockForced) setTutorialOutcomeRestriction(null);
  }, [isShockForced]);
  const caseSummaryScrollRef = useRef<HTMLDivElement>(null);

  // Leaving the tutorial from its first setup page: back to the welcome page,
  // with the tutorial and everything entered in it (mode, weight, interval,
  // previous treatments) cleared so a real calibration starts from scratch.
  // Starting a mode's tutorial is always a clean slate: whatever was entered on the setup
  // screens while trying another mode (or this one) is cleared, as are the setup notes read.
  const resetTutorialSetup = () => {
    setRhythmInterval(null);
    setWeightInput('');
    setWeightType(null);
    setPaedWeightMethod(null);
    setPaedAgeLabel('');
    setCatchupElapsed({ hrs: 0, mins: 0, secs: 0 });
    setUseManualEntry(false);
    setCatchupTxMode(false);
    setPriorTxs([]);
    setPriorCounts({ shock: 0, disarm: 0, adrenaline: 0, amiodarone: 0 });
    setElapsedTimestamp(null);
    setState(INITIAL_STATE);
    setSetupReset(n => n + 1);
  };

  const exitTutorialToWelcome = () => {
    setShowInteractiveTutorial(false);
    setTutorialModeIntro(null);
    setAboutMode(null);
    setTimingNodesComplete(false);
    setCatchupNodeCleared(false);
    setTimingMode(null);
    setExpandedMode(null);
    setRhythmInterval(null);
    setWeightInput('');
    setWeightType(null);
    setPaedWeightMethod(null);
    setPaedAgeLabel('');
    setCatchupElapsed({ hrs: 0, mins: 0, secs: 0 });
    setUseManualEntry(false);
    setCatchupTxMode(false);
    setPriorTxs([]);
    setPriorCounts({ shock: 0, disarm: 0, adrenaline: 0, amiodarone: 0 });
    setElapsedTimestamp(null);
    setState(INITIAL_STATE);
    setCatchupStep(1);
  };

  // Correct timer drift when tab becomes visible again
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && state.running && !state.rhythmCheckPaused) {
        setState(prev => {
          if (!prev.startTime || !prev.running || prev.rhythmCheckPaused) return prev;
          const correctedElapsed = Math.floor((Date.now() - prev.startTime + prev.pausedTime) / 1000);
          if (Math.abs(correctedElapsed - prev.elapsedSeconds) < 2) return prev;
          return { ...prev, elapsedSeconds: correctedElapsed };
        });
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [state.running, state.rhythmCheckPaused]);

  // Mirror timingMode/rhythmInterval into persisted state so a page reload
  // mid-case (crash, phone restart, tab close) restores the correct timing
  // method instead of losing it.
  useEffect(() => {
    setState(prev => {
      if (prev.timingMode === timingMode && prev.rhythmInterval === rhythmInterval) return prev;
      return { ...prev, timingMode, rhythmInterval };
    });
  }, [timingMode, rhythmInterval]);

  // Both the Case Summary page and the live Summary overlay are scrollable,
  // but the tutorial's node markers are positioned relative to the viewport
  // (fixed), not the scroll position. A one-time scroll-into-view isn't
  // enough on its own - if the user then scrolls manually, the marker would
  // drift out of alignment with its target again. So for every node anchored
  // to a specific piece of scrollable content, this scrolls that content
  // into view AND locks scrolling on its container for as long as the node
  // stays active, so the marker can't be knocked out of alignment.
  useEffect(() => {
    if (!tutorialMode) return;

    // Case Summary page: Export PDF and Close Case sit side by side near the
    // top, so both nodes scroll (and lock) to the top of that page.
    if (tutorialNodeId === 'export' || tutorialNodeId === 'delete') {
      caseSummaryScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      const el = caseSummaryScrollRef.current;
      const prevBodyOverflow = document.body.style.overflow;
      const prevBodyTouchAction = document.body.style.touchAction;
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
      const prevOverflow = el?.style.overflowY;
      const prevTouchAction = el?.style.touchAction;
      if (el) {
        el.style.overflowY = 'hidden';
        el.style.touchAction = 'none';
      }
      return () => {
        document.body.style.overflow = prevBodyOverflow;
        document.body.style.touchAction = prevBodyTouchAction;
        if (el) {
          el.style.overflowY = prevOverflow ?? '';
          el.style.touchAction = prevTouchAction ?? '';
        }
      };
    }

    // Case Summary page: Final Case Data is anchored to the Treatment Log
    // banner, which sits below Case Details / Arrest Summary / Vital Signs /
    // Pharma Summary - scroll it to the centre of the screen and lock, same
    // reasoning as the two nodes above.
    if (tutorialNodeId === 'finalStats') {
      document.querySelector('[data-tutorial-anchor="closed-treatment-log-banner"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const el = caseSummaryScrollRef.current;
      const prevBodyOverflow = document.body.style.overflow;
      const prevBodyTouchAction = document.body.style.touchAction;
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
      const prevOverflow = el?.style.overflowY;
      const prevTouchAction = el?.style.touchAction;
      if (el) {
        el.style.overflowY = 'hidden';
        el.style.touchAction = 'none';
      }
      return () => {
        document.body.style.overflow = prevBodyOverflow;
        document.body.style.touchAction = prevBodyTouchAction;
        if (el) {
          el.style.overflowY = prevOverflow ?? '';
          el.style.touchAction = prevTouchAction ?? '';
        }
      };
    }

    // Live Summary overlay: each of its four "info" nodes is anchored to a
    // different section spread across that scroll, so each scrolls its own
    // section to the centre of the screen and locks that container in place.
    const sectionForNode: Record<string, string> = {
      arrestSummaryInfo: 'arrestSummary',
      vitalSignsInfo: 'vitalSigns',
      pharmaSummaryInfo: 'pharmaSummary',
      treatmentLogInfo: 'treatmentLog'
    };
    const section = sectionForNode[tutorialNodeId];
    if (section) {
      document.querySelector(`[data-tutorial-section="${section}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const container = document.querySelector('[data-scroll-container="summary"]') as HTMLElement | null;
      if (container) {
        const prevOverflow = container.style.overflowY;
        const prevTouchAction = container.style.touchAction;
        container.style.overflowY = 'hidden';
        container.style.touchAction = 'none';
        return () => {
          container.style.overflowY = prevOverflow;
          container.style.touchAction = prevTouchAction;
        };
      }
    }
  }, [tutorialMode, tutorialNodeId, state.currentOverlay, isCaseClosed]);

  // Rhythm check walkthrough: fast-forward the countdown at the three points
  // that start it running for real. First, entering the walkthrough itself
  // (jump to 0:20, matching what the real auto-close-at-20 would have left
  // on screen). Then, at the start of each of the two "let's try that again"
  // popups (jump to 0:03, so the real timer counts the last few seconds down
  // and the real popup fires on its own - nothing else here is simulated).
  useEffect(() => {
    if (!tutorialMode) return;
    if (tutorialNodeId === 'rhythmDemoFirstPopup') {
      setState(prev => ({ ...prev, currentOverlay: null, rhythmCheckTarget: prev.elapsedSeconds + 20 }));
    } else if (tutorialNodeId === 'rhythmDemoDelayPopup') {
      // Second time round: jump straight to 0:04, no watch-then-animate -
      // that demonstration only needs to happen once.
      setState(prev => ({ ...prev, rhythmCheckTarget: prev.elapsedSeconds + 4 }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorialMode, tutorialNodeId]);

  // First time round only: once the real countdown (running normally since
  // the walkthrough's first outcome slide) reaches 0:16, visibly fast-forward it down to
  // 0:04 - a quick ticking-down animation, not an instant jump - then let it
  // run normally again from there.
  //
  // This is a self-contained pair of plain intervals, deliberately NOT
  // written as "watch state.rhythmCheckTarget in a useEffect": the animation
  // itself writes to rhythmCheckTarget every 100ms, and a dependency on that
  // same value would tear the effect down and re-run it on every one of its
  // own ticks - clearing the interval a fraction of a second in, every time.
  // Reading the latest state via a ref sidesteps that entirely: the outer
  // effect is created once on arrival at this node and torn down once on
  // leaving it, full stop.
  const rhythmDemoStateRef = useRef(state);
  useEffect(() => { rhythmDemoStateRef.current = state; }, [state]);
  useEffect(() => {
    if (!tutorialMode || tutorialNodeId !== 'rhythmDemoFirstPopup') return;
    let rapidId: number | null = null;
    const watcherId = window.setInterval(() => {
      const s = rhythmDemoStateRef.current;
      const countdown = s.rhythmCheckTarget - s.elapsedSeconds;
      if (countdown > 16) return;
      window.clearInterval(watcherId);
      let remaining = countdown - 4;
      if (remaining <= 0) return;
      setTutorialFastForward(true);
      rapidId = window.setInterval(() => {
        remaining -= 1;
        setState(prev => ({ ...prev, rhythmCheckTarget: prev.elapsedSeconds + 4 + Math.max(remaining, 0) }));
        if (remaining <= 0 && rapidId != null) {
          window.clearInterval(rapidId);
          rapidId = null;
          setTutorialFastForward(false);
        }
      }, 100);
    }, 150);
    return () => {
      window.clearInterval(watcherId);
      if (rapidId != null) window.clearInterval(rapidId);
      setTutorialFastForward(false);
    };
  }, [tutorialMode, tutorialNodeId]);


  // Capture the patient weight as it was when the tutorial started, so we know
  // once it's actually been changed (used to stop the recalibrate/weight flash).
  useEffect(() => {
    if (tutorialMode && tutorialInitialWeightRef.current === null) {
      tutorialInitialWeightRef.current = state.patientWeight;
    }
    if (!tutorialMode) {
      tutorialInitialWeightRef.current = null;
    }
  }, [tutorialMode, state.patientWeight]);

  useEffect(() => {
    // Every other pulse comes from the node the tutorial is currently waiting
    // on (see flashWhileCurrent in TutorialOverlay.tsx): the previous node has
    // been dismissed and this one appears once its instruction is followed, so
    // that instruction's button pulses until then. Once the last node is done,
    // the Close Case button pulses.
    const weightUnchanged = state.patientWeight === tutorialInitialWeightRef.current;
    const adrenalineHandled = !state.treatments.some(t => t.name.startsWith('Adrenaline push'))
      || state.treatments.some(t => t.name.startsWith('Adrenaline push') && (t.timeUnknown || t.edited));
    let activeFlashes: string[] = [];
    if (tutorialMode) {
      activeFlashes = tutorialNodeId === 'done'
        ? ['tutorial-flash-close']
        : (tutorialNodeList[tutorialNodeIndex]?.flashWhileCurrent?.({ state, showRecalibrateMenu, showWeightChange, weightUnchanged, adrenalineHandled, intervalUnchanged: rhythmInterval === tutorialIntervalBaseline, showElapsedRecalibrate }) ?? []);
    }
    TUTORIAL_FLASH_CLASSES.forEach(c => document.body.classList.toggle(c, activeFlashes.includes(c)));

    return () => {
      TUTORIAL_FLASH_CLASSES.forEach(c => document.body.classList.remove(c));
    };
  }, [tutorialMode, tutorialNodeId, tutorialNodeIndex, tutorialNodeList, state, showCatchup, catchupStep, showInteractiveTutorial, timingNodesComplete, showRecalibrateMenu, showWeightChange, rhythmInterval, tutorialIntervalBaseline, showElapsedRecalibrate]);

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

  // Ask the browser to exempt this site's storage from automatic eviction
  // under storage pressure - reduces the risk of the browser silently
  // clearing case data on its own. Silent, one-time, no UI. Not universally
  // supported, so this is feature-detected and just no-ops where it isn't.
  useEffect(() => {
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persist();
    }
  }, []);

  // PWA updates - checked and applied only on the welcome screen.
  // "Welcome screen" = the first catchup step, with no case running, no
  // closed-case summary, no saved case / saved-case list open, and not in
  // the tutorial. Nothing update-related happens anywhere else: no check
  // (network request) and no install/reload during or around a case.
  //
  // Checking: the browser only checks for a new version on a fresh page
  // load. An installed Android PWA is usually resumed from memory rather
  // than freshly loaded, so without an explicit check it can sit on an old
  // version indefinitely. So: check each time the welcome screen is reached,
  // and each time the app is brought back on screen while sitting on it.
  //
  // Applying: silent. Once a new version has downloaded, it's applied
  // (page reload) as soon as the app is on the welcome screen. The current
  // case and the last three saved cases are in localStorage and survive
  // the reload either way.
  const updateSWFnRef = useRef<((reloadPage?: boolean) => Promise<void>) | null>(null);
  const swRegistrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const [updateWaiting, setUpdateWaiting] = useState(false);

  const onWelcomeScreen =
    showCatchup && !catchupTxMode && catchupStep === 1 &&
    !state.running && !isCaseClosed &&
    !viewingPreviousCase && !showPreviousCasesList && !tutorialMode;

  // --- Phone back button ---
  // Anywhere except the welcome screen, one extra history entry sits in front of the app's own
  // entry, so the phone's back button lands on it instead of closing the app. Each back press
  // steps back one layer using the same logic as the on-screen Back / Cancel buttons
  // (handleBackRef below). On the welcome screen no entry is kept, so back closes the app.
  //
  // Why the entry is put back with history.go(1) and not a new pushState: Chrome's back button
  // skips any history entry the page added without a fresh tap behind it, and a back press is not
  // a tap. So an entry pushed from the back handler gets skipped, and the second back press in a
  // row would close the app. Stepping forward onto the entry we already made is never skipped.
  const backTrapActive = !onWelcomeScreen || showInteractiveTutorial || !!aboutMode;
  const backTrapActiveRef = useRef(false);
  backTrapActiveRef.current = backTrapActive;
  // Our extra entry exists, and we're sitting on it. Both start true when the page loads sitting
  // on one (closing a case reloads the page, and a reload keeps the entry), so it's reused or
  // removed instead of forgotten - otherwise the welcome screen would need two back presses to exit.
  const backExistsRef = useRef(typeof window !== 'undefined' && !!window.history.state?.bigOneBackTrap);
  const backAtSentinelRef = useRef(backExistsRef.current);
  const backFreshRef = useRef(false);          // a real tap has happened since the last back/forward move
  const backIgnorePopsRef = useRef(0);         // popstate events caused by our own history.go() calls
  const backIgnoreUntilRef = useRef(0);
  const backArmedRef = useRef(false);          // waiting for a tap before adding the entry
  const handleBackRef = useRef<() => void>(() => {});

  // History moves are done one at a time: the browser drops a second history.go() made before the
  // first one has finished (e.g. stepping back onto our entry and then straight off it again).
  const backQueueRef = useRef<number[]>([]);
  const backBusyRef = useRef(false);
  const backPump = () => {
    if (backBusyRef.current) return;
    const delta = backQueueRef.current.shift();
    if (delta === undefined) return;
    backBusyRef.current = true;
    backIgnorePopsRef.current += 1;
    backIgnoreUntilRef.current = Date.now() + 1500;
    window.history.go(delta);
    // If the move never reports back (nothing to move to), don't stay stuck
    window.setTimeout(() => {
      if (backBusyRef.current && Date.now() >= backIgnoreUntilRef.current) {
        backBusyRef.current = false;
        backIgnorePopsRef.current = 0;
        backPump();
      }
    }, 1600);
  };
  const backGo = (delta: number) => { backQueueRef.current.push(delta); backPump(); };

  const addBackSentinel = () => {
    if (backExistsRef.current) {
      if (!backAtSentinelRef.current) { backAtSentinelRef.current = true; backGo(1); }
      return;
    }
    // Chrome only keeps an entry that was added with a fresh tap behind it (a back/forward move
    // uses the tap up), so on a fresh start, or after a back press, wait for the next tap.
    if (!backFreshRef.current) {
      if (backArmedRef.current) return;
      backArmedRef.current = true;
      const arm = (e: Event) => {
        if (!e.isTrusted) return;
        window.removeEventListener('pointerup', arm, true);
        window.removeEventListener('keydown', arm, true);
        backArmedRef.current = false;
        backFreshRef.current = true;
        if (backTrapActiveRef.current && !backExistsRef.current) {
          window.history.pushState({ bigOneBackTrap: true }, '');
          backExistsRef.current = true;
          backAtSentinelRef.current = true;
        }
      };
      window.addEventListener('pointerup', arm, true);
      window.addEventListener('keydown', arm, true);
      return;
    }
    window.history.pushState({ bigOneBackTrap: true }, '');
    backExistsRef.current = true;
    backAtSentinelRef.current = true;
  };

  const removeBackSentinel = () => {
    if (!backExistsRef.current) return;
    if (backAtSentinelRef.current) { backAtSentinelRef.current = false; backGo(-1); }
    backExistsRef.current = false;
  };

  useEffect(() => {
    if (backTrapActive) addBackSentinel(); else removeBackSentinel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backTrapActive]);

  useEffect(() => {
    const mark = (e: Event) => { if (e.isTrusted) backFreshRef.current = true; };
    const evs = ['pointerup', 'keydown', 'touchend', 'click'];
    evs.forEach(t => window.addEventListener(t, mark, true));
    const onPop = () => {
      backFreshRef.current = false;              // a back/forward move uses up the last tap
      if (backIgnorePopsRef.current > 0 && Date.now() < backIgnoreUntilRef.current) {
        backIgnorePopsRef.current -= 1;
        backBusyRef.current = false;
        backPump();                              // start the next queued move, if any
        return;
      }
      backIgnorePopsRef.current = 0;
      const onSentinel = !!window.history.state?.bigOneBackTrap;
      backAtSentinelRef.current = onSentinel;
      if (onSentinel) return;                    // moved forward onto our entry: nothing to do
      // Back was pressed and we landed on the app's own entry
      if (!backTrapActiveRef.current) { backExistsRef.current = false; return; }   // welcome screen: back works as normal
      handleBackRef.current();
      if (backExistsRef.current) { backAtSentinelRef.current = true; backGo(1); }  // step back onto our entry
    };
    window.addEventListener('popstate', onPop);
    return () => {
      evs.forEach(t => window.removeEventListener(t, mark, true));
      window.removeEventListener('popstate', onPop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openWeightChange = () => {
    setNewWeightInput(String(state.patientWeight ?? ''));
    setNewPatientType(state.patientType as 'adult' | 'paed');
    if (state.patientType === 'paed' && state.patientAge) { setNewPaedWeightMethod('age'); setNewPaedAgeLabel(state.patientAge); }
    else { setNewPaedWeightMethod('weight'); setNewPaedAgeLabel(null); }
    setShowWeightChange(true);
  };
  // The Handover sits in the home screen box, under any screen that opens over it. The forced rhythm check popup simply covers it
  // (and it's still there when the popup is answered); a screen the crew opens themselves (a tab, Add Tx) takes its place.
  useEffect(() => { if (showHandover && state.currentOverlay && state.currentOverlay !== 'tutorial' && !isShockForced) setShowHandover(false); }, [state.currentOverlay]);
  const setVital = (key: keyof AppState['vitals'], value: string) =>
    setState(p => ({ ...p, vitals: { ...p.vitals, [key]: value } }));
  const setHandoverField = (key: keyof HandoverFields, value: string) =>
    setState(p => ({ ...p, handover: { ...HANDOVER_EMPTY, ...(p.handover ?? {}), [key]: value } }));

  handleBackRef.current = () => {
    // 1. Layers owned by other components (tutorial slides, delete confirmation, reorder mode)
    //    say so by marking this event handled.
    const ev = new CustomEvent('bigone:back', { detail: { handled: false } });
    window.dispatchEvent(ev);
    if (ev.detail.handled) return;

    // 2. The Handover page closes first (it sits over the summary or the closed case page)
    if (showHandover && !(state.currentOverlay && state.currentOverlay !== 'tutorial')) { closeHandover(); return; }

    // 2b. Warnings and notices: back works like their Cancel / OK
    if (showTutorialModeBlocked) { setShowTutorialModeBlocked(false); return; }
    if (showCloseWarning) { setShowCloseWarning(false); return; }
    if (showEndWarning) { setShowEndWarning(false); return; }
    if (showPauseWarning) { setShowPauseWarning(false); return; }
    if (showResetWarning) { setShowResetWarning(false); return; }
    if (showPatternSwitchModal) { setShowPatternSwitchModal(false); return; }

    // 3. Recalibrate: its pages go back to the Recalibrate menu, which goes back to the home page
    if (showElapsedRecalibrate) { setShowElapsedRecalibrate(false); setStagedMode(null); if (timingMode !== 'minimal') setShowRecalibrateMenu(true); return; }
    if (showWeightChange) { setPendingWeightForMode(null); setShowWeightChange(false); setShowRecalibrateMenu(true); return; }
    if (showModeChange) { setShowModeChange(false); setShowRecalibrateMenu(true); return; }
    if (showRecalibrateMenu) { setShowRecalibrateMenu(false); return; }

    // 4. A rhythm check popup has to be answered, so back does nothing
    if (isShockForced) return;

    // 5. Menus and checklists open over the home page
    if (state.currentOverlay) {
      setState(p => ({ ...p, currentOverlay: null }));
      setEditingTreatmentIndex(null);
      return;
    }

    // 6. Previous cases, the mode descriptions, and the Tx step of the setup
    if (viewingPreviousCase) { setViewingPreviousCase(null); setShowPreviousCasesList(true); return; }
    if (showPreviousCasesList) { setShowPreviousCasesList(false); return; }
    if (aboutMode) { setAboutMode(null); return; }
    if (catchupTxMode) { setCatchupTxMode(false); return; }

    // 7. Setup pages: the same step back as each page's Back button
    if (showCatchup && !state.running && !tutorialMode) {
      if (tutorialModeIntro) { setTutorialModeIntro(null); return; }   // the "you've chosen..." slide: back to App Mode
      if (catchupStep === 6) { if (showInteractiveTutorial) setIntroRewind(n => n + 1); else setCatchupStep(1); }
      else if (catchupStep === 2) setCatchupStep(6);
      else if (catchupStep === 3) setCatchupStep(2);
      else if (catchupStep === 7) setCatchupStep(timingMode === 'minimal' ? 6 : 3);
      else if (catchupStep === 4) { setCatchupStep(7); setUseManualEntry(false); }
      return;
    }

    // 8. The home page mid-case (and the closed case page): back does nothing
  };

  useEffect(() => {
    try {
      updateSWFnRef.current = registerSW({
        onNeedRefresh() {
          setUpdateWaiting(true);
        },
        onRegisteredSW(_swUrl, registration) {
          swRegistrationRef.current = registration ?? null;
        }
      });
    } catch (err) {
      console.error('PWA update registration failed (non-fatal):', err);
    }
  }, []);

  useEffect(() => {
    if (!onWelcomeScreen) return;
    const checkForUpdate = () => {
      if (!navigator.onLine) return;
      swRegistrationRef.current?.update().catch((err) => {
        console.error('PWA update check failed (non-fatal):', err);
      });
    };
    checkForUpdate();
    const onVisible = () => {
      if (document.visibilityState === 'visible') checkForUpdate();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [onWelcomeScreen]);

  useEffect(() => {
    if (updateWaiting && onWelcomeScreen) {
      updateSWFnRef.current?.(true)?.catch((err) => {
        console.error('PWA update apply failed (non-fatal):', err);
      });
    }
  }, [updateWaiting, onWelcomeScreen]);

  // Timer logic
  // Demo tick for animated timers on the mode selection screen
  useEffect(() => {
    if (catchupStep !== 6) return;
    const interval = window.setInterval(() => setDemoTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [catchupStep]);

  // While the Recalibrate Elapsed Time modal is open, keep the staged elapsed
  // time ticking up live (matching the real running case) unless the user has
  // actually started editing it by hand - that way, someone who only wants to
  // change the rhythm check interval doesn't need to touch the timer at all,
  // and won't accidentally commit a stale snapshot from when the modal opened.
  useEffect(() => {
    if (!showElapsedRecalibrate || elapsedManuallyEdited) return;
    const interval = window.setInterval(() => {
      setStagedElapsedSeconds(s => s + 1);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [showElapsedRecalibrate, elapsedManuallyEdited]);

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
          let nextTreatments = prev.treatments;
          let nextPending = prev.pendingRhythmCheckDueAt ?? null;
          let nextOvertime = prev.rhythmCheckOvertime;
          let nextPaused = prev.rhythmCheckPaused;
          
          // Only update rhythm check if not paused, and not held by a delayed
          // rhythm check (no beeps, no new forced popup, no round increment
          // until the delayed check is actually done)
          if (!prev.rhythmCheckPaused && prev.rhythmCheckDelayedAt == null && timingMode !== 'log') {
            const countdown = prev.rhythmCheckTarget - newElapsed;

            // The app was restarted (or crashed) while a timer-fired rhythm check popup was
            // unanswered: the saved state remembers it but the popup itself is gone. Carry on
            // as if the app had stayed open - if the 0:20 return to the home screen has been
            // reached, note the check as "nothing logged" (stamped at its due time); if not,
            // bring the popup back for it.
            if (nextPending != null && !isShockForcedRef.current && !tutorialMode && !showCatchup) {
              if (countdown <= 20) {
                nextTreatments = withNothingLoggedEntry(prev, newElapsed, nextPending, now);
                nextPending = null;
              } else if (tutorialPopupAtZeroOK) {
                nextOverlay = 'treatment';
                setIsShockForced(true);
                isShockForcedRef.current = true;
                rhythmCheckDueAtRef.current = nextPending;
              }
            }

            // Auto-close overlay ONCE at 10s (not in tutorial)
            if (countdown === 20 && !hasAutoClosedAt10.current && tutorialAutoCloseOK) {
              nextOverlay = null;
              if (handoverViewRef.current !== 'read') setShowHandover(false);   // Fill in goes with the menus (what's been filled in is kept); Read out stays so a handover isn't interrupted
              hasAutoClosedAt10.current = true;
              // Back to the home screen with the last check's popup still unanswered
              if (isShockForcedRef.current && !tutorialMode && !showCatchup) {
                nextTreatments = withNothingLoggedEntry(prev, newElapsed, rhythmCheckDueAtRef.current, now);
                setIsShockForced(false);
                nextPending = null;
              }
            }

            // Beep logic: beep each second from 10s to 5s in both modes
            const beepStart = 20;
            const beepEnd = 14;
            if (countdown <= beepStart && countdown > beepEnd && lastBeepSecond.current !== newElapsed) {
              playBeep();
              lastBeepSecond.current = newElapsed;
            }

            // Handle rhythm check reaching 0:00
            if (countdown <= 0) {
              if ((timingMode === 'elapsed' || timingMode === 'minimal') && rhythmInterval) {
                // Elapsed/minimal mode: fire overlay immediately at rhythm check time, no overtime phase.
                // A tick can skip straight past 0:00 - the screen locked, the app was left, or it was
                // closed and reopened - so a check that is already overdue (countdown below 0) counts as
                // due right now, instead of never firing at all. (Not in the tutorial, which times its
                // own rhythm checks.) The check's own due time is kept, so a delay shows how late it is.
                if (countdown === 0 || (countdown < 0 && !tutorialMode)) {
                  // The next check is due while the last one's popup is still unanswered
                  // (e.g. the app was frozen across the 0:20 return): note it first
                  if (isShockForcedRef.current && !tutorialMode && !showCatchup) {
                    nextTreatments = withNothingLoggedEntry(prev, newElapsed, rhythmCheckDueAtRef.current, now);
                  }
                  if (!showCatchup && tutorialPopupAtZeroOK) {
                    nextOverlay = 'treatment';
                    setIsShockForced(true);
                    rhythmCheckDueAtRef.current = prev.rhythmCheckTarget;
                    nextPending = prev.rhythmCheckTarget;
                  }
                  nextTarget = calcNextIntervalTarget(newElapsed, rhythmInterval);
                  nextRound += 1;
                  nextOvertime = 0;
                  hasAutoClosedAt10.current = false;
                  setHasShownForcedShock(false);
                }
              } else {
                // Fallback fixed 2-minute cycle with a 6-second overtime phase
                // (used if timingMode/rhythmInterval aren't set yet)
                nextOvertime = newElapsed - prev.rhythmCheckTarget;
                
                if (nextOvertime >= 6) {
                  if (!showCatchup && !tutorialMode) {
                    nextOverlay = 'treatment';
                    setIsShockForced(true);
                  }
                  nextTarget = newElapsed + 120;
                  nextRound += 1;
                  nextOvertime = 0;
                  hasAutoClosedAt10.current = false;
                  setHasShownForcedShock(false);
                }
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
            treatments: nextTreatments,
            rhythmCheckTarget: nextTarget,
            rhythmCheckOvertime: nextOvertime,
            rhythmCheckPaused: nextPaused,
            cprRound: nextRound,
            currentOverlay: nextOverlay,
            pendingRhythmCheckDueAt: nextPending
          };
        });
      }, 500);
    }
    return () => clearInterval(interval);
  }, [state.running, timingMode, rhythmInterval, tutorialMode, tutorialAutoCloseOK, tutorialPopupAtZeroOK, showCatchup]);

  // Keep the screen awake while a case is running, so the phone doesn't lock part-way
  // through (a locked screen stops the timers ticking). It's only a request: the phone
  // can refuse (e.g. Low Power Mode) and the request is dropped whenever the app is left,
  // so it's made again each time the app comes back to the front.
  useEffect(() => {
    if (!state.running) return;
    const wakeLock = (navigator as any).wakeLock;
    if (!wakeLock || typeof wakeLock.request !== 'function') return;
    let sentinel: any = null;
    let stopped = false;
    const acquire = async () => {
      if (stopped || sentinel || document.visibilityState !== 'visible') return;
      try {
        const lock = await wakeLock.request('screen');
        if (stopped) { try { lock.release?.(); } catch { /* already released */ } return; }
        sentinel = lock;
        lock.addEventListener?.('release', () => { if (sentinel === lock) sentinel = null; });
      } catch { /* refused by the phone - nothing more to do */ }
    };
    const onVisible = () => { if (document.visibilityState === 'visible') acquire(); };
    acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      document.removeEventListener('visibilitychange', onVisible);
      try { sentinel?.release?.(); } catch { /* already released */ }
      sentinel = null;
    };
  }, [state.running]);

  const togglePause = () => {
    setState(prev => {
      // A delayed rhythm check is already holding the timer; pausing on top
      // of that would re-anchor it when unpaused and lose the delay.
      if (prev.rhythmCheckDelayedAt != null) return prev;
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

  // Checks whether the adrenaline/amiodarone timer would already be overdue
  // right now - called at the exact moment Rearrest is pressed, from
  // whichever of the app's several Rearrest buttons triggered it - not when
  // ROSC first started, however long ago that was. If overdue, wipes it so
  // it stays hidden rather than reappearing as a stale warning.
  const applyRearrestTimerWipeCheck = () => {
    const adrDoses = state.treatments.filter(t => t.name.includes('Adrenaline push') && !t.customDose && t.elapsed > (state.adrenalineWipedAt ?? -1));
    const lastAdr = adrDoses[adrDoses.length - 1];
    const adrenalineNowOverdue = !!lastAdr && !lastAdr.prior && (240 - (state.elapsedSeconds - lastAdr.elapsed)) <= 0;

    const allAmioDoses = state.treatments.filter(t => t.name.includes('Amiodarone'));
    let amiodaroneNowOverdue = false;
    if (allAmioDoses.length < 2) {
      const amioDoses = allAmioDoses.filter(t => t.elapsed > (state.amiodaroneWipedAt ?? -1));
      const lastAmio = amioDoses[amioDoses.length - 1];
      amiodaroneNowOverdue = !!lastAmio && !lastAmio.prior && (300 - (state.elapsedSeconds - lastAmio.elapsed)) <= 0;
    }

    if (adrenalineNowOverdue || amiodaroneNowOverdue) {
      setState(prev => ({
        ...prev,
        adrenalineWipedAt: adrenalineNowOverdue ? state.elapsedSeconds : prev.adrenalineWipedAt,
        amiodaroneWipedAt: amiodaroneNowOverdue ? state.elapsedSeconds : prev.amiodaroneWipedAt
      }));
    }
  };

  // Delay rhythm check - chosen from the forced rhythm check popup. Logs
  // "Rhythm check delayed" at this moment, closes the popup so the rest of
  // the app stays usable, and holds the rhythm check timer (see the tick):
  // the central ring switches to an overdue count-up with a "Rhythm check
  // now" tap target. The CPR round the timer added when the popup fired is
  // taken back off, and re-added when the check is actually done.
  const delayRhythmCheck = () => {
    const now = new Date();
    const dueAt = rhythmCheckDueAtRef.current ?? state.elapsedSeconds;
    const name = 'Rhythm check delayed';
    const priorCount = state.treatments.filter(t => getTreatmentIdentity(t.name) === getTreatmentIdentity(name)).length;
    const displayName = priorCount > 0 ? insertTreatmentNumber(name, getTreatmentIdentity(name), priorCount + 1) : name;
    setState(prev => {
      // Back to the round before the one the timer just started (which is 0
      // before the first check, hence no floor of 1)
      const heldRound = Math.max(0, prev.cprRound - 1);
      const entry: Treatment = {
        name: displayName,
        elapsed: prev.elapsedSeconds,
        round: heldRound,
        clock: getLocalTime(now),
        clockSeconds: getLocalTimeWithSeconds(now),
        loggedAt: now.getTime()
      };
      return {
        ...prev,
        treatments: [...prev.treatments, entry],
        cprRound: heldRound,
        rhythmCheckDelayedAt: dueAt,
        rhythmCheckTarget: dueAt,
        rhythmCheckOvertime: 0,
        currentOverlay: null
      };
    });
    setIsShockForced(false);
  };

  // "Rhythm check now" from the delayed ring: reopen the forced rhythm check
  // popup. The delay itself stays in place until an outcome is logged (see
  // addTreatment), so the check is logged at the time it's actually done.
  const resumeDelayedRhythmCheck = () => {
    setState(prev => ({ ...prev, currentOverlay: 'treatment' }));
    setIsShockForced(true);
  };

  // "Delay rhythm check" is only offered on a timer-forced rhythm check in
  // elapsed mode - not after a rearrest (the arrest has only just restarted),
  // not in the tutorial, not while editing, and not when the popup was
  // reopened from an already-delayed check.
  const allowRhythmCheckDelay =
    isShockForced && !rearrested && (!tutorialMode || tutorialRhythmLive) &&
    (timingMode === 'elapsed' || timingMode === 'minimal') && !!rhythmInterval &&
    state.rhythmCheckDelayedAt == null && editingTreatmentIndex === null;

  const addTreatment = (name: string, options?: { customDose?: boolean; rhythmOutcome?: boolean }) => {
    const now = new Date();
    // Shock, Disarm and ROSC outcomes move the rhythm check timers. (Cases saved by older versions of
    // Timers only may contain a plain "Rhythm check" for what is now Shock or Disarm; those were flagged
    // by the option below.) An early check restarts the countdown, a rearrest re-picks the interval,
    // a delayed check is resolved, and so on.
    const isRhythmOutcomeName = !!options?.rhythmOutcome || name.includes('Shock') || name.includes('Disarm') || isRoscName(name);

    // First time a given treatment type is logged, leave it unnumbered.
    // Every subsequent log of that same type gets numbered (#2, #3, ...).
    // Counts across catchup-added and live-added entries together, and
    // Shock/Disarm are counted independently of one another.
    const identity = getTreatmentIdentity(name);
    const priorCount = state.treatments.filter(t => getTreatmentIdentity(t.name) === identity).length;
    const displayName = priorCount > 0 ? insertTreatmentNumber(name, identity, priorCount + 1) : name;

    // An outcome for a delayed rhythm check is logged in the new round, the
    // same as an outcome chosen straight from the timer-forced popup (where
    // the timer has already moved the round on).
    const resolvingDelayForRound = !catchupTxMode && state.rhythmCheckDelayedAt != null && isRhythmOutcomeName;
    const treatment: Treatment = {
      name: displayName,
      elapsed: state.elapsedSeconds,
      round: resolvingDelayForRound ? state.cprRound + 1 : state.cprRound,
      clock: getLocalTime(now),
      clockSeconds: getLocalTimeWithSeconds(now),
      loggedAt: now.getTime(),
      ...(catchupTxMode ? { prior: true } : {}),
      ...(options?.customDose ? { customDose: true } : {})
    };

    if (catchupTxMode) {
      setState(prev => ({ ...prev, treatments: [...prev.treatments, treatment] }));
      setCatchupTxMode(false);
      return;
    }

    // Computed outside setState because setRhythmInterval must fire directly
    // here, not from inside the updater below - that function is deferred by
    // React and doesn't run synchronously, so anything only decided inside it
    // (like which ref to set) isn't available yet by the time this function
    // continues executing.
    const isShockOrDisarmForReset = isRhythmOutcomeName;
    const isROSCForReset = isRoscName(name);
    // Any rhythm check outcome logged while a check is delayed - from the
    // "Rhythm check now" popup or straight from Add Tx - is that delayed
    // check, done now: it restores the held CPR round and re-anchors the
    // interval the same way a rearrest does (below).
    const resolvingDelay = !catchupTxMode && state.rhythmCheckDelayedAt != null && isShockOrDisarmForReset;
    // When a shock/disarm is logged early (before the timer would have hit
    // zero on its own), automatically switch to whichever of
    // evens/odds/half-evens/half-odds puts the next check closest to - but
    // not over - 2:00 away from right now. Excludes rearrest, which already
    // has its own explicit interval picker the user works through manually;
    // this only covers a plain early log during ongoing resuscitation.
    const isOutOfTurnForReset = timingMode !== 'log' && isShockOrDisarmForReset && !isROSCForReset && !isShockForced && (state.rhythmCheckTarget - state.elapsedSeconds) > 0;
    let earlyResetTarget: number | null = null;
    let earlyResetPattern: 'evens' | 'odds' | 'half-evens' | 'half-odds' | null = null;
    patternSwitchNoticeRef.current = null;
    if (isOutOfTurnForReset && !rearrested) {
      const patterns: Array<'evens' | 'odds' | 'half-evens' | 'half-odds'> = ['evens', 'odds', 'half-evens', 'half-odds'];
      let bestDelta = -1;
      for (const p of patterns) {
        const candidate = calcNextIntervalTarget(state.elapsedSeconds, p);
        const delta = candidate - state.elapsedSeconds;
        if (delta > bestDelta) {
          bestDelta = delta;
          earlyResetTarget = candidate;
          earlyResetPattern = p;
        }
      }
      if (earlyResetPattern) {
        setRhythmInterval(earlyResetPattern);
        const patternLabels: Record<string, string> = { evens: 'Evens', odds: 'Odds', 'half-evens': 'Half evens', 'half-odds': 'Half odds' };
        patternSwitchNoticeRef.current = patternLabels[earlyResetPattern];
        setShowPatternSwitchModal(true);
      }
    }

    setState(prev => {
      const isShockOrDisarm = isRhythmOutcomeName;
      const isROSC = isRoscName(name);
      const isRearrest = name === 'Rearrest';
      const wasRhythmCheckPaused = prev.rhythmCheckPaused;
      // Increment round if shock/disarm logged out of turn (before timer hit 0)
      // Do NOT increment if responding to a forced rhythm check overlay (already incremented by timer)
      // This only applies in elapsed mode - it relies on an actively-ticking
      // rhythmCheckTarget, which log mode doesn't maintain.
      const isOutOfTurn = timingMode !== 'log' && isShockOrDisarm && !isROSC && !isShockForced && (prev.rhythmCheckTarget - prev.elapsedSeconds) > 0;
      // Log mode has no timer to compare against - every shock/disarm (other
      // than ROSC) simply marks the end of a CPR round, the same way a paper
      // code sheet counts them.
      const isLogModeRoundComplete = timingMode === 'log' && isShockOrDisarm && !isROSC;
      const shouldResetTimer = isROSC || (isShockOrDisarm && wasRhythmCheckPaused);
      
      // Auto-add OPA before BVM
      const newTreatments = [...prev.treatments];
      if (name === 'BVM') {
        const opaTreatment: Treatment = {
          name: 'OPA',
          elapsed: state.elapsedSeconds,
          round: state.cprRound,
          clock: getLocalTime(now),
          clockSeconds: getLocalTimeWithSeconds(now),
          loggedAt: now.getTime()
        };
        newTreatments.push(opaTreatment);
      }
      newTreatments.push(treatment);
      
      return {
        ...prev,
        treatments: newTreatments,
        cprRound: (isOutOfTurn || isLogModeRoundComplete || resolvingDelay) ? prev.cprRound + 1 : prev.cprRound,
        rhythmCheckDelayedAt: resolvingDelay ? null : prev.rhythmCheckDelayedAt,
        currentOverlay: isRearrest ? 'treatment' : null,
        // Reset rhythm check to 2:00 for ROSC, or when unpausing via other shock/disarm,
        // or to the auto-selected pattern's target when logged early
        rhythmCheckTarget: earlyResetTarget !== null
          ? earlyResetTarget
          : shouldResetTimer 
            ? prev.elapsedSeconds + 120 
            : prev.rhythmCheckTarget,
        rhythmCheckOvertime: (earlyResetTarget !== null || shouldResetTimer) ? 0 : prev.rhythmCheckOvertime,
        // Pause for ROSC, unpause for other shock/disarm; Rearrest exits ROSC mode
        rhythmCheckPaused: isShockOrDisarm ? isROSC : prev.rhythmCheckPaused,
        // For ROSC, freeze the countdown at 2:00
        frozenCountdown: isROSC ? 120 : prev.frozenCountdown,
        // Enter ROSC mode when ROSC logged, exit when any shock/disarm or rearrest logged
        isROSCMode: isROSC ? true : (isShockOrDisarm || isRearrest) ? false : prev.isROSCMode,
        // Clear ROSC checklist when ROSC is logged again (new ROSC event)
        roscChecked: isROSC ? [] : prev.roscChecked
      };
    });

    // Rearrest from Add Tx menu: stop flashing, set forced overlay, mark as rearrest
    if (name === 'Rearrest') {
      setRoscButtonFlashing(false);
      setRearrested(true);
      // An unanswered rearrest popup is noted at the time of the rearrest, not an earlier check
      rhythmCheckDueAtRef.current = state.elapsedSeconds;
      setIsShockForced(true);
      applyRearrestTimerWipeCheck();
      return; // Skip the rest — overlay stays open for rhythm check outcome
    }

    // Make ROSC button flash when ROSC is selected
    if (isRoscName(name)) {
      setRoscButtonFlashing(true);
    }
    
    setIsShockForced(false);

    // If this treatment was logged from a rearrest, auto-pick the interval
    // pattern the same way an early (out-of-turn) shock/disarm does - the
    // rearrest is itself an unscheduled event, so the same "closest to but
    // not over 2:00" logic applies directly. Applied silently here, no
    // acknowledgment modal - unlike a plain early shock, a rearrest already
    // has plenty happening on screen and doesn't need an extra prompt.
    if ((rearrested || resolvingDelay) && isRhythmOutcomeName) {
      setRearrested(false);
      if (isRoscName(name)) {
        // ROSC again — go straight back to ROSC mode, no interval picker needed
      } else if (timingMode === 'elapsed' || timingMode === 'minimal') {
        const patterns: Array<'evens' | 'odds' | 'half-evens' | 'half-odds'> = ['evens', 'odds', 'half-evens', 'half-odds'];
        let bestDelta = -1;
        let bestTarget = state.elapsedSeconds;
        let bestPattern: 'evens' | 'odds' | 'half-evens' | 'half-odds' = 'evens';
        for (const p of patterns) {
          const candidate = calcNextIntervalTarget(state.elapsedSeconds, p);
          const delta = candidate - state.elapsedSeconds;
          if (delta > bestDelta) {
            bestDelta = delta;
            bestTarget = candidate;
            bestPattern = p;
          }
        }
        setRhythmInterval(bestPattern);
        setState(prev => ({
          ...prev,
          rhythmCheckTarget: bestTarget,
          rhythmCheckOvertime: 0,
          rhythmCheckPaused: false
        }));
      }
    }
    
    // Show notification with treatment name
    if (!isRoscName(name) && !name.startsWith('Mode changed')) {
      loggedTreatmentRef.current = name;
      setShowLoggedNotification(true);
      setTimeout(() => setShowLoggedNotification(false), 2000);
    }
    
    // Reset the forced shock flag when Shock/Disarm is applied (rhythm check resets to 2:00)
    if (isRhythmOutcomeName) {
      setHasShownForcedShock(false);
      previousCountdown.current = null; // Reset countdown tracking
    }
    
    // Reset disregard states when new doses given
    if (name.includes('Adrenaline push')) {
      setDisregardAdrenaline(null);
    }
    if (name.includes('Amiodarone')) {
      setDisregardAmiodarone(null);
    }
  };

  const deleteTreatment = (idx: number) => {
    setState(prev => {
      const remaining = prev.treatments.filter((_, i) => i !== idx);
      return { ...prev, treatments: renumberTreatments(remaining) };
    });
  };

  const handleEditTreatment = (idx: number) => {
    setEditingTreatmentIndex(idx);
    setState(prev => ({ ...prev, currentOverlay: 'treatment' }));
  };

  // Corrects what was logged (wrong drug, wrong dose, wrong Tx) without
  // touching when it was logged or anything that already happened as a
  // result of the original entry - e.g. editing a Shock into an Adrenaline
  // push does NOT retroactively undo the rhythm-check reset or CPR round
  // increment that already occurred when the Shock was first logged. Only
  // the log record and its numbering change.
  const editTreatment = (name: string, options?: { customDose?: boolean }) => {
    if (editingTreatmentIndex === null) return;
    setState(prev => {
      if (editingTreatmentIndex >= prev.treatments.length) return prev;
      const updated = [...prev.treatments];
      const original = updated[editingTreatmentIndex];
      const { customDose: _oldCustomDose, ...rest } = original;
      updated[editingTreatmentIndex] = { ...rest, name, edited: true, ...(options?.customDose ? { customDose: true } : {}) };
      // Editing is reachable from two different places depending on timing
      // mode: elapsed mode's Summary overlay, or log mode's inline running
      // summary (which IS the home screen there, not an overlay). In
      // elapsed mode, returning to the Summary overlay (rather than the
      // previous behaviour of going all the way back to the home screen)
      // lets the person see the change land in the log immediately - that
      // overlay stays mounted throughout the whole edit flow (see its render
      // site), so its scroll position is preserved automatically. In log
      // mode there's no separate overlay to return to at all - the inline
      // summary never unmounted in the first place, so going back to the
      // plain home screen (null) already shows it exactly as it was, scroll
      // position included.
      return { ...prev, treatments: renumberTreatments(updated), currentOverlay: timingMode === 'log' ? null : 'summary' };
    });
    setEditingTreatmentIndex(null);
  };

  // Retroactively correct WHEN a treatment happened by dragging it to a new
  // position in the log. The moved item's exact time becomes unknown (shown
  // as a dash) rather than guessed - if it happened somewhere between two
  // other treatments, there's no way to know exactly when within that gap,
  // and displaying a specific inherited time would overstate the precision
  // of the correction. Every other entry keeps its own original time
  // unchanged, since dragging something else past them says nothing about
  // when they themselves happened.
  const moveTreatment = (fromIdx: number, toIdx: number) => {
    setState(prev => {
      if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0 || fromIdx >= prev.treatments.length || toIdx >= prev.treatments.length) {
        return prev;
      }
      const treatments = [...prev.treatments];
      const [moved] = treatments.splice(fromIdx, 1);
      treatments.splice(toIdx, 0, { ...moved, timeUnknown: true });
      return { ...prev, treatments: renumberTreatments(treatments) };
    });
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

  const adrenalineStatus = useMemo(() => {
    if (state.isROSCMode) {
      return { text: "", show: false, isDue: false, countdown: 0, flashRed: false };
    }
    const adrTreatments = state.treatments.filter(t => t.name.includes('Adrenaline push') && !t.customDose && t.elapsed > (state.adrenalineWipedAt ?? -1));
    const lastAdr = adrTreatments[adrTreatments.length - 1];

    if (!lastAdr) {
      return { text: "", show: false, isDue: false, countdown: 0, flashRed: false };
    }

    if (lastAdr.prior) {
      if (tutorialMode) return { text: '', show: false, isDue: false, countdown: 0, flashRed: false };
      return { text: "Next adrenaline: unknown", show: true, isDue: false, countdown: 0, flashRed: false };
    }

    const timeSinceLastDose = state.elapsedSeconds - lastAdr.elapsed;
    const timeUntilNext = 240 - timeSinceLastDose; // 4 minutes = 240 seconds

    if (timeUntilNext <= 0) {
      // Show negative countdown when overdue
      const overdueTime = Math.abs(timeUntilNext);
      const mins = Math.floor(overdueTime / 60);
      const secs = overdueTime % 60;
      const timeStr = `-${mins}:${secs.toString().padStart(2, '0')}`;
      return { text: `Next adrenaline: ${timeStr}`, show: true, isDue: true, countdown: timeUntilNext, flashRed: true };
    } else {
      const mins = Math.floor(timeUntilNext / 60);
      const secs = timeUntilNext % 60;
      const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
      const flashRed = timeUntilNext <= 30; // Flash red when 30s or less
      return { text: `Next adrenaline: ${timeStr}`, show: true, isDue: false, countdown: timeUntilNext, flashRed };
    }
  }, [state.treatments, state.elapsedSeconds, state.isROSCMode, state.adrenalineWipedAt, tutorialMode]);

  const amiodaroneStatus = useMemo(() => {
    if (state.isROSCMode) {
      return { text: "", show: false, isDue: false, countdown: 0, flashRed: false };
    }
    // Protocol: first amiodarone dose starts the 5-min timer, second (final) dose clears it.
    // We can't rely on dose string matching because cleanDoseForLog strips mg/kg to just
    // the calculated value (e.g. "5mg/kg (42mg)" -> "Amiodarone 42mg").
    // So we use count: 1 dose = show timer, 2+ doses = hide permanently.
    const allAmioTreatments = state.treatments.filter(t => t.name.includes('Amiodarone'));
    if (allAmioTreatments.length >= 2) {
      return { text: '', show: false, isDue: false, countdown: 0, flashRed: false };
    }

    const amioTreatments = allAmioTreatments.filter(t => t.elapsed > (state.amiodaroneWipedAt ?? -1));
    const lastAmio = amioTreatments[amioTreatments.length - 1];

    if (!lastAmio) {
      return { text: "", show: false, isDue: false, countdown: 0, flashRed: false };
    }

    if (lastAmio.prior) {
      if (tutorialMode) return { text: '', show: false, isDue: false, countdown: 0, flashRed: false };
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
  }, [state.treatments, state.elapsedSeconds, state.isROSCMode, state.amiodaroneWipedAt, tutorialMode]);


  const pharmaSummary = useMemo(() => computePharmaSummary(state.treatments), [state.treatments]);

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
    
    // Clear localStorage for a completely fresh start (keeping what must survive)
    clearStorageForFreshCase();
    
    let adjustedElapsed = catchupElapsed.hrs * 3600 + catchupElapsed.mins * 60 + catchupElapsed.secs;
    
    // Use override weight if provided, otherwise use weightInput state
    const finalWeight = timingMode === 'minimal' ? '' : (overrideWeight || weightInput);
    
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
    
    // Adjust times based on elapsed time since they were entered
    if (elapsedTimestamp) {
      const timeSinceElapsed = Math.floor((Date.now() - elapsedTimestamp) / 1000);
      adjustedElapsed += timeSinceElapsed;
    }
    
    const now = Date.now();
    const startClockTime = now - (adjustedElapsed * 1000);
    
    // Calculate rhythm check target based on mode
    let rhythmCheckTarget: number;
    if ((timingMode === 'elapsed' || timingMode === 'minimal') && rhythmInterval) {
      rhythmCheckTarget = calcNextIntervalTarget(adjustedElapsed, rhythmInterval);
    } else {
      // Log mode doesn't act on this value at all (rhythm-check tracking is
      // disabled entirely in log mode), so a simple default is fine here.
      rhythmCheckTarget = adjustedElapsed + 120;
    }

    const initialTxs: Treatment[] = [];
    const baseClock = new Date(startClockTime);

    const pushPrior = (name: string) => {
      // Timers only skips the catch-up page (and has no weight, so no doses),
      // so anything left over from before switching to it is left out.
      if (timingMode === 'minimal') return;
      initialTxs.push({
        name,
        elapsed: 0,
        round: 0,
        clock: getLocalTime(baseClock),
        clockSeconds: getLocalTimeWithSeconds(baseClock),
        prior: true
      });
    };

    // Auto-add "CPR" and "Pads on" before shocks/disarms in catchup
    if (priorCounts.shock > 0 || priorCounts.disarm > 0) {
      pushPrior('CPR');
      pushPrior('Pads on');
    }

    for (let i = 0; i < priorCounts.shock; i++) {
      pushPrior(i === 0 ? 'Shock' : `Shock #${i+1}`);
    }
    for (let i = 0; i < priorCounts.disarm; i++) {
      pushPrior(i === 0 ? 'Disarm' : `Disarm #${i+1}`);
    }

    // Airway/access buttons, always presented in a fixed chronological order
    // (earliest to latest) regardless of the order they were tapped in:
    // OPA, BVM, LMA, IV access, IO access
    if (priorTxs.includes('BVM')) pushPrior('OPA');
    if (priorTxs.includes('BVM')) pushPrior('BVM');
    if (priorTxs.includes('LMA')) pushPrior('LMA');
    if (priorTxs.includes('IV')) pushPrior('IV access');
    if (priorTxs.includes('IO')) pushPrior('IO access');

    for (let i = 0; i < priorCounts.adrenaline; i++) {
      const adrenalineDose = getAdrenalinePushDose(weightType, parsedWeight);
      const baseName = `Adrenaline push ${adrenalineDose}`;
      pushPrior(i === 0 ? baseName : insertTreatmentNumber(baseName, 'Adrenaline push', i + 1));
    }
    for (let i = 0; i < priorCounts.amiodarone; i++) {
      const amiodaroneDose = getAmiodaroneDose(weightType, parsedWeight, i === 0 ? 1 : 2);
      const baseName = `Amiodarone ${amiodaroneDose}`;
      pushPrior(i === 0 ? baseName : insertTreatmentNumber(baseName, 'Amiodarone', i + 1));
    }
    
    // Include any treatments added via the Full Tx list button
    const extraPriorTxs = timingMode === 'minimal' ? [] : state.treatments.filter(t => t.prior);
    const allInitialTxs = [...extraPriorTxs, ...initialTxs];

    setState({
      ...INITIAL_STATE,
      running: true,
      startTime: now,
      caseOpenedAt: now,
      pausedTime: adjustedElapsed * 1000,
      elapsedSeconds: adjustedElapsed,
      rhythmCheckTarget: rhythmCheckTarget,
      cprRound: timingMode === 'minimal' ? 0 : priorCounts.shock + priorCounts.disarm,
      treatments: allInitialTxs,
      catchupElapsed: adjustedElapsed,
      startClockTime: startClockTime,
      patientWeight: parsedWeight || (tutorialMode ? 70 : null),
      patientType: timingMode === 'minimal' ? null : (weightType || (tutorialMode ? 'adult' : null)),
      patientAge: (weightType === 'paed' && paedWeightMethod === 'age' && paedAgeLabel) ? paedAgeLabel : null,
      // Without these two, INITIAL_STATE's defaults (both null) would silently
      // overwrite the mode the person actually chose, and the separate effect
      // that normally keeps state.timingMode in sync with this local variable
      // wouldn't catch it - that effect only fires when the local timingMode/
      // rhythmInterval themselves change, and they don't change here.
      timingMode,
      elapsedCalibrated: timingMode === 'elapsed' || timingMode === 'minimal',
      rhythmInterval,
    });
    
    // Reset all UI states for clean new case
    setShowCatchup(false);
    setCatchupTxMode(false);
    setDisregardAdrenaline(null);
    setDisregardAmiodarone(null);
    setShowLoggedNotification(false);
    setIsShockForced(false);
    setHasShownForcedShock(false);
    setCatchupStep(1);
    setWeightType(null);
    setPaedWeightMethod(null);
    setWeightInput('');
    setPriorCounts({ shock: 0, disarm: 0, adrenaline: 0, amiodarone: 0 });
    setPriorTxs([]);
    // setPhotoTimestamp(null); // Removed - not defined
    setElapsedTimestamp(null);
    previousCountdown.current = rhythmCheckTarget - adjustedElapsed;
  };

  const closeCase = () => {
    // Start fresh, keeping what must survive (see clearStorageForFreshCase)
    clearStorageForFreshCase();
    
    // Unregister service worker (removes stale cached content) then do a single
    // clean reload of the current URL. Previously this also navigated to a
    // modified '?nocache=' URL before reloading again 100ms later - a redundant
    // double-navigation that's a plausible source of timing issues on some
    // platforms (e.g. installed/home-screen apps), removed here in favour of
    // the simplest reliable approach.
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(registration => registration.unregister());
      }).finally(() => {
        window.location.reload();
      });
    } else {
      window.location.reload();
    }
  };

  const endCase = () => {
    addTreatment('Close case');
    setState(prev => {
      const closed = { ...prev, running: false, caseClosedAt: Date.now() };
      if (!tutorialMode) {
        savePreviousCase({ ...closed, handover: undefined });
        setPreviousCases(loadPreviousCases());
      }
      return closed;
    });
    setIsCaseClosed(true);
    setShowHandover(false);       // the Handover never opens by itself when a case closes
    setShowEndWarning(false);
    // The tutorial's own End Case step is when 'endCase'/'finalStats' is the
    // current node - then the closing notes carry on as normal. Ending the
    // case at any other point is leaving the tutorial: switch it off, so no
    // stale note (e.g. "Delayed Rhythm Check") can appear over the closed
    // case page. Close Case there resets the app as usual.
    if (tutorialMode && tutorialNodeId !== 'endCase' && tutorialNodeId !== 'finalStats') {
      setTutorialMode(false);
      setTutorialNodeIndex(0);
    }
  };

  // Switching mode part-way through a case. The switch is timestamped in the Tx
  // log. Leaving Timers only asks for the patient's weight first (it never had
  // one), and backing out of that leaves the mode as it was. There is no
  // "treatments already applied" page here: whatever was done is already in
  // the log.
  // The timer page of the Recalibrate menu. In Timers only that's all the menu would offer (no weight, and the mode can't be changed),
  // so the Recalibrate button goes straight here.
  const openTimerRecalibrate = () => {
    setShowRecalibrateMenu(false);
    setStagedElapsedSeconds(state.elapsedSeconds);
    setStagedRhythmInterval(rhythmInterval || 'evens');
    setElapsedManuallyEdited(false);
    setShowElapsedRecalibrate(true);
  };

  const beginModeChange = (target: 'log' | 'minimal' | 'elapsed') => {
    if (target === 'log') {
      // Choosing Tx log only commits straight away, so this is where the tutorial stops it
      if (tutorialMode) { setShowModeChange(false); setShowTutorialModeBlocked(true); return; }
      // No timer to recalibrate, so it takes effect straight away
      // (A case saved before elapsedCalibrated existed was calibrated if it was in a timer mode)
      if (state.elapsedCalibrated === undefined && timingMode !== 'log') setState(prev => ({ ...prev, elapsedCalibrated: true }));
      setTimingMode('log');
      setShowModeChange(false);
      addTreatment(`Mode changed: ${TIMING_MODE_LABELS.log}`);
      return;
    }
    // The timer modes go via the recalibrate step; the mode itself changes, and
    // the log entry is added, only when that's confirmed
    setStagedMode(target);
    const startingInterval = rhythmInterval || 'evens';
    if (!rhythmInterval) setRhythmInterval(startingInterval);
    // Coming from Tx log only with a clock that was never checked against the monitor, it isn't
    // offered as a starting point: it starts at 00:00:00 and stays there until the real elapsed
    // time is entered. Otherwise (between the two timer modes, or back from Tx log only once the
    // time has been entered) the clock was already calibrated and kept running, so it's kept and
    // carries on ticking.
    const fromTxLogOnly = timingMode === 'log' && !state.elapsedCalibrated;
    setStagedElapsedSeconds(fromTxLogOnly ? 0 : state.elapsedSeconds);
    setStagedRhythmInterval(startingInterval);
    setElapsedManuallyEdited(fromTxLogOnly); // true stops the live tick
    setShowModeChange(false);
    setShowElapsedRecalibrate(true);
  };

  // Switching from Tx log only with a clock that was never checked against the monitor: Done stays
  // unavailable until the monitor's elapsed time has actually been entered (anything above 00:00:00).
  const needsElapsedEntry = !!stagedMode && timingMode === 'log' && !state.elapsedCalibrated && stagedElapsedSeconds === 0;

  // What the Recalibrate step needs to know about the rhythm check right now
  const recalDelayed = state.rhythmCheckDelayedAt != null;
  const recalPaused = !!state.rhythmCheckPaused && !recalDelayed;

  const requestModeChange = (target: 'log' | 'minimal' | 'elapsed') => {
    if (!canChangeMode(timingMode, target)) return;
    if (target !== 'minimal' && state.patientWeight == null) {
      setNewWeightInput('');
      setNewPatientType('adult');
      setNewPaedWeightMethod('weight');
      setNewPaedAgeLabel(null);
      setPendingWeightForMode(target);
      setShowModeChange(false);
      setShowWeightChange(true);
      return;
    }
    beginModeChange(target);
  };

  if (isCaseClosed) {
    return (
      <div ref={caseSummaryScrollRef} className="min-h-screen bg-neutral-200 p-6 overflow-y-auto pb-24">
      <div className="max-w-2xl mx-auto bg-white rounded-3xl border border-neutral-200 shadow-2xl p-6 space-y-6">
        <div className="space-y-6 break-inside-avoid has-arrest-summary">
        <div className="text-center space-y-6">
          <div className="inline-flex items-center gap-3 text-emerald-600 font-bold text-xs tracking-[0.2em] uppercase">
            <span className="w-6 h-px bg-emerald-300" />
            The Big One
            <span className="w-6 h-px bg-emerald-300" />
          </div>
          <h1 className="text-4xl font-bold text-neutral-900">Case Summary</h1>
          <p className="text-neutral-400 text-sm font-medium">{formatCaseDate(state.caseClosedAt)}</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button 
            onClick={() => exportCasePdf(state.caseClosedAt)}
            className="flex items-center justify-center gap-1 bg-emerald-50 text-emerald-700 py-3 px-2 rounded-xl font-bold btn-base border border-emerald-100"
            data-button="export-pdf"
          >
            <FileText size={20} /> Export PDF
          </button>
          <button 
            onClick={() => setShowCloseWarning(true)}
            className="flex items-center justify-center gap-1 bg-red-50 text-red-700 py-3 px-2 rounded-xl font-bold btn-base border border-red-100"
            data-button="close-case"
          >
            <Trash2 size={20} /> Close Case
          </button>
        </div>

        <ArrestSummarySection state={state} showRecordingDuration showFinalDuration alwaysShowArrestSummary />
        </div>

        <VitalSignsSection vitals={state.vitals} />

        <PharmaSummarySection treatments={state.treatments} pharmaSummary={pharmaSummary} infusionDoses={state.infusionDoses} activeInfusions={INFUSION_DRUGS.filter(d => state.treatments.some(t => t.name.startsWith(d)))} />
        
        <div className="rounded-xl border border-neutral-100">
          <div data-tutorial-anchor="closed-treatment-log-banner" className="bg-emerald-50 text-emerald-800 p-3 font-bold text-sm tracking-wider text-center rounded-t-xl">TREATMENT LOG</div>
          <TreatmentLog treatments={state.treatments} elapsedSeconds={state.elapsedSeconds} caseOpenedAt={state.caseOpenedAt} isSummary={true} />
        </div>
      </div>


      {showCloseWarning && (
           <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-6" style={{ height: '100dvh' }}>
           <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
             <AlertCircle size={48} className="mx-auto text-red-600 mb-4" />
             <h2 className="text-2xl font-bold text-neutral-900 mb-2">Close This Case?</h2>
             <p className="text-neutral-500 mb-8">
               You will return to the welcome page. Only your most recent three cases are saved as a backup, found under 'View Previous Cases' on the welcome screen.
             </p>
             <div className="grid grid-cols-2 gap-3">
               <button onClick={() => setShowCloseWarning(false)} className="bg-neutral-100 p-4 rounded-xl font-bold text-neutral-700 btn-base">Cancel</button>
               <button onClick={closeCase} className="bg-red-600 p-4 rounded-xl font-bold text-white btn-base">Close</button>
             </div>
           </div>
         </div>
        )}

        {tutorialMode && (
          <TutorialOverlay
            appState={state}
            isShockForced={isShockForced}
            isCaseClosed={isCaseClosed}
            globalNodeIndex={tutorialNodeIndex}
            mode={timingMode ?? 'elapsed'}
            appModalOpen={showEndWarning || showPauseWarning || showRecalibrateMenu || showWeightChange || showModeChange || showElapsedRecalibrate || showResetWarning || showPatternSwitchModal || showCloseWarning || showTutorialModeBlocked}
            intervalBaseline={tutorialIntervalBaseline}
            onNodeChange={(nodeIndex, done) => {
              setTutorialNodeIndex(nodeIndex);
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

      {aboutMode && <ModeAboutSlide mode={aboutMode} onClose={() => setAboutMode(null)} />}

      {/* Interactive Tutorial pre-screen */}
      {showInteractiveTutorial && (
        <InteractiveTutorial
          catchupStep={catchupStep}
          mode={timingMode}
          onExit={exitTutorialToWelcome}
          introRewind={introRewind}
          setupReset={setupReset}
          modeIntroLabel={tutorialModeIntro ? TIMING_MODE_LABELS[tutorialModeIntro] : null}
          onModeIntroBack={() => setTutorialModeIntro(null)}
          onModeIntroNext={() => {
            const chosen = tutorialModeIntro;
            setTutorialModeIntro(null);
            // Each mode's setup starts where the real app's does: Timers only
            // has no patient details or previous treatments, so it goes
            // straight to the rhythm check interval.
            if (chosen === 'minimal') setCatchupStep(7);
            else if (chosen) setCatchupStep(2);
          }}
          onTimingNodesComplete={() => setTimingNodesComplete(true)}
          onCatchupNodeStatusChange={(_screen, cleared) => { setCatchupNodeCleared(cleared); }}
        />
      )}

      {/* Disclaimer Modal */}
      {pendingNotes.length > 0 && onWelcomeScreen && disclaimerAccepted && (
        <div className="fixed inset-0 z-[3000] bg-black/60 flex items-center justify-center p-6" role="dialog" aria-label="What's New">
          <div className="bg-white rounded-3xl p-7 max-w-sm w-full shadow-2xl flex flex-col" style={{ maxHeight: '88%' }}>
            <h2 className="text-2xl font-bold text-neutral-900 text-center">What's New</h2>
            <p className="text-sm text-neutral-500 text-center mt-1 mb-4">Updated to {APP_VERSION}</p>
            <div className="overflow-y-auto min-h-0 flex-1 space-y-5 pr-1">
              {pendingNotes.map(note => (
                <div key={note.version}>
                  {pendingNotes.length > 1 && <h3 className="text-base font-bold text-neutral-900 mb-1.5">{note.version}</h3>}
                  <ul className="list-disc pl-5 space-y-2 text-neutral-700 text-[15px] leading-relaxed">
                    {note.items.map((item, i) => <li key={i}>{item}</li>)}
                  </ul>
                </div>
              ))}
            </div>
            <button
              onClick={() => { localStorage.setItem(LAST_SEEN_VERSION_KEY, APP_VERSION); setPendingNotes([]); }}
              className="mt-5 w-full p-4 rounded-2xl bg-emerald-600 text-white font-bold flex-shrink-0"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {!disclaimerAccepted && (
        <div className="fixed inset-0 bg-black/90 z-[3000] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h1 className="text-2xl font-bold text-neutral-900 mb-1">The Big One <span className="text-sm font-medium text-neutral-400">{APP_VERSION}</span></h1>
            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-widest mb-6">Important — please read before use</p>
            <div className="space-y-4 text-[14px] text-neutral-600 leading-relaxed mb-6">
              <p><strong className="text-neutral-900">Prototype in development.</strong> This application is a prototype in development and may contain errors. Access is by invitation only, for testing in simulation and providing feedback. It is not yet for use in real patient care.</p>
              <p><strong className="text-neutral-900">Supplementary cognitive aid only.</strong> This application is a consolidated digital alternative to the pen, paper, and stopwatch a clinician would typically use during cardiac arrest management. <em>The Big One</em> tracks multiple timers, records interventions, and displays pre-configured guideline-derived information. It is a documentation, timing, and situational awareness tool only, not a clinical decision-making system, and does not replace clinical judgement, professional training, or your service's approved clinical guidelines and procedures. This application is intended for use by trained clinicians only.</p>
              <p><strong className="text-neutral-900">Clinical responsibility remains with the treating clinician.</strong> All patient assessment, treatment decisions, and medication administration remain the responsibility of the treating clinician(s). Users must apply their own professional judgement and follow current local clinical guidelines at all times.</p>
              <p><strong className="text-neutral-900">Guideline source and verification.</strong> This application has been configured with reference to ACTAS Clinical Management Guidelines (CMG) v1.1.0.3. Users are responsible for verifying that information displayed by this application aligns with their service's current approved protocols.</p>
              <p><strong className="text-neutral-900">Independent application.</strong> This application is independently developed and is not affiliated with, endorsed by, or approved by ACT Ambulance Service (ACTAS), or any other ambulance service, health authority, or regulatory body.</p>
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
              Continue to <em>The Big One</em>
            </button>
          </div>
        </div>
      )}
      {/* Top Controls */}
      <div className={`grid gap-2 sm:gap-3 mb-3 sm:mb-4 flex-shrink-0 ${showHandoverBtn ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {timingMode !== 'log' && timingMode !== 'elapsed' && timingMode !== 'minimal' && (
          <button onClick={confirmPause} className="bg-neutral-200 p-2.5 sm:p-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 sm:gap-2 btn-base">
            {(state.running && !state.rhythmCheckPaused) ? <Pause size={14} className="sm:w-4 sm:h-4" /> : <Play size={14} className="sm:w-4 sm:h-4" />} 
            {(state.running && !state.rhythmCheckPaused) ? 'Pause' : 'Play'}
          </button>
        )}
        <button 
          onClick={() => (timingMode === 'minimal' ? openTimerRecalibrate() : setShowRecalibrateMenu(true))} 
          disabled={tutorialRhythmDemoActive}
          data-button="recalibrate"
          className={`bg-neutral-200 ${showHandoverBtn ? 'px-1 py-2.5 text-[13px]' : 'p-2.5 text-sm'} sm:p-4 sm:text-base rounded-xl font-bold flex items-center justify-center gap-1.5 sm:gap-2 btn-base whitespace-nowrap`}
        >
          <RefreshCw size={14} className="sm:w-4 sm:h-4" /> Recalibrate
        </button>
        {showHandoverBtn && (
          <button
            onClick={toggleHandover}
            disabled={isShockForced || tutorialRhythmDemoActive}
            data-button="handover"
            aria-pressed={handoverOpen}
            className={`${handoverOpen ? 'bg-[#dde7f3] text-[#3b5b8a]' : 'bg-neutral-200'} px-1 py-2.5 text-[13px] sm:p-4 sm:text-base rounded-xl font-bold flex items-center justify-center gap-1.5 sm:gap-2 btn-base whitespace-nowrap ${isShockForced ? 'opacity-50' : ''}`}
          >
            {handoverOpen ? <XCircle size={14} className="sm:w-4 sm:h-4" /> : <ClipboardList size={14} className="sm:w-4 sm:h-4" />} {handoverOpen ? 'Close' : 'Handover'}
          </button>
        )}
        <button onClick={() => setShowEndWarning(true)} className={`bg-neutral-200 ${showHandoverBtn ? 'px-1 py-2.5 text-[13px]' : 'p-2.5 text-sm'} sm:p-4 sm:text-base rounded-xl font-bold flex items-center justify-center gap-1.5 sm:gap-2 btn-base whitespace-nowrap`} data-button="end-case">
          <XCircle size={14} className="sm:w-4 sm:h-4" /> End Case
        </button>
      </div>

      {/* Top Quick Tools */}
      <div data-tutorial-anchor="checklist-row" className="grid grid-cols-4 gap-2 sm:gap-3 mb-3 sm:mb-4 flex-shrink-0">
        <button 
          onClick={() => {
            if (isShockForced) return;
            setState(p => ({
              ...p,
              reversiblesChecklistOpened: true,
              currentOverlay: p.currentOverlay === 'reversibles' ? null : 'reversibles'
            }));
          }}
          disabled={isShockForced || tutorialRhythmDemoActive}
          data-button="reversibles"
          className={`p-4 sm:p-6 rounded-xl text-sm sm:text-xl font-bold btn-base transition-colors text-center ${
            state.currentOverlay === 'reversibles' ? 'bg-red-100 text-red-800' :
            !state.reversiblesChecklistOpened ? 'bg-red-600 text-white animate-pulse' :
            'bg-blue-100 text-blue-700'
          } ${isShockForced ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
        >
          {state.currentOverlay === 'reversibles' ? 'Close' : '4H 4T'}
        </button>
        <button 
          onClick={() => {
            if (isShockForced) return;
            setRoscButtonFlashing(false);
            setState(p => ({ ...p, currentOverlay: p.currentOverlay === 'rosc' ? null : 'rosc' }))
          }}
          data-button="rosc"
          disabled={isShockForced || tutorialRhythmDemoActive}
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
          disabled={isShockForced || tutorialRhythmDemoActive}
          className={`p-4 sm:p-6 rounded-xl text-sm sm:text-xl font-bold btn-base transition-colors ${state.currentOverlay === 'phea' ? 'bg-red-100 text-red-800' : 'bg-purple-100 text-purple-700'} ${isShockForced ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
        >
          {state.currentOverlay === 'phea' ? 'Close' : 'PHEA'}
        </button>
        <button 
          onClick={() => {
            if (isShockForced) return;
            setState(p => ({ ...p, currentOverlay: p.currentOverlay === 'vitals' ? null : 'vitals' }))
          }}
          disabled={isShockForced || tutorialRhythmDemoActive}
          data-button="vitals"
          className={`p-4 sm:p-6 rounded-xl text-sm sm:text-xl font-bold btn-base transition-colors text-center ${state.currentOverlay === 'vitals' ? 'bg-red-100 text-red-800' : 'bg-sky-100 text-sky-700'} ${isShockForced ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
        >
          {state.currentOverlay === 'vitals' ? 'Close' : 'VSS'}
        </button>
      </div>

      {/* Main Center Display */}
      <div data-green-box className={`flex-1 bg-white border-4 rounded-3xl relative overflow-hidden transition-colors duration-300 min-h-0 ${
        showHandover && !state.currentOverlay && !tutorialMode ? 'border-[#4a6fa5]' :
        state.currentOverlay === 'reversibles' ? 'border-blue-400' :
        state.currentOverlay === 'rosc' ? 'border-orange-400' :
        state.currentOverlay === 'phea' ? 'border-purple-400' :
        state.currentOverlay === 'vitals' ? 'border-sky-400' : 'border-emerald-500'
      }`}>
        {timingMode === 'log' ? (
          /* Log mode: scrollable running summary is the home screen */
          <div className="h-full flex flex-col relative">
            <div data-scroll-container="summary" className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* In the tutorial the Arrest Summary is always shown, since its note is about it and no rhythm check has happened yet to bring it up on its own */}
              <div data-tutorial-section="arrestSummary"><ArrestSummarySection state={state} showRecordingDuration alwaysShowArrestSummary={tutorialMode} /></div>
              <div data-tutorial-section="vitalSigns"><VitalSignsSection vitals={state.vitals} /></div>
              <div data-tutorial-section="pharmaSummary"><PharmaSummarySection treatments={state.treatments} pharmaSummary={pharmaSummary} infusionDoses={state.infusionDoses} activeInfusions={INFUSION_DRUGS.filter(d => state.treatments.some(t => t.name.startsWith(d)))} onUpdateInfusionDose={(drug, dose) => setState(prev => ({ ...prev, infusionDoses: { ...prev.infusionDoses, [drug]: dose } }))} /></div>
              <div data-tutorial-section="treatmentLog" className="rounded-xl border border-neutral-100">
                <div className="bg-emerald-50 text-emerald-800 p-3 font-bold text-sm tracking-wider text-center rounded-t-xl">TREATMENT LOG</div>
                <TreatmentLog treatments={state.treatments} elapsedSeconds={state.elapsedSeconds} caseOpenedAt={state.caseOpenedAt} onDelete={deleteTreatment} onMove={moveTreatment} onEdit={handleEditTreatment} />
              </div>
            </div>
            {/* Unlike elapsed mode, log mode's running summary is the inline
                content above, not an overlay - it never unmounts regardless
                of what opens on top of it, so its scroll position is already
                naturally preserved with no special handling needed. This is
                a single block (not split into a persistent "summary" layer
                like elapsed mode's equivalent) because there's no separate
                summary overlay to keep alive here - nothing in log mode
                ever sets currentOverlay to 'summary' at all. */}
            <AnimatePresence>
              {state.currentOverlay && state.currentOverlay !== 'tutorial' && (
                <Overlay
                  key={state.currentOverlay}
                  type={state.currentOverlay as OverlayType}
                  onClose={() => { setState(p => ({ ...p, currentOverlay: null })); setEditingTreatmentIndex(null); }}
                  addTreatment={editingTreatmentIndex !== null ? editTreatment : addTreatment}
                  state={state}
                  pharmaSummary={pharmaSummary}
                  isShockForced={isShockForced}
                  onDelayRhythmCheck={allowRhythmCheckDelay ? delayRhythmCheck : undefined}
                  tutorialOutcomeRestriction={tutorialOutcomeRestriction}
                  toggleChecklistItem={toggleChecklistItem}
                  onVitalsChange={(v) => setState(p => ({ ...p, vitals: v }))}
                  onDeleteTreatment={deleteTreatment}
                  onMoveTreatment={moveTreatment}
                  onEditTreatment={handleEditTreatment}
                  editingTreatmentIndex={editingTreatmentIndex}
                  onUpdateInfusionDose={(drug, dose) => setState(prev => ({ ...prev, infusionDoses: { ...prev.infusionDoses, [drug]: dose } }))}
                onHandover={tutorialMode ? undefined : () => { setShowHandover(true); setState(p => ({ ...p, currentOverlay: null })); }}
                />
              )}
            </AnimatePresence>

            {/* Tutorial overlay for Tx log only (the other modes' is in the branch below) */}
            {tutorialMode && (
              <TutorialOverlay
                appState={state}
                isShockForced={isShockForced}
                isCaseClosed={isCaseClosed}
                globalNodeIndex={tutorialNodeIndex}
                mode={timingMode ?? 'elapsed'}
                appModalOpen={showEndWarning || showPauseWarning || showRecalibrateMenu || showWeightChange || showModeChange || showElapsedRecalibrate || showResetWarning || showPatternSwitchModal || showCloseWarning || showTutorialModeBlocked}
                intervalBaseline={tutorialIntervalBaseline}
                onNodeChange={(nodeIndex, done) => {
                  setTutorialNodeIndex(nodeIndex);
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
        ) : (
        <div className="h-full flex flex-col items-center px-2 sm:px-3 pt-4 pb-2 sm:pb-3 relative">
          {/* Corner Cards */}
          <div className="absolute top-3 sm:top-4 left-3 sm:left-4 right-3 sm:right-4 flex justify-between gap-3 sm:gap-4">
            {timingMode !== 'elapsed' && timingMode !== 'minimal' && (
              <div className="bg-neutral-100 border border-neutral-100 shadow-sm rounded-xl sm:rounded-2xl py-4 px-4 sm:py-7 sm:px-8 flex flex-col items-center min-w-[100px] sm:min-w-[140px]">
                <span className="text-[10px] sm:text-[12px] font-bold text-neutral-900 tracking-widest mb-1.5 sm:mb-3">Total time</span>
                <span className="text-[22px] sm:text-[43px] font-bold text-neutral-400 tabular-nums leading-none">{formatTime(state.elapsedSeconds)}</span>
              </div>
            )}
            {(timingMode === 'elapsed' || timingMode === 'minimal') && !state.isROSCMode && (
              <div data-tutorial-anchor="elapsed-card" className="bg-neutral-100 border border-neutral-100 shadow-sm rounded-xl sm:rounded-2xl py-4 px-4 sm:py-7 sm:px-8 flex flex-col items-center min-w-[100px] sm:min-w-[140px]">
                <span className="text-[12px] sm:text-[14px] font-bold text-neutral-900 tracking-widest mb-1.5 sm:mb-3">Elapsed Time</span>
                <span className="text-[25px] sm:text-[47px] font-bold tabular-nums leading-none text-neutral-400">
                  {formatTimeWithSeconds(state.elapsedSeconds)}
                </span>
              </div>
            )}
          </div>

          {/* Rhythm Check - Centered vertically and responsive size */}
          <div className="flex-1 flex flex-col items-center justify-center w-full pt-14 sm:pt-16">
            <div data-tutorial-anchor="rhythm-ring" className="relative flex items-center justify-center w-[240px] h-[240px] sm:w-[320px] sm:h-[320px]">

              {/* Delayed rhythm check - full circle is tap target. Counts up how
                  long the check is overdue; tapping reopens the rhythm check
                  popup. No automatic re-prompt - this ring is the reminder. */}
              {state.rhythmCheckDelayedAt != null && !state.isROSCMode && timingMode !== 'log' ? (
                <>
                  <button
                    onClick={resumeDelayedRhythmCheck}
                    className="absolute inset-0 w-full h-full rounded-full btn-base flex flex-col items-center justify-center"
                    data-button="rhythm-check-now"
                  >
                    <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 300 300">
                      <circle cx="150" cy="150" r="140" fill="none" stroke="currentColor" strokeWidth="6" className="text-rose-500" />
                    </svg>
                    {/* Nudged down 4px: on-device (Roboto) the block sat ~2px high, and the
                        short "NOW" line leaves extra white space beneath it, so
                        a little more than the measured 2px balances it by eye. */}
                    <span className="z-10 translate-y-[6px] sm:translate-y-[8px] text-[36px] sm:text-[60px] font-bold tracking-tighter leading-none text-rose-600 text-center">RHYTHM<br />CHECK<br />NOW</span>
                  </button>
                  {/* How long the check has been delayed - its own pale red card just
                      below the ring. Single line so it clears the drug timer cards
                      on small phones. */}
                  <div className="absolute top-full mt-3 sm:mt-5 px-4 py-1.5 sm:px-5 sm:py-2 rounded-xl bg-red-100 flex items-baseline gap-2 whitespace-nowrap">
                    <span className="text-[13px] sm:text-[16px] font-semibold tracking-wide uppercase text-red-800">Delayed</span>
                    <span className="text-[15px] sm:text-[19px] font-semibold tabular-nums leading-none text-red-800">
                      {formatTime(Math.max(0, state.elapsedSeconds - state.rhythmCheckDelayedAt))}
                    </span>
                  </div>
                </>
              ) : state.isROSCMode ? (
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
                    setRoscButtonFlashing(false);
                    setRearrested(true);
                    rhythmCheckDueAtRef.current = state.elapsedSeconds;
                    setIsShockForced(true);
                    applyRearrestTimerWipeCheck();
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
                    (state.rhythmCheckTarget - state.elapsedSeconds) <= 20 ? 'text-red-500' : 'text-emerald-500'
                  }
                  animate={{ 
                    strokeDashoffset: state.rhythmCheckPaused
                      ? 1 - Math.max(0, (state.frozenCountdown || 0) / 120)
                      : state.rhythmCheckOvertime > 0 
                        ? 1 - (state.rhythmCheckOvertime / 6)
                        : tutorialMode && (timingMode === 'elapsed' || timingMode === 'minimal')
                          // In the tutorial the countdown is moved around (reset to 0:20, fast-forwarded), so the
                          // ring follows the countdown itself. In normal use this is the same value as the
                          // interval-grid calculation below, which is what the real app uses.
                          ? Math.min(1, Math.max(0, (state.rhythmCheckTarget - state.elapsedSeconds) / 120))
                        : (timingMode === 'elapsed' || timingMode === 'minimal') && rhythmInterval
                          ? (() => {
                              // Progress ring fills from previous interval boundary to next
                              const intervalMap: Record<string, { period: number; offset: number }> = {
                                'evens':      { period: 120, offset: 0  },
                                'odds':       { period: 120, offset: 60 },
                                'half-evens': { period: 120, offset: 30 },
                                'half-odds':  { period: 120, offset: 90 },
                              };
                              const { period, offset } = intervalMap[rhythmInterval];
                              const phase = ((state.elapsedSeconds - offset) % period + period) % period;
                              return 1 - (phase / period);
                            })()
                          : 1 - Math.max(0, (state.rhythmCheckTarget - state.elapsedSeconds) / 120)
                  }}
                  style={{ strokeDasharray: 1 }}
                  transition={{ duration: tutorialFastForward ? 0.1 : 0.5, ease: "linear" }}
                />
              </svg>
              
              <div className="flex flex-col items-center z-10 translate-y-3 sm:translate-y-4">
                <div 
                  className={`font-bold tabular-nums tracking-tighter leading-none text-7xl sm:text-[120px] ${
                    state.rhythmCheckPaused ? 'text-neutral-900' :
                    state.rhythmCheckOvertime > 0 ? 'text-red-600' :
                    (state.rhythmCheckTarget - state.elapsedSeconds) <= 20 ? 'text-red-600' : 'text-neutral-900'
                  }`}
                >
                  {state.rhythmCheckPaused 
                    ? formatTime(state.frozenCountdown || 0)
                    : state.rhythmCheckOvertime > 0 
                      ? formatTime(6 - state.rhythmCheckOvertime)
                      : formatTime(Math.max(0, state.rhythmCheckTarget - state.elapsedSeconds))
                  }
                </div>
                <div className={`uppercase tracking-widest font-bold mt-4 sm:mt-8 text-[14px] sm:text-[18px] ${
                  state.rhythmCheckOvertime > 0 ? 'text-red-600 flash-red' :
                  (state.rhythmCheckTarget - state.elapsedSeconds) <= 20 && !state.rhythmCheckPaused ? 'text-red-600' :
                  'text-neutral-400'
                }`}>
                  Rhythm Check
                </div>
              </div>
              </>
              )}
            </div>
          </div>

          <AnimatePresence>
            {(state.currentOverlay === 'summary' || (state.currentOverlay === 'treatment' && editingTreatmentIndex !== null)) && (
              <Overlay
                key="summary"
                type="summary"
                onClose={() => { setState(p => ({ ...p, currentOverlay: null })); setEditingTreatmentIndex(null); }}
                addTreatment={addTreatment}
                state={state}
                pharmaSummary={pharmaSummary}
                isShockForced={isShockForced}
                toggleChecklistItem={toggleChecklistItem}
                onVitalsChange={(v) => setState(p => ({ ...p, vitals: v }))}
                onDeleteTreatment={deleteTreatment}
                onMoveTreatment={moveTreatment}
                onEditTreatment={handleEditTreatment}
                editingTreatmentIndex={editingTreatmentIndex}
                onUpdateInfusionDose={(drug, dose) => setState(prev => ({ ...prev, infusionDoses: { ...prev.infusionDoses, [drug]: dose } }))}
                onHandover={tutorialMode ? undefined : () => { setShowHandover(true); setState(p => ({ ...p, currentOverlay: null })); }}
              />
            )}
          </AnimatePresence>
          {/* Split into two AnimatePresence blocks (unlike log mode's single
              block above, which needs no such split - see its own comment):
              the Summary overlay keeps a fixed key="summary" so it stays
              mounted the entire time an edit's Tx-selection overlay is open
              on top of it, preserving its scroll position automatically.
              This one genuinely needs it, since elapsed mode's running
              summary IS an overlay - unlike log mode's, which is inline on
              the home screen and never unmounts regardless. */}
          <AnimatePresence>
            {state.currentOverlay && state.currentOverlay !== 'tutorial' && state.currentOverlay !== 'summary' && (
              <Overlay 
                key={state.currentOverlay}
                type={state.currentOverlay as OverlayType} 
                onClose={() => { setState(p => ({ ...p, currentOverlay: null })); setEditingTreatmentIndex(null); }}
                addTreatment={editingTreatmentIndex !== null ? editTreatment : addTreatment}
                state={state}
                pharmaSummary={pharmaSummary}
                isShockForced={isShockForced}
                onDelayRhythmCheck={allowRhythmCheckDelay ? delayRhythmCheck : undefined}
                tutorialOutcomeRestriction={tutorialOutcomeRestriction}
                toggleChecklistItem={toggleChecklistItem}
                onVitalsChange={(v) => setState(p => ({ ...p, vitals: v }))}
                onDeleteTreatment={deleteTreatment}
                onMoveTreatment={moveTreatment}
                onEditTreatment={handleEditTreatment}
                editingTreatmentIndex={editingTreatmentIndex}
                  onUpdateInfusionDose={(drug, dose) => setState(prev => ({ ...prev, infusionDoses: { ...prev.infusionDoses, [drug]: dose } }))}
                onHandover={tutorialMode ? undefined : () => { setShowHandover(true); setState(p => ({ ...p, currentOverlay: null })); }}
              />
            )}
          </AnimatePresence>

          {showPatternSwitchModal && (
            <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-6" style={{ height: '100dvh' }}>
              <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
                <AlertTriangle size={48} className="mx-auto text-amber-600 mb-4" />
                <h2 className="text-2xl font-bold text-neutral-900 mb-4">Unscheduled Rhythm Check Added.</h2>
                <p className="text-neutral-500 mb-2">2:00 countdown restarted.</p>
                <p className="text-neutral-500 mb-8">Future rhythm checks changed to {patternSwitchNoticeRef.current}.</p>
                <button onClick={() => setShowPatternSwitchModal(false)} className="w-full bg-amber-600 p-4 rounded-xl font-bold text-white btn-base">Got It</button>
              </div>
            </div>
          )}

          {/* Tutorial Overlay - renders on top of real app */}
          {tutorialMode && (
            <TutorialOverlay
              appState={state}
              isShockForced={isShockForced}
              isCaseClosed={isCaseClosed}
              globalNodeIndex={tutorialNodeIndex}
              mode={timingMode ?? 'elapsed'}
              appModalOpen={showEndWarning || showPauseWarning || showRecalibrateMenu || showWeightChange || showModeChange || showElapsedRecalibrate || showResetWarning || showPatternSwitchModal || showCloseWarning || showTutorialModeBlocked}
              intervalBaseline={tutorialIntervalBaseline}
              onNodeChange={(nodeIndex, done) => {
                setTutorialNodeIndex(nodeIndex);
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
              data-tutorial-anchor="adrenaline-timer"
              onClick={() => {
                if (!adrenalineStatus.show || disregardAdrenaline === 'confirmed') return;
                if (disregardAdrenaline === 'pending') {
                  setDisregardAdrenaline('confirmed');
                } else if (disregardAdrenaline !== 'confirmed') {
                  setDisregardAdrenaline('pending');
                }
              }}
              className={`flex-1 p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl flex flex-col items-center justify-center border-2 transition-all duration-300 min-h-[90px] sm:min-h-[120px] ${
                !adrenalineStatus.show || disregardAdrenaline === 'confirmed' 
                  ? 'opacity-0 pointer-events-none' 
                  : 'opacity-100 cursor-pointer'
              } ${
                disregardAdrenaline === 'pending'
                  ? 'bg-red-200 text-red-900 border-neutral-100'
                  : adrenalineStatus.flashRed 
                  ? 'bg-red-200 text-red-900 border-neutral-100 animate-pulse' 
                  : 'bg-[#daf3e5] text-emerald-900 border-[#daf3e5]' // pale green, part-way between muted sage and emerald-100
              }`}
            >
              {disregardAdrenaline === 'pending' ? (
                <span className="text-xl sm:text-2xl font-bold tracking-tight text-center">Disregard?</span>
              ) : (
                <DrugTimerContent text={adrenalineStatus.text} flashRed={adrenalineStatus.flashRed} nameColour="text-emerald-900" timeColour="text-emerald-500" />
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
                    : 'bg-purple-100 text-purple-900 border-purple-100' // pale purple = ICP-only drug (ACTAS guideline app convention)
                }`}
              >
                {disregardAmiodarone === 'pending' ? (
                  <span className="text-xl sm:text-2xl font-bold tracking-tight text-center">Disregard?</span>
                ) : (
                  <DrugTimerContent text={amiodaroneStatus.text} flashRed={amiodaroneStatus.flashRed} nameColour="text-purple-900" timeColour="text-purple-400" />
                )}
              </div>
          </div>
        </div>
        )} {/* end else (non-log mode) */}
        <AnimatePresence>
          {showHandover && !tutorialMode && (
            <motion.div key="handover" className="absolute inset-0 z-[45]"
              initial={{ y: '-100%' }} animate={{ y: 0 }} exit={{ y: '-100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 220, mass: 0.8 }}>
              <HandoverOverlay embedded state={state} pharmaSummary={pharmaSummary} onField={setHandoverField} onVital={setVital} onView={v => { handoverViewRef.current = v; }} barEl={handoverBar} resumeKey={handoverResumeRef.current} onPage={k => { handoverResumeRef.current = k; }} onFinish={() => { closeHandover(); setState(p => ({ ...p, currentOverlay: null })); }} onClose={closeHandover} onWeight={setHandoverWeight} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Main Controls */}
      {showHandover && !state.currentOverlay && !tutorialMode && (
        <div ref={setHandoverBar} data-handover-bar className="grid grid-cols-2 gap-3 sm:gap-4 mt-3 sm:mt-4 flex-shrink-0" />
      )}
      <div className={`${showHandover && !state.currentOverlay && !tutorialMode ? 'hidden' : ''} grid gap-3 sm:gap-4 mt-3 sm:mt-4 flex-shrink-0 ${timingMode === 'log' ? (state.isROSCMode ? 'grid-cols-2' : 'grid-cols-1') : timingMode === 'minimal' ? 'grid-cols-1' : 'grid-cols-2'}`}>
        {timingMode !== 'log' && timingMode !== 'minimal' && (
          <button 
            onClick={() => {
              if (isShockForced) return;
              if (showHandover && !state.currentOverlay) { setShowHandover(false); return; }    // the Handover is open in the box: this closes it
              setState(p => ({ ...p, currentOverlay: p.currentOverlay === 'summary' ? null : 'summary' }))
            }}
            disabled={isShockForced || tutorialRhythmDemoActive}
            className={`p-3 sm:p-5 rounded-2xl text-base sm:text-xl font-bold flex items-center justify-center gap-2 sm:gap-3 btn-base transition-colors ${state.currentOverlay === 'summary' || (showHandover && !state.currentOverlay) ? 'bg-red-100 text-red-800' : 'bg-emerald-600 text-white'}`}
            data-button="summary"
          >
            {state.currentOverlay === 'summary' || (showHandover && !state.currentOverlay) ? <XCircle size={18} className="sm:w-6 sm:h-6" /> : <FileText size={18} className="sm:w-6 sm:h-6" />}
            {state.currentOverlay === 'summary' || (showHandover && !state.currentOverlay) ? 'Close' : 'Summary'}
          </button>
        )}
        {timingMode === 'log' && state.isROSCMode && (
          <button
            onClick={() => {
              setState(prev => ({
                ...prev,
                isROSCMode: false,
                currentOverlay: 'treatment'
              }));
              setRoscButtonFlashing(false);
              setRearrested(true);
              rhythmCheckDueAtRef.current = state.elapsedSeconds;
              setIsShockForced(true);
              applyRearrestTimerWipeCheck();
            }}
            className="p-3 sm:p-5 rounded-2xl text-base sm:text-xl font-bold flex items-center justify-center gap-2 sm:gap-3 btn-base transition-colors bg-orange-500 text-white"
          >
            Rearrest
          </button>
        )}
        <button 
          onClick={() => {
            if (isShockForced) return;
            setState(p => ({ ...p, currentOverlay: p.currentOverlay === 'treatment' ? null : 'treatment' }))
          }}
          disabled={isShockForced || tutorialRhythmDemoActive}
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
              key={catchupTxMode ? 'catchupTx' : catchupStep}
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '-100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 30, stiffness: 280 }}
              className={`bg-white rounded-[28px] max-w-md w-[90%] shadow-2xl overflow-hidden overflow-x-hidden ${catchupTxMode ? '' : 'p-6 absolute max-h-[calc(100dvh-2rem)] overflow-y-auto'}`}
              style={catchupTxMode ? { height: '68vh' } : {}}
            >
              {catchupTxMode && (
                <div className="flex flex-col h-full overflow-hidden" style={{ width: '100%', boxSizing: 'border-box' }}>
                  <div className="flex-1 overflow-hidden" style={{ width: '100%' }}>
                    <TreatmentSelection
                      addTreatment={(name) => { addTreatment(name); }}
                      state={{ ...state, patientType: weightType as any, patientWeight: weightInput ? parseFloat(weightInput) : state.patientWeight }}
                      isShockForced={false}
                      patientTypeOverride={weightType}
                    />
                  </div>
                  <div className="flex-shrink-0 p-4 border-t border-neutral-100">
                    <button onClick={() => setCatchupTxMode(false)} className="w-full bg-neutral-100 text-neutral-700 p-3 rounded-xl font-bold">
                      Back
                    </button>
                  </div>
                </div>
              )}
              {!catchupTxMode && catchupStep === 1 && (
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
                        setTimingMode(null);          // nothing is pre-chosen: a mode picked in an earlier, abandoned setup isn't kept
                        setExpandedMode(null);
                        setCatchupStep(6);
                        setUseManualEntry(true);
                      }} 
                      className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white p-5 rounded-2xl text-lg font-bold shadow-lg shadow-emerald-500/30 transition-all duration-200 hover:shadow-xl hover:scale-[1.02]"
                    >
                      Start
                    </button>
                    <button 
                      onClick={() => {
                        setShowCatchup(true);
                        setCatchupStep(6);
                        setTimingMode(null);
                        setTimingNodesComplete(false);
                        setShowInteractiveTutorial(true);
                      }} 
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-2xl text-base font-semibold shadow-md shadow-blue-500/20 transition-all duration-200 hover:shadow-lg hover:scale-[1.02]"
                    >
                      Tutorial
                    </button>
                    {previousCases.length > 0 && (
                      <button
                        onClick={() => setShowPreviousCasesList(true)}
                        className="w-full bg-neutral-100 hover:bg-neutral-200 text-neutral-700 p-4 rounded-2xl text-base font-semibold transition-all duration-200"
                      >
                        View Previous Cases
                      </button>
                    )}
                  </div>

                  <div className="text-[11px] text-neutral-400 text-center pt-2 space-y-0.5">
                    <p>The Big One {APP_VERSION}</p>
                    <p>ACTAS CMG v1.1.0.3</p>
                    <p>Last reviewed October 2026</p>
                  </div>
                </div>
              )}

              {showPreviousCasesList && (
                <div className="fixed inset-0 bg-black/60 z-[2000] flex items-center justify-center p-6">
                  <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl max-h-[85vh] flex flex-col">
                    <h2 className="text-xl font-bold text-neutral-900 text-center mb-4 flex-shrink-0">Previous Cases</h2>
                    <p className="text-xs text-neutral-500 text-center mb-4 flex-shrink-0">The last {MAX_PREVIOUS_CASES} closed cases are kept here as a backup, in case a case is closed but never exported.</p>
                    <div className="space-y-3 overflow-y-auto flex-1">
                      {previousCases.length === 0 && (
                        <p className="text-neutral-400 text-center text-sm py-6">No previous cases saved yet.</p>
                      )}
                      {previousCases.map((pc, i) => {
                        const pcPatientLabel = pc.patientType === 'adult'
                          ? `Adult · ${pc.patientWeight}kg`
                          : pc.patientType === 'paed'
                          ? (pc.patientAge ? `Paediatric · ${pc.patientAge} · ${pc.patientWeight}kg` : `Paediatric · ${pc.patientWeight}kg`)
                          : 'Patient details not recorded';
                        const closedDate = pc.caseClosedAt ? new Date(pc.caseClosedAt) : null;
                        const closedLabel = closedDate
                          ? `${closedDate.toLocaleDateString('en-AU')} · ${getLocalTime(closedDate)}`
                          : 'Closure time not recorded';
                        return (
                          <button
                            key={i}
                            onClick={() => { setViewingPreviousCase(pc); setShowPreviousCasesList(false); }}
                            className="w-full text-left bg-neutral-50 hover:bg-neutral-100 rounded-2xl p-4 border border-neutral-200 transition-colors"
                          >
                            <div className="font-bold text-neutral-900">{pcPatientLabel}</div>
                            <div className="text-sm text-neutral-500 mt-0.5">Closed {closedLabel}</div>
                          </button>
                        );
                      })}
                    </div>
                    <button onClick={() => setShowPreviousCasesList(false)} className="w-full mt-4 p-3 rounded-xl bg-neutral-100 font-bold text-neutral-700 btn-base flex-shrink-0">Close</button>
                  </div>
                </div>
              )}

              {/* Portalled to <body> so the viewer is no longer a descendant of
                  the Catchup modal's .fixed wrapper - print CSS hides every
                  .fixed element, and a display:none ancestor hides all of its
                  descendants regardless of their own display value, which is
                  what made the saved-case PDF blank. */}
              {viewingPreviousCase && createPortal(
                <div className="fixed inset-0 bg-neutral-200 z-[2000] overflow-y-auto previous-case-modal">
                  <div className="min-h-screen p-6 pb-24">
                  <div className="max-w-2xl mx-auto bg-white rounded-3xl border border-neutral-200 shadow-2xl p-6 space-y-6">
                    <div className="space-y-6 break-inside-avoid has-arrest-summary">
                    <div className="text-center space-y-6">
          <div className="inline-flex items-center gap-3 text-emerald-600 font-bold text-xs tracking-[0.2em] uppercase">
            <span className="w-6 h-px bg-emerald-300" />
            The Big One
            <span className="w-6 h-px bg-emerald-300" />
          </div>
          <h1 className="text-4xl font-bold text-neutral-900">Case Summary</h1>
          <p className="text-neutral-400 text-sm font-medium">{formatCaseDate(viewingPreviousCase.caseClosedAt)}</p>
        </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => exportCasePdf(viewingPreviousCase.caseClosedAt)}
                        className="flex items-center justify-center gap-1 bg-emerald-50 text-emerald-700 py-3 px-2 rounded-xl font-bold btn-base border border-emerald-100"
                      >
                        <FileText size={20} /> Export PDF
                      </button>
                      <button
                        onClick={() => { setViewingPreviousCase(null); setShowPreviousCasesList(true); }}
                        className="flex items-center justify-center gap-1 bg-red-50 text-red-700 py-3 px-2 rounded-xl font-bold btn-base border border-red-100"
                      >
                        Back
                      </button>
                    </div>

                    <ArrestSummarySection state={viewingPreviousCase} showRecordingDuration showFinalDuration alwaysShowArrestSummary />
                    </div>

                    <VitalSignsSection vitals={viewingPreviousCase.vitals} />

                    <PharmaSummarySection
                      treatments={viewingPreviousCase.treatments}
                      pharmaSummary={computePharmaSummary(viewingPreviousCase.treatments)}
                      infusionDoses={viewingPreviousCase.infusionDoses}
                      activeInfusions={INFUSION_DRUGS.filter(d => viewingPreviousCase.treatments.some(t => t.name.startsWith(d)))}
                    />

                    <div className="rounded-xl border border-neutral-100">
                      <div className="bg-emerald-50 text-emerald-800 p-3 font-bold text-sm tracking-wider text-center rounded-t-xl">TREATMENT LOG</div>
                      <TreatmentLog
                        treatments={viewingPreviousCase.treatments}
                        elapsedSeconds={viewingPreviousCase.elapsedSeconds}
                        caseOpenedAt={viewingPreviousCase.caseOpenedAt}
                        isSummary={true}
                      />
                    </div>
                  </div>
                  </div>
                </div>,
                document.body
              )}

              {!catchupTxMode && catchupStep === 2 && (
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
                        <div className="h-14 flex items-end justify-center">
                          <svg width="52" height="46" viewBox="0 0 52 46" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="26" cy="10" r="10" fill={weightType === 'adult' ? 'white' : '#10b981'} />
                            <path d="M6 46c0-11.046 8.954-24 20-24s20 12.954 20 24" fill={weightType === 'adult' ? 'white' : '#10b981'} />
                          </svg>
                        </div>
                        <div className="text-center">
                          <div className="font-bold text-lg">Adult</div>
                          <div className={`text-xs mt-1 ${weightType === 'adult' ? 'text-emerald-100' : 'text-neutral-400'}`}>
                            ≥12 years
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
                        <div className="h-14 flex items-end justify-center">
                          <svg width="66" height="46" viewBox="0 0 66 46" fill="none" xmlns="http://www.w3.org/2000/svg">
                            {/* Carer - exact same coordinates as adult icon, slightly lighter */}
                            <circle cx="26" cy="10" r="10" fill={weightType === 'paed' ? 'rgba(255,255,255,0.6)' : '#c4cad1'} />
                            <path d="M6 46c0-11.046 8.954-24 20-24s20 12.954 20 24" fill={weightType === 'paed' ? 'rgba(255,255,255,0.6)' : '#c4cad1'} />
                            {/* Child - moved closer */}
                            <circle cx="44" cy="23" r="6" fill={weightType === 'paed' ? 'white' : '#f472b6'} />
                            <path d="M32 46c0-6.627 5.373-14 12-14s12 7.373 12 14" fill={weightType === 'paed' ? 'white' : '#f472b6'} />
                          </svg>
                        </div>
                        <div className="text-center">
                          <div className="font-bold text-lg">Paediatric</div>
                          <div className={`text-xs mt-1 ${weightType === 'paed' ? 'text-pink-100' : 'text-neutral-400'}`}>
                            24 hrs – 11 yrs
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
                        <option value="35">35kg</option>
                        <option value="40">40kg</option>
                        <option value="50">50kg</option>
                        <option value="60">60kg</option>
                        <option value="70">70kg</option>
                        <option value="80">80kg</option>
                        <option value="90">90kg</option>
                        <option value="100">100kg</option>
                        <option value="110">110kg</option>
                        <option value="120">120kg</option>
                        <option value="130">130kg</option>
                        <option value="140">140kg</option>
                        <option value="150">150kg</option>
                        <option value="160">160kg</option>
                        <option value="170">170kg</option>
                        <option value="180">180kg</option>
                        <option value="190">190kg</option>
                        <option value="200">200kg</option>
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
                            const opt = e.target.options[e.target.selectedIndex];
                            setPaedAgeLabel(opt.text.split(' (')[0]);
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
                            <option key={age} value={weight}>{age} ({weight}kg)</option>
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
                  <div className="sticky bottom-0 bg-white grid grid-cols-2 gap-3 pt-2">
                    <button 
                      onClick={() => setCatchupStep(6)} 
                      className="py-4 rounded-xl font-bold transition-colors bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                    >
                      Back
                    </button>
                    <button
                      onClick={() => weightInput && setCatchupStep(3)}
                      disabled={!weightInput || (showInteractiveTutorial && !catchupNodeCleared)}
                      className={`py-4 rounded-xl font-bold transition-all ${
                        weightInput && !(showInteractiveTutorial && !catchupNodeCleared)
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
                  <h2 className="text-xl font-bold text-neutral-900 px-4">Enter Elapsed Time</h2>
                  <p className="text-neutral-600 text-sm px-4">This is the time in the top-right corner of the monitor</p>
                  <ElapsedTimePicker value={catchupElapsed} onChange={setCatchupElapsed} />
                  
                  <div className="sticky bottom-0 bg-white grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => {
                        setCatchupStep(7);
                        setUseManualEntry(false);
                      }} 
                      className="bg-neutral-100 text-neutral-700 p-3 rounded-xl font-bold btn-base"
                    >
                      Back
                    </button>
                    <button 
                      onClick={() => { 
                        setElapsedTimestamp(Date.now());
                        if (showInteractiveTutorial) {
                          setShowInteractiveTutorial(false);
                          setTutorialMode(true);
                        }
                        handleCatchupStart();
                      }} 
                      disabled={showInteractiveTutorial && !catchupNodeCleared}
                      className={`p-3 rounded-xl font-bold btn-base ${showInteractiveTutorial && !catchupNodeCleared ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed' : 'bg-emerald-600 text-white'}`}
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
                            ? 'bg-emerald-500 text-white shadow-lg scale-105'
                            : 'bg-white text-neutral-700 border-2 border-neutral-200 hover:border-emerald-300'
                        }`}
                      >
                        <div className="font-bold text-base">{label}</div>
                        <div className={`text-xs mt-1 ${rhythmInterval === key ? 'text-emerald-100' : 'text-neutral-400'}`}>{example}</div>
                      </button>
                    ))}
                  </div>

                  <div className="sticky bottom-0 bg-white grid grid-cols-2 gap-3 pt-2">
                    <button onClick={() => setCatchupStep(timingMode === 'minimal' ? 6 : 3)} className="bg-neutral-100 text-neutral-700 py-4 rounded-xl font-bold hover:bg-neutral-200 transition-colors">Back</button>
                    <button
                      onClick={() => rhythmInterval && setCatchupStep(4)}
                      disabled={!rhythmInterval}
                      className={`py-4 rounded-xl font-bold transition-all ${
                        rhythmInterval
                          ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md'
                          : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                      }`}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}

              {!catchupTxMode && catchupStep === 3 && (
                <div className="text-center space-y-5">
                  <h2 className="text-xl font-bold text-neutral-900">What Treatments Have<br />You Already Applied?</h2>
                  <div className="space-y-3 py-3 px-2">
                    <div className="bg-red-50 border border-red-200 rounded-2xl p-3.5">
                      <p className="text-xs font-bold uppercase tracking-wide text-red-900 text-center mb-2.5">Rhythm checks</p>
                      <div className="space-y-2">
                        <CounterItem label="Shock" value={priorCounts.shock} onChange={v => setPriorCounts(p => ({ ...p, shock: v }))} activeBorderClass="border-red-700" />
                        <CounterItem label="Disarm" value={priorCounts.disarm} onChange={v => setPriorCounts(p => ({ ...p, disarm: v }))} activeBorderClass="border-red-700" />
                      </div>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5">
                      <p className="text-xs font-bold uppercase tracking-wide text-emerald-900 text-center mb-2.5">Medications</p>
                      <div className="space-y-2">
                        <CounterItem label="Adrenaline" value={priorCounts.adrenaline} onChange={v => setPriorCounts(p => ({ ...p, adrenaline: v }))} activeBorderClass="border-emerald-700" />
                        <CounterItem label="Amiodarone" value={priorCounts.amiodarone} onChange={v => setPriorCounts(p => ({ ...p, amiodarone: Math.min(2, v) }))} activeBorderClass="border-emerald-700" />
                      </div>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3.5">
                      <p className="text-xs font-bold uppercase tracking-wide text-blue-900 text-center mb-2.5">Airway and access</p>
                      <div className="grid grid-cols-4 gap-2">
                        {['BVM', 'LMA', 'IO', 'IV'].map(tx => (
                          <button 
                            key={tx}
                            onClick={() => setPriorTxs(p => p.includes(tx) ? p.filter(t => t !== tx) : [...p, tx])}
                            className={`p-3 rounded-xl font-bold text-base bg-white border-2 ${priorTxs.includes(tx) ? 'border-blue-800 text-blue-900' : 'border-neutral-200 text-neutral-600'}`}
                          >
                            {tx}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={() => setCatchupTxMode(true)}
                      className="w-full p-3 rounded-xl font-bold text-base bg-neutral-100 text-neutral-700 border border-neutral-300 flex items-center justify-center gap-2"
                    >
                      <Plus size={16} /> Full Tx List
                    </button>
                    <div className="sticky bottom-0 bg-white grid grid-cols-2 gap-3 pt-2">
                      <button onClick={() => setCatchupStep(2)} className="bg-neutral-100 text-neutral-700 p-3 rounded-xl font-bold btn-base">Back</button>
                      <button
                        onClick={() => {
                          if (timingMode === 'elapsed' || timingMode === 'minimal') setCatchupStep(7);
                          else if (timingMode === 'log') {
                            if (showInteractiveTutorial) {
                              setShowInteractiveTutorial(false);
                              setTutorialMode(true);
                            }
                            handleCatchupStart();
                          }
                        }}
                        disabled={showInteractiveTutorial && !catchupNodeCleared}
                        className={`p-3 rounded-xl font-bold btn-base ${showInteractiveTutorial && !catchupNodeCleared ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed' : 'bg-emerald-600 text-white'}`}
                      >
                        {timingMode === 'log' ? 'Start Case' : 'Next'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {!catchupTxMode && catchupStep === 6 && (
                <div className="space-y-4 px-4 pb-1 max-w-md mx-auto text-center max-h-[calc(100dvh-6rem)] overflow-y-auto overflow-x-hidden">
                  <h2 className="text-2xl font-bold text-neutral-900">Select App Mode</h2>

                  {/* Three stacked landscape cards. Tap one to choose it: it
                      highlights and expands to show what that mode does and
                      doesn't do. Nothing is pre-selected, so Next stays
                      disabled until a mode has been picked on purpose.
                      timingMode is the only state involved; everything
                      downstream reads it exactly as before. The max-height /
                      scroll on this container is a safety net so the Back and
                      Next buttons stay reachable on a short screen once a card
                      has expanded. */}
                  <div className="flex flex-col gap-3 -mx-2">
                    {([{ title: 'Cardiac arrest', modes: ['minimal', 'elapsed'] }, { title: 'General', modes: ['log'] }] as const).map(group => (
                    <div key={group.title} data-mode-group className="rounded-3xl border border-neutral-200 bg-neutral-50 p-2.5 space-y-2">
                    <ModeGroupHeading text={group.title} />
                    {group.modes.map(mode => {
                      const selected = timingMode === mode;
                      // Only ever expanded while it's also the chosen mode, so a
                      // stale value left over from an earlier run can't show a
                      // panel on a card that isn't selected.
                      const expanded = selected && expandedMode === mode;
                      const details = TIMING_MODE_DETAILS[mode];
                      return (
                        <div
                          key={mode}
                          className={`rounded-2xl border-2 overflow-hidden transition-colors duration-200 ${selected ? 'border-emerald-500 bg-emerald-50' : 'border-neutral-200 bg-white hover:border-neutral-300'}`}
                        >
                          <button
                            onClick={() => {
                              if (selected) {
                                // Already chosen: tapping it again un-chooses it (Next goes back to disabled)
                                setTimingMode(null);
                                setExpandedMode(null);
                              } else {
                                setTimingMode(mode);
                                setExpandedMode(mode);
                              }
                            }}
                            disabled={showInteractiveTutorial && !timingNodesComplete}
                            aria-expanded={expanded}
                            className="w-full h-[72px] px-4 flex items-center gap-4 text-left"
                          >
                            <div className="w-[88px] flex-shrink-0 flex items-center justify-center">
                              <ModeIcon mode={mode} />
                            </div>
                            <div className="font-bold text-lg text-neutral-900"><ModeShortName mode={mode} /></div>
                          </button>

                          <AnimatePresence initial={false}>
                            {expanded && (
                              <motion.div
                                key="details"
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.25, ease: 'easeOut' }}
                                // Tapping anywhere in the opened-up part closes it too, not just
                                // the title row above - that's where a thumb naturally lands
                                onClick={() => { setTimingMode(null); setExpandedMode(null); }}
                                className="overflow-hidden cursor-pointer"
                              >
                                <div className="px-4 pb-4 pt-1 text-left space-y-3 text-sm text-neutral-700">
                                  <p>{details.summary}</p>
                                  <p data-mode-card-note>{mode === 'minimal' ? "Can't be changed to another mode once the case starts." : `Can be changed to '${MODE_SHORT_NAMES[mode === 'log' ? 'elapsed' : 'log']}' mode mid case.`}</p>
                                  <div
                                    className="pt-3 border-t border-emerald-200"
                                    role="img"
                                    aria-label={`Difficulty: ${DIFFICULTY_LABELS[details.difficulty - 1]}`}
                                  >
                                    <div className="text-xs font-semibold text-neutral-500 mb-1.5">Difficulty</div>
                                    <div className="flex gap-1">
                                      {[1, 2, 3].map(n => (
                                        <div
                                          key={n}
                                          data-filled={n <= details.difficulty}
                                          className={`h-2 flex-1 rounded-full ${n <= details.difficulty ? DIFFICULTY_COLOURS[details.difficulty - 1] : 'bg-neutral-200'}`}
                                        />
                                      ))}
                                    </div>
                                    <div className="flex justify-between mt-1 text-[11px] font-medium text-neutral-400">
                                      <span>Low</span>
                                      <span>High</span>
                                    </div>
                                  </div>
                                  {/* Read about this mode before committing to it. Plain text in
                                      the card's own colours - deliberately not a node. */}
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setAboutMode(mode); }}
                                    className="block text-sm font-semibold text-emerald-700 underline underline-offset-2"
                                  >
                                    Learn More ›
                                  </button>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                    </div>
                    ))}
                  </div>

                  <div className="sticky bottom-0 bg-white grid grid-cols-2 gap-3 pt-2">
                    <button onClick={() => (showInteractiveTutorial ? setIntroRewind(n => n + 1) : setCatchupStep(1))} className="bg-neutral-100 py-4 rounded-xl font-bold transition-colors text-neutral-700 hover:bg-neutral-200">Back</button>
                    <button
                      onClick={() => {
                        // In the tutorial this page is where a mode's tutorial is picked:
                        // a "you've chosen ..." page comes first (see the InteractiveTutorial
                        // props below), then that mode's tutorial.
                        if (showInteractiveTutorial) {
                          resetTutorialSetup();
                          setTutorialModeIntro(timingMode);
                          return;
                        }
                        setCatchupStep(timingMode === 'minimal' ? 7 : 2);
                      }}
                      disabled={!timingMode}
                      className={`py-4 rounded-xl font-bold transition-all ${timingMode ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md' : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'}`}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* Warning Modals */}

      {showEndWarning && (
        <div className="fixed inset-0 bg-black/80 z-[2000] flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
            <h2 className="text-2xl font-bold text-neutral-900 mb-2">End This Case?</h2>
            <p className="text-neutral-500 mb-8">This will end the timer and show the final summary.</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setShowEndWarning(false)} className="bg-neutral-100 p-4 rounded-xl font-bold text-neutral-700 btn-base">Cancel</button>
              <button onClick={endCase} className="bg-emerald-600 p-4 rounded-xl font-bold text-white btn-base">End</button>
            </div>
          </div>
        </div>
      )}

      {showPauseWarning && (
        <div className="fixed inset-0 bg-black/80 z-[2000] flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
            <h2 className="text-2xl font-bold text-neutral-900 mb-2">Pause Timer?</h2>
            <p className="text-neutral-500 mb-8">The arrest timer will pause until you resume.</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setShowPauseWarning(false)} className="bg-neutral-100 p-4 rounded-xl font-bold text-neutral-700 btn-base">Cancel</button>
              <button onClick={togglePause} className="bg-red-600 p-4 rounded-xl font-bold text-white btn-base">Pause</button>
            </div>
          </div>
        </div>
      )}



      {showRecalibrateMenu && (
        <div className="fixed inset-0 bg-black/60 z-[2000] flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl space-y-4">
            <h2 className="text-2xl font-bold text-neutral-900 text-center">Recalibrate</h2>
            {(timingMode === 'elapsed' || timingMode === 'minimal') && (
            <button
              onClick={() => {
                setShowRecalibrateMenu(false);
                setStagedElapsedSeconds(state.elapsedSeconds);
                setStagedRhythmInterval(rhythmInterval || 'evens');
                setElapsedManuallyEdited(false);
                setShowElapsedRecalibrate(true);
              }}
              data-button="recalibrate-timer"
              className="w-full p-4 rounded-2xl bg-neutral-100 text-neutral-800 font-bold text-center"
            >
              <div className="text-base">Recalibrate Timer</div>
              <div className="text-xs text-neutral-500 font-medium mt-0.5">Adjust the current elapsed time or rhythm check interval</div>
            </button>
            )}
            {timingMode !== 'minimal' && (
            <button
              onClick={() => {
                setNewWeightInput(String(state.patientWeight ?? ''));
                setNewPatientType(state.patientType as 'adult' | 'paed');
                if (state.patientType === 'paed' && state.patientAge) {
                  setNewPaedWeightMethod('age');
                  setNewPaedAgeLabel(state.patientAge);
                } else {
                  setNewPaedWeightMethod('weight');
                  setNewPaedAgeLabel(null);
                }
                setShowRecalibrateMenu(false);
                setShowWeightChange(true);
              }}
              data-button="change-weight"
              className="w-full p-4 rounded-2xl bg-neutral-100 text-neutral-800 font-bold text-center"
            >
              <div className="text-base">Change Patient Weight</div>
              <div className="text-xs text-neutral-500 font-medium mt-0.5">Currently {state.patientWeight}kg</div>
            </button>
            )}
            {timingMode !== 'minimal' && (
            <button
              onClick={() => {
                setShowRecalibrateMenu(false);
                setShowModeChange(true);
              }}
              className="w-full p-4 rounded-2xl bg-neutral-100 text-neutral-800 font-bold text-center"
            >
              <div className="text-base">Change Mode</div>
              <div className="text-xs text-neutral-500 font-medium mt-0.5">Currently {timingMode ? TIMING_MODE_LABELS[timingMode] : '—'}</div>
            </button>
            )}
            <button onClick={() => setShowRecalibrateMenu(false)} className="w-full p-3 rounded-xl bg-white border border-neutral-200 text-neutral-500 font-bold">
              Cancel
            </button>
          </div>
        </div>
      )}

      {showWeightChange && (
        <div className="fixed inset-0 bg-black/60 z-[2000] flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl space-y-6">
            <h2 className="text-2xl font-bold text-neutral-900 text-center">{pendingWeightForMode ? 'Enter Patient Weight' : 'Change Weight'}</h2>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  setNewPatientType('adult');
                  setNewWeightInput('');
                }}
                className={`p-3 rounded-xl font-bold text-center transition-all duration-200 ${
                  newPatientType === 'adult'
                    ? 'bg-emerald-500 text-white shadow-md'
                    : 'bg-white text-neutral-700 border-2 border-neutral-200 hover:border-emerald-300'
                }`}
              >
                Adult
              </button>
              <button
                onClick={() => {
                  setNewPatientType('paed');
                  if (!newPaedWeightMethod) setNewPaedWeightMethod('age');
                  setNewWeightInput('');
                }}
                className={`p-3 rounded-xl font-bold text-center transition-all duration-200 ${
                  newPatientType === 'paed'
                    ? 'bg-pink-400 text-white shadow-md'
                    : 'bg-white text-neutral-700 border-2 border-neutral-200 hover:border-pink-300'
                }`}
              >
                Paediatric
              </button>
            </div>

            {newPatientType === 'adult' ? (
              <select
                value={newWeightInput}
                onChange={e => setNewWeightInput(e.target.value)}
                className="w-full bg-white border-2 border-emerald-300 rounded-xl px-4 py-4 text-base font-semibold focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              >
                <option value="">Select weight</option>
                <option value="35">35kg</option>
                <option value="40">40kg</option>
                <option value="50">50kg</option>
                <option value="60">60kg</option>
                <option value="70">70kg</option>
                <option value="80">80kg</option>
                <option value="90">90kg</option>
                <option value="100">100kg</option>
                <option value="110">110kg</option>
                <option value="120">120kg</option>
                <option value="130">130kg</option>
                <option value="140">140kg</option>
                <option value="150">150kg</option>
                <option value="160">160kg</option>
                <option value="170">170kg</option>
                <option value="180">180kg</option>
                <option value="190">190kg</option>
                <option value="200">200kg</option>
              </select>
            ) : (
              <div className="bg-pink-50 rounded-2xl p-6 border-2 border-pink-200 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-pink-900 mb-3">Select weight by age</label>
                  <select
                    value={newPaedWeightMethod === 'age' ? newWeightInput : ''}
                    onChange={(e) => {
                      setNewPaedWeightMethod('age');
                      setNewWeightInput(e.target.value);
                      const opt = e.target.options[e.target.selectedIndex];
                      setNewPaedAgeLabel(opt.text.split(' (')[0]);
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
                      <option key={age} value={weight}>{age} ({weight}kg)</option>
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
                      value={newPaedWeightMethod === 'weight' ? newWeightInput : ''}
                      onChange={(e) => {
                        setNewPaedWeightMethod('weight');
                        setNewWeightInput(e.target.value);
                        setNewPaedAgeLabel(null);
                      }}
                      className="w-full bg-white border-2 border-pink-300 rounded-xl px-4 py-4 pr-12 text-base font-semibold focus:ring-2 focus:ring-pink-400 focus:border-pink-400 outline-none transition-all"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 font-bold pointer-events-none">kg</span>
                  </div>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => { setPendingWeightForMode(null); setShowWeightChange(false); }} className="p-3 rounded-xl bg-neutral-100 font-bold text-neutral-700">Cancel</button>
              <button
                onClick={() => {
                  // Mid-tutorial, a weight entered on the way to a mode change isn't saved:
                  // the mode change is stopped here instead
                  if (tutorialMode && pendingWeightForMode) {
                    setPendingWeightForMode(null);
                    setShowWeightChange(false);
                    setShowTutorialModeBlocked(true);
                    return;
                  }
                  const w = parseFloat(newWeightInput);
                  if (!isNaN(w) && w > 0) {
                    // No "changed" entry for a first weight: there was nothing to change from
                    if (state.patientWeight != null && w !== state.patientWeight) {
                      addTreatment(`Weight changed: ${state.patientWeight}kg → ${w}kg`);
                    }
                    setState(prev => ({
                      ...prev,
                      patientWeight: w,
                      patientType: newPatientType,
                      patientAge: (newPatientType === 'paed' && newPaedWeightMethod === 'age' && newPaedAgeLabel) ? newPaedAgeLabel : null,
                    }));
                  }
                  setShowWeightChange(false);
                  if (pendingWeightForMode) {
                    const target = pendingWeightForMode;
                    setPendingWeightForMode(null);
                    beginModeChange(target);
                  }
                }}
                disabled={!newWeightInput}
                className="p-3 rounded-xl bg-emerald-600 text-white font-bold disabled:opacity-40"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {showModeChange && (
        <div className="fixed inset-0 bg-black/60 z-[2000] flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl space-y-4">
            <h2 className="text-2xl font-bold text-neutral-900 text-center">Change Mode</h2>
            <p data-mode-lock-note className="text-sm text-neutral-500 text-center">Arrest – Timers can't be switched to or from a mode with a Tx log partway through a case, so the record stays complete.</p>
            <div className="flex flex-col gap-3">
              {TIMING_MODE_ORDER.map(mode => {
                const blocked = timingMode !== mode && !canChangeMode(timingMode, mode);
                const off = timingMode === mode || blocked;
                return (
                  <button
                    key={mode}
                    data-mode-option={mode}
                    data-mode-blocked={blocked ? 'true' : 'false'}
                    disabled={off}
                    onClick={() => requestModeChange(mode)}
                    className={`w-full p-4 rounded-2xl font-bold flex items-center gap-3 text-left ${off ? 'bg-neutral-100 text-neutral-300 cursor-not-allowed' : 'bg-neutral-100 text-neutral-800 hover:bg-neutral-200'}`}
                  >
                    <span className="w-[72px] h-7 flex-shrink-0 flex items-center justify-center">
                      <ModeIcon mode={mode} size={28} dim={off} />
                    </span>
                    <span>
                      <ModeLabel mode={mode} />
                      {blocked && <span className="block text-xs font-medium text-neutral-400">Can't be changed during a case</span>}
                    </span>
                  </button>
                );
              })}
            </div>
            <button onClick={() => setShowModeChange(false)} className="w-full p-3 rounded-xl bg-white border border-neutral-200 text-neutral-500 font-bold">
              Cancel
            </button>
          </div>
        </div>
      )}

      {showTutorialModeBlocked && (
        <div className="fixed inset-0 bg-black/60 z-[2000] flex items-center justify-center p-6" data-modal="tutorial-mode-blocked">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl space-y-4 text-center">
            <h2 className="text-2xl font-bold text-neutral-900">Change Mode Disabled</h2>
            <p className="text-neutral-600">Changing mode is disabled during the tutorial.</p>
            <p className="text-neutral-600">You can change mode once you've finished the tutorial.</p>
            <button onClick={() => setShowTutorialModeBlocked(false)} className="w-full p-4 rounded-xl bg-emerald-600 text-white font-bold btn-base">OK</button>
          </div>
        </div>
      )}

      {showElapsedRecalibrate && (
        <div className="fixed inset-0 bg-black/80 z-[2000] flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl space-y-6">
            <div className="text-center space-y-1">
              <h2 className="text-2xl font-bold text-neutral-900">Recalibrate Elapsed Time</h2>
              <p className="text-neutral-500 text-sm">{stagedMode && timingMode === 'log' && !state.elapsedCalibrated ? 'Enter the elapsed time shown on the monitor' : 'Adjust elapsed time and rhythm check interval'}</p>
            </div>

            <div>
              <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-3 text-center">Elapsed Time</p>
              <ElapsedTimePicker
                value={{
                  hrs: Math.floor(stagedElapsedSeconds / 3600),
                  mins: Math.floor((stagedElapsedSeconds % 3600) / 60),
                  secs: stagedElapsedSeconds % 60,
                }}
                onChange={(v) => {
                  setElapsedManuallyEdited(true);
                  setStagedElapsedSeconds(v.hrs * 3600 + v.mins * 60 + v.secs);
                }}
              />
            </div>

            <div>
              <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-3 text-center">Rhythm Check Interval</p>
              {recalDelayed && (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3 text-center">
                  A rhythm check is currently delayed. The interval will be reset automatically once it's done.
                </p>
              )}
              {recalPaused && (
                <p className="text-xs text-neutral-600 bg-neutral-100 rounded-xl p-3 mb-3 text-center">
                  The rhythm check is currently paused, and will stay paused.
                </p>
              )}
              <div className={`grid grid-cols-2 gap-2 ${recalDelayed ? 'opacity-40 pointer-events-none' : ''}`} aria-disabled={recalDelayed}>
                {([
                  { key: 'evens',      label: 'Evens',      example: '2:00, 4:00...' },
                  { key: 'odds',       label: 'Odds',       example: '1:00, 3:00...' },
                  { key: 'half-evens', label: 'Half evens', example: '2:30, 4:30...' },
                  { key: 'half-odds',  label: 'Half odds',  example: '1:30, 3:30...' },
                ] as const).map(({ key, label, example }) => (
                  <button
                    key={key}
                    onClick={() => setStagedRhythmInterval(key)}
                    disabled={recalDelayed}
                    className={`p-3 rounded-xl transition-all duration-200 ${
                      stagedRhythmInterval === key
                        ? 'bg-emerald-500 text-white shadow-md'
                        : 'bg-white text-neutral-700 border-2 border-neutral-200 hover:border-emerald-300'
                    }`}
                  >
                    <div className="font-bold text-sm">{label}</div>
                    <div className={`text-xs mt-0.5 ${stagedRhythmInterval === key ? 'text-emerald-100' : 'text-neutral-400'}`}>{example}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  // Discard staged changes entirely - nothing here was ever written to state.
                  setShowElapsedRecalibrate(false);
                  setStagedMode(null);
                }}
                className="bg-neutral-100 p-4 rounded-xl font-bold text-neutral-700 btn-base"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (needsElapsedEntry) return;
                  // Mid-tutorial, a mode change is stopped at its final step and nothing staged is kept
                  if (tutorialMode && stagedMode) {
                    setShowElapsedRecalibrate(false);
                    setStagedMode(null);
                    setShowTutorialModeBlocked(true);
                    return;
                  }
                  // Commit staged changes to real state.
                  // While a rhythm check is delayed the interval can't be changed (it is
                  // reset by itself once that check is done), so the current one is kept
                  const interval = recalDelayed ? (rhythmInterval || 'evens') : stagedRhythmInterval;
                  const newTarget = calcNextIntervalTarget(stagedElapsedSeconds, interval);
                  setRhythmInterval(interval);
                  setState(prev => {
                    const held = prev.rhythmCheckDelayedAt != null;
                    return {
                      ...prev,
                      elapsedCalibrated: true,
                      elapsedSeconds: stagedElapsedSeconds,
                      startTime: Date.now(),
                      pausedTime: stagedElapsedSeconds * 1000,
                      // A delayed check keeps holding the timer, so its schedule is left alone
                      ...(held ? {} : { rhythmCheckTarget: newTarget, rhythmCheckOvertime: 0 }),
                      // A paused countdown stays paused, now frozen at the countdown to the new schedule
                      ...(prev.rhythmCheckPaused && !held ? { frozenCountdown: Math.max(0, newTarget - stagedElapsedSeconds) } : {}),
                    };
                  });
                  setShowElapsedRecalibrate(false);
                  if (stagedMode) {
                    setTimingMode(stagedMode);
                    addTreatment(`Mode changed: ${TIMING_MODE_LABELS[stagedMode]}`);
                    setStagedMode(null);
                  }
                }}
                disabled={needsElapsedEntry}
                className={`p-4 rounded-xl font-bold btn-base ${needsElapsedEntry ? 'bg-neutral-100 text-neutral-300 cursor-not-allowed' : 'bg-emerald-600 text-white'}`}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {showResetWarning && (
        <div className="fixed inset-0 bg-black/80 z-[2000] flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
            <h2 className="text-2xl font-bold text-neutral-900 mb-2">Reset 2-Minute Cycle?</h2>
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

function ElapsedTimePicker({ value, onChange }: { value: { hrs: number, mins: number, secs: number }, onChange: (v: { hrs: number, mins: number, secs: number }) => void }) {
  const adjust = (type: 'hrs' | 'mins' | 'secs', delta: number) => {
    const totalSecs = value.hrs * 3600 + value.mins * 60 + value.secs + (
      type === 'hrs' ? delta * 3600 : type === 'mins' ? delta * 60 : delta
    );
    if (totalSecs < 0) return;
    onChange({
      hrs: Math.floor(totalSecs / 3600),
      mins: Math.floor((totalSecs % 3600) / 60),
      secs: totalSecs % 60,
    });
  };

  const col = (label: string, val: number, type: 'hrs' | 'mins' | 'secs', bigStep?: number) => (
    <div className="flex flex-col items-center">
      <div className="flex gap-1">
        {bigStep && <button onClick={() => adjust(type, bigStep)} className="p-2 bg-neutral-100 rounded-lg text-lg font-bold text-neutral-400 hover:text-neutral-900">▲</button>}
        <button onClick={() => adjust(type, 1)} className="p-2 bg-neutral-100 rounded-lg text-lg font-bold text-neutral-400 hover:text-neutral-900">▲</button>
      </div>
      <div className="text-5xl font-bold text-neutral-900 tabular-nums my-2">{val.toString().padStart(2, '0')}</div>
      <div className="flex gap-1">
        {bigStep && <button onClick={() => adjust(type, -bigStep)} className="p-2 bg-neutral-100 rounded-lg text-lg font-bold text-neutral-400 hover:text-neutral-900">▼</button>}
        <button onClick={() => adjust(type, -1)} className="p-2 bg-neutral-100 rounded-lg text-lg font-bold text-neutral-400 hover:text-neutral-900">▼</button>
      </div>
      <span className="text-neutral-400 font-bold uppercase text-xs mt-2">{label}</span>
    </div>
  );

  const sep = <div className="text-5xl font-bold text-neutral-400 mb-8">:</div>;

  return (
    <div className="flex items-center justify-center gap-3">
      {col('hr', value.hrs, 'hrs')}
      {sep}
      {col('min', value.mins, 'mins')}
      {sep}
      {col('sec', value.secs, 'secs', 10)}
    </div>
  );
}

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

function CounterItem({ label, value, onChange, activeBorderClass }: { label: string, value: number, onChange: (v: number) => void, activeBorderClass?: string }) {
  return (
    <div className={`flex items-center justify-between bg-white p-2.5 rounded-2xl border-2 ${value > 0 ? (activeBorderClass || 'border-neutral-400') : 'border-neutral-200'}`}>
      <span className="text-base font-bold text-neutral-800 ml-2">{label}</span>
      <div className="flex items-center gap-4">
        <button onClick={() => onChange(Math.max(0, value - 1))} className="w-9 h-9 bg-white shadow-sm border border-neutral-200 rounded-xl font-bold text-xl flex items-center justify-center">−</button>
        <span className="text-xl font-bold tabular-nums w-4 text-center">{value}</span>
        <button onClick={() => onChange(value + 1)} className="w-9 h-9 bg-white shadow-sm border border-neutral-200 rounded-xl font-bold text-xl flex items-center justify-center">+</button>
      </div>
    </div>
  );
}

function Overlay({ type, onClose, addTreatment, state, pharmaSummary, isShockForced, onDelayRhythmCheck, tutorialOutcomeRestriction, toggleChecklistItem, onVitalsChange, onDeleteTreatment, onMoveTreatment, onEditTreatment, editingTreatmentIndex, onUpdateInfusionDose, onHandover }: { 
  key?: string,
  type: OverlayType, 
  onClose: () => void, 
  addTreatment: (n: string, options?: { customDose?: boolean; rhythmOutcome?: boolean }) => void,
  state: AppState,
  pharmaSummary: Record<string, { totalDose: number, unit: string, count: number, display: string }>,
  isShockForced: boolean,
  onDelayRhythmCheck?: () => void,
  tutorialOutcomeRestriction?: 'redblue' | 'rosc' | 'delay' | null,
  toggleChecklistItem: (checklist: 'reversibles' | 'rosc' | 'phea', label: string) => void,
  onVitalsChange: (v: AppState['vitals']) => void,
  onDeleteTreatment?: (idx: number) => void,
  onMoveTreatment?: (fromIdx: number, toIdx: number) => void,
  onEditTreatment?: (idx: number) => void,
  editingTreatmentIndex?: number | null,
  onUpdateInfusionDose?: (drug: string, dose: string) => void,
  onHandover?: () => void
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
      <div data-scroll-container="summary" className="flex-1 overflow-y-auto">
        {type === 'reversibles' && <ReversiblesOverlay checkedItems={state.reversiblesChecked} onToggle={(label) => toggleChecklistItem('reversibles', label)} />}
        {type === 'rosc' && <ROSCSelection checkedItems={state.roscChecked} onToggle={(label) => toggleChecklistItem('rosc', label)} patientType={state.patientType} patientWeight={state.patientWeight} />}
        {type === 'phea' && <PHEASelection checkedItems={state.pheaChecked} onToggle={(label) => toggleChecklistItem('phea', label)} />}
        {type === 'vitals' && <VitalsOverlay vitals={state.vitals ?? { hr: '', rr: '', gcs: '', bpSys: '', bpDia: '', spo2: '', etco2: '', bgl: '', temp: '' }} onChange={onVitalsChange} />}
        {type === 'summary' && <SummaryOverlay onHandover={onHandover} state={state} pharmaSummary={pharmaSummary} onDelete={onDeleteTreatment} onMove={onMoveTreatment} onEdit={onEditTreatment} onUpdateInfusionDose={onUpdateInfusionDose} />}
        {type === 'treatment' && (state.timingMode === 'minimal' && editingTreatmentIndex == null ? (
          <TimersOnlySelection state={state} isShockForced={isShockForced} addTreatment={addTreatment} onDelayRhythmCheck={onDelayRhythmCheck} tutorialOutcomeRestriction={tutorialOutcomeRestriction} />
        ) : (
          <>
            {editingTreatmentIndex != null && state.treatments[editingTreatmentIndex] && (
              <div className="bg-emerald-50 text-emerald-800 px-4 py-3 text-center font-bold text-sm border-b border-emerald-100">
                Editing: {state.treatments[editingTreatmentIndex].name}
              </div>
            )}
            {/* isShockForced deliberately not passed through while editing:
                that gate exists to force documenting a live rhythm check
                outcome before anything else, which has nothing to do with
                correcting an existing, already-logged entry. Without this,
                a rhythm check timer hitting 0:00 mid-edit would suddenly
                collapse this menu down to just the shock/disarm buttons. */}
            <TreatmentSelection addTreatment={addTreatment} state={state} isShockForced={editingTreatmentIndex != null ? false : isShockForced} onDelayRhythmCheck={editingTreatmentIndex != null ? undefined : onDelayRhythmCheck} tutorialOutcomeRestriction={editingTreatmentIndex != null ? null : tutorialOutcomeRestriction} />
          </>
        ))}
      </div>
    </motion.div>
  );
}

// Add Tx and the forced rhythm check popup for Timers only. Everything here is
// logged in the background exactly as in the other modes (so it shows in the
// Tx log if the mode is switched, and in the closed case); the only
// difference is what there is to pick from: Shock / Disarm / ROSC for a rhythm
// check (no rhythm or dose is asked for), and the two drugs that have timers.
function TimersOnlySelection({ state, isShockForced, addTreatment, onDelayRhythmCheck, tutorialOutcomeRestriction }: {
  state: AppState;
  isShockForced: boolean;
  addTreatment: (n: string, options?: { customDose?: boolean; rhythmOutcome?: boolean }) => void;
  onDelayRhythmCheck?: () => void;
  // Tutorial only: the one outcome the walkthrough is asking for. The others
  // are slightly greyed and don't respond; the one to press pulses. Here
  // 'redblue' means Shock or Disarm.
  tutorialOutcomeRestriction?: 'redblue' | 'rosc' | 'delay' | null;
}) {
  const redBlueOff = tutorialOutcomeRestriction === 'rosc' || tutorialOutcomeRestriction === 'delay';
  const roscOff = tutorialOutcomeRestriction === 'redblue' || tutorialOutcomeRestriction === 'delay';
  const delayOff = tutorialOutcomeRestriction === 'redblue' || tutorialOutcomeRestriction === 'rosc';
  const dimmed = { opacity: 0.6, filter: 'grayscale(0.5)' } as const;
  const shock = () => addTreatment('Shock', { rhythmOutcome: true });
  const disarm = () => addTreatment('Disarm', { rhythmOutcome: true });
  const rosc = () => addTreatment('ROSC');

  if (isShockForced) {
    return (
      <div className="w-full h-full flex flex-col">
        <div className="bg-[#b91c1c] text-white p-4 text-center font-bold sticky top-0 z-[100] animate-pulse flex-shrink-0">
          RHYTHM CHECK
        </div>
        {/* The outcomes sit in the middle of the space below the header.
            (min-h-full rather than justify-center on the scroller itself, so
            a short screen scrolls from the top instead of clipping it.)
            ROSC is last, with a bigger gap above it, so it isn't hit by
            accident reaching for Shock or Disarm. */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="min-h-full flex flex-col justify-center gap-4 p-6 timers-outcomes">
            <button
              onClick={() => { if (!redBlueOff) shock(); }}
              disabled={redBlueOff}
              style={redBlueOff ? dimmed : undefined}
              className={`w-full py-8 rounded-2xl text-2xl font-bold btn-base timers-outcome bg-red-50 text-red-700 border-2 border-red-100 ${redBlueOff ? 'cursor-not-allowed' : ''}`}
            >
              Shock
            </button>
            <button
              onClick={() => { if (!redBlueOff) disarm(); }}
              disabled={redBlueOff}
              style={redBlueOff ? dimmed : undefined}
              className={`w-full py-8 rounded-2xl text-2xl font-bold btn-base timers-outcome bg-blue-50 text-blue-700 border-2 border-blue-100 ${redBlueOff ? 'cursor-not-allowed' : ''}`}
            >
              Disarm
            </button>
            <button
              onClick={() => { if (!roscOff) rosc(); }}
              disabled={roscOff}
              style={roscOff ? dimmed : undefined}
              className={`w-full py-8 mt-4 rounded-2xl text-2xl font-bold btn-base timers-outcome timers-rosc bg-emerald-50 text-emerald-700 border-2 border-emerald-100 ${roscOff ? 'cursor-not-allowed' : ''}`}
            >
              ROSC
            </button>
          </div>
        </div>
        {onDelayRhythmCheck && (
          <div className="flex-shrink-0 px-6 pb-6">
            <button
              onClick={() => { if (!delayOff) onDelayRhythmCheck(); }}
              disabled={delayOff}
              style={delayOff ? dimmed : undefined}
              className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl border-2 border-amber-300 bg-amber-50 text-amber-800 font-bold text-base btn-base hover:bg-amber-100 ${delayOff ? 'cursor-not-allowed' : ''}`}
            >
              <Hourglass size={20} strokeWidth={2.5} />
              Delay Rhythm Check
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div data-tutorial-anchor="add-tx-submenu" className="w-full h-full overflow-y-auto pb-4">
      <TxSection
        title="Rhythm Check"
        color="pink"
        sectionId="rhythmCheck"
        expandedSection="rhythmCheck"
        onToggle={() => {}}
        showChevron={false}
        items={state.isROSCMode
          ? [{ name: 'Rearrest', color: 'orange' }]
          : [
              { name: 'Shock', color: 'red' },
              { name: 'Disarm', color: 'blue' },
              { name: 'ROSC', color: 'emerald' }
            ]}
        onSelect={(n) => addTreatment(n)}
      />
      <TxSection
        title="Medications"
        color="emerald"
        sectionId="medications"
        expandedSection="medications"
        onToggle={() => {}}
        showChevron={false}
        items={[{ name: 'Adrenaline push', displayName: 'Adrenaline' }, { name: 'Amiodarone' }]}
        onSelect={(n) => addTreatment(n)}
      />
    </div>
  );
}

function VitalsOverlay({ vitals, onChange }: { vitals: AppState['vitals'], onChange: (v: AppState['vitals']) => void }) {
  // Every keystroke is saved straight away. The green tick is not a button: it
  // only confirms that a field has been changed since the VSS tab was opened,
  // and it clears when the tab closes (the values stay).
  const [changed, setChanged] = useState<Set<keyof AppState['vitals']>>(new Set());
  // While the tab slides closed this component can still be mounted, and a quick
  // reopen reuses it - so clear the ticks as soon as the tab starts closing.
  const isPresent = useIsPresent();
  useEffect(() => { if (!isPresent) setChanged(new Set()); }, [isPresent]);

  const update = (key: keyof AppState['vitals'], value: string) => {
    onChange({ ...vitals, [key]: value });
    setChanged(prev => (prev.has(key) ? prev : new Set(prev).add(key)));
  };

  const fields: { key: keyof AppState['vitals'], label: string }[] = [
    { key: 'hr',   label: 'HR'           },
    { key: 'rr',   label: 'RR'           },
    { key: 'spo2', label: 'SpO₂'         },
    { key: 'etco2',label: 'EtCO₂'        },
    { key: 'bpSys',label: 'Systolic BP'  },
    { key: 'bpDia',label: 'Diastolic BP' },
    { key: 'gcs',  label: 'GCS'          },
    { key: 'bgl',  label: 'BGL'          },
    { key: 'temp', label: 'Temp'         },
  ];
  return (
    <div className="h-full overflow-y-auto">
      <div className="p-2.5 px-4 font-bold text-[16px] tracking-wide border-b uppercase sticky top-0 text-center bg-sky-50 text-sky-800 border-sky-200">Vital Signs</div>
      <div className="p-3 space-y-2">
        {fields.map(({ key, label }) => {
          const isChanged = changed.has(key);
          return (
            <div key={key} className="flex items-center justify-between bg-neutral-50 rounded-xl px-4 py-3 border border-neutral-100">
              <span className="text-[15px] font-bold text-neutral-800">{label}</span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  aria-label={label}
                  value={vitals[key]}
                  onChange={e => update(key, e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                  className="w-24 text-right text-[18px] font-bold text-sky-700 bg-transparent border-b-2 border-sky-200 focus:border-sky-500 outline-none py-1 tabular-nums"
                />
                <span
                  data-vss-tick={key}
                  aria-hidden="true"
                  className={`w-5 h-5 flex-shrink-0 rounded-full bg-emerald-500 text-white flex items-center justify-center transition-opacity ml-1 pointer-events-none ${isChanged ? 'opacity-100' : 'opacity-0'}`}
                >
                  <Check size={10} />
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReversiblesOverlay({ checkedItems, onToggle }: { checkedItems: string[], onToggle: (label: string) => void }) {
  return (
    <div className="h-full">
      <SectionGroup title="PREHOSPITAL CORRECTABLE" color="blue" items={['Hypoxia', 'Hypovolaemia', 'Hypothermia', 'Hyperkalaemia', 'Tension pneumothorax', 'Some toxins']} checkedItems={checkedItems} onToggle={onToggle} />
      <SectionGroup title="HOSPITAL ONLY CORRECTABLE" color="blue" items={['Hypokalaemia', 'Hydrogen ion excess', 'Thrombosis coronary/pulmonary', 'Tamponade']} checkedItems={checkedItems} onToggle={onToggle} />
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
      <SectionGroup title="INITIAL TEAM BRIEF" color="purple" items={['Adequate hands and skills mix?', { label: 'Optimise patient position', subItems: ['Consider relocating patient now to optimal location', 'Apply C-spine immobilisation if required', 'If remaining on scene and resources allow, prepare extrication concurrently'] }, { label: 'Assign roles', subItems: ['Team leader', 'Airway primary', 'Airway assistant', 'Drugs & access primary', 'Drugs & access assistant', 'Gofer'] }]} checkedItems={checkedItems} onToggle={onToggle} />
      <SectionGroup title="SCENE OPTIMISATION" color="purple" items={['Optimise environment', 'Optimise equipment placement']} checkedItems={checkedItems} onToggle={onToggle} />
      <SectionGroup title="MONITORING" color="purple" items={['ECG', 'BP — cycling', 'SpO₂', 'EtCO₂']} checkedItems={checkedItems} onToggle={onToggle} />
      <SectionGroup title="DRUGS & ACCESS" color="purple" items={['IV/IO access ×2 if possible', 'IV fluids', 'Ketamine drawn up', 'Suxamethonium drawn up', 'Post PHEA sedation medication(s) drawn up']} checkedItems={checkedItems} onToggle={onToggle} />
      <SectionGroup title="AIRWAY" color="purple" items={['Sufficient oxygen available?', 'Pre-oxygenation applied?', 'Suction', 'OPA/NPA', 'LMA', 'BVM', 'Airtraq', 'ETT', 'Syringe', 'Securing method', 'Laryngoscope checked', 'FONA scalpel', 'External laryngeal manipulation discussed', 'Fallback plan discussed']} checkedItems={checkedItems} onToggle={onToggle} />
      <SectionGroup 
        title="POST-INTUBATION" 
        color="darkPurple" 
        items={[
          { label: 'Confirm ETT placement', subItems: ['EtCO₂', 'Visualise cords', 'Auscultation', 'Misting', 'Chest rise'] },
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
function TreatmentLog({ treatments, elapsedSeconds, caseOpenedAt, isSummary = false, onDelete, onMove, onEdit }: { treatments: Treatment[], elapsedSeconds: number, caseOpenedAt?: number | null, isSummary?: boolean, onDelete?: (index: number) => void, onMove?: (fromIndex: number, toIndex: number) => void, onEdit?: (index: number) => void }) {
  const [pendingDelete, setPendingDelete] = React.useState<number | null>(null);
  const [reorderingRealIdx, setReorderingRealIdx] = React.useState<number | null>(null);
  const [draggingRealIdx, setDraggingRealIdx] = React.useState<number | null>(null);
  // Gap index in VISUAL (top-to-bottom, newest-first) order: 0 = above the
  // topmost row, treatments.length = below the bottommost row.
  const [dragOverGapIdx, setDragOverGapIdx] = React.useState<number | null>(null);
  const rowRefs = React.useRef<Record<number, HTMLDivElement | null>>({});

  // Phone back button: close the delete confirmation, or leave reorder mode (see handleBackRef)
  React.useEffect(() => {
    if (pendingDelete === null && reorderingRealIdx === null) return;
    const onBack = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d.handled) return;
      d.handled = true;
      if (pendingDelete !== null) setPendingDelete(null); else setReorderingRealIdx(null);
    };
    window.addEventListener('bigone:back', onBack);
    return () => window.removeEventListener('bigone:back', onBack);
  }, [pendingDelete, reorderingRealIdx]);

  const handleDragPointerDown = (realIdx: number) => (e: React.PointerEvent) => {
    setDraggingRealIdx(realIdx);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleDragPointerMove = (e: React.PointerEvent) => {
    if (draggingRealIdx === null) return;
    const y = e.clientY;
    const rowsByVisualPosition = (Object.entries(rowRefs.current) as [string, HTMLDivElement | null][])
      .filter((entry): entry is [string, HTMLDivElement] => entry[1] !== null)
      .map(([key, el]) => ({ realIdx: parseInt(key, 10), mid: el.getBoundingClientRect().top + el.getBoundingClientRect().height / 2 }))
      .sort((a, b) => a.mid - b.mid); // ascending Y = visual top-to-bottom = newest-first
    let gapIdx = 0;
    rowsByVisualPosition.forEach(r => { if (y > r.mid) gapIdx++; });
    setDragOverGapIdx(gapIdx);
  };

  const handleDragPointerUp = () => {
    if (draggingRealIdx !== null && dragOverGapIdx !== null) {
      const n = treatments.length;
      // Convert a visual gap index (0=top/newest, n=bottom/oldest) into a real
      // chronological-array index: gapIdx rows are visually above the gap, so
      // (n - gapIdx) real-array items (the oldest ones) sit before it.
      const targetIdxInFullArray = n - dragOverGapIdx;
      const toIdx = targetIdxInFullArray <= draggingRealIdx ? targetIdxInFullArray : targetIdxInFullArray - 1;
      if (toIdx !== draggingRealIdx) {
        onMove?.(draggingRealIdx, toIdx);
        // The item moved to a new array position - follow it, so the checkmark
        // stays attached to the same treatment, not the same slot.
        setReorderingRealIdx(toIdx);
      }
    }
    setDraggingRealIdx(null);
    setDragOverGapIdx(null);
  };

  const splitTreatmentName = (name: string): { med: string, dose: string | null } => {
    // Oxygen: split route onto second line
    if (name.startsWith('Oxygen ')) {
      return { med: 'Oxygen', dose: name.slice(7) };
    }
    // Sodium bicarbonate: abbreviate in Tx log
    if (name.startsWith('Sodium bicarbonate')) {
      const rest = name.slice('Sodium bicarbonate'.length).trim();
      return { med: 'Sodium bic.', dose: rest || null };
    }
    // ROSC, including one saved the old way as 'Disarm - ROSC': shown as ROSC
    if (isRoscName(name)) {
      const roscNum = name.match(/ROSC #(\d+)$/);
      return { med: roscNum ? `ROSC #${roscNum[1]}` : 'ROSC', dose: null };
    }
    // Shock/Disarm: split on first ' - ' (handles both plain 'Shock - VF' and
    // numbered 'Shock #3 - VF' forms)
    if (/^Shock( #\d+)? - /.test(name)) {
      const dashIdx = name.indexOf(' - ');
      return { med: name.slice(0, dashIdx), dose: name.slice(dashIdx + 3) };
    }
    if (/^Disarm( #\d+)? - /.test(name)) {
      const dashIdx = name.indexOf(' - ');
      return { med: name.slice(0, dashIdx), dose: name.slice(dashIdx + 3) };
    }
    // Match known medication names first, then treat remainder as dose
    for (const med of KNOWN_MEDS) {
      if (name.startsWith(med + ' ')) {
        let dose = name.slice(med.length).trim();
        let displayMed = med;
        // Pull a '#N' prefix (from repeat logging) into the med line, not the dose line
        const numMatch = dose.match(/^#(\d+)\s*/);
        if (numMatch) {
          displayMed = `${med} #${numMatch[1]}`;
          dose = dose.slice(numMatch[0].length);
        }
        // For weight-based doses "0.01mg/kg (0.13mg)", show only the calculated value
        const calcMatch = dose.match(/\(([\d.]+(?:mg|mL|mMol|mcg|g))\)/i);
        if (calcMatch) dose = calcMatch[1];
        displayMed = displayMed.replace('Adrenaline', 'Adren.').replace(/infusion/i, 'Infus.');
        return { med: displayMed, dose: dose || null };
      }
    }
    return { med: name, dose: null };
  };

  const showAgo = !isSummary;

  const gridCols = isSummary
    ? 'grid-cols-[1.8fr_1.2fr]'
    : 'grid-cols-[1.9fr_1fr_1.1fr]';

  return (
    <div className="bg-white rounded-b-xl">
      <div className={`grid ${gridCols} gap-1 bg-neutral-100 border-b border-neutral-200 px-4 py-3`}>
        <div className={`text-[11px] font-black text-neutral-800 uppercase tracking-widest text-left ${onDelete ? 'pl-5' : ''}`}>Treatment</div>
        <div className="text-[11px] font-black text-neutral-800 uppercase tracking-widest text-center">Logged at</div>
        {showAgo && <div className="text-[11px] font-black text-neutral-800 uppercase tracking-widest text-right pr-[20px]">Ago</div>}
      </div>

      <div className="divide-y divide-neutral-100">
        {treatments.length === 0 ? (
          <div className="p-12 text-center text-neutral-300 italic">No treatments recorded</div>
        ) : (
          [...treatments].reverse().map((tx, i) => {
            const realIndex = treatments.length - 1 - i;
            const timeVal = isSummary ? tx.clockSeconds : tx.clock;
            const timeDisplay = tx.timeUnknown ? '—' : (tx.prior ? `< ${timeVal}` : timeVal);
            const agoVal = tx.prior
              ? (caseOpenedAt != null ? Math.max(0, Math.floor((Date.now() - caseOpenedAt) / 1000)) : elapsedSeconds)
              : (tx.loggedAt != null ? Math.max(0, Math.floor((Date.now() - tx.loggedAt) / 1000)) : (elapsedSeconds - tx.elapsed));
            const ago = tx.timeUnknown ? '—' : (tx.prior ? `> ${formatTimeHMM(agoVal)}` : formatTimeHMM(agoVal));
            const { med, dose } = splitTreatmentName(tx.name);
            const isReorderingThis = reorderingRealIdx === realIndex;

            return (
              <React.Fragment key={i}>
                {dragOverGapIdx === i && (
                  <div className="h-[3px] bg-blue-500 rounded-full mx-4 -my-[1.5px] relative z-10" />
                )}
                <div
                  ref={(el) => { rowRefs.current[realIndex] = el; }}
                  onPointerDown={isReorderingThis ? handleDragPointerDown(realIndex) : undefined}
                  onPointerMove={isReorderingThis ? handleDragPointerMove : undefined}
                  onPointerUp={isReorderingThis ? handleDragPointerUp : undefined}
                  onPointerCancel={isReorderingThis ? handleDragPointerUp : undefined}
                  style={isReorderingThis ? { touchAction: 'none' } : undefined}
                  data-tx={tx.name.startsWith('Adrenaline push') ? 'adrenaline-push' : undefined}
                  className={`grid ${gridCols} px-4 py-4 items-center gap-1 transition-colors ${
                    isReorderingThis ? 'bg-blue-50 cursor-grab active:cursor-grabbing' : ''
                  }`}
                >
                  <div className="pr-1 flex items-center gap-2">
                    {onDelete && (
                      <button
                        data-tx-more={tx.name.startsWith('Adrenaline push') ? 'adrenaline-push' : undefined}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => {
                          if (isReorderingThis) {
                            setReorderingRealIdx(null);
                          } else {
                            setPendingDelete(realIndex);
                          }
                        }}
                        className={`-ml-1.5 w-4 h-4 flex-shrink-0 flex items-center justify-center rounded-full transition-colors ${
                          isReorderingThis
                            ? 'bg-emerald-500 text-white'
                            : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-400 hover:text-neutral-600'
                        }`}
                      >
                        {isReorderingThis ? <Check size={8} /> : <MoreVertical size={8} />}
                      </button>
                    )}
                    <div>
                      <div className={`text-[15px] font-bold ${isSummary ? '' : 'ml-[2px]'} ${
                        tx.name.toLowerCase().includes('shock') ? 'text-red-600' :
                        tx.name.toLowerCase().includes('disarm') ? 'text-blue-600' :
                        'text-neutral-900'
                      }`}>{med}</div>
                      {dose && <div className="text-[13px] text-neutral-500 font-medium mt-0.5">{dose}</div>}
                    </div>
                  </div>
                  <div className={`text-[16px] text-neutral-800 font-medium tabular-nums text-center ${isSummary ? '' : '-ml-[2px]'}`}>{timeDisplay}</div>
                  {showAgo && <div className="text-[16px] text-neutral-800 font-medium tabular-nums text-right">{ago}</div>}
                </div>
              </React.Fragment>
            );
          })
        )}
        {dragOverGapIdx === treatments.length && (
          <div className="h-[3px] bg-blue-500 rounded-full mx-4 -my-[1.5px] relative z-10" />
        )}
      </div>

      {pendingDelete !== null && (
        <div className="fixed inset-0 bg-black/60 z-[3000] flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl p-6 max-w-xs w-full shadow-2xl space-y-4">
            <div className="text-center space-y-1">
              <p className="font-bold text-neutral-900 text-lg">{treatments[pendingDelete]?.name}</p>
            </div>
            <div className="space-y-2">
              {onEdit && (
                <button onClick={() => { onEdit(pendingDelete); setPendingDelete(null); }} className="w-full py-3 rounded-xl bg-emerald-50 font-bold text-emerald-700">Edit</button>
              )}
              {onMove && (
                <button onClick={() => { setReorderingRealIdx(pendingDelete); setPendingDelete(null); }} className="w-full py-3 rounded-xl bg-blue-50 font-bold text-blue-700">Reorder</button>
              )}
              <button onClick={() => { onDelete?.(pendingDelete); setPendingDelete(null); }} className="w-full py-3 rounded-xl bg-red-50 font-bold text-red-600">Delete</button>
              <button onClick={() => setPendingDelete(null)} className="w-full py-3 rounded-xl bg-neutral-100 font-bold text-neutral-700">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryStats({ state, pharmaSummary }: { state: AppState, pharmaSummary: Record<string, { totalDose: number, unit: string, count: number, display: string }> }) {
  const shockCount = state.treatments.filter(t => t.name.includes('Shock') && !t.name.includes('Disarm')).length;
  const disarmCount = state.treatments.filter(t => t.name.includes('Disarm') && !isRoscName(t.name)).length;
  const roscCount = state.treatments.filter(t => isRoscName(t.name)).length;
  const patientLabel = state.patientType === 'adult'
    ? `Adult · ${state.patientWeight}kg`
    : state.patientType === 'paed'
    ? state.patientAge ? `Paediatric · ${state.patientAge} · ${state.patientWeight}kg` : `Paediatric · ${state.patientWeight}kg`
    : null;

  return (
    <div className="space-y-6">
      {patientLabel && (
        <div className="rounded-xl border border-neutral-100">
          <div className="bg-neutral-50 text-neutral-500 px-4 py-3 font-bold text-xs tracking-wider text-center">PATIENT</div>
          <div className="bg-white px-4 py-3">
            <span className="text-[17px] font-bold text-neutral-900 text-center block">{patientLabel}</span>
          </div>
        </div>
      )}
       <div>
        <div className="bg-emerald-50 text-emerald-800 p-3 rounded-t-lg font-bold text-sm tracking-wider text-center">ARREST SUMMARY</div>
        <div className="bg-white border-x border-b border-neutral-100 rounded-b-lg divide-y divide-neutral-50 shadow-sm">
          <StatRow label="CPR Rounds" value={state.cprRound} />
          <StatRow label="Shocks" value={shockCount} color="text-red-600" />
          <StatRow label="Disarmed" value={disarmCount} color="text-blue-600" />
          <StatRow label="ROSC" value={roscCount} color="text-emerald-600" />
        </div>
      </div>

      <div>
        <div className="bg-emerald-50 text-emerald-800 p-3 rounded-t-lg font-bold text-sm tracking-wider text-center">PHARMA SUMMARY</div>
        <div className="bg-white border-x border-b border-neutral-100 rounded-b-lg divide-y divide-neutral-50 shadow-sm min-h-[60px]">
          {Object.keys(pharmaSummary).length === 0 ? (
            <div className="p-4 text-neutral-300 italic text-sm">No medications recorded</div>
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

function VitalSignsSection({ vitals }: { vitals: AppState['vitals'] }) {
  const v = vitals ?? { hr: '', rr: '', gcs: '', bpSys: '', bpDia: '', spo2: '', etco2: '', bgl: '', temp: '' };
  const vitalRows = [
    { label: 'HR',     value: v.hr,   unit: 'bpm'    },
    { label: 'RR',      value: v.rr,   unit: 'br/min' },
    { label: 'SpO₂',           value: v.spo2, unit: '%'      },
    { label: 'EtCO₂',          value: v.etco2,unit: 'mmHg'   },
    { label: 'BP', value: v.bpSys && v.bpDia ? `${v.bpSys}/${v.bpDia}` : v.bpSys || v.bpDia || '', unit: 'mmHg' },
    { label: 'GCS',            value: v.gcs,  unit: '/ 15'   },
    { label: 'BGL',            value: v.bgl,  unit: 'mmol/L' },
    { label: 'Temp',    value: v.temp, unit: '°C'     },
  ].filter(r => r.value !== '');
  return (
    <div className="rounded-xl border border-neutral-100">
      <div className="bg-sky-50 text-sky-800 px-4 py-3 font-bold text-sm tracking-wider text-center rounded-t-xl">VITAL SIGNS</div>
      <div className="bg-white rounded-b-xl">
      {vitalRows.length > 0 ? vitalRows.map(({ label, value, unit }, i) => (
        <div key={label} className={`flex items-center justify-between px-4 py-3 ${i < vitalRows.length - 1 ? 'border-b border-neutral-100' : ''}`}>
          <span className="text-[14px] font-semibold text-neutral-500">{label}</span>
          <span className="text-[17px] font-bold text-neutral-900 tabular-nums">
            {value} <span className="text-[12px] font-medium text-neutral-400">{unit}</span>
          </span>
        </div>
      )) : (
        <div className="p-4 text-neutral-300 italic text-sm">No vital signs recorded</div>
      )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Handover (IMIST, then AMBO). Two views of the same page: "Fill in" (mostly buttons, done en route)
// and "Read out" (one big card at a time, short fragments, to speak from at handover).
// It reads differently depending on the case: while the patient is still in arrest there is no
// response, breathing or circulation to hand over, so only the airway is shown; in ROSC mode the
// R / A / B / C block is shown. GCS, respiratory rate, HR and BP are the same values as on the VSS
// tab: an existing value shows here and can be changed here, and the VSS tab shows the change.
// Anything not filled in is prompted for (amber) rather than left out.
// ---------------------------------------------------------------------------------------------
const HANDOVER_EMPTY: HandoverFields = {
  unknowns: '', airway: '', airwayIgt: '', accessIv: '', accessIo: '', gcsE: '', gcsV: '', gcsM: '', otherTx: '', otherMeds: '', pertinentEvents: '', weightFor: '', latestRhythm: '', ageUnknown: '', gender: '', genderOther: '', arrestStart: '', startedBefore: '', firstRhythm: '', witnessed: '', bystanderCpr: '', breathing: '',
  suspectedCause: '', allergies: '', allergiesOther: '', medications: '', background: '', otherInfo: ''
};
// The handover differs by case, so the crew chooses which one they're giving. PHEA and Both are still to be built.
const HANDOVER_YNU = ['Yes', 'No', 'Unknown'];
const HANDOVER_GENDERS = ['Male', 'Female', 'Other', 'Unknown'];
// How long before we arrived the arrest started
const HANDOVER_STARTED_BEFORE = ['Under 5 min', '5–10 min', '10–15 min', '15–20 min', 'Over 20 min', 'Unknown'];
const HANDOVER_FIRST_RHYTHMS = ['VF', 'pVT', 'Asystole', 'PEA', 'Unknown'];
// Rhythm checks are 2 minutes apart. Used to count back over the checks that happened before the app started.
const HANDOVER_CHECK_SECONDS = 120;
// The middle of each "how long before we arrived" band, in minutes (Over 20 has no middle, so it only gives a limit)
const HANDOVER_BEFORE_MIDPOINT: Record<string, number> = { 'Under 5 min': 2.5, '5–10 min': 7.5, '10–15 min': 12.5, '15–20 min': 17.5 };
const HANDOVER_BREATHING = ['Breathing', 'Ventilated', 'Unknown'];
// True when the Handover sits inside the home screen box (squished to fit) rather than filling the screen
const HandoverDensity = React.createContext(false);
// The question headings on the Fill in pages: large and centred
// Pressing Enter in a one-line box closes the keyboard
const isEnter = (e: React.KeyboardEvent) => e.key === 'Enter' || e.keyCode === 13;       // (some phone keyboards only report the key code)
const closeKeyboardOnEnter = (e: React.KeyboardEvent<HTMLInputElement>) => { if (isEnter(e)) { e.preventDefault(); e.currentTarget.blur(); } };
// In a list box (one item per line) Enter starts a new item; Enter again on the empty line closes the keyboard
const closeKeyboardOnDoubleEnter = (e: React.KeyboardEvent<HTMLTextAreaElement>, value: string, setValue: (v: string) => void) => {
  if (!isEnter(e)) return;
  const t = e.currentTarget;
  if (t.selectionStart === value.length && (value === '' || value.endsWith('\n'))) { e.preventDefault(); setValue(value.replace(/\n+$/, '')); t.blur(); }
};

// A clock time for the handover, in 12 hour time: "16:45" -> "4:45pm" (a leading "< " from a catch-up entry is kept)
const t12 = (clock: string): string => clock.replace(/(\d{1,2}):(\d{2})(?::\d{2})?/, (_m, hh, mm) => { const h24 = parseInt(hh, 10); return `${h24 % 12 === 0 ? 12 : h24 % 12}:${mm}${h24 >= 12 ? 'pm' : 'am'}`; });

// Every question lives in its own box. A box that hasn't been answered yet has an amber edge and tint; once answered it goes plain.
// (state 'none' = an optional question)
function HandoverBox({ label, state, children, className = '', narrow = false }: { label: string, state: 'missing' | 'done' | 'none', children: React.ReactNode, className?: string, narrow?: boolean }) {
  const compact = React.useContext(HandoverDensity);
  const attr = state === 'missing' ? { 'data-handover-missing': label } : state === 'done' ? { 'data-handover-done': label } : {};
  return (
    <div data-handover-box={label} {...attr}
      className={`relative rounded-xl border-2 ${compact ? 'p-2.5' : 'p-4'} ${state === 'missing' ? 'bg-[#edf2f8] border-[#4a6fa5]' : 'bg-white border-neutral-200'} ${narrow ? '[&_.hh]:!px-0' : ''} ${className}`}>
      {state !== 'none' && (
        <span data-handover-tag={state === 'missing' ? 'todo' : 'done'}
          className={`absolute ${narrow ? 'top-1 right-1.5 text-[10px]' : 'top-2 right-2.5 text-[11px]'} font-bold leading-none ${state === 'missing' ? 'bg-[#4a6fa5] text-white rounded-full px-2 py-[3px]' : 'text-[#4a6fa5] py-[3px]'}`}>
          {state === 'missing' ? 'To do' : '✓ Done'}
        </span>
      )}
      {children}
    </div>
  );
}

const HANDOVER_HEADING = 'hh block text-center px-[60px] text-[17px] font-bold text-neutral-700 uppercase tracking-wide mb-3';
const HANDOVER_HEADING_PLAIN = 'block text-center text-[14px] font-bold text-neutral-700 uppercase tracking-wide mb-1';
const HANDOVER_HEADING_COMPACT = 'hh block text-center px-[52px] text-[14px] font-bold text-neutral-700 uppercase tracking-wide mb-1';
const HANDOVER_RR = ['6', '8', '10', '12', '14', '16', '18', '20', '24'];
const HANDOVER_ALLERGIES = ['Yes', 'No', 'Unknown'];
const HANDOVER_NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
// Airways from least to most advanced: only the most advanced one that worked is listed
const HANDOVER_AIRWAY_LADDER = ['NPA', 'OPA', 'LMA', 'ETT', 'FONA'];
const HANDOVER_OTHER_KNOWN = ['Corpuls', 'Extrication', 'Pacing', 'Reassurance provided', 'Suction', 'IGT', 'IO access', 'IV access', 'Rearrest', 'Close case'];
// Added automatically by the previous-treatments page at setup: not listed under Treatment
const HANDOVER_LEFT_OUT = ['CPR', 'Pads on', 'BVM'];

type VitalKey = keyof AppState['vitals'];
type HandoverSign = { label: string, key: VitalKey, unit: string, value: string };

// "approximately 25 minutes", "approximately 1 hour and 5 minutes": to the nearest minute, never seconds
const approxPhrase = (seconds: number): string => {
  const m = Math.round(seconds / 60);
  if (m < 1) return 'less than a minute';
  if (m < 60) return `approximately ${m} minute${m === 1 ? '' : 's'}`;
  const hr = Math.floor(m / 60), rest = m % 60;
  return `approximately ${hr} hour${hr === 1 ? '' : 's'}${rest ? ` and ${rest} minute${rest === 1 ? '' : 's'}` : ''}`;
};

const rhythmFromName = (name: string): string | null => {
  const m = name.match(/^(?:Shock|Disarm)(?: #\d+)? - (.+)$/);
  return m ? m[1] : null;
};

// '3 months', '2 years', 'Newborn' (a paediatric age picked at setup) -> number and unit for the Age box
const parseAgeLabel = (label: string | null): { value: string, unit: string } | null => {
  if (!label) return null;
  if (/^newborn/i.test(label)) return { value: '0', unit: 'Months' };
  const m = label.match(/^(\d+)\s*(month|year)/i);
  return m ? { value: m[1], unit: /month/i.test(m[2]) ? 'Months' : 'Years' } : null;
};
const ageText = (value: string, unit: string): string => {
  if (!value) return '';
  if (value === '0' && unit === 'Months') return 'Newborn';
  const u = unit === 'Months' ? 'month' : 'year';
  return `${value} ${u}${value === '1' ? '' : 's'}`;
};
const genderText = (h: HandoverFields): string => (h.gender === 'Other' ? (h.genderOther.trim() || 'Other') : h.gender);
const allergyText = (h: HandoverFields): string => (h.allergies === 'Yes' ? (h.allergiesOther.trim() || 'allergies (not specified)') : h.allergies);

type HandoverInfoItem = { t: string, sub?: string[] };
type HandoverArrest = {
  rhythm: { text: string, urgent: boolean } | null;   // the next rhythm check (arrest with timers only)
  durationSeconds: number | null;                     // first rhythm check to now, or to ROSC
  rounds: number;
  shocks: number;
  disarms: number;
  firstRhythm: string;
  others: string[];                                   // rhythms seen apart from the first and the latest
  latest: string;                                     // latest rhythm, or the last one before ROSC
  inRosc: boolean;
  rosc: { clock: string, rearrestSince: boolean } | null;
  roscCount: number;                                  // how many times ROSC was logged in the case
  ownChecks: number;                                  // shocks and disarms we logged (none means the patient may have had ROSC before we arrived)
  episodes: { presenting: string, then: { rhythm: string, n: number }[], endsWithRosc: boolean, rearrest: { laterSeconds: number | null, clock: string } | null }[];   // one per arrest: ROSC ends one and a rearrest begins the next
  askFirstRhythm: boolean;
  askLatestRhythm: boolean;                           // Arrest – Timers also asks the most recent rhythm                            // the crew are asked the first rhythm (shocks or disarms entered at setup, or Arrest – Timers, which doesn't record rhythms)
  priorChecks: boolean;                               // shocks or disarms were entered at setup, so they happened before the app started
  firstState: 'known' | 'unknown' | 'ask' | 'none';   // the first rhythm: from the log, answered by the crew, or still to ask
  startEstimate: { clock: string, kind: 'at' | 'before' } | null;   // best guess of when the arrest happened, to the nearest 5 minutes
};
type HandoverTreatment = {
  airway: string[];                                   // the most advanced airway that worked, then IGT
  io: number;
  iv: number;
  meds: { name: string, dose: string, note: string }[];   // in the order each was first given
  others: { line: string, note: string }[];
};
type HandoverContent = {
  weight: string;
  defaultAge: { value: string, unit: string } | null;
  airway: string;
  rhythm: { text: string, urgent: boolean } | null;
  arrest: HandoverArrest;
  information: HandoverInfoItem[];
  signs: HandoverSign[];
  tx: HandoverTreatment;
  treatment: string[];
};

// "1 minute and 10 seconds" (spoken, not 1:10)
const spokenDuration = (total: number): string => {
  const secsAll = Math.max(0, Math.floor(total));
  const m = Math.floor(secsAll / 60), sec = secsAll % 60;
  const mTxt = `${m} minute${m === 1 ? '' : 's'}`, sTxt = `${sec} second${sec === 1 ? '' : 's'}`;
  return m && sec ? `${mTxt} and ${sTxt}` : m ? mTxt : sTxt;
};

// When the next rhythm check is due, as on the home screen. Only while the patient is in arrest and the
// app is running the rhythm check timer (not Tx log only, not ROSC).
const handoverRhythmStatus = (state: AppState): { text: string, urgent: boolean } | null => {
  if (state.timingMode === 'log' || state.isROSCMode || !state.running) return null;
  if (state.rhythmCheckDelayedAt != null) return { text: 'Our rhythm check is delayed', urgent: true };
  if (state.rhythmCheckPaused) return { text: `Our rhythm check timer is paused with ${spokenDuration(state.frozenCountdown || 0)} to go`, urgent: false };
  const left = state.rhythmCheckTarget - state.elapsedSeconds;
  if (state.rhythmCheckOvertime > 0 || left <= 0) return { text: 'Our rhythm check is due now', urgent: true };
  return { text: `Our next rhythm check is in ${spokenDuration(left)}`, urgent: left <= 30 };
};

const buildHandoverContent = (
  state: AppState,
  pharmaSummary: Record<string, { totalDose: number, unit: string, count: number, display: string }>,
  h: HandoverFields
): HandoverContent => {
  const tx = state.treatments;
  const succeeded = (n: string) => !n.includes('Unsuccessful');
  const isOutcome = (n: string) => {
    const id = getTreatmentIdentity(n);
    return id === 'Shock' || id === 'Disarm' || isRoscName(n) || /^Rhythm check( #\d+)?$/.test(n.trim());
  };

  // --- Airway and oxygen
  const airwayDone = (id: string) => tx.some(x => getTreatmentIdentity(x.name) === id && succeeded(x.name));
  const topAirway = [...HANDOVER_AIRWAY_LADDER].reverse().find(airwayDone);
  const airway = [topAirway, airwayDone('IGT') ? 'IGT' : null].filter((a): a is string => !!a);
  const oxygen = tx.filter(x => getTreatmentIdentity(x.name) === 'Oxygen' && succeeded(x.name));
  const oxygenDevices: string[] = [];
  // BVM is covered by "ventilated", so it isn't named as an oxygen device
  oxygen.forEach(x => { const d = x.name.replace(/^Oxygen\s*(#\d+\s*)?/, '').trim(); if (d && d !== 'BVM' && !oxygenDevices.includes(d)) oxygenDevices.push(d); });

  // --- Arrest summary
  const roscIdx = tx.map((x, i) => (isRoscName(x.name) ? i : -1)).filter(i => i >= 0);
  const lastRoscIdx = roscIdx.length ? roscIdx[roscIdx.length - 1] : -1;
  const lastRosc = lastRoscIdx >= 0 ? tx[lastRoscIdx] : null;
  // Shocks or disarms entered at setup happened before the app started, so the first rhythm check logged isn't the first check
  const priorChecks = tx.some(x => x.prior && (getTreatmentIdentity(x.name) === 'Shock' || getTreatmentIdentity(x.name) === 'Disarm'));
  const firstCheck = tx.find(x => !x.prior && !x.timeUnknown && isOutcome(x.name));
  const endAtRosc = !!(state.isROSCMode && lastRosc && !lastRosc.timeUnknown);
  const endElapsed = endAtRosc ? lastRosc!.elapsed : state.elapsedSeconds;
  // When arrest management ended (now, ROSC, or when the case was closed), as a clock time
  const endMs = (endAtRosc && lastRosc!.loggedAt != null) ? lastRosc!.loggedAt : (state.caseClosedAt ?? Date.now());
  // How long arrest management has run: from the first rhythm check the app logged, plus one 2-minute cycle for each
  // shock or disarm entered at setup (those happened before the app started, so their times aren't known)
  const priorCount = tx.filter(x => x.prior && (getTreatmentIdentity(x.name) === 'Shock' || getTreatmentIdentity(x.name) === 'Disarm')).length;
  let loggedSpan: number | null = null;
  if (firstCheck) {
    if (state.timingMode === 'log') loggedSpan = firstCheck.loggedAt != null ? Math.max(0, Math.floor((endMs - firstCheck.loggedAt) / 1000)) : null;
    else loggedSpan = Math.max(0, Math.floor(endElapsed - firstCheck.elapsed));
  } else if (priorCount > 0) {
    // nothing logged yet: the monitor's elapsed time, or when recording began in Tx log only
    loggedSpan = state.timingMode === 'log'
      ? (state.caseOpenedAt != null ? Math.max(0, Math.floor((endMs - state.caseOpenedAt) / 1000)) : 0)
      : Math.max(0, Math.floor(endElapsed));
  }
  const durationSeconds: number | null = loggedSpan != null ? loggedSpan + priorCount * HANDOVER_CHECK_SECONDS : null;
  const managementStartMs = durationSeconds != null ? endMs - durationSeconds * 1000 : null;
  // Best guess of when the arrest happened: when management began, less the time before we arrived
  const round5 = (ms: number) => Math.round(ms / 300000) * 300000;
  let startEstimate: { clock: string, kind: 'at' | 'before' } | null = null;
  if (managementStartMs != null) {
    if (h.arrestStart === 'During') startEstimate = { clock: getLocalTime(new Date(round5(managementStartMs))), kind: 'at' };
    else if (h.arrestStart === 'Before' && HANDOVER_BEFORE_MIDPOINT[h.startedBefore] != null) startEstimate = { clock: getLocalTime(new Date(round5(managementStartMs - HANDOVER_BEFORE_MIDPOINT[h.startedBefore] * 60000))), kind: 'at' };
    else if (h.arrestStart === 'Before' && h.startedBefore === 'Over 20 min') startEstimate = { clock: getLocalTime(new Date(round5(managementStartMs - 20 * 60000))), kind: 'before' };
  }
  const shockCount = tx.filter(x => x.name.includes('Shock') && !x.name.includes('Disarm')).length;
  const disarmCount = tx.filter(x => x.name.includes('Disarm') && !isRoscName(x.name)).length;
  const withRhythm = tx.filter(x => rhythmFromName(x.name));
  const loggedFirst = withRhythm.length ? rhythmFromName(withRhythm[0].name)! : '';
  const askFirst = priorChecks || (state.timingMode === 'minimal' && tx.some(x => { const id = getTreatmentIdentity(x.name); return id === 'Shock' || id === 'Disarm'; }));
  const firstState: 'known' | 'unknown' | 'ask' | 'none' = askFirst
    ? (!h.firstRhythm ? 'ask' : h.firstRhythm === 'Unknown' ? 'unknown' : 'known')
    : (loggedFirst ? 'known' : 'none');
  const firstRhythm = firstState === 'known' ? (askFirst ? h.firstRhythm : loggedFirst) : '';
  const recentPool = state.isROSCMode && lastRoscIdx >= 0 ? withRhythm.filter(x => tx.indexOf(x) < lastRoscIdx) : withRhythm;
  const askLatest = state.timingMode === 'minimal' && askFirst;
  const recentRhythm = askLatest ? (h.latestRhythm && h.latestRhythm !== 'Unknown' ? h.latestRhythm : '') : (recentPool.length ? rhythmFromName(recentPool[recentPool.length - 1].name)! : '');
  // Rhythms seen apart from the first and the latest (neither is listed twice)
  const others: string[] = [];
  withRhythm.forEach(x => { const r = rhythmFromName(x.name)!; if (r !== firstRhythm && r !== recentRhythm && !others.includes(r)) others.push(r); });
  // One entry per arrest (ROSC ends one, a rearrest begins the next): the presenting rhythm, then the rhythms after it in the order they came.
  // Checks with no rhythm recorded are left out. A first check entered at setup with no rhythm takes the answer to "What was the first rhythm?".
  const episodes: HandoverArrest['episodes'] = [];
  {
    let seq: string[] = [];
    let firstSeen = false;
    let prevRoscAt = -1;
    const closeEpisode = (endsWithRosc: boolean, upTo: number) => {
      const i = episodes.length;
      const presenting = (i === 0 && askFirst) ? (firstState === 'known' ? firstRhythm : '') : (seq[0] || '');
      const rest = presenting && seq.length ? seq.slice(1) : seq;
      const thenCounts: { rhythm: string, n: number }[] = [];
      rest.forEach(r => { const f = thenCounts.find(c => c.rhythm === r); if (f) f.n++; else thenCounts.push({ rhythm: r, n: 1 }); });
      let rearrest: HandoverArrest['episodes'][number]['rearrest'] = null;
      if (i > 0 && prevRoscAt >= 0) {
        const after = tx.slice(prevRoscAt + 1, upTo + 1);
        const ra = after.find(x => x.name.startsWith('Rearrest')) || after.find(x => { const id = getTreatmentIdentity(x.name); return id === 'Shock' || id === 'Disarm'; });
        const prev = tx[prevRoscAt];
        rearrest = {
          laterSeconds: ra && !ra.timeUnknown && !prev.timeUnknown ? Math.max(0, ra.elapsed - prev.elapsed) : null,
          clock: ra && !ra.timeUnknown ? ra.clock : '',
        };
        if (!ra) rearrest = { laterSeconds: null, clock: '' };
      }
      episodes.push({ presenting, then: thenCounts, endsWithRosc, rearrest });
      seq = [];
    };
    tx.forEach((x, idx) => {
      if (isRoscName(x.name)) { closeEpisode(true, idx); prevRoscAt = idx; return; }
      const id = getTreatmentIdentity(x.name);
      if (id !== 'Shock' && id !== 'Disarm') return;
      let r = rhythmFromName(x.name) || '';
      if (!r && !firstSeen && askFirst && firstRhythm) r = firstRhythm;
      firstSeen = true;
      if (r) seq.push(r);
    });
    const rearrestAfterLast = prevRoscAt >= 0 && tx.slice(prevRoscAt + 1).some(x => x.name.startsWith('Rearrest'));
    if (seq.length || !episodes.length || rearrestAfterLast) closeEpisode(false, tx.length - 1);
  }
  const rhythm = handoverRhythmStatus(state);
  const rearrestSince = lastRoscIdx >= 0 && tx.some((x, i) => i > lastRoscIdx && x.name.startsWith('Rearrest'));
  const arrest: HandoverArrest = {
    rhythm, durationSeconds, rounds: state.cprRound, shocks: shockCount, disarms: disarmCount,
    firstRhythm, others, latest: recentRhythm, inRosc: !!state.isROSCMode,
    rosc: lastRosc ? { clock: lastRosc.clock, rearrestSince } : null, roscCount: roscIdx.length, ownChecks: tx.filter(x => { const id = getTreatmentIdentity(x.name); return id === 'Shock' || id === 'Disarm'; }).length, episodes, priorChecks, askFirstRhythm: askFirst, askLatestRhythm: askLatest, firstState, startEstimate,
  };
  const information: HandoverInfoItem[] = [];
  if (rhythm) information.push({ t: rhythm.text });
  if (durationSeconds != null) information.push({ t: `Arrest management for ${approxPhrase(durationSeconds)}` });
  information.push({ t: `${state.cprRound} CPR round${state.cprRound === 1 ? '' : 's'}` });
  information.push({ t: `${shockCount} shock${shockCount === 1 ? '' : 's'}` });
  information.push({ t: `${disarmCount} disarm${disarmCount === 1 ? '' : 's'}` });
  if (firstState === 'known' && firstRhythm) information.push({ t: `First rhythm ${firstRhythm}` });
  if (firstState === 'unknown') information.push({ t: 'First rhythm unknown' });
  if (others.length) information.push({ t: 'Other rhythms', sub: others });
  if (recentRhythm) information.push({ t: `${state.isROSCMode ? 'Last rhythm before ROSC' : 'Latest rhythm'} ${recentRhythm}` });
  if (lastRosc) information.push({ t: `ROSC ${t12(lastRosc.clock)}${rearrestSince ? ', rearrested since' : ''}` });

  // --- Signs not covered by R / A / B / C. SpO₂ only matters once there's a circulation to measure it in.
  const v = state.vitals ?? { hr: '', rr: '', gcs: '', bpSys: '', bpDia: '', spo2: '', etco2: '', bgl: '', temp: '' };
  const signDefs: [string, VitalKey, string][] = state.isROSCMode
    ? [['SpO₂', 'spo2', '%'], ['EtCO₂', 'etco2', 'mmHg'], ['BGL', 'bgl', 'mmol/L'], ['Temp', 'temp', '°C']]
    : [['EtCO₂', 'etco2', 'mmHg'], ['BGL', 'bgl', 'mmol/L'], ['Temp', 'temp', '°C']];
  const signs: HandoverSign[] = signDefs.map(([label, key, unit]) => ({ label, key, unit, value: v[key] ?? '' }));

  // --- Treatment, in the order a receiving team wants it: the airway, then access, then medications (and oxygen)
  // in the order each was first given, then anything else that was done
  const accessCount = (id: string) => tx.filter(x => getTreatmentIdentity(x.name) === id && succeeded(x.name)).length;
  const firstIdx = (match: (n: string) => boolean) => tx.findIndex(x => match(x.name));
  const medList: { idx: number, name: string, dose: string, note: string }[] = [];
  Object.entries(pharmaSummary).forEach(([med, info]) => {
    const dt = doseTimeNote(tx, med);
    const name = med.replace(/ push$/, '');
    let dose: string;
    if (INFUSION_DRUGS.includes(med)) {
      const d = state.infusionDoses?.[med];
      dose = d ? `${d}${med === 'Adrenaline infusion' ? 'mcg' : 'mg'}` : '';
    } else {
      dose = info.display.replace(/\s*\(\d+\)\s*$/, '');
    }
    medList.push({ idx: firstIdx(n => n.startsWith(med)), name, dose, note: dt ? `${dt.label === 'Started' ? 'started' : 'last'} ${t12(dt.time)}` : '' });
  });
  if (oxygen.length) medList.push({ idx: firstIdx(n => getTreatmentIdentity(n) === 'Oxygen' && succeeded(n)), name: 'Oxygen', dose: oxygenDevices.join(', '), note: '' });
  medList.sort((p, q) => p.idx - q.idx);
  // Anything else: Corpuls, Pacing, and anything typed into the log that isn't one of the app's own items
  const otherList: { idx: number, line: string, note: string }[] = [];
  ['Corpuls', 'Pacing'].forEach(n => {
    const i = firstIdx(x => getTreatmentIdentity(x) === n || x.startsWith(n));
    if (i < 0) return;
    const timed = tx.find(x => (getTreatmentIdentity(x.name) === n || x.name.startsWith(n)) && !x.timeUnknown && x.clock);
    otherList.push({ idx: i, line: n, note: timed ? `Started ${timed.prior ? '< ' : ''}${t12(timed.clock)}` : '' });
  });
  tx.forEach((x, i) => {
    const n = x.name;
    const known = isOutcome(n) || n.startsWith('Rhythm check') || n.startsWith('Mode changed') || n.startsWith('Weight changed')
      || MEDICATIONS.some(m => n.startsWith(m)) || KNOWN_MEDS.some(m => n.startsWith(m)) || n.startsWith('Oxygen')
      || HANDOVER_LEFT_OUT.some(a => n === a || n.startsWith(a + ' '))
      || HANDOVER_AIRWAY_LADDER.some(a => n === a || n.startsWith(a + ' ')) || HANDOVER_OTHER_KNOWN.some(a => n === a || n.startsWith(a + ' ') || getTreatmentIdentity(n) === a);
    if (known) return;
    const clean = n.replace(/ #\d+/, '');
    if (!otherList.some(o => o.line === clean)) otherList.push({ idx: i, line: clean, note: '' });
  });
  otherList.sort((p, q) => p.idx - q.idx);
  const txData: HandoverTreatment = {
    airway, io: accessCount('IO access'), iv: accessCount('IV access'),
    meds: medList.map(m => ({ name: m.name, dose: m.dose, note: m.note })), others: otherList.map(o => ({ line: o.line, note: o.note })),
  };
  const treatment: string[] = [];
  if (airway.length) treatment.push(`Airway ${airway.join(', ')}`);
  if (txData.io) treatment.push(`${txData.io} x IO`);
  if (txData.iv) treatment.push(`${txData.iv} x IV`);
  txData.meds.forEach(m => treatment.push(`${m.name}${m.dose ? ` ${m.dose}` : ''}${m.note ? ` (${m.note})` : ''}`));
  txData.others.forEach(o => treatment.push(`${o.line}${o.note ? ` (${o.note.toLowerCase()})` : ''}`));
  if (!treatment.length) treatment.push('None recorded');

  return {
    weight: (state.timingMode === 'minimal' ? (isPaedAge(h.age, h.ageUnit || 'Years') && h.weightFor === `${h.age}|${h.ageUnit || 'Years'}`) : state.patientType === 'paed') && state.patientWeight ? `${state.patientWeight}kg` : '',
    defaultAge: state.patientType === 'paed' ? parseAgeLabel(state.patientAge) : null,
    airway: airway.length ? airway.join(', ') : 'none recorded',
    rhythm,
    arrest,
    information,
    signs,
    tx: txData,
    treatment,
  };
};

function HandoverButton({ onClick, className = '' }: { onClick: () => void, className?: string }) {
  return (
    <button
      onClick={onClick}
      data-button="handover"
      className={`w-full flex items-center justify-center gap-2 bg-[#4a6fa5] text-white py-3 px-4 rounded-xl font-bold btn-base ${className}`}
    >
      <ClipboardList size={20} /> Create handover
    </button>
  );
}

function HandoverSection({ letter, title, children, muted = false, done }: { letter: string, title: string, children: React.ReactNode, muted?: boolean, done?: boolean }) {
  return (
    <div className={`rounded-xl bg-white overflow-hidden ${muted ? 'border-2 border-dashed border-neutral-300' : 'border border-neutral-200'}`}>
      <div className={`relative px-4 py-3 font-bold text-sm tracking-wider text-center uppercase ${muted ? 'bg-neutral-100 text-neutral-500' : 'bg-[#edf2f8] text-[#4a6fa5]'}`}>
        {letter}{letter ? ' – ' : ''}{title}
        {done !== undefined && (
          <span data-handover-tick={done ? 'done' : 'todo'} className={`absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-[13px] ${done ? 'bg-[#4a6fa5] text-white' : 'border-2 border-[#4a6fa5] text-transparent'}`}>✓</span>
        )}
      </div>
      <div className="p-4 space-y-3">{children}</div>
    </div>
  );
}

// A row of buttons to choose from. An unanswered question has an amber dot beside its label.
function HandoverPageCard({ children, muted = false }: { children: React.ReactNode, muted?: boolean }) {
  const compact = React.useContext(HandoverDensity);
  return <div className={`${compact ? 'space-y-2' : 'space-y-3'} ${muted ? 'border-2 border-dashed border-neutral-300 rounded-xl p-3' : ''}`}>{children}</div>;
}

// A big Unknown button, so every question can be answered
function HandoverUnknown({ label, on, onClick }: { label: string, on: boolean, onClick: () => void }) {
  const compact = React.useContext(HandoverDensity);
  return (
    <button data-handover-choice={`${label}: Unknown`} aria-pressed={on} onClick={onClick}
      className={`w-full ${compact ? 'py-2' : 'py-4'} rounded-lg font-bold text-[16px] border btn-base ${on ? 'bg-[#4a6fa5] text-white border-[#4a6fa5]' : 'bg-white text-[#4a6fa5] border-neutral-200'}`}>Unknown</button>
  );
}

function HandoverChoice({ label, options, value, onChange, columns = 3, footer, answered }: { label: string, options: string[], value: string, onChange: (v: string) => void, columns?: 2 | 3 | 5, footer?: React.ReactNode, answered?: boolean }) {
  const compact = React.useContext(HandoverDensity);
  // "Unknown" is never one of the buttons in the row: it's a full-width button underneath, the same place on every page
  const hasUnknown = options.includes('Unknown');
  const main = options.filter(o => o !== 'Unknown');
  const n = hasUnknown ? (main.length <= 3 ? main.length : main.length === 4 ? 2 : 3) : columns;
  const cols = n === 1 ? 'grid-cols-1' : n === 2 ? 'grid-cols-2' : n === 5 ? 'grid-cols-5' : 'grid-cols-3';
  const idle = 'bg-neutral-50 text-neutral-700 border-neutral-200';
  return (
    <HandoverBox label={label} state={(answered ?? !!value) ? 'done' : 'missing'}>
      <span className={compact ? HANDOVER_HEADING_COMPACT : HANDOVER_HEADING}>{label}</span>
      <div className={`grid ${cols} ${compact ? 'gap-2' : 'gap-3'}`}>
        {main.map(c => (
          <button
            key={c}
            data-handover-choice={`${label}: ${c}`}
            aria-pressed={value === c}
            onClick={() => onChange(value === c ? '' : c)}
            className={`${compact ? 'py-2.5 text-[15px]' : 'py-4 text-[16px]'} rounded-lg font-bold border btn-base ${value === c ? 'bg-[#4a6fa5] text-white border-[#4a6fa5]' : idle}`}
          >{c}</button>
        ))}
      </div>
      {hasUnknown && <div className={compact ? 'mt-2' : 'mt-3'}><HandoverUnknown label={label} on={value === 'Unknown'} onClick={() => onChange(value === 'Unknown' ? '' : 'Unknown')} /></div>}
      {footer && <div className={compact ? 'mt-2' : 'mt-3'}>{footer}</div>}
    </HandoverBox>
  );
}

// A number box (number pad on a phone), with an optional Unknown button. Empty ones are amber so they're noticed.
function HandoverNumber({ label, value, onChange, unit, unknownOn, onUnknown, disabled, onBlur, boxed = true, narrow = false }: { label: string, value: string, onChange: (v: string) => void, unit: string, unknownOn?: boolean, onUnknown?: () => void, disabled?: boolean, onBlur?: () => void, boxed?: boolean, narrow?: boolean }) {
  const off = unknownOn || disabled;
  const compact = React.useContext(HandoverDensity);
  // (a plain function, not a component, so the input keeps focus while typing)
  const wrap = (children: React.ReactNode) => boxed ? <HandoverBox label={label} narrow={narrow} state={(value || off) ? 'done' : 'missing'}>{children}</HandoverBox> : <div>{children}</div>;
  return wrap(
    <>
      <label className="block">
        <span className={!boxed ? HANDOVER_HEADING_PLAIN : (compact ? HANDOVER_HEADING_COMPACT : HANDOVER_HEADING)}>{label}</span>
        <div className="relative">
          <input aria-label={label} inputMode="decimal" enterKeyHint="done" onKeyDown={closeKeyboardOnEnter} onKeyUp={closeKeyboardOnEnter} value={value} disabled={off} onBlur={onBlur} onChange={e => onChange(e.target.value.replace(/[^0-9./]/g, '').slice(0, 6))} autoComplete="off" placeholder="—"
            className={`w-full border rounded-lg px-4 ${unit ? 'pr-14' : ''} ${compact ? 'py-2 text-[17px]' : 'py-4 text-[18px]'} text-center text-neutral-900 outline-none focus:border-[#4a6fa5] ${value || off ? 'bg-neutral-50 border-neutral-200' : 'bg-white border-[#4a6fa5]'} ${off ? 'opacity-50' : ''}`} />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-neutral-400 pointer-events-none">{unit}</span>
        </div>
      </label>
      {onUnknown && <div className={compact ? 'mt-2' : 'mt-3'}><HandoverUnknown label={label} on={!!unknownOn} onClick={onUnknown} /></div>}
    </>
  );
}

// The patient's weight: filled in from the case, editable. The case's weight changes when the crew leave the box with a valid number
// (not on every key, so typing 85 doesn't log a change to 8 first). A blank or invalid entry goes back to the case's weight.
const PAED_WEIGHTS: [string, number][] = [['Newborn', 3], ['3 months', 5], ['6 months', 7], ['12 months', 11], ['2 years', 13], ['3 years', 15], ['4 years', 17], ['5 years', 19], ['6 years', 21], ['7 years', 23], ['8 years', 25], ['9 years', 27], ['10 years', 30], ['11 years', 33]];

// In Arrest – Timers the age decides: a child (a number of months, or up to 11 years, the range of the weight list) gets a weight to confirm, an adult gets none
const isPaedAge = (age: string, unit: string): boolean => !!age && (unit === 'Months' || (+age >= 0 && +age <= 11));
const suggestedPaedWeight = (age: string, unit: string): [string, number] => {
  const months = unit === 'Months' ? +age : +age * 12;
  const asMonths = (label: string) => (label === 'Newborn' ? 0 : (parseInt(label, 10) * (label.includes('year') ? 12 : 1)));
  return PAED_WEIGHTS.reduce((best, cur) => (Math.abs(asMonths(cur[0]) - months) < Math.abs(asMonths(best[0]) - months) ? cur : best), PAED_WEIGHTS[0]);
};

// Arrest – Timers: for a child, confirm the weight suggested by their age, or enter a custom one
function HandoverPaedWeight({ ageKey, suggested, weight, confirmedFor, onConfirm, onCustom }: { ageKey: string, suggested: [string, number], weight: number | null | undefined, confirmedFor: string | undefined, onConfirm: () => void, onCustom: (w: number) => void }) {
  const compact = React.useContext(HandoverDensity);
  const confirmed = weight != null && confirmedFor === ageKey;
  const wasCustom = confirmed && weight !== suggested[1];
  const [custom, setCustom] = useState(wasCustom);
  const [customText, setCustomText] = useState(wasCustom ? String(weight) : '');
  useEffect(() => { if (!confirmed) { setCustom(false); setCustomText(''); } }, [ageKey]);
  const sentRef = React.useRef<number | null>(null);          // Enter commits and then blurs: the blur must not commit (and log) it a second time
  const commitCustom = () => { const w = parseFloat(customText); if (!isNaN(w) && w > 0 && w !== sentRef.current && !(confirmed && w === weight)) { sentRef.current = w; onCustom(w); } };
  const tcls = (on: boolean) => `${compact ? 'py-2.5' : 'py-3.5'} rounded-lg font-bold text-[15px] border btn-base ${on ? 'bg-[#4a6fa5] text-white border-[#4a6fa5]' : 'bg-neutral-50 text-neutral-700 border-neutral-200'}`;
  return (
    <HandoverBox label="Weight" state={confirmed ? 'done' : 'missing'}>
      <span className={compact ? HANDOVER_HEADING_COMPACT : HANDOVER_HEADING}>Weight</span>
      <div className={`grid grid-cols-2 ${compact ? 'gap-2' : 'gap-3'}`}>
        <button data-handover-choice="Weight: Confirm" aria-pressed={confirmed && !wasCustom && !custom} onClick={() => { setCustom(false); sentRef.current = null; onConfirm(); }} className={tcls(confirmed && !wasCustom && !custom)}>{suggested[1]}kg ({suggested[0]})</button>
        <button data-handover-choice="Weight: Custom" aria-pressed={custom || wasCustom} onClick={() => { setCustom(true); setCustomText(wasCustom ? String(weight) : ''); }} className={tcls(custom || wasCustom)}>Custom weight</button>
      </div>
      {custom && (
        <div className={`relative ${compact ? 'mt-2' : 'mt-3'}`}>
          <input data-handover-weight-custom type="number" inputMode="decimal" aria-label="Custom weight" placeholder="Custom weight" value={customText} onChange={e => setCustomText(e.target.value)} onBlur={commitCustom} onKeyDown={e => { if (e.key === 'Enter') { commitCustom(); (e.target as HTMLInputElement).blur(); } }}
            className={`w-full bg-white border-2 border-[#4a6fa5] rounded-lg ${compact ? 'px-3 py-2.5' : 'px-3 py-3.5'} text-[16px] font-semibold text-center`} />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 font-bold pointer-events-none">kg</span>
        </div>
      )}
    </HandoverBox>
  );
}

function HandoverOverlay({ state, pharmaSummary, onField, onVital, onWeight, onView, onFinish, onClose, embedded = false, barEl, resumeKey, onPage }: {
  barEl?: HTMLElement | null,
  resumeKey?: string | null,
  onPage?: (k: string) => void,
  embedded?: boolean,
  onFinish?: () => void,
  onView?: (v: 'fill' | 'read') => void,
  onWeight?: (w: number, type: 'adult' | 'paed', ageLabel: string | null) => void,
  state: AppState,
  pharmaSummary: Record<string, { totalDose: number, unit: string, count: number, display: string }>,
  onField: (key: keyof HandoverFields, value: string) => void,
  onVital: (key: VitalKey, value: string) => void,
  onClose: () => void
}) {
  const compact = embedded;
  // Which handover this is is worked out from the case, not chosen: an arrest if the app is running its rhythm check timers (Timers and Tx log),
  // or if anything that only happens in an arrest has been logged (a shock, disarm or other rhythm check, ROSC, or shocks/disarms entered at setup).
  // Anything else (Tx log only with none of those) is not an arrest: its prompts are still to be added.
  const isArrestCase = state.isROSCMode || state.timingMode !== 'log' || state.treatments.some(x => {
    const id = getTreatmentIdentity(x.name);
    return id === 'Shock' || id === 'Disarm' || isRoscName(x.name) || x.name.trim() === NOTHING_LOGGED_NAME || /^Rhythm check( #\d+)?$/.test(x.name.trim());
  });
  const general = !isArrestCase;       // General – Tx log only with nothing that only happens in an arrest logged
  const modeLabel = general ? 'General' : state.isROSCMode ? 'ROSC' : 'Arrest';
  const frame = embedded ? 'absolute inset-0 z-[45]' : 'fixed inset-0 z-[2000]';
  const [view, setView] = useState<'fill' | 'read'>('fill');
  const [card, setCard] = useState(0);
  const [pageKey, setPageKey] = useState<string>(() => resumeKey ?? (Object.values(state.handover ?? {}).some(v => (typeof v === 'string' ? v.trim() !== '' : !!v)) ? 'review' : 'id'));      // a handover that's been started reopens on Review, a new one starts at the first page
  useEffect(() => { onPage?.(pageKey); }, [pageKey]);
  const [rrOtherOpen, setRrOtherOpen] = useState(false);
  useEffect(() => { onView?.(view); return () => onView?.('fill'); }, [view]);
  const h: HandoverFields = { ...HANDOVER_EMPTY, ...(state.handover ?? {}) };
  const content = buildHandoverContent(general ? { ...state, isROSCMode: true } : state, pharmaSummary, h);
  const vit = state.vitals;
  const inRosc = state.isROSCMode || general;       // a General handover asks the same primary survey and vital signs as a ROSC one
  // A paediatric age the app already knows is filled in until it's changed
  const ageValue = state.handover?.age ?? content.defaultAge?.value ?? '';
  const ageUnit = state.handover?.ageUnit || content.defaultAge?.unit || 'Years';
  const age = ageText(ageValue, ageUnit);
  // Things marked Unknown (instead of being left blank). Typing or choosing a value clears Unknown; choosing Unknown clears the value.
  const unkList = (h.unknowns || '').split(',').filter(Boolean);
  const unk = (k: string) => unkList.includes(k);
  const setUnk = (k: string, on: boolean) => onField('unknowns', [...unkList.filter(x => x !== k), ...(on ? [k] : [])].join(','));
  const setVitalValue = (key: VitalKey, flag: string, v: string) => { onVital(key, v); if (unk(flag) && v) setUnk(flag, false); };
  const toggleUnknownVital = (flag: string, keys: VitalKey[]) => { const on = !unk(flag); setUnk(flag, on); if (on) keys.forEach(k => onVital(k, '')); };

  // Fill in is a series of pages. An arrest has them all; anything else is still to be built, so it only has the one page saying so.
  const timersOnly = state.timingMode === 'minimal';       // Arrest – Timers
  const pageKeys: string[] = isArrestCase ? ['id', ...(inRosc ? ['resp', 'breath'] : []), 'what', ...(h.arrestStart === 'Before' ? ['witness'] : []), 'details', ...(content.arrest.askFirstRhythm ? ['info'] : []), 'vitals', 'treatment', ...(timersOnly ? ['othertx'] : []), 'allergies', 'otherinfo', 'review'] : ['id', 'events', 'resp', 'breath', 'vitals', 'treatment', 'allergies', 'otherinfo', 'review'];     // General: what happened first, then GCS and breathing (own pages) just before Vital Signs
  const curKey = pageKeys.includes(pageKey) ? pageKey : pageKeys[0];
  const curIdx = pageKeys.indexOf(curKey);

  // Phone back: in Read out go back a card, then back to Fill in; in Fill in go back a page, and from the first page the
  // Handover closes (handled in App)
  useEffect(() => {
    const onBack = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d.handled) return;
      if (view === 'read') {
        d.handled = true;
        if (card > 0) setCard(card - 1); else setView('fill');
      } else if (curIdx > 0) {
        d.handled = true;
        setPageKey(pageKeys[curIdx - 1]);
      }
    };
    window.addEventListener('bigone:back', onBack);
    return () => window.removeEventListener('bigone:back', onBack);
  }, [view, card, curIdx, pageKeys.join(',')]);

  // A free-text field: white, left-aligned, inset, with a pencil and a placeholder, so it doesn't look like a button
  const textFieldClass = `w-full bg-white border-2 border-neutral-400 shadow-inner rounded-lg pl-4 pr-10 ${compact ? 'py-2.5 text-[16px]' : 'py-4 text-[17px]'} text-left text-neutral-900 outline-none focus:border-[#4a6fa5] placeholder:text-neutral-400 placeholder:italic`;
  const inputClass = `w-full bg-neutral-50 border border-neutral-200 rounded-lg px-4 ${compact ? 'py-2.5 text-[16px]' : 'py-4 text-[17px]'} text-neutral-900 outline-none focus:border-[#4a6fa5]`;
  const labelClass = compact ? HANDOVER_HEADING_COMPACT : HANDOVER_HEADING;
  const smallLabel = 'text-xs font-bold text-neutral-500 uppercase tracking-wide';
  const bullets = (lines: (string | HandoverInfoItem)[]) => (
    <ul className="space-y-1">{lines.map((item, i) => {
      const l = typeof item === 'string' ? { t: item } : item;
      return (
        <li key={i} className="text-[15px] text-neutral-800">
          <div className="flex gap-2"><span>•</span><span>{l.t}</span></div>
          {l.sub && <ul className="ml-6 mt-1 space-y-1">{l.sub.map((x, j) => <li key={j} className="flex gap-2"><span>–</span><span>{x}</span></li>)}</ul>}
        </li>
      );
    })}</ul>
  );
  const text = (key: keyof HandoverFields, label: string, extra?: { rows?: number, words?: boolean, prompt?: boolean, clearUnknown?: string, placeholder?: string, state?: 'missing' | 'done' | 'none', footer?: React.ReactNode }) => (
    <HandoverBox label={label} state={extra?.state ?? (!extra?.prompt ? 'none' : h[key].trim() ? 'done' : 'missing')}>
    <label className="block"><span className={compact ? HANDOVER_HEADING_COMPACT : HANDOVER_HEADING}>{label}</span>
      <div className="relative" data-handover-textfield>
        {extra?.rows
          ? <textarea aria-label={label} placeholder={extra?.placeholder ?? "Type here…"} value={h[key]} onKeyDown={e => closeKeyboardOnDoubleEnter(e, h[key], v => onField(key, v))} onChange={e => { let v = e.target.value; const done = /\n\n$/.test(v); if (done) v = v.replace(/\n+$/, ''); onField(key, v); if (extra.clearUnknown && v && unk(extra.clearUnknown)) setUnk(extra.clearUnknown, false); if (done) e.target.blur(); }} rows={extra.rows} className={textFieldClass} />
          : <input aria-label={label} placeholder="Type here…" enterKeyHint="done" onKeyDown={closeKeyboardOnEnter} onKeyUp={closeKeyboardOnEnter} value={h[key]} onChange={e => onField(key, e.target.value)} autoCapitalize={extra?.words ? 'words' : undefined} autoComplete="off"
              className={`${textFieldClass} ${extra?.prompt && !h[key].trim() ? '!border-[#4a6fa5]' : ''}`} />}
        <Pencil size={16} className={`absolute right-3 text-neutral-400 pointer-events-none ${extra?.rows ? 'top-3' : 'top-1/2 -translate-y-1/2'}`} />
      </div>
    </label>
    {extra?.footer && <div className={compact ? 'mt-2' : 'mt-3'}>{extra.footer}</div>}
    </HandoverBox>
  );

  // R / A / B / C values (the VSS tab's own values)
  // HR, BP and GCS sit with the other vital signs in ROSC and in Tx log only (where there are no R / A / B / C pages to hold them)
  const showCirc = inRosc;
  // Arrest – Timers records no weight, airway, access, other medications or devices: the crew are asked for them (the Tx log can't fill them in)
  const othersDone = !timersOnly || !!h.otherTx.trim() || unk('othertx') || content.tx.others.length > 0;       // Additional treatments
  const medsDone = !timersOnly || !!h.otherMeds.trim() || unk('othermeds');
  // GCS as E / V / M. The total is what's kept in the vital signs (the VSS tab shares it); the parts are kept to read out "GCS 14 (E4, V4, M6)".
  const gcsPartsOk = !!(h.gcsE && h.gcsV && h.gcsM) && (parseInt(h.gcsE, 10) + parseInt(h.gcsV, 10) + parseInt(h.gcsM, 10) === parseInt(vit.gcs, 10));
  const gcsText = vit.gcs ? `GCS ${vit.gcs}${gcsPartsOk ? ` (E${h.gcsE}, V${h.gcsV}, M${h.gcsM})` : ''}` : '';
  const pickGcs = (field: 'gcsE' | 'gcsV' | 'gcsM', v: string) => {
    const next = { gcsE: h.gcsE, gcsV: h.gcsV, gcsM: h.gcsM, [field]: h[field] === v ? '' : v };
    onField(field, next[field]);
    if (next.gcsE && next.gcsV && next.gcsM) setVitalValue('gcs', 'gcs', String(parseInt(next.gcsE, 10) + parseInt(next.gcsV, 10) + parseInt(next.gcsM, 10)));
    else if (unk('gcs')) setUnk('gcs', false);
  };
  const rrIsPreset = HANDOVER_RR.includes(vit.rr);
  const rrChoice = rrOtherOpen ? 'Other' : (rrIsPreset ? vit.rr : (vit.rr ? 'Other' : ''));
  const rrLabel = h.breathing === 'Ventilated' ? 'Ventilation rate' : 'Respiratory rate';

  // Airway and access: the Tx log fills these in; the crew can correct them for the handover (the Tx log itself is never changed).
  const txLog = content.tx;
  const logAirwayDev = txLog.airway.find(a => a !== 'IGT') ?? '';
  const logIgt = txLog.airway.includes('IGT');
  const airwayVal = unk('airway') ? 'Unknown' : (h.airway || logAirwayDev);
  const airwayHasDevice = !!airwayVal && airwayVal !== 'None' && airwayVal !== 'Unknown';
  const igtVal = !airwayHasDevice ? '' : (h.airwayIgt || (logIgt ? 'Yes' : (airwayVal === logAirwayDev ? 'No' : '')));
  const logAccessAny = txLog.io + txLog.iv > 0;
  const ivVal = unk('access') ? '' : (h.accessIv !== '' ? h.accessIv : (logAccessAny ? String(Math.min(txLog.iv, 3)) : ''));
  const ioVal = unk('access') ? '' : (h.accessIo !== '' ? h.accessIo : (logAccessAny ? String(Math.min(txLog.io, 3)) : ''));
  const airwayDone = !!airwayVal && (!airwayHasDevice || !!igtVal);
  const accessDone = unk('access') || (ivVal !== '' && ioVal !== '');

  // What's still to fill in, page by page (the Review page's list, and what stops Next). Unknown counts as an answer.
  const missing: Record<string, string[]> = { id: [], resp: [], breath: [], what: [], witness: [], info: [], vitals: [], treatment: [], othertx: [], events: [], details: [], allergies: [], otherinfo: [] };
  if (!h.gender) missing.id.push('Gender');
  if (!ageValue && h.ageUnknown !== 'Yes') missing.id.push('Age');
  if (timersOnly && h.ageUnknown !== 'Yes' && isPaedAge(ageValue, ageUnit) && !(state.patientWeight && h.weightFor === `${ageValue}|${ageUnit}`)) missing.id.push('Weight');
  if (inRosc) {
    if (!vit.gcs && !unk('gcs')) missing.resp.push('GCS');
    if (!h.breathing) missing.breath.push('Breathing');
    else if (h.breathing !== 'Unknown' && !vit.rr && !unk('rr')) missing.breath.push(rrLabel);
  }
  if (showCirc) {
    if (!vit.hr && !unk('hr')) missing.vitals.push('HR');
    if ((!vit.bpSys || !vit.bpDia) && !unk('bp')) missing.vitals.push('BP');
    if (!inRosc && !vit.gcs && !unk('gcs')) missing.vitals.push('GCS');
  }
  if (timersOnly && !medsDone) missing.othertx.push('Medications given');
  if (timersOnly && !othersDone) missing.othertx.push('Additional treatments');
  if (!h.arrestStart) missing.what.push('When the patient arrested');
  else if (h.arrestStart === 'Before') {
    if (!h.startedBefore) missing.what.push('How long before');
    if (!h.witnessed) missing.witness.push('Witnessed');
    if (!h.bystanderCpr) missing.witness.push('Bystander CPR');
  }
  if (content.arrest.firstState === 'ask') missing.info.push('First rhythm');
  if (content.arrest.askLatestRhythm && !h.latestRhythm) missing.info.push('Latest rhythm');
  if (!h.suspectedCause.trim()) (h.arrestStart === 'Before' ? missing.witness : missing.what).push('Suspected cause');
  content.signs.forEach(s => { if (!s.value && !unk(s.key)) (inRosc && s.key === 'etco2' ? missing.breath : missing.vitals).push(s.label); });
  if (!h.allergies) missing.allergies.push('Allergies');
  else if (h.allergies === 'Yes' && !h.allergiesOther.trim()) missing.allergies.push('What they are allergic to');
  if (!h.background.trim() && !unk('history')) missing.allergies.push('Medical history');
  if (!h.medications.trim() && !unk('meds')) missing.otherinfo.push('Regular medications');
  if (!airwayVal) missing.treatment.push('Airway'); else if (airwayHasDevice && !igtVal) missing.treatment.push('IGT');
  if (!accessDone) missing.treatment.push('Access');
  const pageTitle: Record<string, string> = { other: 'Handover', events: 'Before our arrival', details: 'Before our arrival', treatment: 'Treatment', othertx: 'Medications and Tx', id: 'Identification', resp: 'Response', breath: 'Breathing', what: 'What happened', witness: 'Witnessed and CPR', info: 'Info / Arrest Summary', vitals: 'Vital Signs', allergies: 'Allergies and history', otherinfo: 'Medications and other info', review: 'Review' };
  const pageDone: Record<string, boolean> = { review: false, other: false };
  Object.keys(missing).forEach(k => { pageDone[k] = missing[k].length === 0; });
  // Which Fill in page a Read out card belongs to (the Edit button goes there)
  const pageForCard: Record<string, string> = { I: 'id', E: 'events', RABC: 'resp', M: 'what', I2: content.arrest.askFirstRhythm ? 'info' : 'what', I3: content.arrest.askFirstRhythm ? 'info' : 'what', S: 'vitals', T: 'treatment', AMBO: 'allergies', END: 'review' };

  // --- Read out: one card at a time, written as the words to say. Anything missing is shown amber with a question mark.
  const miss = (t: string) => <span className="text-amber-500" data-handover-missing-frag={t}>{t}</span>;
  // A sentence broken over lines: commas between the lines and a full stop after the last
  const withCommas = (lines: React.ReactNode[]) => lines.map((n, i) => <div key={i}>{n}{i < lines.length - 1 ? ',' : '.'}</div>);
  // The clauses run on as one sentence, with no line break after each comma
  const oneSentence = (parts: React.ReactNode[]) => [<div key="s">{parts.map((n, i) => <React.Fragment key={i}>{n}{i < parts.length - 1 ? ', ' : '.'}</React.Fragment>)}</div>];
  const lcFirst = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);
  const cap = (x: React.ReactNode) => (typeof x === 'string' && x ? x.charAt(0).toUpperCase() + x.slice(1) : x);
  const sub = (items: React.ReactNode[]) => (
    <div className={`mt-2 ml-5 ${compact ? 'space-y-1.5 text-[22px]' : 'space-y-2 text-[28px]'} font-semibold text-neutral-700`}>{items.map((x, i) => <div key={i}>• {cap(x)}</div>)}</div>
  );
  // Medication-style dot points with a smaller line underneath (when it was last given, or started)
  const subWithNote = (items: { text: string, note?: string }[]) => (
    <div className={`mt-2 ml-5 ${compact ? 'space-y-2 text-[22px]' : 'space-y-3 text-[28px]'} font-semibold text-neutral-700`}>
      {items.map((x, i) => <div key={i}>• {cap(x.text)}{x.note && <div className={`ml-4 ${compact ? 'text-[14px]' : 'text-[19px]'} font-medium text-neutral-500`}>{x.note}</div>}</div>)}
    </div>
  );
  const noteWords = (n: string) => (n.startsWith('last ') ? `Last given ${n.slice(5)}` : n.charAt(0).toUpperCase() + n.slice(1));
  const rhythmWords = (r: string) => (r === 'pVT' ? 'pulseless VT' : r);
  // inside a sentence "asystole" has no capital (VF, PEA and pulseless VT are as written)
  const rhythmSentence = (r: string) => (r === 'Asystole' ? 'asystole' : rhythmWords(r));
  const bandWords: Record<string, string> = { 'Under 2 min': 'under 2 minutes', '2–5 min': '2 to 5 minutes', '5–10 min': '5 to 10 minutes', 'Over 10 min': 'over 10 minutes' };
  const lines = (txt: string) => txt.split('\n').map(l => l.trim()).filter(Boolean);

  // "Our patient is a 67 year old male, estimated weight 80kg."
  const anAge = /^(8|11$|18$)/.test(ageValue) ? 'an' : 'a';
  const ageWords = !ageValue ? null : (ageValue === '0' && ageUnit === 'Months') ? 'a newborn' : `${anAge} ${ageValue} ${ageUnit === 'Months' ? 'month' : 'year'} old`;
  const idLines: React.ReactNode[] = [
    h.ageUnknown === 'Yes' && h.gender === 'Unknown' ? "Our patient's age and gender are unknown"
      : h.ageUnknown === 'Yes' ? <>Our patient is {h.gender ? genderText(h).toLowerCase() : miss('Gender ?')}, age unknown</>
      : h.gender === 'Unknown' ? <>Our patient is {ageWords ?? miss('Age ?')}, gender unknown</>
      : <>Our patient is {ageWords ?? miss('Age ?')} {h.gender ? genderText(h).toLowerCase() : miss('Gender ?')}</>,
    ...(content.weight ? [`estimated weight ${content.weight}`] : []),
  ];
  const beforeWords: Record<string, string> = { 'Under 5 min': 'less than 5 minutes', '5–10 min': 'approximately 5 to 10 minutes', '10–15 min': 'approximately 10 to 15 minutes', '15–20 min': 'approximately 15 to 20 minutes', 'Over 20 min': 'more than 20 minutes' };
  const est = content.arrest.startEstimate;
  // "They arrested at approximately 10:20am. It was a witnessed arrest, but they received no CPR between their arrest and our arrival
  // 10 to 15 minutes later. We suspect the cause of arrest was sepsis."
  const bandLater: Record<string, string> = { 'Under 5 min': 'less than 5 minutes', '5–10 min': '5 to 10 minutes', '10–15 min': '10 to 15 minutes', '15–20 min': '15 to 20 minutes', 'Over 20 min': 'more than 20 minutes' };
  const laterText = (roughly: boolean) => { const bt = bandLater[h.startedBefore]; return bt ? ` ${roughly && /^\d/.test(bt) ? 'roughly ' : ''}${bt} later` : ''; };
  const startSentence: React.ReactNode = !h.arrestStart ? miss('When the arrest started ?')
    : h.arrestStart === 'Unknown' ? "We don't know when they arrested."
    : h.arrestStart === 'During' ? (est ? `They arrested at approximately ${t12(est.clock)}, after our arrival.` : 'They arrested after our arrival.')
    : !h.startedBefore ? <>They arrested before our arrival {miss('How long before ?')}</>
    : h.startedBefore === 'Unknown' ? "They arrested before our arrival, we don't know when."
    : h.startedBefore === 'Over 20 min' ? `They arrested more than 20 minutes before our arrival${est ? `, so before approximately ${t12(est.clock)}` : ''}.`
    : est ? `They arrested at approximately ${t12(est.clock)}.`
    : `They arrested ${beforeWords[h.startedBefore]} before our arrival.`;
  const wit = h.witnessed, byc = h.bystanderCpr;
  const witText = wit === 'Yes' ? 'a witnessed' : wit === 'No' ? 'an unwitnessed' : '';
  const bycClause = byc === 'Yes' ? `they received bystander CPR until our arrival${laterText(true)}`
    : byc === 'No' ? `they received no CPR between their arrest and our arrival${laterText(false)}`
    : byc === 'Unknown' ? "we don't know if they received bystander CPR" : '';
  const witnessSentences: React.ReactNode[] = [];
  if ((wit === 'Yes' || wit === 'No') && (byc === 'Yes' || byc === 'No')) {
    // both known: one sentence, "but" when they pull in opposite directions
    const conn = (wit === 'Yes') === (byc === 'Yes') ? ' and' : ', but';
    witnessSentences.push(`It was ${witText} arrest${conn} ${bycClause}.`);
  } else {
    witnessSentences.push(!wit ? miss('Witnessed ?') : wit === 'Unknown' ? "We don't know if it was witnessed." : `It was ${witText} arrest.`);
    witnessSentences.push(!byc ? miss('Bystander CPR ?') : `${bycClause.charAt(0).toUpperCase()}${bycClause.slice(1)}.`);
  }
  const causeSentence: React.ReactNode = !h.suspectedCause.trim() ? miss('Suspected cause ?')
    : h.suspectedCause.trim().toLowerCase() === 'unknown' ? "We don't know the cause of arrest." : `We suspect the cause of arrest was ${h.suspectedCause.trim()}.`;
  const whatNodes: React.ReactNode[] = [startSentence, ...(h.arrestStart !== 'During' && h.arrestStart !== 'Unknown' ? witnessSentences : []), causeSentence, ...lines(h.pertinentEvents).map(l => (/[.!?]$/.test(l) ? l : `${l}.`))].map((n, i) => <div key={i}>{n}</div>);

  const a = content.arrest;
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const arrestNodes: React.ReactNode[] = [];
  // ROSC can happen more than once in a long case: "twice", and "most recently at ..."
  const timesPhrase = (n: number) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`);
  const roscAt = a.rosc && a.rosc.clock ? t12(a.rosc.clock) : '';
  if (a.inRosc && a.ownChecks === 0 && a.roscCount >= 1) arrestNodes.push(<div key="d">{`ROSC was logged${a.roscCount >= 2 ? ` ${timesPhrase(a.roscCount)}, most recently` : ''}${roscAt ? ` at ${roscAt}` : ''}.`}</div>);
  else if (a.inRosc) {
    if (a.durationSeconds != null && a.roscCount >= 2) arrestNodes.push(<div key="d">{`We ran arrest management for ${approxPhrase(a.durationSeconds)}, achieving ROSC ${timesPhrase(a.roscCount)}${roscAt ? `, most recently at ${roscAt}` : ''}.`}</div>);
    else if (a.roscCount >= 2) arrestNodes.push(<div key="d">{`We have achieved ROSC ${timesPhrase(a.roscCount)}${roscAt ? `, most recently at ${roscAt}` : ''}.`}</div>);
    else if (a.durationSeconds != null) arrestNodes.push(<div key="d">{`We ran arrest management for ${approxPhrase(a.durationSeconds)}${a.rosc ? ` until we achieved ROSC at ${t12(a.rosc.clock)}${a.rosc.rearrestSince ? ', rearrested since' : ''}` : ''}.`}</div>);
    else if (a.rosc) arrestNodes.push(<div key="d">{`We achieved ROSC at ${t12(a.rosc.clock)}${a.rosc.rearrestSince ? ', rearrested since' : ''}.`}</div>);
  } else if (a.durationSeconds != null && a.rhythm) arrestNodes.push(<div key="d">{`We have been running arrest management for ${approxPhrase(a.durationSeconds)} and ${lcFirst(a.rhythm.text)}.`}</div>);
  else if (a.durationSeconds != null) arrestNodes.push(<div key="d">{`We have been running arrest management for ${approxPhrase(a.durationSeconds)}.`}</div>);
  else if (a.rhythm) arrestNodes.push(<div key="r">{a.rhythm.text}.</div>);
  // A rearrest after ROSC: the arrest we're handing over is not the first one
  if (!a.inRosc && a.roscCount >= 1) arrestNodes.push(<div key="rr">{`We ${a.roscCount === 1 ? 'achieved' : 'have achieved'} ROSC ${timesPhrase(a.roscCount)}${roscAt ? `, ${a.roscCount === 1 ? 'at' : 'most recently at'} ${roscAt}` : ''}, but they have since rearrested.`}</div>);
  if (!(a.inRosc && a.ownChecks === 0)) arrestNodes.push(<div key="p">They have received:{sub([plural(a.rounds, 'round of CPR', 'rounds of CPR'), plural(a.shocks, 'shock', 'shocks')])}</div>);
  if (a.askLatestRhythm) {
    // Arrest – Timers: both rhythms come from the crew
    const latestW = a.inRosc ? 'last rhythm before ROSC' : 'latest rhythm';
    if (a.firstState === 'ask') arrestNodes.push(<div key="f">{miss('First rhythm ?')}</div>);
    if (!h.latestRhythm) arrestNodes.push(<div key="l">{miss('Latest rhythm ?')}</div>);
    if (a.firstState === 'known' && a.latest && a.latest === a.firstRhythm) arrestNodes.push(<div key="f">Our presenting rhythm and {latestW} were both {rhythmSentence(a.firstRhythm)}.</div>);
    else {
      if (a.firstState === 'unknown') arrestNodes.push(<div key="f">I can't recall the presenting rhythm.</div>);
      if (a.firstState === 'known') arrestNodes.push(<div key="f">The presenting rhythm was {rhythmSentence(a.firstRhythm)}.</div>);
      if (h.latestRhythm === 'Unknown') arrestNodes.push(<div key="l">I can't recall the {latestW}.</div>);
      if (a.latest) arrestNodes.push(<div key="l">Our {latestW} was {rhythmSentence(a.latest)}.</div>);
    }
  } else {
    // The rhythms in the order they came, one block per arrest: "The presenting rhythm was VF. We then had: 1 x VF, 1 x PEA and then ROSC. They rearrested ... into pulseless VT. ..."
    // (with no rhythm recorded at all there's nothing to list: a ROSC alone is already said above)
    const anyRhythm = a.episodes.some(e => e.then.length > 0 || !!e.presenting);
    const useEpisodes = anyRhythm && (a.roscCount >= 1 || a.others.length > 0 || (!!a.latest && a.latest !== a.firstRhythm));
    const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
    if (a.firstState === 'ask') arrestNodes.push(<div key="f">{miss('First rhythm ?')}</div>);
    if (a.firstState === 'unknown') arrestNodes.push(<div key="f">I can't recall the presenting rhythm.</div>);
    if (a.firstState === 'known' && a.firstRhythm) arrestNodes.push(<div key="f">{useEpisodes ? `The presenting rhythm was ${rhythmSentence(a.firstRhythm)}.` : `Rhythm has been ${rhythmSentence(a.firstRhythm)} throughout.`}</div>);
    if (useEpisodes) {
      a.episodes.forEach((e, i) => {
        if (i > 0) {
          const later = e.rearrest && e.rearrest.laterSeconds != null ? (e.rearrest.laterSeconds < 60 ? ' less than a minute later' : ` ${approxPhrase(e.rearrest.laterSeconds)} later`) : '';
          const at = e.rearrest && e.rearrest.clock ? ` at ${t12(e.rearrest.clock)}` : '';
          arrestNodes.push(<div key={`ra${i}`}>{`They rearrested${later}${at}${e.presenting ? ` into ${rhythmSentence(e.presenting)}` : ''}.`}</div>);
        }
        const items = e.then.map((c, k) => `${c.n} x ${cap(rhythmWords(c.rhythm))}${e.endsWithRosc && k === e.then.length - 1 ? ' and then ROSC' : ''}`);
        if (items.length) arrestNodes.push(<div key={`th${i}`}>We then had:{sub(items)}</div>);
        else if (e.endsWithRosc) arrestNodes.push(<div key={`th${i}`}>We then achieved ROSC.</div>);
      });
    }
    // (in ROSC the list already ends "... and then ROSC": when its last rhythm is the last rhythm, saying it again is redundant)
    const lastEp = a.episodes[a.episodes.length - 1];
    const listEndsWith = lastEp && lastEp.endsWithRosc ? (lastEp.then.length ? lastEp.then[lastEp.then.length - 1].rhythm : lastEp.presenting) : '';
    const latestRedundant = useEpisodes && a.inRosc && !!a.latest && a.latest === listEndsWith;
    if (a.latest && !latestRedundant && (useEpisodes || a.firstState !== 'known' || a.latest !== a.firstRhythm)) arrestNodes.push(<div key="l">Our {a.inRosc ? 'last rhythm before ROSC' : 'latest rhythm'} was {rhythmSentence(a.latest)}.</div>);
  }
  // The summary is split over two pages so neither needs scrolling: the counts first, then the rhythms and any notes
  const pAt = arrestNodes.findIndex(n => (n as React.ReactElement)?.key === 'p');
  const splitAt = pAt >= 0 ? pAt + 1 : arrestNodes.length;
  const arrestPage1 = arrestNodes.slice(0, splitAt);
  const arrestPage2 = arrestNodes.slice(splitAt);

  const recorded = content.signs.filter(s => s.value);
  const unknownSigns = content.signs.filter(s => !s.value && unk(s.key));
  const notRecorded = content.signs.filter(s => !s.value && !unk(s.key));
  // HR, BP and GCS come first (ROSC and Tx log only)
  const circLines: { node: React.ReactNode, known: boolean }[] = !showCirc ? [] : [
    vit.hr ? { node: `HR of ${vit.hr}`, known: true } : unk('hr') ? { node: 'HR unknown', known: true } : { node: miss('HR ?'), known: false },
    (vit.bpSys && vit.bpDia) ? { node: `BP of ${vit.bpSys}/${vit.bpDia}`, known: true } : unk('bp') ? { node: 'BP unknown', known: true } : { node: miss('BP ?'), known: false },
    vit.gcs ? { node: gcsText, known: true } : unk('gcs') ? { node: 'GCS unknown', known: true } : { node: miss('GCS ?'), known: false },
  ];
  const vitalsNodes: React.ReactNode[] = [
    <div key="v">{recorded.length || unknownSigns.length || circLines.some(l => l.known) ? 'For vital signs we have recorded:' : 'No vital signs recorded:'}
      {sub([...circLines.map(l => l.node), ...recorded.map(s => `${s.label} of ${s.value}${s.unit === '%' ? '%' : ''}`), ...unknownSigns.map(s => `${s.label} unknown`), ...notRecorded.map(s => <span key={s.label} className="text-amber-500" data-handover-missing-frag={`${s.label} ?`}>{s.label} ?</span>)])}
    </div>,
  ];

  const t = content.tx;
  const airwayName: Record<string, string> = { ETT: 'an ETT tube', LMA: 'an LMA', OPA: 'an OPA', NPA: 'an NPA', FONA: 'a FONA', IGT: 'an IGT' };
  // (the crew's airway and access answers, or what the Tx log says)
  const airwayPhrase = airwayHasDevice ? `${airwayName[airwayVal]}${igtVal === 'Yes' ? ' with an IGT' : ''}` : '';
  const ivN = parseInt(ivVal, 10) || 0, ioN = parseInt(ioVal, 10) || 0;
  const standardTreatmentNodes: React.ReactNode[] = [
    <div key="a">{airwayVal === 'Unknown' ? "We don't know what airway is in place." : airwayPhrase ? `For airway we have ${airwayPhrase}.` : airwayVal === 'None' ? 'Airway is not yet secured.' : miss('Airway ?')}</div>,
    unk('access') ? <div key="x">We don't know what access is in place.</div>
      : !accessDone ? <div key="x">{miss('Access ?')}</div>
      : ioN || ivN ? <div key="x">For access we have:{sub([...(ioN ? [`${ioN} x IO${ioN > 1 ? 's' : ''}`] : []), ...(ivN ? [`${ivN} x IV${ivN > 1 ? 's' : ''}`] : [])])}</div> : <div key="x">We do not have IV or IO access.</div>,
    t.meds.length ? <div key="m">For medications we have given:{subWithNote(t.meds.map(m => ({ text: `${m.name}${m.dose ? ` ${m.dose}` : ''}`, note: m.note ? noteWords(m.note) : '' })))}</div> : <div key="m">No medications given.</div>,
    ...(t.others.length ? [<div key="o">We have also used:{subWithNote(t.others.map(o => ({ text: o.line, note: o.note })))}</div>] : []),
  ];

  // Arrest – Timers: the log has only the adrenaline and amiodarone timers' taps (no doses). The crew confirm airway and access
  // and tell us what else was given or done; it never says "no medications given", because nothing else is recorded.
  const timerTaps = (prefix: string) => state.treatments.filter(x => x.name.startsWith(prefix) && !x.name.includes('Unsuccessful'));
  const lastTap = (list: typeof state.treatments) => { const x = [...list].reverse().find(y => !y.timeUnknown && y.clock); return x ? `last ${t12(x.clock)}` : ''; };
  const adrTaps = timerTaps('Adrenaline'), amioTaps = timerTaps('Amiodarone');
  const timerMeds = [
    ...(adrTaps.length ? [{ text: `Adrenaline x${adrTaps.length}`, note: lastTap(adrTaps) ? noteWords(lastTap(adrTaps)) : '' }] : []),
    ...(amioTaps.length ? [{ text: `Amiodarone x${amioTaps.length}`, note: lastTap(amioTaps) ? noteWords(lastTap(amioTaps)) : '' }] : []),
  ];
  const medItems = [...timerMeds, ...lines(h.otherMeds).map(x => ({ text: x, note: '' }))];
  const otherItems = [...t.others.map(o => ({ text: o.line, note: o.note })), ...lines(h.otherTx).map(x => ({ text: x, note: '' }))];
  const timersTreatmentNodes: React.ReactNode[] = [
    standardTreatmentNodes[0], standardTreatmentNodes[1],
    medItems.length ? <div key="m">For medications we have given:{subWithNote(medItems)}</div>
      : unk('othermeds') ? <div key="m">We have not given any medications.</div> : <div key="m">{miss('Medications ?')}</div>,
    otherItems.length ? <div key="o">For additional treatments we have:{subWithNote(otherItems)}</div>
      : unk('othertx') ? <div key="o">We have not done any additional treatments.</div> : <div key="o">{miss('Additional treatments ?')}</div>,
  ];
  const treatmentNodes = timersOnly ? timersTreatmentNodes : standardTreatmentNodes;

  // The primary survey (ROSC), as sentences: "For our primary survey we have GCS 6, airway is an ETT tube, we are ventilating at a rate of 10,
  // for circulation we have a heart rate of 112 and a blood pressure of 128/76."
  const ampm = (t: string) => <span className="text-amber-500" data-handover-missing-frag={t}>{t}</span>;
  const gcsPart: React.ReactNode = vit.gcs ? gcsText : unk('gcs') ? 'GCS unknown' : ampm('GCS ?');
  const airwayPart: React.ReactNode = airwayVal === 'Unknown' ? 'Airway is unknown' : airwayPhrase ? `Airway is ${airwayPhrase}` : airwayVal === 'None' ? 'Airway is not yet secured' : <>Airway is {ampm('Airway ?')}</>;
  const rateOf = (kind: 'breath' | 'vent') => (vit.rr ? ` at a rate of ${vit.rr}` : unk('rr') ? ', rate unknown' : null);
  const breathPart: React.ReactNode = !h.breathing ? ampm('Breathing ?')
    : h.breathing === 'Unknown' ? "We don't know if they are breathing"
    : <>{h.breathing === 'Breathing' ? 'They are spontaneously ventilating' : 'We are ventilating'}{rateOf('breath') ?? <> at a rate of {ampm('rate ?')}</>}</>;
  const hrKnown = !!vit.hr, bpKnown = !!(vit.bpSys && vit.bpDia);
  const hrText = `a heart rate of ${vit.hr}`, bpText = `a blood pressure of ${vit.bpSys}/${vit.bpDia}`;
  const circPart: React.ReactNode =
    (hrKnown && bpKnown) ? `For circulation we have ${hrText} and ${bpText}`
    : (hrKnown && unk('bp')) ? `For circulation we have ${hrText}, blood pressure unknown`
    : (bpKnown && unk('hr')) ? `For circulation we have ${bpText}, heart rate unknown`
    : (unk('hr') && unk('bp')) ? "For circulation we don't know the heart rate or blood pressure"
    : <>For circulation we have a heart rate of {hrKnown ? vit.hr : unk('hr') ? 'unknown' : ampm('HR ?')} and a blood pressure of {bpKnown ? `${vit.bpSys}/${vit.bpDia}` : unk('bp') ? 'unknown' : ampm('BP ?')}</>;
  const roscBlock: React.ReactNode[] = [<>For our primary survey{general ? ' now' : ''} we have {gcsPart}</>, airwayPart, breathPart, circPart].map((n, i) => <div key={i}>{n}.</div>);
  // Allergies, medical history and medications read as one sentence, e.g. "They have no known allergies, we don't know
  // their medical history or medications." What isn't known because it wasn't filled in is amber, as a prompt.
  const joinList = (xs: string[], word: string) => (xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} ${word} ${xs[xs.length - 1]}`);
  const capFirst = (x: string) => (x ? x.charAt(0).toUpperCase() + x.slice(1) : x);
  const knownClauses: string[] = [];
  const unknownItems: string[] = [];
  let blankUnknown = false;
  if (h.allergies === 'No' || h.allergies === 'NKA') knownClauses.push('they have no known allergies');
  else if (h.allergies === 'Yes') knownClauses.push(h.allergiesOther.trim() ? `they are allergic to ${h.allergiesOther.trim()}` : 'they have allergies (not specified)');
  else if (h.allergies === 'Unknown') unknownItems.push('allergies');
  if (h.background.trim()) {
    const hx = lines(h.background);
    knownClauses.push(hx.length === 1 ? `the only medical history we know of is ${hx[0]}` : `their medical history includes ${joinList(hx, 'and')}`);
  }
  else { unknownItems.push('medical history'); if (!unk('history')) blankUnknown = true; }
  if (h.medications.trim()) knownClauses.push(`they take ${joinList(lines(h.medications), 'and')}`);
  else { unknownItems.push('medications'); if (!unk('meds')) blankUnknown = true; }
  const knownStr = knownClauses.join(', ');
  const unknownStr = unknownItems.length ? `we don't know their ${joinList(unknownItems, 'or')}` : '';
  const leadStr = knownStr ? capFirst(knownStr) : '';
  const tailStr = knownStr ? unknownStr : capFirst(unknownStr);
  const ambo: React.ReactNode[] = [
    ...(!h.allergies ? [<div key="a"><span className="text-amber-500" data-handover-missing-frag="Allergies ?">Allergies ?</span></div>] : []),
    <div key="s">{leadStr}{leadStr && tailStr ? ', ' : ''}{tailStr && (blankUnknown ? <span className="text-amber-500" data-handover-missing-frag={tailStr}>{tailStr}</span> : tailStr)}.</div>,
    ...(h.otherInfo.trim() ? [<div key="o">Other information: {lines(h.otherInfo).join(', ')}</div>] : []),
  ];
  const arrestCards: { key: string, title: string, muted?: boolean, body: React.ReactNode }[] = [
    { key: 'I', title: 'I – Identification', body: oneSentence(idLines) },
    ...(inRosc ? [{ key: 'RABC', title: 'R / A / B / C', body: roscBlock }] : []),
    { key: 'M', title: 'M – What happened', body: whatNodes },
    { key: 'I2', title: 'I – Info / Arrest Summary', body: arrestPage1 },
    ...(arrestPage2.length ? [{ key: 'I3', title: 'I – Info / Arrest Summary', body: arrestPage2 }] : []),
    { key: 'S', title: 'S – Vital Signs', body: vitalsNodes },
    { key: 'T', title: 'T – Treatment', body: treatmentNodes },
    { key: 'AMBO', title: 'AMBO', body: ambo },
    { key: 'END', title: 'Finish', body: <div className={`text-center ${compact ? 'text-[34px] pt-10' : 'text-[44px] pt-20'}`}>Any questions?</div> },
  ];

  // General: Identification, what happened before we arrived (when there's something to say), then the primary survey, vital signs, treatment and AMBO
  const eventLines = lines(h.pertinentEvents);
  const cards = general
    ? [arrestCards.find(c => c.key === 'I')!, arrestCards.find(c => c.key === 'RABC')!, ...(eventLines.length ? [{ key: 'E', title: 'M – Before our arrival', body: eventLines.map((l, i) => <div key={i}>{/[.!?]$/.test(l) ? l : `${l}.`}</div>) }] : []), ...arrestCards.filter(c => ['S', 'T', 'AMBO', 'END'].includes(c.key))]
    : arrestCards;

  if (view === 'read') {
    const c = cards[card];
    const last = card === cards.length - 1;
    return (
      <HandoverDensity.Provider value={compact}>
      <div data-handover data-handover-view="read" className={`${frame} bg-neutral-100 flex flex-col`}>
        <div className={`flex-shrink-0 ${compact ? 'h-12 px-2.5' : 'h-16 px-4'} grid grid-cols-[1fr_auto_1fr] items-center font-bold tracking-wide ${c.muted ? 'bg-neutral-500 text-white' : 'bg-[#4a6fa5] text-white'}`}>
          <button onClick={() => { const k = pageForCard[c.key] ?? 'review'; setPageKey(pageKeys.includes(k) ? k : 'review'); setView('fill'); }} data-button="handover-edit" className="justify-self-start px-3 py-1 rounded-lg bg-white/20 text-sm">Edit</button>
          <span className="text-center leading-tight"><span data-handover-title>{c.title}</span></span>
          <span className="justify-self-end text-sm opacity-80 tabular-nums">{card + 1}/{cards.length}</span>
        </div>
        <div data-handover-card={c.key} className={`flex-1 overflow-y-auto ${compact ? 'p-4 space-y-3 text-[22px]' : 'p-6 space-y-5 text-[28px]'} leading-tight font-bold ${c.muted ? 'text-neutral-500' : 'text-neutral-900'}`}>
          {c.body}
        </div>
        {(() => {
          const btn = embedded ? 'p-3 sm:p-5 rounded-2xl text-base sm:text-xl' : `${compact ? 'p-3' : 'p-4'} rounded-xl`;
          const prevB = <button onClick={() => (card > 0 ? setCard(card - 1) : setView('fill'))} data-button="handover-prev" className={`bg-neutral-200 ${btn} font-bold text-neutral-700 btn-base`}>Back</button>;
          const nextB = <button onClick={() => (last ? (onFinish ? onFinish() : onClose()) : setCard(card + 1))} data-button="handover-next" className={`bg-[#4a6fa5] ${btn} font-bold text-white btn-base`}>{last ? 'Done' : 'Next'}</button>;
          return embedded
            ? (barEl ? createPortal(<>{prevB}{nextB}</>, barEl) : null)
            : <div className={`flex-shrink-0 grid grid-cols-2 gap-3 ${compact ? 'p-2.5' : 'p-4'} bg-neutral-100 border-t border-neutral-200`}>{prevB}{nextB}</div>;
        })()}
      </div>
      </HandoverDensity.Provider>
    );
  }

  // --- Fill in: one page at a time. A page has to be completed (an answer, or Unknown) before Next works.
  const pageIncomplete = (k: string) => (k === 'other' ? true : k === 'review' ? false : (missing[k]?.length ?? 0) > 0);
  const firstIncomplete = pageKeys.findIndex(pageIncomplete);          // -1 when every page is complete
  const reachable = (k: string, i: number) => firstIncomplete === -1 || i <= firstIncomplete || k === curKey;
  const canNext = !pageIncomplete(curKey);
  const goNext = () => { if (canNext && curIdx < pageKeys.length - 1) setPageKey(pageKeys[curIdx + 1]); };
  const goBack = () => { if (curIdx > 0) setPageKey(pageKeys[curIdx - 1]); };
  // The suspected cause of arrest: on the Witnessed and CPR page when there is one (the patient had arrested before we arrived), otherwise on What happened
  const causeBox = text('suspectedCause', 'Suspected cause of arrest?', { prompt: true, footer: (
            <button data-handover-choice="Suspected cause: Unknown" aria-pressed={h.suspectedCause.trim().toLowerCase() === 'unknown'}
              onClick={() => onField('suspectedCause', h.suspectedCause.trim().toLowerCase() === 'unknown' ? '' : 'Unknown')}
              className={`w-full ${compact ? 'py-2.5' : 'py-4'} rounded-lg font-bold text-[16px] border btn-base ${h.suspectedCause.trim().toLowerCase() === 'unknown' ? 'bg-[#4a6fa5] text-white border-[#4a6fa5]' : 'bg-white text-[#4a6fa5] border-neutral-200'}`}>Unknown</button>) });

  // In a ROSC or General handover EtCO₂ is asked at the bottom of the Breathing page (so Vital Signs fits); it is still read out with the vital signs
  const vsSigns = inRosc ? content.signs.filter(sg => sg.key !== 'etco2') : content.signs;

  const gcsBox = (
    <HandoverBox label="GCS" state={(vit.gcs || unk('gcs')) ? 'done' : 'missing'} className="col-span-2">
      <span className={compact ? HANDOVER_HEADING_COMPACT : HANDOVER_HEADING}>GCS</span>
      {/* the scale runs down the page, highest at the top, like a GCS chart */}
      <div className="grid grid-cols-3 gap-2">
        {([['E', 'Eye', 'gcsE', 4], ['V', 'Verbal', 'gcsV', 5], ['M', 'Motor', 'gcsM', 6]] as const).map(([k, name, field, n]) => (
          <div key={k} data-handover-gcs-column={k} className="flex flex-col gap-1.5">
            <span className="text-center text-sm font-bold text-neutral-700">{name}</span>
            {Array.from({ length: n }, (_, j) => String(n - j)).map(o => (
              <button key={o} data-handover-choice={`GCS ${k}: ${o}`} aria-pressed={h[field] === o} onClick={() => pickGcs(field, o)}
                className={`${compact ? 'py-1.5' : 'py-2.5'} rounded-lg font-bold text-[15px] border btn-base ${h[field] === o ? 'bg-[#4a6fa5] text-white border-[#4a6fa5]' : 'bg-neutral-50 text-neutral-700 border-neutral-200'}`}>{o}</button>
            ))}
          </div>
        ))}
      </div>
      <div data-handover-gcs-total className="text-center text-sm font-semibold text-neutral-600 mt-2">{unk('gcs') ? 'GCS unknown' : gcsText || 'Choose E, V and M'}</div>
      <div className={compact ? 'mt-2' : 'mt-3'}><HandoverUnknown label="GCS" on={unk('gcs')} onClick={() => { toggleUnknownVital('gcs', ['gcs']); onField('gcsE', ''); onField('gcsV', ''); onField('gcsM', ''); }} /></div>
    </HandoverBox>
  );

  const pageBody = (): React.ReactNode => {
    switch (curKey) {
      case 'other': return (
        <div className="space-y-6">
          <div data-handover-empty className={`rounded-xl ${compact ? 'p-4' : 'p-6'} text-center font-semibold bg-white border border-neutral-200 text-neutral-500`}>
            The handover prompts for a job that isn't a cardiac arrest are still to be added.
          </div>
          <div className={`rounded-xl ${compact ? 'p-4' : 'p-6'} text-center text-[15px] text-neutral-500`}>
            If this is an arrest, log a rhythm check (or ROSC) and the arrest handover appears here.
          </div>
        </div>
      );
      case 'details': return (
        <HandoverPageCard>
          {text('pertinentEvents', 'Pertinent events before our arrival', { rows: 5, state: 'none', placeholder: 'e.g. Collapsed at a shopping centre\nBystander CPR and one AED shock, ROSC before we arrived' })}
        </HandoverPageCard>
      );
      case 'events': return (
        <HandoverPageCard>
          {text('pertinentEvents', 'Pertinent events before our arrival', { rows: 5, state: 'none', placeholder: 'e.g. Collapsed at a shopping centre\nBystander CPR and one AED shock, ROSC before we arrived' })}
        </HandoverPageCard>
      );
      case 'id': return (
        <HandoverPageCard>
          <HandoverChoice label="Gender" options={HANDOVER_GENDERS} value={h.gender} onChange={v => onField('gender', v)} columns={2} />
          {h.gender === 'Other' && text('genderOther', 'Gender (other)', { words: true })}
          <HandoverBox label="Age" state={(ageValue || h.ageUnknown === 'Yes') ? 'done' : 'missing'}>
            <span className={labelClass}>Age</span>
            <select aria-label="Age" data-handover-age-select value={h.ageUnknown === 'Yes' || !ageValue ? '' : `${ageValue}|${ageUnit}`}
              onChange={e => { const [n, u] = e.target.value.split('|'); if (!n) return; onField('age', n); onField('ageUnit', u); if (h.ageUnknown) onField('ageUnknown', ''); }}
              className={`w-full bg-white border ${ageValue || h.ageUnknown === 'Yes' ? 'border-neutral-300' : 'border-[#4a6fa5]'} rounded-lg px-3 ${compact ? 'py-2.5' : 'py-3.5'} text-[16px] font-semibold text-neutral-800`}>
              <option value="">Select age</option>
              <option value="0|Months">Newborn</option>
              {Array.from({ length: 23 }, (_, i) => i + 1).map(n => <option key={`m${n}`} value={`${n}|Months`}>{n} {n === 1 ? 'month' : 'months'}</option>)}
              {Array.from({ length: 110 }, (_, i) => i + 1).map(n => <option key={`y${n}`} value={`${n}|Years`}>{n} {n === 1 ? 'year' : 'years'}</option>)}
              {ageValue && !((ageUnit === 'Months' && +ageValue <= 23) || (ageUnit === 'Years' && +ageValue >= 1 && +ageValue <= 110)) && <option value={`${ageValue}|${ageUnit}`}>{ageValue} {ageUnit.toLowerCase()}</option>}
            </select>
            <div className="mt-3">
              <button data-handover-choice="Age: Unknown" aria-pressed={h.ageUnknown === 'Yes'}
                onClick={() => { if (h.ageUnknown === 'Yes') onField('ageUnknown', ''); else { onField('ageUnknown', 'Yes'); onField('age', ''); } }}
                className={`w-full ${compact ? 'py-2.5' : 'py-4'} rounded-lg font-bold text-[16px] border btn-base ${h.ageUnknown === 'Yes' ? 'bg-[#4a6fa5] text-white border-[#4a6fa5]' : 'bg-white text-[#4a6fa5] border-neutral-200'}`}>Unknown</button>
            </div>
          </HandoverBox>
          {timersOnly && onWeight && h.ageUnknown !== 'Yes' && isPaedAge(ageValue, ageUnit) && (() => {
            const sg = suggestedPaedWeight(ageValue, ageUnit); const key = `${ageValue}|${ageUnit}`;
            return <HandoverPaedWeight ageKey={key} suggested={sg} weight={state.patientWeight} confirmedFor={h.weightFor} onConfirm={() => { onField('weightFor', key); onWeight(sg[1], 'paed', sg[0]); }} onCustom={w => { onField('weightFor', key); onWeight(w, 'paed', null); }} />;
          })()}
        </HandoverPageCard>
      );
      case 'resp': return (
        <HandoverPageCard>
          {gcsBox}
        </HandoverPageCard>
      );
      case 'breath': return (
        <HandoverPageCard>
          <HandoverChoice label="Breathing?" options={HANDOVER_BREATHING} value={h.breathing} onChange={v => onField('breathing', v)} columns={3} />
          {(h.breathing === 'Breathing' || h.breathing === 'Ventilated') && (
            <>
              <HandoverChoice label={rrLabel} options={[...HANDOVER_RR, 'Other']} value={unk('rr') ? '' : rrChoice} columns={5} answered={!!rrChoice || unk('rr')}
                onChange={v => { if (v === 'Other') { setRrOtherOpen(true); if (unk('rr')) setUnk('rr', false); } else { setRrOtherOpen(false); setVitalValue('rr', 'rr', v); } }}
                footer={<HandoverUnknown label={rrLabel} on={unk('rr')} onClick={() => { setRrOtherOpen(false); toggleUnknownVital('rr', ['rr']); }} />} />
              {rrChoice === 'Other' && !unk('rr') && <HandoverNumber label="Rate (other)" value={vit.rr} onChange={v => setVitalValue('rr', 'rr', v)} unit="/min" />}
            </>
          )}
          <div className={`grid grid-cols-2 ${compact ? 'gap-2' : 'gap-3'}`}>
            {content.signs.filter(sg => sg.key === 'etco2').map(sg => <React.Fragment key={sg.key}><HandoverNumber narrow label={sg.label} value={sg.value} onChange={v => setVitalValue(sg.key, sg.key, v)} unit={sg.unit} unknownOn={unk(sg.key)} onUnknown={() => toggleUnknownVital(sg.key, [sg.key])} /></React.Fragment>)}
          </div>
        </HandoverPageCard>
      );
      case 'what': return (
        <HandoverPageCard>
          <HandoverChoice label="When did the patient arrest?" options={['Before we arrived', 'During the case', 'Unknown']} columns={3}
            value={h.arrestStart === 'Before' ? 'Before we arrived' : h.arrestStart === 'During' ? 'During the case' : h.arrestStart === 'Unknown' ? 'Unknown' : ''}
            onChange={v => { onField('arrestStart', v === 'Before we arrived' ? 'Before' : v === 'During the case' ? 'During' : v === 'Unknown' ? 'Unknown' : ''); if (v !== 'Before we arrived') onField('startedBefore', ''); }} />
          {h.arrestStart === 'Before' && <HandoverChoice label="How long before we arrived?" options={HANDOVER_STARTED_BEFORE} value={h.startedBefore} onChange={v => onField('startedBefore', v)} columns={3} />}
          {content.arrest.startEstimate && (
            <div data-handover-estimate className="text-[15px] font-semibold text-neutral-700 bg-neutral-100 rounded-lg px-4 py-1.5 text-center">
              Estimated time of arrest: {content.arrest.startEstimate.kind === 'before' ? 'before ' : ''}{t12(content.arrest.startEstimate.clock)}
            </div>
          )}
          {(h.arrestStart === 'During' || h.arrestStart === 'Unknown') && causeBox}
        </HandoverPageCard>
      );
      case 'witness': return (
        <HandoverPageCard>
          <HandoverChoice label="Witnessed?" options={HANDOVER_YNU} value={h.witnessed} onChange={v => onField('witnessed', v)} />
          <HandoverChoice label="Bystander CPR?" options={HANDOVER_YNU} value={h.bystanderCpr} onChange={v => onField('bystanderCpr', v)} />
          {causeBox}
        </HandoverPageCard>
      );
      case 'info': return (
        <HandoverPageCard>
          {content.arrest.askFirstRhythm && <HandoverChoice label="What was the first rhythm?" options={HANDOVER_FIRST_RHYTHMS} value={h.firstRhythm} onChange={v => onField('firstRhythm', v)} />}
          {content.arrest.askLatestRhythm && <HandoverChoice label={inRosc ? 'What was the last rhythm before ROSC?' : 'What was the most recent rhythm?'} options={HANDOVER_FIRST_RHYTHMS} value={h.latestRhythm} onChange={v => onField('latestRhythm', v)} />}
        </HandoverPageCard>
      );
      case 'vitals': return (
        <HandoverPageCard>
          <div className={`grid grid-cols-2 ${compact ? 'gap-2' : 'gap-3'}`}>
            {showCirc && <HandoverNumber narrow label="HR" value={vit.hr} onChange={v => setVitalValue('hr', 'hr', v)} unit="bpm" unknownOn={unk('hr')} onUnknown={() => toggleUnknownVital('hr', ['hr'])} />}
            {vsSigns.slice(0, 1).map(sg => <React.Fragment key={sg.key}><HandoverNumber narrow label={sg.label} value={sg.value} onChange={v => setVitalValue(sg.key, sg.key, v)} unit={sg.unit} unknownOn={unk(sg.key)} onUnknown={() => toggleUnknownVital(sg.key, [sg.key])} /></React.Fragment>)}
            {showCirc && (
              <HandoverBox label="BP" state={((vit.bpSys && vit.bpDia) || unk('bp')) ? 'done' : 'missing'} className="col-span-2">
                <span className={compact ? HANDOVER_HEADING_COMPACT : HANDOVER_HEADING}>BP</span>
                <div className="grid grid-cols-2 gap-3">
                  <HandoverNumber boxed={false} label="Systolic" value={vit.bpSys} onChange={v => { onVital('bpSys', v); if (unk('bp') && v) setUnk('bp', false); }} unit="mmHg" disabled={unk('bp')} />
                  <HandoverNumber boxed={false} label="Diastolic" value={vit.bpDia} onChange={v => { onVital('bpDia', v); if (unk('bp') && v) setUnk('bp', false); }} unit="mmHg" disabled={unk('bp')} />
                </div>
                <div className={compact ? 'mt-2' : 'mt-3'}><HandoverUnknown label="BP" on={unk('bp')} onClick={() => toggleUnknownVital('bp', ['bpSys', 'bpDia'])} /></div>
              </HandoverBox>
            )}
            {showCirc && !inRosc && gcsBox}
            {vsSigns.slice(1).map(sg => <React.Fragment key={sg.key}><HandoverNumber narrow label={sg.label} value={sg.value} onChange={v => setVitalValue(sg.key, sg.key, v)} unit={sg.unit} unknownOn={unk(sg.key)} onUnknown={() => toggleUnknownVital(sg.key, [sg.key])} /></React.Fragment>)}
          </div>
        </HandoverPageCard>
      );
      case 'treatment': {
        const pick = (cur: string, field: 'airway' | 'airwayIgt' | 'accessIv' | 'accessIo', v: string, group: 'airway' | 'access') => {
          if (unk(group)) setUnk(group, false);
          onField(field, (cur === v && h[field] === v) ? '' : v);          // tapping the chosen one again goes back to what the Tx log says
        };
        const bcls = (on: boolean) => `${compact ? 'py-1.5 text-[15px]' : 'py-4 text-[16px]'} rounded-lg font-bold border btn-base ${on ? 'bg-[#4a6fa5] text-white border-[#4a6fa5]' : 'bg-neutral-50 text-neutral-700 border-neutral-200'}`;
        const head = compact ? HANDOVER_HEADING_COMPACT : HANDOVER_HEADING;
        const sub2 = `${compact ? 'mt-2' : 'mt-3'} ${HANDOVER_HEADING_PLAIN}`;
        const COUNTS = ['0', '1', '2', '3'];
        return (
          <HandoverPageCard>
            <HandoverBox label="Airway" state={airwayVal ? 'done' : 'missing'}>
              <span className={head}>Confirm airway</span>
              <div className={`grid grid-cols-3 ${compact ? 'gap-2' : 'gap-3'}`}>
                {['ETT', 'LMA', 'FONA', 'OPA', 'NPA', 'None'].map(o => (
                  <button key={o} data-handover-choice={`Airway: ${o}`} aria-pressed={airwayVal === o} onClick={() => { if (airwayHasDevice && o === 'None') onField('airwayIgt', ''); pick(airwayVal, 'airway', o, 'airway'); }} className={bcls(airwayVal === o)}>{o}</button>
                ))}
              </div>
              <div className={compact ? 'mt-2' : 'mt-3'}><HandoverUnknown label="Airway" on={airwayVal === 'Unknown'} onClick={() => { const on = !unk('airway'); setUnk('airway', on); if (on) { onField('airway', ''); onField('airwayIgt', ''); } }} /></div>
            </HandoverBox>
            {airwayHasDevice && (
              <HandoverBox label="IGT?" state={igtVal ? 'done' : 'missing'}>
                <span className={head}>IGT?</span>
                <div className={`grid grid-cols-2 ${compact ? 'gap-2' : 'gap-3'}`}>
                  {['Yes', 'No'].map(o => <button key={o} data-handover-choice={`IGT?: ${o}`} aria-pressed={igtVal === o} onClick={() => pick(igtVal, 'airwayIgt', o, 'airway')} className={bcls(igtVal === o)}>{o}</button>)}
                </div>
              </HandoverBox>
            )}
            <HandoverBox label="Access" state={accessDone ? 'done' : 'missing'}>
              <span className={head}>Confirm access points</span>
              {([['IV', ivVal, 'accessIv'], ['IO', ioVal, 'accessIo']] as const).map(([lab, val, field], i) => (
                <div key={lab} className={i ? (compact ? 'mt-2' : 'mt-3') : ''}>
                  <span className={`${HANDOVER_HEADING_PLAIN} !mb-1`}>{lab}</span>
                  <div className={`grid grid-cols-4 ${compact ? 'gap-2' : 'gap-3'}`}>
                    {COUNTS.map(o => <button key={o} data-handover-choice={`${lab}: ${o}`} aria-pressed={val === o} onClick={() => pick(val, field, o, 'access')} className={bcls(val === o)}>{o}</button>)}
                  </div>
                </div>
              ))}
              <div className={compact ? 'mt-2' : 'mt-3'}><HandoverUnknown label="Access" on={unk('access')} onClick={() => { const on = !unk('access'); setUnk('access', on); if (on) { onField('accessIv', ''); onField('accessIo', ''); } }} /></div>
            </HandoverBox>
          </HandoverPageCard>
        );
      }
      case 'othertx': return (
        <HandoverPageCard>
          {text('otherMeds', 'Medications given', { rows: 3, clearUnknown: 'othermeds', placeholder: 'Other than adrenaline and amiodarone', state: medsDone ? 'done' : 'missing', footer: (
            <button data-handover-choice="Medications given: None" aria-pressed={unk('othermeds')} onClick={() => { const on = !unk('othermeds'); setUnk('othermeds', on); if (on) onField('otherMeds', ''); }}
              className={`w-full ${compact ? 'py-2' : 'py-4'} rounded-lg font-bold text-[16px] border btn-base ${unk('othermeds') ? 'bg-[#4a6fa5] text-white border-[#4a6fa5]' : 'bg-white text-[#4a6fa5] border-neutral-200'}`}>None</button>) })}
          {text('otherTx', 'Additional treatments', { rows: 3, clearUnknown: 'othertx', placeholder: 'e.g. Pacing, stroke team notified...', state: othersDone ? 'done' : 'missing', footer: (
            <>
              {txLog.others.length > 0 && <p className="text-sm text-neutral-500 text-center mb-2">Already logged: {txLog.others.map(o => o.line).join(', ')}</p>}
              <button data-handover-choice="Additional treatments: None" aria-pressed={unk('othertx')} onClick={() => { const on = !unk('othertx'); setUnk('othertx', on); if (on) onField('otherTx', ''); }}
                className={`w-full ${compact ? 'py-2' : 'py-4'} rounded-lg font-bold text-[16px] border btn-base ${unk('othertx') ? 'bg-[#4a6fa5] text-white border-[#4a6fa5]' : 'bg-white text-[#4a6fa5] border-neutral-200'}`}>None</button>
            </>) })}
        </HandoverPageCard>
      );
      case 'allergies': return (
        <HandoverPageCard>
          <HandoverChoice label="Allergies?" options={HANDOVER_ALLERGIES} value={h.allergies} onChange={v => onField('allergies', v)} />
          {h.allergies === 'Yes' && text('allergiesOther', 'What are they allergic to?', { state: h.allergiesOther.trim() ? 'done' : 'missing' })}
          {text('background', 'Medical history', { rows: 2, clearUnknown: 'history', state: (h.background.trim() || unk('history')) ? 'done' : 'missing',
            footer: <HandoverUnknown label="Medical history" on={unk('history')} onClick={() => { const on = !unk('history'); setUnk('history', on); if (on) onField('background', ''); }} /> })}
        </HandoverPageCard>
      );
      case 'otherinfo': return (
        <HandoverPageCard>
          {text('medications', 'Regular medications', { rows: 2, clearUnknown: 'meds', state: (h.medications.trim() || unk('meds')) ? 'done' : 'missing',
            footer: <HandoverUnknown label="Regular medications" on={unk('meds')} onClick={() => { const on = !unk('meds'); setUnk('meds', on); if (on) onField('medications', ''); }} /> })}
          {text('otherInfo', 'Other information (optional)', { rows: 4, state: 'none' })}
        </HandoverPageCard>
      );
      default: {
        const toDo = pageKeys.filter(k => k !== 'review' && (missing[k]?.length ?? 0) > 0);
        return (
          <div className="space-y-4">
            {toDo.length ? (
              <HandoverSection letter="" title="Still to fill">
                <div className="space-y-3">
                  {toDo.map(k => (
                    <button key={k} data-handover-jump={k} onClick={() => setPageKey(k)}
                      className="w-full text-left rounded-lg border-2 border-[#4a6fa5] bg-[#edf2f8] px-4 py-4 btn-base">
                      <span className="block text-[13px] font-bold text-[#4a6fa5] uppercase tracking-wide">{pageTitle[k]}</span>
                      <span className="block text-[16px] font-semibold text-neutral-800">{missing[k].join(', ')}</span>
                    </button>
                  ))}
                </div>
              </HandoverSection>
            ) : (
              <div data-handover-allfilled className="space-y-4 pt-2">
                <button data-button="handover-edit-all" onClick={() => setPageKey('id')}
                  className={`w-full ${compact ? 'py-6' : 'py-8'} rounded-2xl text-[20px] font-bold border-2 border-[#4a6fa5] text-[#4a6fa5] bg-white btn-base flex items-center justify-center gap-3`}><Pencil size={22} strokeWidth={2.25} /> Edit handover</button>
                <button data-button="handover-deliver" onClick={() => { setCard(0); setView('read'); }}
                  className={`w-full ${compact ? 'py-6' : 'py-8'} rounded-2xl text-[20px] font-bold bg-[#4a6fa5] text-white btn-base flex items-center justify-center gap-3`}><MessageSquareText size={22} strokeWidth={2.25} /> Deliver handover</button>
              </div>
            )}
          </div>
        );
      }
    }
  };
  return (
    <HandoverDensity.Provider value={compact}>
    <div data-handover data-handover-view="fill" className={`${frame} bg-neutral-100 flex flex-col`}>
      <div data-handover-bar-top className={`bg-[#4a6fa5] text-white ${compact ? 'h-12 px-2.5' : 'h-16 px-4'} grid grid-cols-[1fr_auto_1fr] items-center font-bold tracking-wide flex-shrink-0`}>
        {embedded
          ? <span data-handover-mode className="justify-self-start px-3 py-1 rounded-lg bg-white/20 text-sm">{modeLabel}</span>
          : <button onClick={onClose} data-button="handover-close" className="justify-self-start px-3 py-1 rounded-lg bg-white/20 text-sm">Close</button>}
        <span className="text-center leading-tight">
          <span className="block" data-handover-page-title>{pageTitle[curKey]}</span>
        </span>
        {pageKeys.length < 2 ? <span /> : <span className="justify-self-end text-sm opacity-80 tabular-nums" data-handover-progress>{curIdx + 1} of {pageKeys.length}</span>}
      </div>
      <div data-handover-dots data-handover-page-current={curKey} className="flex-shrink-0 flex items-center justify-center bg-neutral-100">
        {pageKeys.length > 1 && pageKeys.map((k, i) => (
          <button key={k} data-handover-page-dot={k} data-handover-page-done={pageDone[k] ? 'done' : 'todo'} aria-label={pageTitle[k]} aria-current={k === curKey}
            disabled={!reachable(k, i)} onClick={() => setPageKey(k)} className={`${compact ? 'p-1' : 'p-1.5'} ${reachable(k, i) ? '' : 'opacity-40'}`}>
            <span className={`block h-3 rounded-full ${k === curKey ? 'w-6 bg-[#4a6fa5]' : pageDone[k] ? 'w-3 bg-[#4a6fa5]' : k === 'review' ? 'w-3 bg-neutral-300' : 'w-3 bg-[#c5d3e6]'}`} />
          </button>
        ))}
      </div>
      <div className={`flex-1 overflow-y-auto ${compact ? 'p-2 space-y-2' : 'p-4 space-y-4'}`}>{pageBody()}</div>
      {(() => {
        const btn = embedded ? 'p-3 sm:p-5 rounded-2xl text-base sm:text-xl' : `${compact ? 'p-3' : 'p-4'} rounded-xl`;
        const backB = <button onClick={curIdx === 0 ? onClose : goBack} disabled={embedded && curIdx === 0} data-button="handover-back" className={`${btn} font-bold btn-base ${embedded && curIdx === 0 ? 'bg-neutral-100 text-neutral-300' : 'bg-neutral-200 text-neutral-700'}`}>{!embedded && curIdx === 0 ? 'Close' : 'Back'}</button>;
        const nextB = curKey === 'review'
          ? <button onClick={() => { setCard(0); setView('read'); }} data-button="handover-readout" className={`${btn} font-bold btn-base bg-[#4a6fa5] text-white`}>Read out</button>
          : <button onClick={goNext} disabled={!canNext} data-button="handover-next-page" className={`${btn} font-bold btn-base ${canNext ? 'bg-[#4a6fa5] text-white' : 'bg-neutral-200 text-neutral-400'}`}>Next</button>;
        return embedded
          ? (barEl ? createPortal(<>{backB}{nextB}</>, barEl) : null)
          : <div className={`flex-shrink-0 grid grid-cols-2 gap-3 ${compact ? 'p-2.5' : 'p-4'} bg-neutral-100 border-t border-neutral-200`}>{backB}{nextB}</div>;
      })()}
    </div>
    </HandoverDensity.Provider>
  );
}

function ArrestSummarySection({ state, showRecordingDuration, showFinalDuration, alwaysShowArrestSummary }: { state: AppState, showRecordingDuration?: boolean, showFinalDuration?: boolean, alwaysShowArrestSummary?: boolean }) {
  const shockCount = state.treatments.filter(t => t.name.includes('Shock') && !t.name.includes('Disarm')).length;
  const disarmCount = state.treatments.filter(t => t.name.includes('Disarm') && !isRoscName(t.name)).length;
  const roscCount = state.treatments.filter(t => isRoscName(t.name)).length;
  const isPaedWithAge = state.patientType === 'paed' && !!state.patientAge;
  const patientTypeLabel = state.patientType === 'adult' ? 'Adult' : state.patientType === 'paed' ? 'Paediatric' : null;
  // Single-line label for adult, or paediatric with a custom (non-age-based) weight
  const patientOneLineLabel = state.patientType === 'adult'
    ? `Adult · ${state.patientWeight}kg`
    : state.patientType === 'paed' && !isPaedWithAge
    ? `Paediatric · ${state.patientWeight}kg`
    : null;
  // Two-line detail (age · weight) only for paediatric estimated by age
  const patientDetailLabel = isPaedWithAge ? `${state.patientAge} · ${state.patientWeight}kg` : null;
  return (
    <div className="space-y-6">
      {(patientTypeLabel || showRecordingDuration) && (
        <div className="rounded-xl border border-neutral-100">
          <div className="bg-neutral-50 text-neutral-500 px-4 py-3 font-bold text-sm tracking-wider text-center rounded-t-xl">CASE DETAILS</div>
          <div className="bg-white px-4 py-3 flex items-start justify-between gap-3 rounded-b-xl">
          {patientTypeLabel && (
            <div>
              <div className="text-[11px] font-medium text-neutral-400 uppercase tracking-wide mb-1">Patient settings</div>
              {isPaedWithAge ? (
                <>
                  <div className="text-[15px] font-bold text-neutral-900">{patientTypeLabel}</div>
                  <div className="text-[15px] font-bold text-neutral-900">{patientDetailLabel}</div>
                </>
              ) : (
                <div className="text-[15px] font-bold text-neutral-900">{patientOneLineLabel}</div>
              )}
            </div>
          )}
          {showRecordingDuration && (
            <div className={patientTypeLabel ? 'text-right' : 'text-left'}>
              <div className="text-[11px] font-medium text-neutral-400 uppercase tracking-wide mb-1">
                {showFinalDuration && state.timingMode !== 'log' ? 'Case duration' : 'App recording for'}
              </div>
              <div className="text-[15px] font-bold text-neutral-800 tabular-nums">
                {showFinalDuration
                  ? (state.timingMode === 'log'
                      ? (state.caseOpenedAt ? formatDurationHM(Math.floor(((state.caseClosedAt ?? Date.now()) - state.caseOpenedAt) / 1000)) : '—')
                      : formatDurationHM(state.elapsedSeconds))
                  : state.caseOpenedAt ? formatRecordingDuration(Math.floor(((state.caseClosedAt ?? Date.now()) - state.caseOpenedAt) / 1000)) : '—'}
              </div>
            </div>
          )}
          </div>
        </div>
      )}
      {(state.timingMode !== 'log' || state.cprRound > 0 || alwaysShowArrestSummary) && (
        <div className="rounded-xl border border-neutral-100">
          <div data-tutorial-anchor="arrest-summary-banner" className="bg-emerald-50 text-emerald-800 px-4 py-3 font-bold text-sm tracking-wider text-center rounded-t-xl">ARREST SUMMARY</div>
          <div className="bg-white divide-y divide-neutral-50 rounded-b-xl">
            {state.cprRound > 0 ? (
              <>
                <StatRow label="CPR Rounds" value={state.cprRound} />
                <StatRow label="Shocks" value={shockCount} color="text-red-600" />
                <StatRow label="Disarmed" value={disarmCount} color="text-blue-600" />
                <StatRow label="ROSC" value={roscCount} color="text-emerald-600" />
              </>
            ) : (
              <div className="p-4 text-neutral-300 italic text-sm">No CPR rounds recorded</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PharmaSummarySection({ pharmaSummary, infusionDoses, activeInfusions, onUpdateInfusionDose, treatments }: { 
  treatments?: Treatment[],
  pharmaSummary: Record<string, { totalDose: number, unit: string, count: number, display: string }>,
  infusionDoses?: Record<string, string>,
  activeInfusions?: string[],
  onUpdateInfusionDose?: (drug: string, dose: string) => void
}) {
  const nonInfusionEntries = Object.entries(pharmaSummary).filter(([name]) => !INFUSION_DRUGS.includes(name));
  const hasContent = nonInfusionEntries.length > 0 || (activeInfusions && activeInfusions.length > 0);

  return (
    <div className="rounded-xl border border-neutral-100">
      <div className="bg-emerald-50 text-emerald-800 px-4 py-3 font-bold text-sm tracking-wider text-center rounded-t-xl">PHARMA SUMMARY</div>
      <div className="bg-white divide-y divide-neutral-50 min-h-[60px] rounded-b-xl">
        {!hasContent ? (
          <div className="p-4 text-neutral-300 italic text-sm">No medications recorded</div>
        ) : (
          <>
            {nonInfusionEntries.map(([name, info]) => {
              const dt = treatments ? doseTimeNote(treatments, name) : null;
              return <StatRow key={name} label={name} value={info.display} sub={dt ? `${dt.label} ${dt.time}` : undefined} />;
            })}
            {activeInfusions && activeInfusions.map(drug => (
              <div key={drug} className="flex items-center justify-between p-2 px-3">
                <span className="text-neutral-500 text-[16px] font-medium">{drug}{(() => { const dt = treatments ? doseTimeNote(treatments, drug) : null; return dt ? <span className="block text-[12px] text-neutral-400 font-medium tabular-nums print:hidden">{dt.label} {dt.time}</span> : null; })()}</span>
                {onUpdateInfusionDose ? (
                  <div className="flex items-center bg-neutral-50 border border-neutral-200 rounded-lg overflow-hidden focus-within:border-emerald-400">
                    <input
                      type="text"
                      value={infusionDoses?.[drug] ?? ''}
                      onChange={e => onUpdateInfusionDose(drug, e.target.value)}
                      placeholder="0"
                      className="w-16 text-right text-[16px] font-black text-neutral-900 bg-transparent px-2 py-1 outline-none"
                    />
                    <span className="text-[13px] font-medium text-neutral-400 pr-2 w-8 text-left flex-shrink-0">
                      {drug === 'Adrenaline infusion' ? 'mcg' : 'mg'}
                    </span>
                  </div>
                ) : (
                  <span className="text-[16px] font-black text-neutral-900">
                    {infusionDoses?.[drug] ? `${infusionDoses[drug]}${drug === 'Adrenaline infusion' ? 'mcg' : 'mg'}` : '—'}
                  </span>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function SummaryOverlay({ state, pharmaSummary, onDelete, onMove, onEdit, onUpdateInfusionDose, onHandover }: { onHandover?: () => void, state: AppState, pharmaSummary: Record<string, { totalDose: number, unit: string, count: number, display: string }>, onDelete?: (idx: number) => void, onMove?: (fromIdx: number, toIdx: number) => void, onEdit?: (idx: number) => void, onUpdateInfusionDose?: (drug: string, dose: string) => void }) {
  return (
    <div className="space-y-6 pb-20">
      <div data-tutorial-section="arrestSummary">
        <ArrestSummarySection state={state} showRecordingDuration alwaysShowArrestSummary />
      </div>
      <div data-tutorial-section="vitalSigns">
        <VitalSignsSection vitals={state.vitals} />
      </div>
      <div data-tutorial-section="pharmaSummary">
        <PharmaSummarySection treatments={state.treatments} pharmaSummary={pharmaSummary} infusionDoses={state.infusionDoses} activeInfusions={INFUSION_DRUGS.filter(d => state.treatments.some(t => t.name.startsWith(d)))} onUpdateInfusionDose={onUpdateInfusionDose} />
      </div>
      <div data-tutorial-section="treatmentLog" className="rounded-xl border border-neutral-100">
        <div className="bg-emerald-50 text-emerald-800 p-3 font-bold text-sm tracking-wider text-center rounded-t-xl">TREATMENT LOG</div>
        <TreatmentLog treatments={state.treatments} elapsedSeconds={state.elapsedSeconds} caseOpenedAt={state.caseOpenedAt} onDelete={onDelete} onMove={onMove} onEdit={onEdit} />
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
  sub?: string;
}

function StatRow({ label, value, color = "text-neutral-900", stacked = false, sub }: StatRowProps) {
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
      <span className="text-neutral-500 text-[16px] font-medium">{label}{sub && <span className="block text-[12px] text-neutral-400 font-medium tabular-nums print:hidden">{sub}</span>}</span>
      <span className={`text-[16px] font-black tabular-nums ${color}`}>{value}</span>
    </div>
  );
}

function TreatmentSelection({ addTreatment, state, isShockForced, patientTypeOverride, noScroll, onDelayRhythmCheck, tutorialOutcomeRestriction }: { addTreatment: (n: string, options?: { customDose?: boolean; rhythmOutcome?: boolean }) => void, state: AppState, isShockForced?: boolean, patientTypeOverride?: string | null, noScroll?: boolean, onDelayRhythmCheck?: () => void, tutorialOutcomeRestriction?: 'redblue' | 'rosc' | 'delay' | null }) {
  const [customTx, setCustomTx] = useState('');
  const [selectedMed, setSelectedMed] = useState<string | null>(null);
  const [customDose, setCustomDose] = useState('');
  const [selectedCustomUnit, setSelectedCustomUnit] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>(isShockForced ? 'rhythmCheck' : null);
  const [customInputValues, setCustomInputValues] = useState<Record<string, string>>({});

  // The useState initializer above only runs once at mount, so if this menu
  // was already open (e.g. mid-edit) when a rhythm check became forced,
  // expandedSection would stay at whatever it was before - collapsed - with
  // no way to expand it, since the toggle itself is also disabled below.
  // This keeps it in sync whenever isShockForced actually changes.
  useEffect(() => {
    if (isShockForced) setExpandedSection('rhythmCheck');
  }, [isShockForced]);
  
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

      const displayDose = calculateDose(dose, state.patientWeight);
      let cleanDose = cleanDoseForLog(displayDose);
      
      // For Glucose 10%, add gram calculation
      if (selectedMed === 'Glucose 10%') {
        cleanDose = formatGlucose10Dose(cleanDose);
      }
      
      // For Sodium Bicarbonate, add mls calculation
      if (selectedMed === 'Sodium bicarbonate') {
        cleanDose = formatSodiumBicarbonateDose(cleanDose);
      }
      
      // For Calcium, add mg and mL calculation with max cap
      if (selectedMed === 'Calcium') {
        cleanDose = formatCalciumDose(cleanDose, state.patientWeight);
      }
      
      // For Ondansetron paed, cap at 4mg
      if (selectedMed === 'Ondansetron' && dose.includes('/kg')) {
        const weight = typeof state.patientWeight === 'number' ? state.patientWeight : parseFloat(String(state.patientWeight));
        const mgMatch = cleanDose.match(/([\d.]+)mg/);
        if (mgMatch) {
          const calculated = parseFloat(mgMatch[1]);
          const capped = Math.min(calculated, 4);
          cleanDose = `${capped}mg`;
        }
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
      const finalTreatment = `${selectedMed} ${cleanDose}`;
      addTreatment(finalTreatment);
      setSelectedMed(null);
      setCustomDose('');
      setSelectedCustomUnit(null);
    }
  };
  
  const handleCustomDoseAdd = () => {
    if (selectedMed && customDose && DOSE_CONFIG[selectedMed]) {
      const unit = selectedCustomUnit ?? getDefaultCustomUnit(selectedMed);

      let doseWithUnit = unit ? `${customDose}${unit}` : customDose;
      
      // For Glucose 10%, add gram calculation
      if (selectedMed === 'Glucose 10%') {
        doseWithUnit = formatGlucose10Dose(doseWithUnit);
      }
      
      // For Sodium Bicarbonate, add mls calculation
      if (selectedMed === 'Sodium bicarbonate') {
        doseWithUnit = formatSodiumBicarbonateDose(doseWithUnit);
      }
      
      // For Calcium, add mg and mL calculation with max cap
      if (selectedMed === 'Calcium') {
        doseWithUnit = formatCalciumDose(doseWithUnit, state.patientWeight);
      }
      
      addTreatment(`${selectedMed} ${doseWithUnit}`, { customDose: true });
      setSelectedMed(null);
      setCustomDose('');
      setSelectedCustomUnit(null);
    }
  };
  
  const handleBackFromMed = () => {
    // Update both states atomically to prevent flash
    setSelectedMed(null);
    setCustomDose('');
    setSelectedCustomUnit(null);
    setExpandedSection(() => 'medications');
  };

  // Phone back button: with the dose picker open, back returns to the treatments menu
  // (same as the picker's own back button) instead of closing the whole menu
  useEffect(() => {
    if (!selectedMed) return;
    const onBack = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d.handled) return;
      d.handled = true;
      handleBackFromMed();
    };
    window.addEventListener('bigone:back', onBack);
    return () => window.removeEventListener('bigone:back', onBack);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMed]);
  
  if (selectedMed && DOSE_CONFIG[selectedMed]) {
    const allDoses = DOSE_CONFIG[selectedMed].doses;
    const effectivePatientType = patientTypeOverride ?? state.patientType;
    const weight = typeof state.patientWeight === 'number' ? state.patientWeight : parseFloat(String(state.patientWeight));
    const filteredDoses = effectivePatientType 
      ? allDoses.filter(d => {
          if (d.population !== 'both' && d.population !== effectivePatientType) return false;
          if (d.minWeight !== undefined && !isNaN(weight) && weight < d.minWeight) return false;
          if (d.maxWeight !== undefined && !isNaN(weight) && weight > d.maxWeight) return false;
          return true;
        })
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
    
    // Display dose on button — calculated dose first, formula in brackets
    const getButtonDisplayDose = (doseOpt: { dose: string; indication?: string }) => {
      const weight = typeof state.patientWeight === 'number' ? state.patientWeight : parseFloat(String(state.patientWeight));
      
      // Glucose 10%: show mL/dose with formula
      if (selectedMed === 'Glucose 10%' && doseOpt.dose.includes('/kg')) {
        const base = calculateDose(doseOpt.dose, state.patientWeight);
        const mlMatch = base.match(/\(([\d.]+)mL\)/i);
        if (mlMatch) {
          const mls = parseFloat(mlMatch[1]);
          const grams = Math.round(mls * 0.1 * 10) / 10;
          return `${mls}mL/${grams}g (${doseOpt.dose})`;
        }
        return base;
      }
      
      // Calcium: show calculated dose first, formula after
      if (selectedMed === 'Calcium' && doseOpt.dose.includes('/kg')) {
        const calculatedMg = Math.min(10 * weight, 1000);
        const doseDisplay = calculatedMg >= 1000 ? `1g` : `${calculatedMg}mg`;
        return `${doseDisplay} (10mg/kg)`;
      }
      
      // Ondansetron paed: cap display at 4mg
      if (selectedMed === 'Ondansetron' && doseOpt.dose.includes('/kg')) {
        const calculatedMg = Math.min(Math.round(0.1 * weight * 10) / 10, 4);
        return `${calculatedMg}mg (0.1mg/kg${(0.1 * weight) > 4 ? ' - 4mg max' : ''})`;
      }
      
      // Amiodarone paed: cap display at 300mg for arrest, 150mg for VT with output
      if (selectedMed === 'Amiodarone' && doseOpt.dose.includes('/kg') && (effectivePatientType ?? state.patientType) === 'paed') {
        const base = calculateDose(doseOpt.dose, state.patientWeight);
        const mgMatch = base.match(/\(([\d.]+)mg\)/);
        if (mgMatch) {
          const calculated = parseFloat(mgMatch[1]);
          if (doseOpt.indication?.includes('cardiac arrest') && !doseOpt.indication?.includes('repeat')) {
            const capped = Math.min(calculated, 300);
            return `${capped}mg (5mg/kg${calculated > 300 ? ' - 300mg max' : ''})`;
          }
          if (doseOpt.indication?.includes('repeat')) {
            const capped = Math.min(calculated, 150);
            return `${capped}mg (2.5mg/kg${calculated > 150 ? ' - 150mg max' : ''})`;
          }
          if (doseOpt.indication?.includes('VT with output')) {
            const capped = Math.min(calculated, 150);
            return `${capped}mg (5mg/kg${calculated > 150 ? ' - 150mg max' : ''})`;
          }
        }
      }
      
      // Suxamethonium: 1.5mg/kg max 150mg
      if (selectedMed === 'Suxamethonium' && doseOpt.dose.includes('/kg')) {
        const base = calculateDose(doseOpt.dose, state.patientWeight);
        const calcMatch = base.match(/\(([\d.]+)(mg)\)/i);
        if (calcMatch) {
          const calculated = parseFloat(calcMatch[1]);
          const capped = Math.min(calculated, 150);
          return `${capped}mg (1.5mg/kg${calculated > 150 ? ' - 150mg max' : ''})`;
        }
        return base;
      }

      // Levetiracetam: 40mg/kg max 3000mg
      if (selectedMed === 'Levetiracetam (Keppra)' && doseOpt.dose.includes('/kg')) {
        const base = calculateDose(doseOpt.dose, state.patientWeight);
        const calcMatch = base.match(/\(([\d.]+)(mg)\)/i);
        if (calcMatch) {
          const calculated = parseFloat(calcMatch[1]);
          const capped = Math.min(calculated, 3000);
          return `${capped}mg (40mg/kg${calculated > 3000 ? ' - 3000mg max' : ''})`;
        }
        return base;
      }

      // Weight-based: reorder to "Xcalculated (formula)"
      if (doseOpt.dose.includes('/kg')) {
        const base = calculateDose(doseOpt.dose, state.patientWeight);
        const calcMatch = base.match(/\(([\d.]+)(mg|mL|mMol|mcg|g)\)/i);
        if (calcMatch) {
          return `${calcMatch[1]}${calcMatch[2]} (${doseOpt.dose})`;
        }
        return base;
      }
      
      // Fixed dose: just return as-is
      return doseOpt.dose;
    };

    return (
      <div className="h-full overflow-y-auto pb-4">
        <div className="p-6 mb-4">
          <h2 className="text-2xl font-bold text-neutral-900 mb-2">{selectedMed}</h2>
          {state.patientWeight && (
            <p className="text-neutral-500 text-sm mb-2">
              Patient weight: {state.patientWeight}kg
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
              const defaultUnit = getDefaultCustomUnit(selectedMed);
              const unit = selectedCustomUnit ?? defaultUnit;
              const canToggleUnit = defaultUnit === 'mg' || defaultUnit === 'mcg';
              const placeholder = unit ? `Enter dose...` : 'Enter dose...';
              
              // Calculate secondary unit for live display
              const getSecondaryUnit = () => {
                if (!customDose || isNaN(parseFloat(customDose))) return null;
                const value = parseFloat(customDose);
                
                if (selectedMed === 'Glucose 10%') {
                  const grams = Math.round(value * 0.1 * 10) / 10;
                  return `/ ${grams}g`;
                }
                
                if (selectedMed === 'Sodium bicarbonate') {
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
                  {canToggleUnit ? (
                    <button
                      type="button"
                      onClick={() => setSelectedCustomUnit(unit === 'mg' ? 'mcg' : 'mg')}
                      className="mr-2 px-2 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-600 text-sm font-bold whitespace-nowrap flex-shrink-0"
                      aria-label="Toggle dose unit"
                    >
                      {unit}
                    </button>
                  ) : (unit || secondaryUnit) && (
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
    <div data-tutorial-anchor="add-tx-submenu" className={`w-full ${noScroll ? 'pb-4' : 'h-full overflow-y-auto pb-4'}`}>
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
        onToggle={(id) => { if (!isShockForced) setExpandedSection(expandedSection === id ? null : id); }}
        showChevron={!isShockForced}
        items={[
          { name: 'Shock - VF', color: 'red' },
          { name: 'Shock - pVT', color: 'red' },
          { name: 'Disarm - Asystole', color: 'blue' },
          { name: 'Disarm - PEA', color: 'blue' },
          state.isROSCMode
            ? { name: 'Rearrest', color: 'orange' }
            : { name: 'ROSC', color: 'emerald' }
        ]} 
        onSelect={addTreatment}
        disabledItems={
          tutorialOutcomeRestriction === 'redblue' ? ['ROSC', 'Rearrest']
          : tutorialOutcomeRestriction === 'rosc' ? ['Shock - VF', 'Shock - pVT', 'Disarm - Asystole', 'Disarm - PEA']
          : tutorialOutcomeRestriction === 'delay' ? ['Shock - VF', 'Shock - pVT', 'Disarm - Asystole', 'Disarm - PEA', 'ROSC', 'Rearrest']
          : undefined
        }
      />

      {/* Delay rhythm check - same size/position as the Rhythm Check buttons
          above (matches their p-3/rounded-xl/text-sm styling and grid gap
          exactly), but with one blank button-height slot between it and
          ROSC / Rearrest so it can't be hit by accident reaching
          for that button. */}
      {isShockForced && onDelayRhythmCheck && (
        <div className="bg-white p-3 pt-0 grid grid-cols-1 gap-2">
          <div aria-hidden="true" className="w-full p-3 rounded-xl text-sm font-bold invisible">
            spacer
          </div>
          {(() => {
            const delayDisabled = tutorialOutcomeRestriction != null && tutorialOutcomeRestriction !== 'delay';
            return (
              <button
                onClick={() => { if (!delayDisabled) onDelayRhythmCheck(); }}
                disabled={delayDisabled}
                className={`w-full text-left p-3 rounded-xl font-bold text-sm btn-base text-amber-800 bg-amber-50 hover:bg-amber-100 flex items-center justify-center gap-2 ${delayDisabled ? 'cursor-not-allowed' : ''}`}
                style={delayDisabled ? { opacity: 0.6, filter: 'grayscale(0.5)' } : undefined}
              >
                <Hourglass size={16} strokeWidth={2.5} />
                Delay Rhythm Check
              </button>
            );
          })()}
        </div>
      )}

      {!isShockForced && (
        <>
          {/* "Timers only" trims Add Tx to just adrenaline, amiodarone
              and rhythm check outcomes (the latter always available above,
              unaffected by this) - the whole point of the mode is fewer
              things to log, not a relabelled version of the full list.
              Airway and Other Tx are dropped entirely; the custom-text box
              below stays, as a deliberate exception. */}
          <TxSection 
            title="Medications" 
            color="emerald" 
            items={state.timingMode === 'minimal' ? ['Adrenaline push', 'Amiodarone'] : MEDICATIONS} 
            onSelect={handleMedClick}
            sectionId="medications"
            expandedSection={expandedSection}
            onToggle={(id) => setExpandedSection(expandedSection === id ? null : id)}
          />
          
          {state.timingMode !== 'minimal' && (
          <TxSection 
            title="Airway" 
            color="blue" 
            items={[
              { name: 'ETT', failable: true },
              { name: 'FONA', failable: true },
              { name: 'IGT', failable: true },
              { name: 'LMA', failable: true },
              { name: 'NPA', failable: true },
              { name: 'OPA', failable: true },
              { name: 'Suction', failable: true }
            ]} 
            onSelect={addTreatment}
            sectionId="airway"
            expandedSection={expandedSection}
            onToggle={(id) => setExpandedSection(expandedSection === id ? null : id)}
          />
          )}
          
          {state.timingMode !== 'minimal' && (
          <TxSection 
            title="Other Tx" 
            color="neutral" 
            items={[
              'Corpuls', 'Extrication',
              { name: 'IO access', failable: true },
              { name: 'IV access', failable: true },
              'Pacing', { name: 'Reassurance provided', failable: true }
            ]} 
            onSelect={addTreatment}
            sectionId="otherTx"
            expandedSection={expandedSection}
            onToggle={(id) => setExpandedSection(expandedSection === id ? null : id)}
          />
          )}
          
          <div className="py-3 px-2 border-t border-neutral-100 bg-neutral-50 mb-4">
            <div className="flex gap-2 w-full">
              <input 
                type="text" 
                value={customTx}
                onChange={e => setCustomTx(e.target.value)}
                placeholder="Custom treatment..."
                className="flex-1 min-w-0 bg-white border border-neutral-200 rounded-xl p-4 text-base focus:ring-2 focus:ring-emerald-500 outline-none"
              />
              <button 
                onClick={() => { if(customTx) { addTreatment(customTx); setCustomTx(''); } }} 
                className="bg-emerald-600 text-white px-4 rounded-xl font-bold btn-base flex-shrink-0"
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
  onToggle,
  showChevron = true,
  disabledItems
}: { 
  title: string;
  color: string;
  items: (string | { name: string; color?: string; displayName?: string; failable?: boolean })[];
  onSelect: (n: string) => void;
  initiallyExpanded?: boolean;
  sectionId?: string;
  expandedSection?: string | null;
  onToggle?: (id: string) => void;
  showChevron?: boolean;
  // Item names to grey out and make unclickable - used by the rhythm-check
  // walkthrough to restrict the popup to only the outcome it just instructed
  disabledItems?: string[];
}) {
  const [isCollapsed, setIsCollapsed] = useState(!initiallyExpanded);
  // Tracks which failable items (ETT, IV access, etc.) are currently staged
  // as unsuccessful. Defaults to successful (absent from this map) - set at
  // logging time via a toggle right on the item, rather than requiring a
  // trip into the three-dot menu afterward.
  const [markedUnsuccessful, setMarkedUnsuccessful] = useState<Record<string, boolean>>({});
  
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
    emerald: 'text-emerald-600',
    orange: 'text-orange-600'
  };

  return (
    <div>
      <div 
        data-tutorial-anchor="tx-section-header"
        data-tx-section={sectionId}
        onClick={handleToggle}
        className={`flex items-center justify-between p-4 cursor-pointer font-bold select-none text-left ${colorMap[color]}`}
      >
        <span>{title}</span>
        {showChevron && <ChevronDown className={`transition-transform duration-300 ${collapsed ? '-rotate-90' : ''}`} />}
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
            const displayName = typeof item === 'string' ? item : (item.displayName ?? item.name);
            const failable = typeof item === 'string' ? false : !!item.failable;
            const textColorClass = itemColor ? (textColorMap[itemColor] ?? 'text-neutral-700') : 'text-neutral-700';
            const bgClass = itemColor === 'orange' ? 'bg-orange-50 hover:bg-orange-100' : 'bg-neutral-50 hover:bg-neutral-100';
            const isUnsuccessful = !!markedUnsuccessful[itemName];
            const isDisabled = !!disabledItems?.includes(itemName);

            if (failable) {
              return (
                <div key={itemName} className="flex items-stretch gap-2">
                  <button
                    onClick={() => { if (!isDisabled) onSelect(isUnsuccessful ? `${itemName} - Unsuccessful` : itemName); }}
                    disabled={isDisabled}
                    className={`flex-1 text-left p-3 rounded-xl font-bold text-sm btn-base ${textColorClass} ${bgClass} ${isDisabled ? 'cursor-not-allowed' : ''}`}
                    style={isDisabled ? { opacity: 0.6, filter: 'grayscale(0.5)' } : undefined}
                    data-medication={itemName}
                  >
                    {displayName}
                  </button>
                  <button
                    onClick={() => setMarkedUnsuccessful(prev => ({ ...prev, [itemName]: !prev[itemName] }))}
                    className={`flex-shrink-0 relative w-[152px] h-9 rounded-full transition-colors duration-200 btn-base ${isUnsuccessful ? 'bg-red-100' : 'bg-emerald-100'}`}
                    role="switch"
                    aria-checked={!isUnsuccessful}
                    aria-label={`Mark ${displayName} as ${isUnsuccessful ? 'successful' : 'unsuccessful'}`}
                  >
                    <span
                      className={`absolute top-1 w-[120px] h-7 rounded-full shadow flex items-center justify-center gap-1 text-[11px] font-bold text-white transition-all duration-200 ${isUnsuccessful ? 'left-7 bg-red-600' : 'left-1 bg-emerald-600'}`}
                    >
                      {isUnsuccessful ? <X size={12} strokeWidth={3} /> : <Check size={12} strokeWidth={3} />}
                      {isUnsuccessful ? 'Unsuccessful' : 'Successful'}
                    </span>
                  </button>
                </div>
              );
            }

            return (
              <button 
                key={itemName} 
                onClick={() => { if (!isDisabled) onSelect(itemName); }} 
                disabled={isDisabled}
                className={`w-full text-left p-3 rounded-xl font-bold text-sm btn-base ${textColorClass} ${bgClass} ${isDisabled ? 'cursor-not-allowed' : ''}`}
                style={isDisabled ? { opacity: 0.6, filter: 'grayscale(0.5)' } : undefined}
                data-medication={itemName}
              >
                {displayName}
              </button>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
