
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { SchemaEditor } from "./components/SchemaEditor";
import { ChatInterface } from "./components/ChatInterface";
import { useState } from "react";
import { Database, Lock, Unlock, ArrowRight, Wand2, ChevronDown } from "lucide-react";
import { useStore } from "./store";

const SOURCE_DIALECTS = [
  { id: 'mysql', name: 'MySQL' },
  { id: 'postgres', name: 'PostgreSQL' },
  { id: 'oracle', name: 'Oracle' }
];

function App() {
  const [isSourceLocked, setIsSourceLocked] = useState(false); // Default to unlocked so user can paste
  const [isConverting, setIsConverting] = useState(false);
  const [showDialectDropdown, setShowDialectDropdown] = useState(false);
  const [sourceDialect, setSourceDialect] = useState<string | null>(null);
  const { setOutputCode, addMessage, setAgentTyping, sourceCode } = useStore();

  const handleConvert = () => {
    if (!sourceDialect) return;

    setIsConverting(true);
    setAgentTyping(true);
    setIsSourceLocked(true); // Auto-lock on convert

    // Simulate conversion delay
    setTimeout(() => {
      setIsConverting(false);
      setAgentTyping(false);
      setOutputCode(`-- Converted from ${SOURCE_DIALECTS.find(d => d.id === sourceDialect)?.name }
CREATE TABLE Users( 
  Id STRING(36) NOT NULL,
  Username STRING(50) NOT NULL,
  CreatedAt TIMESTAMP NOT NULL OPTIONS(allow_commit_timestamp = true),
) PRIMARY KEY(Id);

--Note: SERIAL was converted to STRING(36)(UUID) as per Spanner best practices.`);
      addMessage({
        id: Date.now().toString(),
        role: 'agent',
        content: "I've converted your schema to Google Cloud Spanner DDL! I applied best practices for Primary Keys and Timestamps. You can check the Diff View now."
      });
    }, 2000);
  };

  return (
    <div className="h-screen w-full bg-zinc-950 text-zinc-200 flex flex-col font-sans selection:bg-indigo-500/30">
      {/* Header */}
      <header className="h-14 border-b border-zinc-800 bg-zinc-950/50 backdrop-blur-xl flex items-center justify-between px-6 shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow-lg shadow-indigo-500/20">
            <Database size={18} className="text-white" />
          </div>
          <h1 className="font-bold text-lg bg-clip-text text-transparent bg-gradient-to-r from-zinc-100 to-zinc-400">
            Schema Conversion Agent
          </h1>
        </div>
        <div className="flex items-center gap-4 text-sm font-medium text-zinc-500">
          <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Agent Active
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden p-2">
        <PanelGroup direction="horizontal" className="h-full gap-2">

          {/* Left Panel: Source */}
          <Panel defaultSize={30} minSize={20} className="flex flex-col">
            <SchemaEditor
              title={sourceDialect ? `Source Schema(${SOURCE_DIALECTS.find(d => d.id === sourceDialect)?.name})` : "Source Schema"}
              type="source"
              readOnly={isSourceLocked}
              showHint={true}
              headerActions={
                <div className="flex items-center gap-2">
                  {/* Dialect Dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => setShowDialectDropdown(!showDialectDropdown)}
                      className={`flex items - center gap - 2 px - 2.5 py - 1 rounded text - xs font - medium transition - all border ${sourceDialect
                          ? "bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700"
                          : "bg-indigo-500/10 border-indigo-500/50 text-indigo-400 hover:bg-indigo-500/20 animate-pulse"
                        } `}
                    >
                      {sourceDialect ? SOURCE_DIALECTS.find(d => d.id === sourceDialect)?.name : "Select Dialect"}
                      <ChevronDown size={12} className={`transition - transform duration - 200 ${showDialectDropdown ? "rotate-180" : ""} `} />
                    </button>

                    {showDialectDropdown && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setShowDialectDropdown(false)}
                        />
                        <div className="absolute top-full mt-2 left-0 w-32 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl overflow-hidden z-50 flex flex-col py-1 animate-in fade-in zoom-in-95 duration-100 origin-top-left">
                          {SOURCE_DIALECTS.map(dialect => (
                            <button
                              key={dialect.id}
                              onClick={() => {
                                setSourceDialect(dialect.id);
                                setShowDialectDropdown(false);
                              }}
                              className={`text - left px - 3 py - 2 text - xs transition - colors ${sourceDialect === dialect.id
                                  ? "bg-indigo-500/10 text-indigo-400 font-medium"
                                  : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                                }`}
                            >
                              {dialect.name}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  <div className="w-px h-3 bg-zinc-800 mx-1" />

                  <button
                    onClick={() => setIsSourceLocked(!isSourceLocked)}
                    className={`flex items - center justify - center w - 6 h - 6 rounded transition - colors ${isSourceLocked
                        ? "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800" 
                        : "text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20"
                      }`}
                    title={isSourceLocked ? "Unlock to edit" : "Lock to prevent edits"}
                  >
                    {isSourceLocked ? <Lock size={12} /> : <Unlock size={12} />}
                  </button>

                  {sourceCode.trim() && (
                    <button
                      onClick={handleConvert}
                      disabled={!sourceDialect || isConverting}
                      className={`flex items - center gap - 1.5 px - 3 py - 1 rounded - full text - xs font - medium shadow - lg transition - all duration - 300 ${sourceDialect
                          ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20 hover:scale-105 active:scale-95 cursor-pointer"
                          : "bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-50"
                        } ${isConverting ? "opacity-75 cursor-wait" : ""}`}
                    >
                      <Wand2 size={12} className={isConverting ? "animate-spin" : ""} />
                      {isConverting ? "Converting..." : "Convert"}
                    </button>
                  )}
                </div>
              }
            />
          </Panel>

          <PanelResizeHandle className="w-1.5 bg-transparent hover:bg-indigo-500/50 transition-colors rounded-full mx-1 cursor-col-resize active:bg-indigo-500 flex items-center justify-center group">
            <div className="h-8 w-1 rounded-full bg-zinc-700 group-hover:bg-indigo-400 transition-colors" />
          </PanelResizeHandle>

          {/* Middle Panel: Output */}
          <Panel defaultSize={40} minSize={20}>
            <SchemaEditor
              title="Cloud Spanner DDL" 
              type="output"
              showHint={true}
              readOnly={false} // Always editable/selectable per previous request
            />
          </Panel>

          <PanelResizeHandle className="w-1.5 bg-transparent hover:bg-indigo-500/50 transition-colors rounded-full mx-1 cursor-col-resize active:bg-indigo-500 flex items-center justify-center group">
            <div className="h-8 w-1 rounded-full bg-zinc-700 group-hover:bg-indigo-400 transition-colors" />
          </PanelResizeHandle>

          {/* Right Panel: Chat */}
          <Panel defaultSize={30} minSize={20}>
            <ChatInterface />
          </Panel>

        </PanelGroup>
      </main>
    </div>
  )
}

export default App
