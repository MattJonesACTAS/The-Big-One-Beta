/**
 * TutorialOverlay - Sequential tutorial nodes
 */

import React, { useState, useEffect } from 'react';

interface TutorialNode {
  id: string;
  x: number;
  y: number;
  number: number;
  title: string;
  description: string;
}

interface TutorialScreen {
  condition: (appState: any, summaryViewed: boolean) => boolean;
  nodes: TutorialNode[];
  initialMessage?: {
    title: string;
    description: string;
  };
}

const TUTORIAL_SCREENS: TutorialScreen[] = [
  {
    // Intro screen 1 - stays until dismissed
    condition: (state) => state.running && state.treatments.length === 0 && state.currentOverlay === null,
    initialMessage: {
      title: 'Welcome to The Big One',
      description: 'The Big One is a tool that you can use when acting as the team leader during cardiac arrest cases to help you stay on top of everything.'
    },
    nodes: []
  },
  {
    // Intro screen 2 with home screen nodes - shown after first is dismissed
    condition: (state) => state.running && state.treatments.length === 0 && state.currentOverlay === null,
    initialMessage: {
      title: 'Getting Started',
      description: "On opening the app, you'll need to enter some times from the monitor and details about the patient. You'll then be brought to the home screen."
    },
    nodes: [
      { id: 'totalTime', x: 19.8, y: 22, number: 1, title: 'Total Time', description: 'Total time the monitor has been turned on' },
      { id: 'cprRound', x: 80.2, y: 22, number: 2, title: 'CPR Round', description: 'The current round of CPR' },
      { id: 'timer', x: 50, y: 52, number: 3, title: 'Rhythm Check Timer', description: 'The countdown to the next rhythm check. When the timer reaches 0:00, it pauses for 6 seconds to allow for the rhythm check, then restarts from 2:00.' },
      { id: 'pause', x: 19.0, y: 4.2, number: 4, title: 'Pause Button', description: 'Pause and resume the rhythm check timer' },
      { id: 'recalibrate', x: 51.0, y: 4.2, number: 5, title: 'Recalibrate Button', description: 'The app estimates a rhythm check of 6 seconds. Recalibrate the timer to match reality if your rhythm checks are longer.' },
      { id: 'tabs', x: 50, y: 10.75, number: 6, title: 'Checklists', description: 'Quick access to checklists for the reversible causes of arrest, ROSC and Prehospital emergency anaesthesia (PHEA)' },
      { id: 'addTxBtn', x: 75, y: 95.4, number: 7, title: 'Add Treatment Button', description: 'Tap here to log treatments and interventions during the arrest' }
    ]
  },
  {
    // Treatment menu
    condition: (state) => state.currentOverlay === 'treatment',
    nodes: [
      { id: 'addTxSubmenu', x: 50, y: 30, number: 1, title: 'Add Tx submenu', description: "After pressing the Add Tx button, you'll see this menu. Click 'Adrenaline push' to see dosage options." }
    ]
  },
  {
    // Home with medication alerts - only show if summary NOT viewed yet
    condition: (state, summaryViewed) => state.running && state.currentOverlay === null && state.treatments.length > 0 && !summaryViewed,
    nodes: [
      { id: 'adrenalineAlert', x: 28.4, y: 82.82, number: 1, title: 'Medication alerts', description: 'When you log adrenaline or amiodarone, an alert will appear on the home screen to help you keep track of when the next dose is due.' },
      { id: 'summaryBtn', x: 26.6, y: 95.4, number: 2, title: 'Summary Button', description: "Next, let's have a look at the running case summary page" }
    ]
  },
  {
    // Summary overlay
    condition: (state) => state.currentOverlay === 'summary',
    nodes: [
      { id: 'pharmaSummary', x: 50, y: 50, number: 1, title: 'Medication Summary', description: 'All medications logged will appear here, with an accumulative tally of the total amount of each drug given.' },
      { id: 'treatmentLog', x: 50, y: 70.9, number: 2, title: 'Treatment Log', description: 'Chronological record of all logged interventions. Timestamps show the exact time, the elapsed time on the monitor, and how long ago each Tx was logged.' },
      { id: 'closeOverlay', x: 50, y: 8, number: 3, title: 'Return to Home', description: 'Press the close button to return to the home page' }
    ]
  },
  {
    // Home after viewing summary - show close case button
    condition: (state, summaryViewed) => state.running && state.currentOverlay === null && summaryViewed,
    nodes: [
      { id: 'close', x: 82.2, y: 4.2, number: 1, title: 'Close Button', description: "Let's say we've either stopped resuscitative efforts or we've handed our patient over at hospital. We can now close the case." }
    ]
  },
  {
    // Case summary (after case is closed)
    condition: (state) => !state.running,
    nodes: [
      { id: 'finalStats', x: 50, y: 61.64, number: 1, title: 'Final Case Data', description: 'Now the case is over, the treatment log shows times to the second, not just to the minute' },
      { id: 'export', x: 27, y: 14, number: 2, title: 'Export PDF', description: 'Export the case summary and Tx log to a pdf, which you can then email for later review.' },
      { id: 'delete', x: 73, y: 14, number: 3, title: 'Delete Case', description: 'Permanently delete the case information from the app' }
    ]
  }
];

interface Props {
  appState: any;
  onExit: () => void;
  onScreenChange?: (screenIndex: number, isComplete: boolean, currentNodeIndex?: number) => void;
  isCaseClosed?: boolean;
}

export default function TutorialOverlay({ appState, onExit, onScreenChange, isCaseClosed }: Props) {
  const [currentNodeIndex, setCurrentNodeIndex] = useState(0);
  const [activeNode, setActiveNode] = useState<TutorialNode | null>(null);
  const [showInitialMessage, setShowInitialMessage] = useState<string | null>(null);
  const [currentScreenId, setCurrentScreenId] = useState<number>(-1);
  const [tutorialComplete, setTutorialComplete] = useState(false);
  const [intro1Dismissed, setIntro1Dismissed] = useState(false);
  const [summaryViewed, setSummaryViewed] = useState(false);

  // Track when summary overlay is closed
  useEffect(() => {
    if (currentScreenId === 5 && appState.currentOverlay !== 'summary' && !summaryViewed) {
      setSummaryViewed(true);
    }
  }, [appState.currentOverlay, currentScreenId, summaryViewed]);

  // Detect screen changes - ignore ROSC/Reversibles/PHEA overlay changes
  useEffect(() => {
    // If we're on ROSC/Reversibles/PHEA overlay, don't change screens
    if (appState.currentOverlay === 'rosc' || 
        appState.currentOverlay === 'reversibles' || 
        appState.currentOverlay === 'phea') {
      return; // Keep current screen
    }

    // Skip intro 1 if already dismissed
    const screensToCheck = intro1Dismissed ? TUTORIAL_SCREENS.slice(1) : TUTORIAL_SCREENS;
    const offset = intro1Dismissed ? 1 : 0;
    
    const matchedScreenIndex = screensToCheck.findIndex(screen => 
      screen.condition(appState, summaryViewed)
    );
    
    const actualScreenIndex = matchedScreenIndex >= 0 ? matchedScreenIndex + offset : -1;
    
    if (actualScreenIndex !== currentScreenId) {
      setCurrentScreenId(actualScreenIndex);
      setActiveNode(null);
      setCurrentNodeIndex(0);
      setTutorialComplete(false);
      
      const screen = TUTORIAL_SCREENS[actualScreenIndex];
      if (screen?.initialMessage) {
        setShowInitialMessage(`screen-${actualScreenIndex}`);
      }
      
      if (onScreenChange) {
        onScreenChange(actualScreenIndex, false, 0);
      }
    }
  }, [appState.running, appState.currentOverlay, appState.treatments.length, currentScreenId, intro1Dismissed, summaryViewed, onScreenChange]);

  // Notify when tutorial completes on a screen or node changes
  useEffect(() => {
    if (onScreenChange) {
      onScreenChange(currentScreenId, tutorialComplete, currentNodeIndex);
    }
  }, [tutorialComplete, currentScreenId, currentNodeIndex, onScreenChange]);

  const currentScreen = currentScreenId >= 0 ? TUTORIAL_SCREENS[currentScreenId] : null;
  if (!currentScreen) return null;

  const currentNode = currentScreen.nodes[currentNodeIndex];
  const currentMessageKey = `screen-${currentScreenId}`;
  const showingInitialMessage = showInitialMessage === currentMessageKey;
  const showDarkOverlay = showingInitialMessage || activeNode !== null;

  const handleNodeClick = (node: TutorialNode) => {
    setActiveNode(node);
  };

  const handleDismissNode = () => {
    setActiveNode(null);
    if (currentNodeIndex >= currentScreen.nodes.length - 1) {
      setTutorialComplete(true);
    } else {
      setCurrentNodeIndex(prev => prev + 1);
    }
  };

  const handleDismissInitialMessage = () => {
    if (currentScreenId === 0) {
      setIntro1Dismissed(true);
    }
    setShowInitialMessage(null);
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9998,
      pointerEvents: 'none'
    }}>
      {showDarkOverlay && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 9999,
          pointerEvents: 'auto'
        }} />
      )}

      <button
        onClick={onExit}
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          zIndex: 10001,
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
          fontSize: '24px',
          fontWeight: '700',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'auto'
        }}
      >
        ×
      </button>

      {currentScreen.initialMessage && showingInitialMessage && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'white',
          borderRadius: '20px',
          padding: '32px',
          maxWidth: '400px',
          width: '90%',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          zIndex: 10000,
          pointerEvents: 'auto',
          textAlign: 'center'
        }}>
          <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '12px', color: '#000' }}>
            {currentScreen.initialMessage.title}
          </h2>
          <p style={{ color: '#666', marginBottom: '24px', lineHeight: '1.5' }}>
            {currentScreen.initialMessage.description}
          </p>
          <button
            onClick={handleDismissInitialMessage}
            style={{
              width: '100%',
              backgroundColor: '#10b981',
              color: 'white',
              padding: '16px',
              borderRadius: '12px',
              border: 'none',
              fontSize: '16px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            Got it
          </button>
        </div>
      )}

      {(!currentScreen.initialMessage || !showingInitialMessage) && currentNode && !activeNode && !tutorialComplete && (
        <button
          onClick={() => handleNodeClick(currentNode)}
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
            border: '4px solid white',
            fontSize: '24px',
            fontWeight: '700',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            zIndex: 9999,
            pointerEvents: 'auto',
            animation: 'pulse 2s infinite'
          }}
        >
          {currentNode.number}
        </button>
      )}

      {activeNode && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'white',
          borderRadius: '20px',
          padding: '32px',
          maxWidth: '400px',
          width: '90%',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          zIndex: 10000,
          pointerEvents: 'auto',
          textAlign: 'center'
        }}>
          <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '12px', color: '#000' }}>
            {activeNode.title}
          </h2>
          <p style={{ color: '#666', marginBottom: '24px', lineHeight: '1.5' }}>
            {activeNode.description}
          </p>
          <button
            onClick={handleDismissNode}
            style={{
              width: '100%',
              backgroundColor: '#10b981',
              color: 'white',
              padding: '16px',
              borderRadius: '12px',
              border: 'none',
              fontSize: '16px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            Got it
          </button>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% {
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3), 0 0 0 0 rgba(59, 130, 246, 0.7);
          }
          50% {
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3), 0 0 0 10px rgba(59, 130, 246, 0);
          }
        }
      `}</style>
    </div>
  );
}
