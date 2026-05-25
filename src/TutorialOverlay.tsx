/**
 * TutorialOverlay - Sequential tutorial nodes that appear one at a time
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
  condition: (appState: any) => boolean;
  nodes: TutorialNode[];
  initialMessage?: {
    title: string;
    description: string;
  };
}

const TUTORIAL_SCREENS: TutorialScreen[] = [
  {
    condition: (state) => state.running && !state.currentOverlay,
    initialMessage: {
      title: 'Welcome to The Big One',
      description: 'This tutorial will guide you through the key features of the cardiac arrest timer. Click each numbered circle as it appears to learn more.'
    },
    nodes: [
      {
        id: 'totalTime',
        x: 19.8,
        y: 22,
        number: 1,
        title: 'Total Time',
        description: 'Total time the monitor has been turned on'
      },
      {
        id: 'cprRound',
        x: 80.2,
        y: 22,
        number: 2,
        title: 'CPR Round',
        description: 'The current round of CPR'
      },
      {
        id: 'timer',
        x: 50,
        y: 52,
        number: 3,
        title: 'Rhythm Check Timer',
        description: 'The countdown to the next rhythm check. When the timer reaches 0:00, it pauses for 6 seconds to allow for the rhythm check, then restarts from 2:00.'
      },
      {
        id: 'pause',
        x: 19.0,
        y: 4.2,
        number: 4,
        title: 'Pause Button',
        description: 'Pause and resume the rhythm check timer'
      },
      {
        id: 'recalibrate',
        x: 51.0,
        y: 4.2,
        number: 5,
        title: 'Recalibrate Button',
        description: 'The app estimates a rhythm check of 6 seconds. Recalibrate the timer to match reality if your rhythm checks are longer.'
      },
      {
        id: 'tabs',
        x: 50,
        y: 10.75,
        number: 6,
        title: 'Checklists',
        description: 'Quick access to checklists for the reversible causes of arrest, ROSC and Prehospital emergency anaesthesia (PHEA)'
      },
      {
        id: 'addTxBtn',
        x: 75,
        y: 95.4,
        number: 7,
        title: 'Add Treatment Button',
        description: 'Tap here to log treatments and interventions during the arrest'
      }
    ]
  },
  {
    condition: (state) => state.currentOverlay === 'treatment',
    nodes: [
      {
        id: 'addTxSubmenu',
        x: 50,
        y: 45.9,
        number: 1,
        title: 'Add Tx submenu',
        description: 'After pressing the Add Tx button, you will be brought to a submenu containing multiple kinds of treatments you can log'
      }
    ]
  }
];

interface Props {
  appState: any;
  onExit: () => void;
  onRestart: () => void;
}

export default function TutorialOverlay({ appState, onExit, onRestart }: Props) {
  const [currentNodeIndex, setCurrentNodeIndex] = useState(0);
  const [activeNode, setActiveNode] = useState<TutorialNode | null>(null);
  const [showInitialMessage, setShowInitialMessage] = useState<string | null>(null);
  const [currentScreenId, setCurrentScreenId] = useState<number>(-1);
  const [previousOverlay, setPreviousOverlay] = useState<string | null>(null);

  // Detect screen changes
  useEffect(() => {
    const matchedScreenIndex = TUTORIAL_SCREENS.findIndex(screen => 
      screen.condition(appState)
    );
    
    if (matchedScreenIndex !== currentScreenId) {
      setCurrentScreenId(matchedScreenIndex);
      setActiveNode(null);
      setCurrentNodeIndex(0);
      
      const screen = TUTORIAL_SCREENS[matchedScreenIndex];
      if (screen?.initialMessage) {
        setShowInitialMessage(`screen-${matchedScreenIndex}`);
      }
    }
  }, [appState, currentScreenId]);

  // Detect if Reversibles/ROSC/PHEA buttons were clicked - restart tutorial
  useEffect(() => {
    const currentOverlay = appState.currentOverlay;
    
    if (currentOverlay !== previousOverlay) {
      if (currentOverlay === 'reversibles' || currentOverlay === 'rosc' || currentOverlay === 'phea') {
        onRestart();
      }
      setPreviousOverlay(currentOverlay);
    }
  }, [appState.currentOverlay, previousOverlay, onRestart]);

  const currentScreen = currentScreenId >= 0 ? TUTORIAL_SCREENS[currentScreenId] : null;
  if (!currentScreen) return null;

  const currentNode = currentScreen.nodes[currentNodeIndex];
  const currentMessageKey = `screen-${currentScreenId}`;
  const showingInitialMessage = showInitialMessage === currentMessageKey;

  const handleNodeClick = (node: TutorialNode) => {
    setActiveNode(node);
  };

  const handleDismissNode = () => {
    setActiveNode(null);
    if (currentNodeIndex < currentScreen.nodes.length - 1) {
      setCurrentNodeIndex(prev => prev + 1);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9998,
      pointerEvents: 'none'
    }}>
      {/* Exit button */}
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

      {/* Initial message */}
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
          pointerEvents: 'auto'
        }}>
          <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '12px', color: '#000' }}>
            {currentScreen.initialMessage.title}
          </h2>
          <p style={{ color: '#666', marginBottom: '24px', lineHeight: '1.5' }}>
            {currentScreen.initialMessage.description}
          </p>
          <button
            onClick={() => setShowInitialMessage(null)}
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

      {/* Current node (only show one at a time) */}
      {(!currentScreen.initialMessage || !showingInitialMessage) && currentNode && !activeNode && (
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

      {/* Node info box */}
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
          pointerEvents: 'auto'
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
