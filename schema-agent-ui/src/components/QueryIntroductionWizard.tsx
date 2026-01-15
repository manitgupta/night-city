
import React, { useState, useEffect } from 'react';
import Joyride, { CallBackProps, STATUS, Step, Styles } from 'react-joyride';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Code2 } from 'lucide-react';

interface IntroductionWizardProps {
  onComplete?: () => void;
}

export const QueryIntroductionWizard: React.FC<IntroductionWizardProps> = ({ onComplete }) => {
  const [run, setRun] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    // Check if user has seen the query intro
    const hasSeenIntro = localStorage.getItem('night_city_query_intro_seen');
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
    localStorage.setItem('night_city_query_intro_seen', 'true');
    if (onComplete) onComplete();
  };

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      setRun(false);
      localStorage.setItem('night_city_query_intro_seen', 'true');
      if (onComplete) onComplete();
    }
  };

  const steps: Step[] = [
    {
      target: 'body',
      content: 'Welcome to the Query Conversion Studio! Here you can convert complex SQL queries to Spanner-optimized SQL.',
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '#schema-editor-source',
      content: 'Paste your legacy SQL query here. The agent supports complex joins, subqueries, and non-standard functions.',
      placement: 'right',
    },

    {
      target: '#query-spanner-trigger',
      content: 'Connect to your Spanner instance here. This is required for validation and running the converted queries.',
    },
    {
      target: '#query-convert-button',
      content: 'Click Convert to let the agent translate your query. It will check for compatibility and optimize for Spanner\'s distributed architecture.',
    },
    {
      target: '#schema-editor-output',
      content: 'The converted Spanner SQL will appear here. You can manually edit it if needed.',
      placement: 'left',
    },
    {
      target: '#query-validate-button',
      content: 'Run the query directly on your Spanner database! This verifies it not only parses but returns the correct data.',
    },
    {
      target: '#chat-interface',
      content: 'Chat with the agent to explain the query logic, request performance tuning, or debug execution errors.',
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
              <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl shadow-xl flex items-center justify-center mb-6">
                  <Code2 className="text-white" size={32} />
                </div>

                <h2 className="text-2xl font-bold text-white mb-2">Query Conversion Studio</h2>
                <p className="text-zinc-400 mb-8 leading-relaxed">
                  Ready to translate your SQL queries to Spanner?
                  <br /><br />
                  Let's walk through the tools available for optimizing and verifying your queries.
                </p>

                <div className="flex flex-col w-full gap-3">
                  <button
                    onClick={handleStartTour}
                    className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 group"
                  >
                    <Sparkles size={18} className="group-hover:animate-pulse" />
                    Start Tour
                  </button>
                  <button
                    onClick={handleSkipTour}
                    className="w-full py-3 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl font-medium transition-colors"
                  >
                    Skip
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
          last: "Start Converting",
          skip: "Skip Tour"
        }}
      />
    </>
  );
};
