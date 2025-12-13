
import React, { useState, useEffect } from 'react';
import Joyride, { CallBackProps, STATUS, Step, Styles } from 'react-joyride';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Map } from 'lucide-react';

interface IntroductionWizardProps {
  onComplete?: () => void;
}

export const IntroductionWizard: React.FC<IntroductionWizardProps> = ({ onComplete }) => {
  const [run, setRun] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    // Check if user has seen the intro
    const hasSeenIntro = localStorage.getItem('night_city_intro_seen');
    if (!hasSeenIntro) {
      setShowWelcome(true);
    }
  }, []);

  const handleStartTour = () => {
    setShowWelcome(false);
    setRun(true);
  };

  const handleSkipTour = () => {
    setShowWelcome(false);
    localStorage.setItem('night_city_intro_seen', 'true');
    if (onComplete) onComplete();
  };

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      setRun(false);
      localStorage.setItem('night_city_intro_seen', 'true');
      if (onComplete) onComplete();
    }
  };

  const steps: Step[] = [
    {
      target: 'body',
      content: 'Welcome to Night City! This tool helps you convert SQL definitions to Google Cloud Spanner seamlessly. Let\'s take a quick tour.',
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '#schema-editor-source',
      content: 'Here is where you paste your existing SQL (MySQL, PostgreSQL, or Oracle). You can also lock it to prevent accidental edits.',
      placement: 'right',
    },
    {
      target: '#dialect-dropdown',
      content: 'Make sure to select the correct source dialect so the agent understands your schema nuances.',
    },
    {
      target: '#convert-button',
      content: 'Click here to summon the agent! It will convert your schema to Spanner DDL, applying best practices automatically.',
    },
    {
      target: '#schema-editor-output',
      content: 'The converted Spanner DDL will appear here. You can edit it directly if needed.',
      placement: 'left',
    },
    {
      target: '#validate-button',
      content: 'Use this to verify your schema. You must successfully validate the schema before you can migrate it to Spanner. If issues are found, the agent will help you fix them.',
    },
    {
      target: '#migrate-button',
      content: 'Once validation passes, this button becomes enabled. Click it to create a real Spanner database and apply your schema directly!',
    },
    {
      target: '#chat-interface',
      content: 'Need help? Chat with the agent here. The agent uses this space to explain its actions and provide insights. You can also highlight portions of the schema and ask the agent to explain it.',
      placement: 'left',
    },
  ];

  const tooltipStyles: Partial<Styles> = {
    options: {
      arrowColor: '#18181b', // zinc-950
      backgroundColor: '#18181b', // zinc-950
      overlayColor: 'rgba(0, 0, 0, 0.6)',
      primaryColor: '#6366f1', // indigo-500
      textColor: '#e4e4e7', // zinc-200
      zIndex: 1000,
    },
    tooltip: {
      borderRadius: '0.75rem',
      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04), 0 0 0 1px rgba(255, 255, 255, 0.1)',
      fontSize: '0.9rem',
      padding: '1.5rem',
    },
    buttonClose: {
      color: '#a1a1aa', // zinc-400
    },
    buttonNext: {
      backgroundColor: '#4f46e5', // indigo-600
      borderRadius: '0.5rem',
      color: '#fff',
      fontSize: '0.875rem',
      fontWeight: 600,
      padding: '0.5rem 1rem',
      outline: 'none',
      border: 'none',
    },
    buttonBack: {
      color: '#a1a1aa', // zinc-400
      marginRight: '1rem',
    },
    tooltipTitle: {
      color: '#818cf8', // indigo-400
      fontSize: '1.1rem',
      fontWeight: 'bold',
      marginBottom: '0.5rem',
    },
  };

  return (
    <>
      {/* Welcome Modal */}
      <AnimatePresence>
        {showWelcome && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={handleSkipTour}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-8 max-w-md w-full overflow-hidden"
            >
              {/* Decorative background effects */}
              <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-xl flex items-center justify-center mb-6">
                  <Map className="text-white" size={32} />
                </div>

                <h2 className="text-2xl font-bold text-white mb-2">Welcome to Night City</h2>
                <p className="text-zinc-400 mb-8 leading-relaxed">
                  Your intelligent companion for converting and optimizing databases for Google Cloud Spanner.
                  <br /><br />
                  Would you like a quick tour of the features?
                </p>

                <div className="flex flex-col w-full gap-3">
                  <button
                    onClick={handleStartTour}
                    className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 group"
                  >
                    <Sparkles size={18} className="group-hover:animate-pulse" />
                    Yes, show me around
                  </button>
                  <button
                    onClick={handleSkipTour}
                    className="w-full py-3 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl font-medium transition-colors"
                  >
                    No thanks, I know my way
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <Joyride
        steps={steps}
        run={run}
        continuous
        showProgress
        showSkipButton
        disableOverlayClose={true}
        spotlightPadding={4}
        styles={tooltipStyles}
        callback={handleJoyrideCallback}
        floaterProps={{
          disableAnimation: true,
        }}
        locale={{
          last: "Finish",
          skip: "Skip Tour"
        }}
      />
    </>
  );
};
