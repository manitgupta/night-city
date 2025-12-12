import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { SchemaEditor } from "./components/SchemaEditor";
import { ChatInterface } from "./components/ChatInterface";
import { MigrateDialog } from "./components/MigrateDialog";
import { useState, useEffect } from "react";
import { Database, Lock, Unlock, Wand2, ChevronDown, CheckCircle, XCircle, AlertCircle, Microscope, Eye, ThumbsUp, ThumbsDown, Rocket } from "lucide-react";
import { useStore } from "./store";
import { api, AnalyzeResponse } from "./services/api";

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
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{ valid: boolean; errors: string[] } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalyzeResponse | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [originalOutputCode, setOriginalOutputCode] = useState<string>("");
  const [showMigrateDialog, setShowMigrateDialog] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<{ success: boolean; database_uri: string; message: string; } | null>(null);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const { setOutputCode, addMessage, setAgentTyping, sourceCode, outputCode } = useStore();

  // Invalidate validation result when output code changes
  useEffect(() => {
    setValidationResult(null);
  }, [outputCode]);

  const handleValidate = async () => {
    if (!outputCode.trim()) return;
    setIsValidating(true);
    setValidationResult(null);
    try {
      const result = await api.validateSpannerDDL(outputCode);
      setValidationResult(result);
      setShowValidationModal(true);
    } catch (error) {
      console.error("Validation error:", error);
      setValidationResult({ valid: false, errors: [error instanceof Error ? error.message : "Unknown error"] });
    } finally {
      setIsValidating(false);
    }
  };

  const closeValidationModal = () => {
    if (isReviewing) return; // Prevent closing validation modal during review if we want to force a choice, or allow cancel. 
    // Let's allow cancel but reset review state
    setIsReviewing(false);
    setShowValidationModal(false);
    setAnalysisResult(null);
  };

  const handleAnalyzeError = async () => {
    if (!validationResult || validationResult.valid) return;
    setIsAnalyzing(true);
    try {
      const result = await api.analyzeError(sourceCode, outputCode, validationResult.errors.join("\n"));
      setAnalysisResult(result);
    } catch (error) {
      console.error("Analysis error:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const startReview = () => {
    if (!analysisResult) return;
    setOriginalOutputCode(outputCode);
    setIsReviewing(true);
  };

  const acceptFix = () => {
    if (!analysisResult) return;
    setOutputCode(analysisResult.fixed_ddl);
    setIsReviewing(false);
    setOriginalOutputCode("");
    setValidationResult(null);
    setAnalysisResult(null);

    // Create a summmary report
    const fixReport = `## Fix Applied ✅\n\n${analysisResult.explanation}`;

    addMessage({
      id: Date.now().toString(),
      role: 'agent',
      content: fixReport,
      isReport: true
    });
  };

  const rejectFix = () => {
    setIsReviewing(false);
    setOriginalOutputCode("");
    setValidationResult(null);
    setAnalysisResult(null);
  };

  const handleMigrate = async (projectId: string, instanceId: string, databaseId: string) => {
    setIsMigrating(true);
    setAgentTyping(true);
    setMigrationResult(null);
    try {
      const result = await api.migrateSchema(projectId, instanceId, databaseId, outputCode);
      if (result.success) {
        setMigrationResult({
          success: true,
          database_uri: result.database_uri,
          message: result.message
        });
        // Don't close dialog, let user see success state
        addMessage({
          id: Date.now().toString(),
          role: 'agent',
          content: `✅ Migration Successful! \n\nDatabase created at: \`${result.database_uri}\``
        });
      } else {
        // Show error but keep dialog open? Or close and show in chat?
        // Let's show in chat and keep dialog open so they can retry if it's a typo
        addMessage({
          id: Date.now().toString(),
          role: 'agent',
          content: `❌ Migration Failed: ${result.message}`
        });
        // We could also show an alert in the dialog itself if we passed setError prop, 
        // but for now chat feedback is good.
      }
    } catch (error) {
      console.error("Migration error:", error);
      addMessage({
        id: Date.now().toString(),
        role: 'agent',
        content: `❌ Migration Error: ${error instanceof Error ? error.message : "Unknown error"}`
      });
    } finally {
      setIsMigrating(false);
      setAgentTyping(false);
    }
  };

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

      const messageContent = result.report || `Conversion complete! ${logsSummary}`;

      addMessage({
        id: Date.now().toString(),
        role: 'agent',
        content: messageContent,
        isReport: !!result.report
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
    <div className="h-screen w-full bg-zinc-950 text-zinc-200 flex flex-col font-sans selection:bg-indigo-500/30 relative">
      <MigrateDialog
        isOpen={showMigrateDialog}
        onClose={() => {
          setShowMigrateDialog(false);
          setMigrationResult(null); // Reset on close
        }}
        onMigrate={handleMigrate}
        isMigrating={isMigrating}
        migrationResult={migrationResult}
      />
      {/* Validation Modal Overlay (Hidden when Reviewing) */}
      {validationResult && showValidationModal && !isReviewing && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          {/* If Reviewing, show a smaller top-center modal or floating action bar? 
              Actually, user said 'Accept/Reject button shows up along with the diff view'.
              Let's keep the modal but make it minimal or move it.
              Or, simply change the content of THIS modal to be the 'Control Center' for the review.
          */}
          <div
            className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 ring-1 ring-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            {!isReviewing && (
            <div className={`px-6 py-4 flex items-center gap-3 border-b ${validationResult.valid ? "bg-emerald-500/10 border-emerald-500/20" : "bg-red-500/10 border-red-500/20"}`}>
                {/* ... existing header ... */}
                {validationResult.valid ? (
                  <CheckCircle className="text-emerald-400 shrink-0" size={24} />
                ) : (
                  <XCircle className="text-red-400 shrink-0" size={24} />
                )}
                <h3 className={`text-lg font-semibold ${validationResult.valid ? "text-emerald-300" : "text-red-300"}`}>
                  {validationResult.valid ? "Validation Successful" : "Validation Failed"}
                </h3>
                <button onClick={closeValidationModal} className="ml-auto text-zinc-400 hover:text-white transition-colors">✕</button>
              </div>
            )}
            {isReviewing ? (
              // Review Mode UI
              <div className="p-6 flex flex-col items-center gap-4">
                <h3 className="text-xl font-semibold text-zinc-100">Review Proposed Fix</h3>
                <p className="text-zinc-400 text-center text-sm">
                  Review the changes in the Diff View on the right. <br />
                  Green lines are additions, red lines are removals.
                </p>
                <div className="flex items-center gap-4 mt-2">
                  <button
                    onClick={rejectFix}
                    className="flex items-center gap-2 px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-red-400 rounded-lg font-medium transition-colors border border-zinc-700"
                  >
                    <ThumbsDown size={18} />
                    Reject
                  </button>
                  <button
                    onClick={acceptFix}
                    className="flex items-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium shadow-lg shadow-emerald-500/20 transition-all"
                  >
                    <ThumbsUp size={18} />
                    Accept Fix
                  </button>
                </div>
              </div>
            ) : (
              // Normal Analysis/Validation UI
              <>
            {analysisResult ? (
              <div className="p-6 bg-indigo-500/5 border-b border-indigo-500/10 animate-in slide-in-from-bottom-2">
                <div className="flex items-center gap-2 mb-3 text-indigo-400 font-semibold">
                  <Microscope size={18} />
                  <span>Agent Analysis</span>
                </div>
                <div className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">
                  {analysisResult.explanation}
                </div>
                      {!isReviewing && (
                        <div className="mt-4 p-3 bg-zinc-950 rounded border border-zinc-800 font-mono text-xs text-zinc-500 text-center italic">
                          Click "Review Fix" to see the full diff and apply changes.
                  </div>
                      )}
              </div>
            ) : (
                <div className="p-6 max-h-[60vh] overflow-y-auto">
                  {validationResult.valid ? (
                    <div className="text-zinc-300 flex flex-col gap-2">
                      <p>The DDL syntax appears valid and compatible with Google Cloud Spanner.</p>
                      <div className="p-4 bg-emerald-500/5 rounded-lg border border-emerald-500/10 text-sm text-emerald-200/80 font-mono mt-2">
                        No errors found.
                      </div>
                    </div>
                  ) : (
                    <div className="text-zinc-300">
                      <p className="mb-4 text-sm text-zinc-400">The following errors were found during verification:</p>
                      <div className="space-y-2">
                        {validationResult.errors.map((err, idx) => (
                          <div key={idx} className="flex gap-3 p-3 bg-red-500/5 border border-red-500/10 rounded-lg text-sm text-red-200/90 font-mono break-all">
                            <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                            <span>{err}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
            )}

            <div className="px-6 py-4 bg-zinc-950/50 border-t border-zinc-800 flex justify-end gap-3">
              {!validationResult.valid && !analysisResult && (
                <button
                  onClick={handleAnalyzeError}
                  disabled={isAnalyzing}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-wait"
                >
                  {isAnalyzing ? (
                    <>
                      <span className="w-3 h-3 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Microscope size={16} />
                      Analyze & Fix
                    </>
                  )}
                </button>
              )}

              {analysisResult && (
                      <button
                        onClick={startReview}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-indigo-500/20"
                      >
                        <Eye size={16} />
                        Review Fix
                      </button>
              )}

              <button
                onClick={closeValidationModal}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-sm font-medium transition-colors"
              >
                Close
              </button>
            </div>
              </>
            )
            }
          </div>
        </div>
      )}

      {/* Header */}
      <header className="h-14 border-b border-zinc-800 bg-zinc-950/50 backdrop-blur-xl flex items-center justify-between px-6 shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow-lg shadow-indigo-500/20">
            <Database size={18} className="text-white" />
          </div>
          <h1 className="font-bold text-lg bg-clip-text text-transparent bg-gradient-to-r from-zinc-100 to-zinc-400">
            Night City: Agentic Spanner Schema Converter
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
              title={isReviewing ? "Review Fix (Diff View)" : "Cloud Spanner DDL"} 
              type="output"
              showHint={true}
              readOnly={false} // Always editable/selectable per previous request
              isLoading={isConverting}
              diffMode={isReviewing}
              diffOriginal={originalOutputCode}
              diffModified={analysisResult?.fixed_ddl || ""}
              headerActions={
                isReviewing ? (
                  <div className="flex items-center gap-2 mr-2">
                    <span className="text-xs text-zinc-400 mr-2">Reviewing Fix...</span>
                    <button
                      onClick={rejectFix}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-red-900/30 text-red-300 hover:text-red-200 border border-zinc-700 hover:border-red-800 rounded-md text-xs font-medium transition-all"
                    >
                      <ThumbsDown size={14} />
                      Reject
                    </button>
                    <button
                      onClick={acceptFix}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-xs font-medium transition-all shadow-lg shadow-emerald-500/20"
                    >
                      <ThumbsUp size={14} />
                      Accept
                    </button>
                  </div>
                ) : (
                <div className="flex items-center gap-2 mr-2">
                  {/* Verification Checkbox */}
                  <div className="flex items-center gap-2 group relative">
                    <input
                      type="checkbox"
                      id="verify-checkbox"
                      checked={isVerificationEnabled}
                      onChange={(e) => setIsVerificationEnabled(e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-zinc-700 bg-zinc-800 text-indigo-500 focus:ring-indigo-500/50 focus:ring-offset-0 cursor-pointer"
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

                  <div className="w-px h-4 bg-zinc-800 mx-2" />

                  {/* Validate Button */}
                  <button
                    onClick={handleValidate}
                    disabled={isValidating || !outputCode.trim() || isConverting}
                    className="flex items-center gap-1.5 px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded-md border border-zinc-700 hover:border-zinc-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isValidating ? (
                      <span className="w-3 h-3 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <CheckCircle size={12} className="text-emerald-500" />
                    )}
                    Validate
                  </button>

                      {validationResult?.valid && !isConverting && (
                        <>
                          <div className="w-px h-4 bg-zinc-800 mx-2" />
                          <button
                            onClick={() => setShowMigrateDialog(true)}
                            className="flex items-center gap-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-md shadow-lg shadow-indigo-500/20 transition-all animate-in fade-in slide-in-from-right-4"
                          >
                            <Rocket size={12} />
                            Migrate
                          </button>
                        </>
                      )}
                </div>
                  )
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
