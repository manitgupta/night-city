
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { SchemaEditor } from "./components/SchemaEditor";
import { ChatInterface } from "./components/ChatInterface";
import { useState } from "react";
import { Database, Lock, Unlock, Wand2, ChevronDown } from "lucide-react";
import { useStore } from "./store";
import { api } from "./services/api";

const SOURCE_DIALECTS = [
  { id: 'mysql', name: 'MySQL' },
  { id: 'postgres', name: 'PostgreSQL' },
  { id: 'oracle', name: 'Oracle' }
];

function App() {
  const [isSourceLocked, setIsSourceLocked] = useState(false); // Default to unlocked so user can paste
  const [isConverting, setIsConverting] = useState(false);
  const [isVerificationEnabled, setIsVerificationEnabled] = useState(false);
  const [showDialectDropdown, setShowDialectDropdown] = useState(false);
  const [sourceDialect, setSourceDialect] = useState<string | null>(null);
  const { setOutputCode, addMessage, setAgentTyping, sourceCode } = useStore();

  const handleConvert = async () => {
    if (!sourceDialect) return;

    setIsConverting(true);
    setAgentTyping(true);
    setIsSourceLocked(true); // Auto-lock on convert

    try {
      const result = await api.convertSchema(sourceCode, sourceDialect, isVerificationEnabled);
      setOutputCode(result.converted_ddl);

      const logsSummary = result.logs.length > 0
        ? "\n\nLogs:\n" + result.logs.join("\n")
        : "";

      addMessage({
        id: Date.now().toString(),
        role: 'agent',
        content: `Conversion complete! ${logsSummary}`
      });
    } catch (error) {
      console.error("Conversion error:", error);
      addMessage({
        id: Date.now().toString(),
        role: 'agent',
        content: `Error converting schema: ${error instanceof Error ? error.message : "Unknown error"}`
      });
    } finally {
      setIsConverting(false);
      setAgentTyping(false);
    }
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
            Night City: Spanner Schema Converter
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
                  <div className="relative z-50">
                    <button
                      onClick={() => setShowDialectDropdown(!showDialectDropdown)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 border ${sourceDialect
                          ? "bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700 hover:border-zinc-600"
                          : "bg-indigo-500/10 border-indigo-500/50 text-indigo-400 hover:bg-indigo-500/20 animate-pulse shadow-[0_0_10px_rgba(99,102,241,0.1)]"
                        }`}
                    >
                      <span>{sourceDialect ? SOURCE_DIALECTS.find(d => d.id === sourceDialect)?.name : "Select Dialect"}</span>
                      <ChevronDown size={14} className={`transition-transform duration-200 ${showDialectDropdown ? "rotate-180" : ""}`} />
                    </button>

                    {showDialectDropdown && (
                      <>
                        <div
                          className="fixed inset-0 z-40" 
                          onClick={() => setShowDialectDropdown(false)}
                        />
                        <div className="absolute top-full mt-2 left-0 w-40 bg-zinc-900/95 backdrop-blur-xl border border-zinc-800/80 rounded-xl shadow-2xl overflow-hidden z-50 flex flex-col p-1 animate-in fade-in zoom-in-95 duration-150 origin-top-left ring-1 ring-white/5">
                          {SOURCE_DIALECTS.map(dialect => (
                            <button
                              key={dialect.id}
                              onClick={() => {
                                setSourceDialect(dialect.id);
                                setShowDialectDropdown(false);
                              }}
                              className={`text-left px-3 py-2.5 rounded-lg text-xs transition-all duration-150 flex items-center gap-2 ${sourceDialect === dialect.id
                                  ? "bg-indigo-500/20 text-indigo-300 font-medium"
                                  : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                                }`}
                            >
                              <div className={`w-1.5 h-1.5 rounded-full ${sourceDialect === dialect.id ? "bg-indigo-400" : "bg-transparent"}`} />
                              {dialect.name}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  <div className="w-px h-4 bg-zinc-800 mx-2" />

                  <button
                    onClick={() => setIsSourceLocked(!isSourceLocked)}
                    className={`flex items-center justify-center w-7 h-7 rounded-md transition-all duration-200 ${isSourceLocked 
                        ? "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800" 
                        : "text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 hover:shadow-[0_0_10px_rgba(99,102,241,0.15)]"
                      }`}
                    title={isSourceLocked ? "Unlock to edit" : "Lock to prevent edits"}
                  >
                    {isSourceLocked ? <Lock size={14} /> : <Unlock size={14} />}
                  </button>

                  {sourceCode.trim() && (
                    <button
                      onClick={handleConvert}
                      disabled={!sourceDialect || isConverting}
                      className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold shadow-lg transition-all duration-300 ml-2 ${sourceDialect
                          ? "bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-105 active:scale-95 cursor-pointer ring-1 ring-white/10"
                          : "bg-zinc-800 text-zinc-600 cursor-not-allowed opacity-50 ring-1 ring-white/5"
                        } ${isConverting ? "opacity-80 cursor-wait" : ""}`}
                    >
                      <Wand2 size={14} className={isConverting ? "animate-spin" : ""} />
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
              isLoading={isConverting}
              headerActions={
                <div className="flex items-center gap-2 mr-2">
                  <div className="flex items-center gap-2 group relative">
                    <input
                      type="checkbox"
                      id="verify-checkbox"
                      checked={isVerificationEnabled}
                      onChange={(e) => setIsVerificationEnabled(e.target.checked)}
                      className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-indigo-500 focus:ring-indigo-500/50 focus:ring-offset-0 cursor-pointer"
                    />
                    <label
                      htmlFor="verify-checkbox"
                      className="text-xs font-medium text-zinc-400 cursor-pointer select-none group-hover:text-zinc-200 transition-colors"
                    >
                      Enable verification?
                    </label>

                    {/* Tooltip on hover */}
                    {isVerificationEnabled && (
                      <div className="absolute top-full right-0 mt-3 w-64 p-2 bg-zinc-900/95 backdrop-blur-xl border border-indigo-500/30 rounded-lg shadow-xl text-xs text-zinc-300 z-50 animate-in fade-in slide-in-from-top-2 pointer-events-none">
                        <p className="font-medium text-indigo-400 mb-1">Slow Operation Warning</p>
                        This tool will attempt to verify the DDL against a real Spanner instance. This process may take longer.
                        {/* Tip pointing UP to the checkbox */}
                        <div className="absolute -top-1 right-8 w-2 h-2 bg-zinc-900 border-l border-t border-indigo-500/30 rotate-45"></div>
                      </div>
                    )}
                  </div>
                </div>
              }
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
