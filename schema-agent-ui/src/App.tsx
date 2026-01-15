import { useState } from "react";
import { LandingPage } from "./components/LandingPage";
import { SchemaConverter } from "./components/SchemaConverter";
import { QueryConverter } from "./components/QueryConverter";

type AppMode = 'landing' | 'schema' | 'query';

function App() {
  const [currentMode, setCurrentMode] = useState<AppMode>('landing');

  return (
    <>
      {currentMode === 'landing' && (
        <LandingPage onSelectMode={setCurrentMode} />
      )}

      {currentMode === 'schema' && (
        <SchemaConverter
          onBack={() => setCurrentMode('landing')}
          onNavigateToQuery={() => setCurrentMode('query')}
        />
      )}

      {currentMode === 'query' && (
        <div className="relative">
          <button 
            onClick={() => setCurrentMode('landing')}
            className="absolute top-4 left-4 z-50 p-2 bg-zinc-900/50 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors backdrop-blur-md border border-zinc-800"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></svg>
          </button>
          <QueryConverter />
        </div>
      )}
    </>
  );
}

export default App;
