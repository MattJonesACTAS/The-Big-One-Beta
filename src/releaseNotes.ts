// The app's version number and the "What's New" notes, in one place.
//
// EACH RELEASE:
//   1. Change APP_VERSION below.
//   2. Add an entry at the TOP of RELEASE_NOTES with that same version number.
// The version number is what triggers the What's New page: after an update, the app
// compares APP_VERSION with the last version this phone showed notes for, and if it
// is newer the page is shown once, on the welcome screen. A version with no notes
// entry shows no page.

export const APP_VERSION = 'v1.5';

// Remembers the last version whose notes were shown (so they're only shown once)
export const LAST_SEEN_VERSION_KEY = 'theBigOneLastSeenVersion';

export interface ReleaseNote {
  version: string;
  items: string[];
}

// Newest first
export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: 'v1.5',
    items: [
      'Three modes to suit different cases: Timers only, Tx log only, and Tx log & timers. You can switch between them during a case.',
      'A rebuilt tutorial, with a separate guided walkthrough for each mode, and a Learn More button on each mode card.',
      'Rhythm checks are no longer missed if the screen locks or the app is left. The popup appears when you return, and a check you didn\u2019t answer is logged as \u201CRhythm check, nothing logged\u201D.',
      'The screen now stays on during a case, on phones that allow it.',
      'Aligned with ACTAS CMG v1.1.0.3, plus wording and spelling corrections.',
    ],
  },
];

// Which notes (if any) to show now.
//   lastSeen     the last version whose notes were shown on this phone, or null
//   hadPriorUse  this phone has used the app before (the disclaimer was accepted)
// - Already seen this version: nothing.
// - A brand-new install: nothing (the notes are about changes, and there's nothing to change from).
// - An existing user from before notes existed (no record, but has used the app): this version's notes.
// - Otherwise: every entry newer than the last one seen (up to `max`), newest first.
export function pendingReleaseNotes(
  lastSeen: string | null,
  hadPriorUse: boolean,
  notes: ReleaseNote[] = RELEASE_NOTES,
  current: string = APP_VERSION,
  max = 5,
): ReleaseNote[] {
  if (lastSeen === current) return [];
  if (lastSeen == null) return hadPriorUse && notes[0]?.version === current ? [notes[0]] : [];
  const i = notes.findIndex(n => n.version === lastSeen);
  const newer = i === -1 ? notes : notes.slice(0, i);
  return newer.slice(0, max);
}
