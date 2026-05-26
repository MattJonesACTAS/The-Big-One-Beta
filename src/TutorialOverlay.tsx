/**
 * TutorialOverlay - Global sequential tutorial nodes
 * Each node waits for its screen condition before showing.
 * Nodes only advance when explicitly dismissed - no jumping ahead.
 */

import React, { useState, useEffect } from 'react';

interface GlobalNode {
  id: string;
  type: 'popup' | 'positioned';
  x?: number;
  y?: number;
  displayNumber?: number;
  title: string;
  description: string;
  condition?: (appState: any, isShockForced?: boolean) => boolean;
}

// Single flat sequence - each node waits for its condition before appearing
const ALL_NODES: GlobalNode[] = [
  // --- Intro popups ---
  {
    id: 'intro1', type: 'popup',
    title: 'Welcome to The Big One',
    description: 'The Big One is a cognitive aid for use during cardiac arrests. Having times and medications kept track of for you, situational awareness and leadership can be your main focus.',
    condition: (s) => s.running && s.currentOverlay === null
  },
  {
    id: 'intro2', type: 'popup',
    title: 'Getting Started',
    description: "On opening the app, you'll need to calibrate the app by entering:\n\n• The elapsed case time on the monitor\n• The time to next rhythm check\n• Select adult or paediatric patient\n• The patient's estimated weight\n\nYou'll then be brought to the home screen which we'll look at first. Click on the blue numbers and follow any instructions to advance through the tutorial.",
    condition: (s) => s.running && s.currentOverlay === null
  },
  // --- Home screen nodes ---
  {
    id: 'totalTime', type: 'positioned', x: 19.8, y: 22, displayNumber: 1,
    title: 'Total Time',
    description: 'The total time since the monitor was turned on (top right timer)',
    condition: (s, sf) => s.running && s.currentOverlay === null && s.rhythmCheckOvertime === 0 && !sf
  },
  {
    id: 'cprRound', type: 'positioned', x: 80.2, y: 22, displayNumber: 2,
    title: 'CPR Round',
    description: 'The current round of CPR. This will update every time the rhythm check counter reaches 0:00.',
    condition: (s, sf) => s.running && s.currentOverlay === null && s.rhythmCheckOvertime === 0 && !sf
  },
  {
    id: 'timer', type: 'positioned', x: 50, y: 52, displayNumber: 3,
    title: 'Rhythm Check Timer',
    description: "The countdown to the next rhythm check.\n\n• When the timer reaches 00:10 you will be forced back to the home screen so that you don't miss the rhythm check.\n• When the timer reaches 0:00, it allows 6 seconds for the rhythm check, then restarts from 2:00.\n• You will then be forced to record whether you shocked or disarmed.",
    condition: (s, sf) => s.running && s.currentOverlay === null && s.rhythmCheckOvertime === 0 && !sf
  },
  {
    id: 'pause', type: 'positioned', x: 19.0, y: 4.2, displayNumber: 4,
    title: 'Pause Button',
    description: 'Pause and resume the rhythm check timer',
    condition: (s, sf) => s.running && s.currentOverlay === null && s.rhythmCheckOvertime === 0 && !sf
  },
  {
    id: 'recalibrate', type: 'positioned', x: 51.0, y: 4.2, displayNumber: 5,
    title: 'Recalibrate Button',
    description: 'The app estimates a rhythm check of 6 seconds. Recalibrate the timer to match reality if your rhythm checks are longer.',
    condition: (s, sf) => s.running && s.currentOverlay === null && s.rhythmCheckOvertime === 0 && !sf
  },
  {
    id: 'tabs', type: 'positioned', x: 50, y: 10.75, displayNumber: 6,
    title: 'Checklists',
    description: 'Quick access to checklists for the reversible causes of arrest, ROSC and Prehospital emergency anaesthesia (PHEA)',
    condition: (s, sf) => s.running && s.currentOverlay === null && s.rhythmCheckOvertime === 0 && !sf
  },
  {
    id: 'addTxBtn', type: 'positioned', x: 75, y: 95.4, displayNumber: 7,
    title: 'Add Treatment Button',
    description: 'This takes you to the treatments (Tx) list for you to log in real time during the case. Press the button so we can log our first Tx.',
    condition: (s, sf) => s.running && s.currentOverlay === null && s.rhythmCheckOvertime === 0 && !sf
  },
  // --- Treatment screen ---
  {
    id: 'addTxSubmenu', type: 'positioned', x: 50, y: 40, displayNumber: 1,
    title: 'Add Tx Submenu',
    description: "The Add Tx submenu has four categories of Tx's that you can log.\n\n• All medications will have one or more dosage options to choose from for different indications.\n• These dosages are pre-calculated if they are weight based.\n\nLog a 1mg adrenaline push to progress.",
    condition: (s, sf) => s.currentOverlay === 'treatment' && !sf
  },
  // --- Home with medication alerts ---
  {
    id: 'adrenalineAlert', type: 'positioned', x: 28.4, y: 82.82, displayNumber: 1,
    title: 'Medication alerts',
    description: 'When you log adrenaline or amiodarone, an alert will appear on the home screen to help you keep track of when the next dose is due.',
    condition: (s, sf) => s.running && s.currentOverlay === null && s.treatments.length > 0 && s.rhythmCheckOvertime === 0 && !sf
  },
  {
    id: 'summaryBtn', type: 'positioned', x: 26.6, y: 95.4, displayNumber: 2,
    title: 'Summary Button',
    description: "Next, let's have a look at the running case summary page",
    condition: (s, sf) => s.running && s.currentOverlay === null && s.treatments.length > 0 && s.rhythmCheckOvertime === 0 && !sf
  },
  // --- Summary overlay ---
  {
    id: 'pharmaSummary', type: 'positioned', x: 50, y: 50, displayNumber: 1,
    title: 'Medication Summary',
    description: 'All medications logged will appear here, with an accumulative tally of the total amount of each drug given.',
    condition: (s) => s.currentOverlay === 'summary'
  },
  {
    id: 'treatmentLog', type: 'positioned', x: 50, y: 70.9, displayNumber: 2,
    title: 'Treatment Log',
    description: 'Chronological record of all logged interventions. Timestamps show the exact time, the elapsed time on the monitor, and how long ago each Tx was logged.',
    condition: (s) => s.currentOverlay === 'summary'
  },
  {
    id: 'closeOverlay', type: 'positioned', x: 15, y: 93, displayNumber: 3,
    title: 'Return to Home',
    description: 'Press the close button to return to the home page',
    condition: (s) => s.currentOverlay === 'summary'
  },
  // --- Home after summary ---
  {
    id: 'closeCase', type: 'positioned', x: 82.2, y: 4.2, displayNumber: 1,
    title: 'Close Case Button',
    description: "When you've either stopped resuscitative efforts or handed your patient over at hospital, you can close the case.",
    condition: (s, sf) => s.running && s.currentOverlay === null && s.rhythmCheckOvertime === 0 && !sf
  },
  // --- Case summary ---
  {
    id: 'finalStats', type: 'positioned', x: 50, y: 61.64, displayNumber: 1,
    title: 'Final Case Data',
    description: 'Now the case is over, the treatment log shows times to the second, not just to the minute',
    condition: (s) => !s.running
  },
  {
    id: 'export', type: 'positioned', x: 27, y: 14, displayNumber: 2,
    title: 'Export PDF',
    description: 'Here you can export the case summary and Tx log to a PDF, which you can then download or email for later review.',
    condition: (s) => !s.running
  },
  {
    id: 'delete', type: 'positioned', x: 73, y: 14, displayNumber: 3,
    title: 'Delete Case',
    description: "Once you've finished your case sheet and exported to PDF (if you wanted to) you can then delete all case data.",
    condition: (s) => !s.running
  }
];

// Global node indices for flash logic
export const TUTORIAL_NODE = {
  ADD_TX_BTN: 8,       // After dismiss: flash Add Tx button
  ADD_TX_SUBMENU: 9,   // After dismiss: flash adrenaline button
  SUMMARY_BTN: 11,     // After dismiss: flash Summary button
  CLOSE_OVERLAY: 14,   // After dismiss: flash summary close button
  CLOSE_CASE: 15,      // After dismiss: flash Close Case button
  DELETE: 18           // After dismiss: flash Delete button
};

interface Props {
  appState: any;
  isShockForced?: boolean;
  onExit: () => void;
  onNodeChange?: (globalNodeIndex: number, tutorialDone: boolean) => void;
  isCaseClosed?: boolean;
  globalNodeIndex?: number;
}

export default function TutorialOverlay({ appState, isShockForced, onExit, onNodeChange, isCaseClosed, globalNodeIndex: externalNodeIndex = 0 }: Props) {
  const [internalNodeIndex, setInternalNodeIndex] = useState(externalNodeIndex);
  const globalNodeIndex = externalNodeIndex;
  const setGlobalNodeIndex = (updater: number | ((prev: number) => number)) => {
    const newVal = typeof updater === 'function' ? updater(internalNodeIndex) : updater;
    setInternalNodeIndex(newVal);
    if (onNodeChange) onNodeChange(newVal, newVal >= ALL_NODES.length);
  };
  const [activePopup, setActivePopup] = useState<GlobalNode | null>(null);
  const [activePositioned, setActivePositioned] = useState<GlobalNode | null>(null);
  const tutorialDone = globalNodeIndex >= ALL_NODES.length;

  // Get current node
  const currentNode = tutorialDone ? null : ALL_NODES[globalNodeIndex];

  // Freeze tutorial during entire rhythm check window (only when case is running)
  const countdown = appState.rhythmCheckTarget - appState.elapsedSeconds;
  const inRhythmCheckWindow = appState.running && (
    isShockForced ||
    appState.rhythmCheckOvertime > 0 ||
    (!appState.rhythmCheckPaused && countdown >= 0 && countdown <= 10)
  );

  // Check if current node's condition is met (and not frozen)
  const conditionMet = !inRhythmCheckWindow && currentNode
    ? (currentNode.condition ? currentNode.condition(appState, isShockForced) : true)
    : false;

  // Auto-show popup when condition is met
  useEffect(() => {
    if (currentNode?.type === 'popup' && conditionMet && !activePopup) {
      setActivePopup(currentNode);
    }
  }, [currentNode?.id, conditionMet]);

  // Dismiss popup or positioned node popup
  const handleDismissPopup = () => {
    setActivePopup(null);
    setGlobalNodeIndex(prev => prev + 1);
  };

  const handleNodeClick = () => {
    if (currentNode?.type === 'positioned' && conditionMet) {
      setActivePositioned(currentNode);
    }
  };

  const handleDismissPositioned = () => {
    setActivePositioned(null);
    setGlobalNodeIndex(prev => prev + 1);
  };

  // Dismiss active node popup during the full rhythm check window
  useEffect(() => {
    if (inRhythmCheckWindow && activePositioned) {
      setActivePositioned(null);
    }
  }, [inRhythmCheckWindow, activePositioned]);

  const showDarkOverlay = activePopup !== null || activePositioned !== null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9998, pointerEvents: 'none' }}>

      {/* Dark backdrop */}
      {showDarkOverlay && (
        <div style={{
          position: 'absolute', inset: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          zIndex: 9999,
          pointerEvents: 'auto'
        }} />
      )}

      {/* Positioned node circle - only show when condition met, not during forced shock */}
      {currentNode?.type === 'positioned' && conditionMet && !activePositioned && !tutorialDone && (
        <button
          onClick={handleNodeClick}
          style={{
            position: 'absolute',
            left: `${currentNode.x}%`,
            top: `${currentNode.y}%`,
            transform: 'translate(-50%, -50%)',
            width: '50px',
            height: '50px',
            borderRadius: '50%',
            backgroundColor: '#3b82f6',
            color: 'white',
            fontSize: '20px',
            fontWeight: '700',
            border: 'none',
            cursor: 'pointer',
            zIndex: 10001,
            pointerEvents: 'auto',
            animation: 'tutorialPulse 2s infinite',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {currentNode.displayNumber}
        </button>
      )}

      {/* Popup modal (intro screens) */}
      {activePopup && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'white', borderRadius: '20px',
          padding: '32px', maxWidth: '400px', width: '90%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          zIndex: 10000, pointerEvents: 'auto'
        }}>
          <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '12px', color: '#000', textAlign: 'center' }}>
            {activePopup.title}
          </h2>
          <p style={{ color: '#666', marginBottom: '24px', lineHeight: '1.5', textAlign: 'left', whiteSpace: 'pre-line' }}>
            {activePopup.description}
          </p>
          <button onClick={handleDismissPopup} style={{
            width: '100%', backgroundColor: '#059669', color: 'white',
            padding: '16px', borderRadius: '12px', border: 'none',
            fontSize: '16px', fontWeight: '700', cursor: 'pointer'
          }}>
            Got it
          </button>
        </div>
      )}

      {/* Positioned node popup */}
      {activePositioned && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'white', borderRadius: '20px',
          padding: '32px', maxWidth: '400px', width: '90%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          zIndex: 10000, pointerEvents: 'auto'
        }}>
          <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '12px', color: '#000', textAlign: 'center' }}>
            {activePositioned.title}
          </h2>
          <p style={{ color: '#666', marginBottom: '24px', lineHeight: '1.5', textAlign: 'left', whiteSpace: 'pre-line' }}>
            {activePositioned.description}
          </p>
          <button onClick={handleDismissPositioned} style={{
            width: '100%', backgroundColor: '#059669', color: 'white',
            padding: '16px', borderRadius: '12px', border: 'none',
            fontSize: '16px', fontWeight: '700', cursor: 'pointer'
          }}>
            Got it
          </button>
        </div>
      )}

      {/* Exit button */}
      <button
        onClick={onExit}
        style={{
          position: 'absolute', top: '16px', left: '16px',
          backgroundColor: 'rgba(0,0,0,0.5)', color: 'white',
          padding: '8px 16px', borderRadius: '8px', border: 'none',
          fontSize: '14px', fontWeight: '600', cursor: 'pointer',
          zIndex: 10002, pointerEvents: 'auto'
        }}
      >
        Exit Tutorial
      </button>

      <style>{`
        @keyframes tutorialPulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7); }
          50% { transform: translate(-50%, -50%) scale(1.1); box-shadow: 0 0 0 10px rgba(59, 130, 246, 0); }
        }
      `}</style>
    </div>
  );
}
