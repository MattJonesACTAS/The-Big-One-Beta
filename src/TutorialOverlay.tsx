/**
 * TutorialOverlay - Adds tutorial guidance on top of the REAL app
 * Reacts to app state changes - no "Next" buttons needed!
 */

import React, { useState, useEffect } from 'react';

interface TutorialNode {
  id: string;
  x: number; // Percentage from left
  y: number; // Percentage from top
  number: number;
  title: string;
  description: string;
}

interface TutorialScreen {
  // Condition to match this screen
  condition: (appState: any) => boolean;
  nodes: TutorialNode[];
  // Optional: message to show when entering this screen
  initialMessage?: {
    title: string;
    description: string;
  };
}

// Define tutorial screens based on app state
const TUTORIAL_SCREENS: TutorialScreen[] = [
  {
    // Home screen - timer running, no overlay
    condition: (state) => state.running && !state.currentOverlay,
    initialMessage: {
      title: 'Welcome to The Big One',
      description: 'This tutorial will walk you through the key features. Click the numbered circles to learn about each feature.'
    },
    nodes: [
      {
        id: 'timer',
        x: 50,
        y: 40,
        number: 1,
        title: 'Central Timer',
        description: 'This is your rhythm check countdown. It counts down from 2 minutes and reminds you when to pause CPR and check for a shockable rhythm.'
      },
      {
        id: 'add_tx',
        x: 75,
        y: 90,
        number: 2,
        title: 'Add Treatment Button',
        description: 'Tap the actual Add Tx button below to open the treatment menu and continue the tutorial.'
      }
    ]
  },
  {
    // Treatment menu opened
    condition: (state) => state.currentOverlay === 'treatment',
    nodes: [
      {
        id: 'medications',
        x: 50,
        y: 45,
        number: 1,
        title: 'Treatment Menu',
        description: 'Here you can log all treatments and interventions. Tap on "Adrenaline push" to see how medication logging works.'
      }
    ]
  }
];

interface Props {
  appState: any; // The actual app state
  onExit: () => void;
}

export default function TutorialOverlay({ appState, onExit }: Props) {
  const [exploredNodes, setExploredNodes] = useState<Set<string>>(new Set());
  const [activeNode, setActiveNode] = useState<TutorialNode | null>(null);
  const [showInitialMessage, setShowInitialMessage] = useState<string | null>(null);
  const [currentScreenId, setCurrentScreenId] = useState<number>(-1);

  // Detect which tutorial screen we're on based on app state
  useEffect(() => {
    const matchedScreenIndex = TUTORIAL_SCREENS.findIndex(screen => 
      screen.condition(appState)
    );
    
    if (matchedScreenIndex !== currentScreenId) {
      setCurrentScreenId(matchedScreenIndex);
      setActiveNode(null); // Close any open node info
      
      // Show initial message if this screen has one
      const screen = TUTORIAL_SCREENS[matchedScreenIndex];
      if (screen?.initialMessage) {
        setShowInitialMessage(`screen-${matchedScreenIndex}`);
      }
    }
  }, [appState, currentScreenId]);

  const currentScreen = currentScreenId >= 0 ? TUTORIAL_SCREENS[currentScreenId] : null;
  if (!currentScreen) return null;

  const handleNodeClick = (node: TutorialNode) => {
    setActiveNode(node);
    setExploredNodes(prev => new Set([...prev, node.id]));
  };

  const currentMessageKey = `screen-${currentScreenId}`;
  const showingInitialMessage = showInitialMessage === currentMessageKey;

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

      {/* Numbered nodes */}
      {(!currentScreen.initialMessage || !showingInitialMessage) && currentScreen.nodes.map(node => {
        const isExplored = exploredNodes.has(node.id);
        
        return (
          <button
            key={node.id}
            onClick={() => handleNodeClick(node)}
            style={{
              position: 'absolute',
              left: `${node.x}%`,
              top: `${node.y}%`,
              transform: 'translate(-50%, -50%)',
              width: '50px',
              height: '50px',
              borderRadius: '50%',
              backgroundColor: isExplored ? '#10b981' : '#3b82f6',
              color: 'white',
              border: '4px solid white',
              fontSize: '24px',
              fontWeight: '700',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
              zIndex: 9999,
              pointerEvents: 'auto',
              animation: isExplored ? 'none' : 'pulse 2s infinite'
            }}
          >
            {node.number}
          </button>
        );
      })}

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
            onClick={() => setActiveNode(null)}
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
