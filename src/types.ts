/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Treatment {
  name: string;
  elapsed: number;
  round: number;
  clock: string;
  clockSeconds: string;
  prior?: boolean;
  loggedAt?: number;
  timeUnknown?: boolean;
  customDose?: boolean;
  edited?: boolean;
}

// What the crew types on the Handover page. Kept with the open case only: cleared when the case is
// closed, and never saved with a previous case or printed in the PDF.
export interface HandoverFields {
  airway: string;           // what the crew say the airway is ('ETT' | 'LMA' | 'FONA' | 'OPA' | 'NPA' | 'None'); '' = what the Tx log says. Never changes the Tx log.
  airwayIgt: string;        // 'Yes' | 'No' | '' (with an airway device)
  accessIv: string;         // how many IVs, '0'-'4'; '' = what the Tx log says
  accessIo: string;
  latestRhythm: string;     // Arrest – Timers: the most recent rhythm (that mode doesn't record rhythms, so the crew say it)
  otherTx: string;          // Arrest – Timers: what else was given or done (that mode doesn't record it), one item per line
  gcsE: string;             // GCS eye, verbal and motor (the total is kept in the vital signs, so the VSS tab and the handover share it)
  gcsV: string;
  gcsM: string;         // how many IOs, '0'-'4'; '' = what the Tx log says
  unknowns: string;         // comma-separated list of the things marked Unknown (e.g. 'gcs,hr,bp,history')
  ageUnknown: string;       // 'Yes' when the age isn't known
  age?: string;             // digits only; the unit is separate. Not set until the crew types or clears it, so a paediatric age from setup shows until then
  ageUnit?: string;         // 'Years' | 'Months'; not set until chosen (then Years, or the paediatric age's own unit)
  gender: string;           // 'Male' | 'Female' | 'Other' | ''
  genderOther: string;
  breathing: string;        // 'Breathing' | 'Ventilated' | '' (ROSC: is the patient breathing, or are we ventilating)
  witnessed: string;        // 'Yes' | 'No' | 'Unknown' | ''
  bystanderCpr: string;     // 'Yes' | 'No' | 'Unknown' | ''
  arrestStart: string;      // 'Before' (we arrived) | 'During' (the case) | ''
  startedBefore: string;    // how long before we arrived: 'Under 5 min' | '5–10 min' | '10–15 min' | '15–20 min' | 'Over 20 min' | 'Unknown' | ''
  firstRhythm: string;      // asked when shocks or disarms were entered at setup: 'VF' | 'pVT' | 'Asystole' | 'PEA' | 'Unknown' | ''
  suspectedCause: string;
  // AMBO: useful if there's time, kept apart from IMIST
  allergies: string;        // 'NKA' | 'Unknown' | 'Other' | ''
  allergiesOther: string;
  medications: string;
  background: string;
  otherInfo: string;
}

export interface AppState {
  running: boolean;
  reversiblesChecklistOpened: boolean;
  caseOpenedAt: number | null;
  caseClosedAt: number | null;
  startTime: number | null;
  pausedTime: number;
  elapsedSeconds: number;
  rhythmCheckTarget: number;
  rhythmCheckPaused: boolean;
  rhythmCheckOvertime: number;
  // Set while a rhythm check has been delayed: the elapsed second the check
  // fell due. The central ring shows how far overdue it is and the rhythm
  // check timer is held until the check is actually done. null/absent = not
  // delayed.
  rhythmCheckDelayedAt?: number | null;
  frozenCountdown?: number;
  cprRound: number;
  adrenalineWipedAt: number | null;
  amiodaroneWipedAt: number | null;
  treatments: Treatment[];
  currentOverlay: string | null;
  catchupElapsed: number;
  startClockTime: number | null;
  patientWeight: number | null;
  patientType: 'adult' | 'paed' | null;
  patientAge: string | null;
  infusionDoses: Record<string, string>;
  reversiblesChecked: string[];
  roscChecked: string[];
  pheaChecked: string[];
  isROSCMode: boolean;
  timingMode: 'elapsed' | 'log' | 'minimal' | null;
  // True once the monitor's elapsed time has been entered during this case (when it started in a
  // timer mode, or a Recalibrate step was confirmed). The case clock keeps running in Tx log only, so
  // it stays valid there. Absent on cases saved before this existed.
  elapsedCalibrated?: boolean;
  rhythmInterval: 'evens' | 'odds' | 'half-evens' | 'half-odds' | null;
  // When a timer-fired rhythm check popup is showing and not yet answered, the elapsed time
  // it was due at. Saved so that after an app restart the app still knows the popup was
  // unanswered (see the tick in App.tsx). Absent/null otherwise.
  pendingRhythmCheckDueAt?: number | null;
  handover?: HandoverFields;
  vitals: {
    hr: string; rr: string; gcs: string;
    bpSys: string; bpDia: string; spo2: string;
    etco2: string; bgl: string; temp: string;
  };
}

export type OverlayType = 'reversibles' | 'rosc' | 'phea' | 'summary' | 'treatment' | 'caseSummary' | 'tutorial' | 'vitals';

export interface Vitals {
  hr: string;
  rr: string;
  gcs: string;
  bpSys: string;
  bpDia: string;
  spo2: string;
  etco2: string;
  bgl: string;
  temp: string;
}
