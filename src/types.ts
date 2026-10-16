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
  name: string;
  age: string;
  gender: string;
  mechanism: string;
  information: string;
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
