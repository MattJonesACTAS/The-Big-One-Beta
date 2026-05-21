/**
 * Interactive Tutorial Component
 * Displays clickable nodes over app screenshots to guide users
 */

import React, { useState, useEffect } from 'react';

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
  const [currentScreen, setCurrentScreen] = useState('home1');
  const [exploredElements, setExploredElements] = useState<Set<string>>(new Set());
  const [activeExplanation, setActiveExplanation] = useState<TutorialElement | null>(null);

  const screens: TutorialScreens = {
    home1: {
      title: 'CPR Timer Home Screen',
      image: 'https://github.com/MattJonesACTAS/The-Big-One-Beta/blob/main/public/tutorial/1.png?raw=true',
      nextScreen: 'addTxMenu',
      elements: [
        { id: 'totalTime', x: 19.8, y: 22, number: 1, title: 'Total Time', description: "Total time the monitor has been turned on" },
        { id: 'cprRound', x: 80.2, y: 22, number: 2, title: 'CPR Round', description: "The current round of CPR" },
        { id: 'timer', x: 50, y: 52, number: 3, title: 'Rhythm Check Timer', description: "The countdown to the next rhythm check. When the timer reaches 0:00, it pauses for 6 seconds to allow for the rhythm check, then restarts from 2:00." },
        { id: 'pause', x: 19.0, y: 4.2, number: 4, title: 'Pause Button', description: "Pause and resume the rhythm check timer" },
        { id: 'recalibrate', x: 51.0, y: 4.2, number: 5, title: 'Recalibrate Button', description: "The app estimates a rhythm check of 6 seconds. Recalibrate the timer to match reality if your rhythm checks are longer." },
        { id: 'tabs', x: 50, y: 10.75, number: 6, title: 'Checklists', description: "Quick access to checklists for the reversible causes of arrest, ROSC and Prehospital emergency anaesthesia (PHEA)" },
        { id: 'addTxBtn', x: 75, y: 95.4, number: 7, title: 'Add Treatment Button', description: "Log treatments as they happen to keep your records accurate" },
        { id: 'summaryBtn', x: 26.6, y: 95.4, number: 8, title: 'Summary Button', description: "See the running case summary at a glance" },
        { id: 'close', x: 82.2, y: 4.2, number: 9, title: 'Close Button', description: "Close the case to go to the final summary page" },
      ],
    },
    addTxMenu: {
      title: 'Add Treatment Menu',
      image: 'https://github.com/MattJonesACTAS/The-Big-One-Beta/blob/main/public/tutorial/2.png?raw=true',
      nextScreen: 'adrenalineDose',
      elements: [
        { id: 'addTxSubmenu', x: 50, y: 45.9, number: 1, title: 'Add Tx submenu', description: "After pressing the Add Tx button, you will be brought to a submenu containing multiple kinds of treatments you can log" },
      ],
    },
    adrenalineDose: {
      title: 'Adrenaline Dosing',
      image: 'https://github.com/MattJonesACTAS/The-Big-One-Beta/blob/main/public/tutorial/4.png?raw=true',
      nextScreen: 'home2',
      elements: [
        { id: 'medications', x: 53.2, y: 44.2, number: 1, title: 'Medications', description: "Each medication will bring up one or multiple age/weight based dosage options depending on the indication. Custom doses can also be added." },
      ],
    },
    home2: {
      title: 'Medication Alerts',
      image: 'https://github.com/MattJonesACTAS/The-Big-One-Beta/blob/main/public/tutorial/5.png?raw=true',
      nextScreen: 'summary',
      elements: [
        { id: 'adrenalineAlert', x: 28.4, y: 82.82, number: 1, title: 'Medication alerts', description: "When you log adrenaline or amiodarone, an alert will appear on the home screen to help you keep track of when the next dose is due." },
      ],
    },
    summary: {
      title: 'Active Case Summary',
      image: 'https://github.com/MattJonesACTAS/The-Big-One-Beta/blob/main/public/tutorial/6.png?raw=true',
      nextScreen: 'caseSummary',
      elements: [
        { id: 'pharmaSummary', x: 50, y: 50, number: 1, title: 'Medication Summary', description: "All medications logged will appear here, with an accumulative tally of the total amount of each drug given." },
        { id: 'treatmentLog', x: 50, y: 70.9, number: 2, title: 'Treatment Log', description: "Chronological record of all logged interventions. Timestamps show the exact time, the elapsed time on the monitor, and how long ago each Tx was logged." },
      ],
    },
    caseSummary: {
      title: 'Closed Case Summary',
      image: 'https://github.com/MattJonesACTAS/The-Big-One-Beta/blob/main/public/tutorial/8.png?raw=true',
      nextScreen: null,
      elements: [
        { id: 'export', x: 27, y: 14, number: 1, title: 'Export PDF', description: "Export the case summary and Tx log to a pdf, which you can then email for later review." },
        { id: 'delete', x: 73, y: 14, number: 2, title: 'Delete Case', description: "Permanently delete the case information from the app" },
        { id: 'finalStats', x: 50, y: 61.64, number: 3, title: 'Final Case Data', description: "Now the case is over, the treatment log shows times to the second, not just to the minute" },
      ],
    },
  };

  const currentScreenData = screens[currentScreen];
  const requiredElements = new Set(currentScreenData.elements.map(el => el.id));
  const allExplored = Array.from(requiredElements).every(id => exploredElements.has(id));

  // Preload all tutorial images when component mounts
  useEffect(() => {
    const imagesToPreload = [
      'https://github.com/MattJonesACTAS/The-Big-One-Beta/blob/main/public/tutorial/1.png?raw=true',
      'https://github.com/MattJonesACTAS/The-Big-One-Beta/blob/main/public/tutorial/2.png?raw=true',
      'https://github.com/MattJonesACTAS/The-Big-One-Beta/blob/main/public/tutorial/4.png?raw=true',
      'https://github.com/MattJonesACTAS/The-Big-One-Beta/blob/main/public/tutorial/5.png?raw=true',
      'https://github.com/MattJonesACTAS/The-Big-One-Beta/blob/main/public/tutorial/6.png?raw=true',
      'https://github.com/MattJonesACTAS/The-Big-One-Beta/blob/main/public/tutorial/8.png?raw=true',
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
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: '#1a1a1a',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      zIndex: 9999,
      overflowY: 'auto',
    }}>
      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          backgroundColor: '#ef4444',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          padding: '8px 16px',
          fontSize: '14px',
          fontWeight: '600',
          cursor: 'pointer',
          zIndex: 10000,
        }}
      >
        Exit Tutorial
      </button>

      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: '400px',
        backgroundColor: '#000',
        borderRadius: '20px',
        overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        <img
          src={currentScreenData.image}
          alt={currentScreenData.title}
          style={{
            width: '100%',
            height: 'auto',
            display: 'block',
          }}
        />

        {currentScreenData.elements.map((element) => {
          const isExplored = exploredElements.has(element.id);
          if (isExplored) return null;
          
          return (
            <div
              key={element.id}
              onClick={() => handleElementClick(element)}
              style={{
                position: 'absolute',
                left: `${element.x}%`,
                top: `${element.y}%`,
                width: '37px',
                height: '37px',
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
                width: '23px',
                height: '23px',
                transform: 'translate(-50%, -50%)',
                borderRadius: '50%',
                backgroundColor: '#fff',
                border: '3px solid #10b981',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '13px',
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
        `}</style>
      </div>

      {/* Next button - centered, 15% from bottom */}
      {allExplored && currentScreenData.nextScreen && (
        <button
          onClick={handleNext}
          style={{
            position: 'absolute',
            bottom: '15%',
            left: '50%',
            transform: 'translateX(-50%)',
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
          Next
        </button>
      )}

      {currentScreen === 'caseSummary' && allExplored && (
        <div style={{
          marginTop: '20px',
          padding: '16px',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          borderRadius: '12px',
          border: '2px solid #10b981',
          textAlign: 'center',
        }}>
          <div style={{ color: '#10b981', fontSize: '18px', fontWeight: '600' }}>
            ✓ Tutorial Complete
          </div>
          <div style={{ color: '#999', fontSize: '14px', marginTop: '8px' }}>
            You have explored all features!
          </div>
          <button
            onClick={onClose}
            style={{
              marginTop: '12px',
              padding: '8px 24px',
              backgroundColor: '#10b981',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            Close Tutorial
          </button>
        </div>
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
