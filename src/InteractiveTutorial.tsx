/**
 * Interactive Tutorial Component
 * Displays clickable nodes over app screenshots to guide users
 */

import React, { useState, useEffect } from 'react';

// Static Home Screen Component - Replica of actual app home screen
function StaticHomeScreen() {
  return (
    <div style={{ 
      height: '100%',
      width: '100%',
      backgroundColor: '#f5f5f5',
      display: 'flex',
      flexDirection: 'column',
      padding: '16px',
      maxWidth: '672px',
      margin: '0 auto',
      overflow: 'hidden',
      position: 'relative'
    }}>
      {/* Top Controls */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr 1fr', 
        gap: '12px',
        marginBottom: '16px',
        flexShrink: 0
      }}>
        <button style={{
          backgroundColor: '#e5e5e5',
          padding: '16px',
          borderRadius: '12px',
          fontSize: '14px',
          fontWeight: '700',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          border: 'none',
          cursor: 'default'
        }}>
          Pause
        </button>
        <button style={{
          backgroundColor: '#e5e5e5',
          padding: '16px',
          borderRadius: '12px',
          fontSize: '14px',
          fontWeight: '700',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          border: 'none',
          cursor: 'default'
        }}>
          Recalibrate
        </button>
        <button style={{
          backgroundColor: '#e5e5e5',
          padding: '16px',
          borderRadius: '12px',
          fontSize: '14px',
          fontWeight: '700',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          border: 'none',
          cursor: 'default'
        }}>
          Close
        </button>
      </div>

      {/* Top Quick Tools */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: '12px',
        marginBottom: '16px',
        flexShrink: 0
      }}>
        <button style={{
          padding: '24px',
          borderRadius: '12px',
          fontSize: '20px',
          fontWeight: '700',
          backgroundColor: '#dbeafe',
          color: '#1d4ed8',
          border: 'none',
          cursor: 'default'
        }}>
          Reversibles
        </button>
        <button style={{
          padding: '24px',
          borderRadius: '12px',
          fontSize: '20px',
          fontWeight: '700',
          backgroundColor: '#fed7aa',
          color: '#c2410c',
          border: 'none',
          cursor: 'default'
        }}>
          ROSC
        </button>
        <button style={{
          padding: '24px',
          borderRadius: '12px',
          fontSize: '20px',
          fontWeight: '700',
          backgroundColor: '#e9d5ff',
          color: '#7e22ce',
          border: 'none',
          cursor: 'default'
        }}>
          PHEA
        </button>
      </div>

      {/* Main Center Display */}
      <div style={{
        flex: 1,
        backgroundColor: '#ffffff',
        border: '4px solid #10b981',
        borderRadius: '24px',
        position: 'relative',
        overflow: 'hidden',
        minHeight: 0
      }}>
        <div style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '16px 12px',
          paddingTop: '16px',
          paddingBottom: '12px',
          position: 'relative'
        }}>
          {/* Corner Cards */}
          <div style={{
            position: 'absolute',
            top: '16px',
            left: '16px',
            right: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            gap: '16px'
          }}>
            <div style={{
              backgroundColor: '#f5f5f5',
              border: '1px solid #f5f5f5',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              borderRadius: '16px',
              padding: '28px 32px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              minWidth: '140px'
            }}>
              <span style={{
                fontSize: '12px',
                fontWeight: '700',
                color: '#171717',
                letterSpacing: '0.1em',
                marginBottom: '12px',
                textTransform: 'uppercase'
              }}>Total time</span>
              <span style={{
                fontSize: '43px',
                fontWeight: '700',
                color: '#a3a3a3',
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1
              }}>1:28</span>
            </div>
            <div style={{
              backgroundColor: '#f5f5f5',
              border: '1px solid #f5f5f5',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              borderRadius: '16px',
              padding: '28px 32px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              minWidth: '140px'
            }}>
              <span style={{
                fontSize: '12px',
                fontWeight: '700',
                color: '#171717',
                letterSpacing: '0.1em',
                marginBottom: '12px',
                textTransform: 'uppercase'
              }}>CPR round</span>
              <span style={{
                fontSize: '43px',
                fontWeight: '700',
                color: '#a3a3a3',
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1
              }}>1</span>
            </div>
          </div>

          {/* Rhythm Check Timer */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            paddingTop: '64px'
          }}>
            <div style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '320px',
              height: '320px'
            }}>
              <svg style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                transform: 'rotate(-90deg)'
              }} viewBox="0 0 300 300">
                <circle
                  cx="150"
                  cy="150"
                  r="140"
                  fill="none"
                  stroke="#fafafa"
                  strokeWidth="6"
                />
                <circle
                  cx="150"
                  cy="150"
                  r="140"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray="879.64"
                  strokeDashoffset="454.77"
                />
              </svg>
              
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                zIndex: 10,
                transform: 'translateY(16px)'
              }}>
                <div style={{
                  fontSize: '120px',
                  fontWeight: '700',
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: '-0.05em',
                  lineHeight: 1,
                  color: '#171717'
                }}>
                  0:58
                </div>
                <div style={{
                  fontSize: '18px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  fontWeight: '700',
                  marginTop: '32px',
                  color: '#a3a3a3'
                }}>
                  Rhythm Check
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Main Controls */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '16px',
        marginTop: '16px',
        flexShrink: 0
      }}>
        <button style={{
          padding: '20px',
          borderRadius: '16px',
          fontSize: '20px',
          fontWeight: '700',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          backgroundColor: '#10b981',
          color: '#ffffff',
          border: 'none',
          cursor: 'default'
        }}>
          Summary
        </button>
        <button style={{
          padding: '20px',
          borderRadius: '16px',
          fontSize: '20px',
          fontWeight: '700',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          backgroundColor: '#10b981',
          color: '#ffffff',
          border: 'none',
          cursor: 'default'
        }}>
          + Add Tx
        </button>
      </div>
    </div>
  );
}

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
  const [currentScreen, setCurrentScreen] = useState('intro1');
  const [exploredElements, setExploredElements] = useState<Set<string>>(new Set());
  const [activeExplanation, setActiveExplanation] = useState<TutorialElement | null>(null);

  const screens: TutorialScreens = {
    intro1: {
      title: 'Welcome to The Big One',
      image: 'https://github.com/MattJonesACTAS/The-Big-One/blob/main/public/tutorial/1.png?raw=true',
      nextScreen: 'intro2',
      elements: [],
    },
    intro2: {
      title: 'Getting Started',
      image: 'https://github.com/MattJonesACTAS/The-Big-One/blob/main/public/tutorial/1.png?raw=true',
      nextScreen: 'home1',
      elements: [],
    },
    home1: {
      title: 'CPR Timer Home Screen',
      image: 'https://github.com/MattJonesACTAS/The-Big-One/blob/main/public/tutorial/1.png?raw=true',
      nextScreen: 'addTxMenu',
      elements: [
        { id: 'totalTime', x: 19.8, y: 22, number: 1, title: 'Total Time', description: "Total time the monitor has been turned on" },
        { id: 'cprRound', x: 80.2, y: 22, number: 2, title: 'CPR Round', description: "The current round of CPR" },
        { id: 'timer', x: 50, y: 52, number: 3, title: 'Rhythm Check Timer', description: "The countdown to the next rhythm check. When the timer reaches 0:00, it pauses for 6 seconds to allow for the rhythm check, then restarts from 2:00." },
        { id: 'pause', x: 19.0, y: 4.2, number: 4, title: 'Pause Button', description: "Pause and resume the rhythm check timer" },
        { id: 'recalibrate', x: 51.0, y: 4.2, number: 5, title: 'Recalibrate Button', description: "The app estimates a rhythm check of 6 seconds. Recalibrate the timer to match reality if your rhythm checks are longer." },
        { id: 'tabs', x: 50, y: 10.75, number: 6, title: 'Checklists', description: "Quick access to checklists for the reversible causes of arrest, ROSC and Prehospital emergency anaesthesia (PHEA)" },
        { id: 'addTxBtn', x: 75, y: 95.4, number: 7, title: 'Add Treatment Button', description: "Tap here to log treatments and interventions during the arrest" },
      ],
    },
    addTxMenu: {
      title: 'Add Treatment Menu',
      image: 'https://github.com/MattJonesACTAS/The-Big-One/blob/main/public/tutorial/2.png?raw=true',
      nextScreen: 'adrenalineDose',
      elements: [
        { id: 'addTxSubmenu', x: 50, y: 45.9, number: 1, title: 'Add Tx submenu', description: "After pressing the Add Tx button, you will be brought to a submenu containing multiple kinds of treatments you can log" },
      ],
    },
    adrenalineDose: {
      title: 'Adrenaline Dosing',
      image: 'https://github.com/MattJonesACTAS/The-Big-One/blob/main/public/tutorial/4.png?raw=true',
      nextScreen: 'home2',
      elements: [
        { id: 'medications', x: 53.2, y: 44.2, number: 1, title: 'Medications', description: "Each medication will bring up one or multiple age/weight based dosage options depending on the indication. Custom doses can also be added. Let's log adrenaline and amiodarone." },
      ],
    },
    home2: {
      title: 'Medication Alerts',
      image: 'https://github.com/MattJonesACTAS/The-Big-One/blob/main/public/tutorial/5.png?raw=true',
      nextScreen: 'home2_summary',
      elements: [
        { id: 'adrenalineAlert', x: 28.4, y: 82.82, number: 1, title: 'Medication alerts', description: "When you log adrenaline or amiodarone, an alert will appear on the home screen to help you keep track of when the next dose is due." },
      ],
    },
    home2_summary: {
      title: 'Summary Navigation',
      image: 'https://github.com/MattJonesACTAS/The-Big-One/blob/main/public/tutorial/5.png?raw=true',
      nextScreen: 'summary',
      elements: [
        { id: 'summaryBtn', x: 26.6, y: 95.4, number: 1, title: 'Summary Button', description: "Next, let's have a look at the running case summary page" },
      ],
    },
    summary: {
      title: 'Active Case Summary',
      image: 'https://github.com/MattJonesACTAS/The-Big-One/blob/main/public/tutorial/6.png?raw=true',
      nextScreen: 'home2_close',
      elements: [
        { id: 'pharmaSummary', x: 50, y: 50, number: 1, title: 'Medication Summary', description: "All medications logged will appear here, with an accumulative tally of the total amount of each drug given." },
        { id: 'treatmentLog', x: 50, y: 70.9, number: 2, title: 'Treatment Log', description: "Chronological record of all logged interventions. Timestamps show the exact time, the elapsed time on the monitor, and how long ago each Tx was logged." },
      ],
    },
    home2_close: {
      title: 'Close Case Navigation',
      image: 'https://github.com/MattJonesACTAS/The-Big-One/blob/main/public/tutorial/5.png?raw=true',
      nextScreen: 'caseSummary',
      elements: [
        { id: 'close', x: 82.2, y: 4.2, number: 1, title: 'Close Button', description: "Let's say we've either stopped resuscitative efforts or we've handed our patient over at hospital. We can now close the case." },
      ],
    },
    caseSummary: {
      title: 'Closed Case Summary',
      image: 'https://github.com/MattJonesACTAS/The-Big-One/blob/main/public/tutorial/8.png?raw=true',
      nextScreen: null,
      elements: [
        { id: 'finalStats', x: 50, y: 61.64, number: 1, title: 'Final Case Data', description: "Now the case is over, the treatment log shows times to the second, not just to the minute" },
        { id: 'export', x: 27, y: 14, number: 2, title: 'Export PDF', description: "Export the case summary and Tx log to a pdf, which you can then email for later review." },
        { id: 'delete', x: 73, y: 14, number: 3, title: 'Delete Case', description: "Permanently delete the case information from the app" },
      ],
    },
  };

  const currentScreenData = screens[currentScreen];
  const requiredElements = new Set(currentScreenData.elements.map(el => el.id));
  const allExplored = Array.from(requiredElements).every(id => exploredElements.has(id));

  // Preload all tutorial images when component mounts
  useEffect(() => {
    const imagesToPreload = [
      'https://github.com/MattJonesACTAS/The-Big-One/blob/main/public/tutorial/1.png?raw=true',
      'https://github.com/MattJonesACTAS/The-Big-One/blob/main/public/tutorial/2.png?raw=true',
      'https://github.com/MattJonesACTAS/The-Big-One/blob/main/public/tutorial/4.png?raw=true',
      'https://github.com/MattJonesACTAS/The-Big-One/blob/main/public/tutorial/5.png?raw=true',
      'https://github.com/MattJonesACTAS/The-Big-One/blob/main/public/tutorial/6.png?raw=true',
      'https://github.com/MattJonesACTAS/The-Big-One/blob/main/public/tutorial/8.png?raw=true',
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
      setExploredElements(new Set()); // Reset for next screen
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
      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: '400px',
        backgroundColor: '#000',
        borderRadius: '20px',
        overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        {/* Exit button for testing */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            zIndex: 10001,
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            fontSize: '20px',
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ×
        </button>

        {/* Render static component for home1, otherwise show screenshot */}
        {currentScreen === 'home1' ? (
          <div style={{ aspectRatio: '9 / 19.5', width: '100%' }}>
            <StaticHomeScreen />
          </div>
        ) : (
          <img
            src={currentScreenData.image}
            alt={currentScreenData.title}
            style={{
              width: '100%',
              height: 'auto',
              display: 'block',
            }}
          />
        )}

        {/* Intro message boxes for intro1 and intro2 screens */}
        {(currentScreen === 'intro1' || currentScreen === 'intro2') && (
          <div style={{
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
          }}>
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '320px',
              width: '85%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            }}>
              <div style={{
                color: '#1a1a1a',
                fontSize: '16px',
                lineHeight: '1.6',
                textAlign: 'center',
                marginBottom: '20px',
              }}>
                {currentScreen === 'intro1' && 
                  "The Big One is a tool that you can use when acting as the team leader during cardiac arrest cases to help you stay on top of everything."
                }
                {currentScreen === 'intro2' && 
                  "On opening the app, you'll need to enter some times from the monitor and details about the patient. You'll then be brought to the home screen."
                }
              </div>
              
              {/* Next button at bottom of box */}
              <button
                onClick={handleNext}
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: '#10b981',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
                }}
              >
                Next
              </button>
            </div>
          </div>
        )}

        {currentScreenData.elements.map((element) => {
          const isExplored = exploredElements.has(element.id);
          if (isExplored) return null;
          
          // Progressive reveal: only show the next node in sequence
          const exploredNumbers = currentScreenData.elements
            .filter(el => exploredElements.has(el.id))
            .map(el => el.number);
          const nextNumber = exploredNumbers.length > 0 
            ? Math.max(...exploredNumbers) + 1 
            : 1;
          
          // Only render this node if it's the next in sequence
          if (element.number !== nextNumber) return null;
          
          return (
            <div
              key={element.id}
              onClick={() => handleElementClick(element)}
              style={{
                position: 'absolute',
                left: `${element.x}%`,
                top: `${element.y}%`,
                width: '43px',
                height: '43px',
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
                width: '26px',
                height: '26px',
                transform: 'translate(-50%, -50%)',
                borderRadius: '50%',
                backgroundColor: '#fff',
                border: '3px solid #10b981',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '15px',
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
          @keyframes buttonPulse {
            0%, 100% {
              transform: translateX(-50%) scale(1);
              box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
            }
            50% {
              transform: translateX(-50%) scale(1.05);
              box-shadow: 0 6px 20px rgba(16, 185, 129, 0.5);
            }
          }
        `}</style>
      </div>

      {/* Next button - centered bottom with pulsing animation (for non-intro screens) */}
      {/* Special case for home1: show exact replica of Add Tx button */}
      {allExplored && currentScreenData.nextScreen && currentScreen === 'home1' && (
        <button
          onClick={handleNext}
          style={{
            position: 'absolute',
            bottom: 'calc(3.5% + 5px)',
            right: 'calc(5% + 15px)',
            width: '41.8%',
            padding: '14.4px 20px',
            backgroundColor: '#10b981',
            color: '#fff',
            border: 'none',
            borderRadius: '16px',
            fontSize: '18px',
            fontWeight: '700',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            animation: 'buttonPulse 2s infinite',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Add Tx
        </button>
      )}
      
      {/* Special case for home2_summary: show exact replica of Summary button */}
      {allExplored && currentScreenData.nextScreen && currentScreen === 'home2_summary' && (
        <button
          onClick={handleNext}
          style={{
            position: 'absolute',
            bottom: 'calc(3.5% + 5px)',
            left: 'calc(5% + 15px)',
            width: '41.8%',
            padding: '14.4px 20px',
            backgroundColor: '#10b981',
            color: '#fff',
            border: 'none',
            borderRadius: '16px',
            fontSize: '18px',
            fontWeight: '700',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            animation: 'buttonPulse 2s infinite',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
          Summary
        </button>
      )}
      
      {/* Regular Next button for other screens */}
      {allExplored && currentScreenData.nextScreen && currentScreen !== 'intro1' && currentScreen !== 'intro2' && currentScreen !== 'home1' && currentScreen !== 'home2_summary' && (
        <button
          onClick={handleNext}
          style={{
            position: 'absolute',
            bottom: '15%',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '12px 36px',
            backgroundColor: '#10b981',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '17px',
            fontWeight: '600',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
            animation: 'buttonPulse 2s infinite',
          }}
        >
          Next
        </button>
      )}

      {/* Finish button - appears on final screen in top-right */}
      {currentScreen === 'caseSummary' && allExplored && (
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
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
          Finish
        </button>
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
