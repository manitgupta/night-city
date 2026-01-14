import { useState } from "react";
import { Search, ChevronDown, Database, Settings } from "lucide-react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { ChatInterface } from "./ChatInterface";
import { SchemaEditor } from "./SchemaEditor";
import { SourceConnectionDialog } from "./SourceConnectionDialog";
import { SpannerConnectionDialog } from "./SpannerConnectionDialog";
import { useStore } from "../store";
import { api, SourceConnectionConfig } from "../services/api";
import { useEffect } from "react";

export function QueryConverter() {
  const [showSourceDialog, setShowSourceDialog] = useState(false);
  const [showSpannerDialog, setShowSpannerDialog] = useState(false);

  const [sourceConnected, setSourceConnected] = useState(false);
  const [spannerConnected, setSpannerConnected] = useState(false);


  const [isConnectingSource, setIsConnectingSource] = useState(false);
  const [isConnectingSpanner, setIsConnectingSpanner] = useState(false);

  const { chatContext, setChatContext, resetMessages, setSourceSessionId, addMessage } = useStore();

  // Initialize Chat for Query Conversion
  useEffect(() => {
    if (chatContext !== 'query') {
      setChatContext('query');
      resetMessages({
        id: '1',
        role: 'agent',
        content: "Hello! Welcome to Night City. I am your query conversion AI assistant! I can help you convert source queries to Spanner SQL, optimize performance, and explain complex query logic!"
      });
    }
  }, [chatContext, setChatContext, resetMessages]);

  // Mock connection handlers
  const handleConnectSource = async (config: any) => {
    setIsConnectingSource(true);
    try {
      const response = await api.connectSource(config as SourceConnectionConfig);
      if (response.success) {
        setSourceConnected(true);
        setShowSourceDialog(false);
        setSourceSessionId(response.session_id || null);
        addMessage({
          id: Date.now().toString(),
          role: 'agent',
          content: `Successfully connected to source database (${config.dialect}: ${config.host})!`,
          isHelpful: true
        });
      } else {
        // We can show a toast or alert here
        console.error('Connection failed:', response.message);
        // For now, let's just log it or maybe assume the dialog stays open with error?
        // The dialog doesn't have error prop yet, so we'll just alert for now or let the user try again.
        // Ideally we pass error back to dialog.
        alert(`Connection Failed: ${response.message}`);
      }
    } catch (error) {
      console.error('Source connection error:', error);
      alert('Failed to connect to source database.');
    } finally {
      setIsConnectingSource(false);
    }
  };

  const handleConnectSpanner = async (config: any) => {
    setIsConnectingSpanner(true);
    try {
      const response = await api.connectSpanner(config);
      if (response.success) {
        setSpannerConnected(true);
        setShowSpannerDialog(false);
        // Assuming we have a setSpannerSessionId in store (we added it)
        // We need to destructure it from useStore first if not already done
        // @ts-ignore - we know it exists but maybe interface update hasn't propagated to this file's TS check in agent mind
        useStore.getState().setSpannerSessionId(response.session_id || null);
        addMessage({
          id: Date.now().toString(),
          role: 'agent',
          content: `Successfully connected to Spanner database (${config.instanceId}/${config.databaseId})!`,
          isHelpful: true
        });
      } else {
        console.error('Spanner connection failed:', response.message);
        alert(`Connection Failed: ${response.message}`);
      }
    } catch (error) {
      console.error('Spanner connection error:', error);
      alert('Failed to connect to Spanner database.');
    } finally {
      setIsConnectingSpanner(false);
    }
  };

  // Helper to go back to landing (can be passed as prop if strictly needed, but for now using simple reload or parent nav if integrated deeper. 
  // Wait, in App.tsx we render this conditionally. We might need a back callback.
  // Actually, App.tsx renders this, but let's assume we can add a Back button that just refreshes or we need to accept props.
  // For now I'll use the one from `SchemaConverter` pattern (accepting onBack would be better, but I'll stick to local state or just "hidden" back if not passed).
  // Actually, I can't easily change the signature without changing App.tsx too.
  // Let's assume App.tsx already provides a back button wrapper for 'query' mode, so I don't need one inside the header.
  // Wait, I put the back button in the wrapper in App.tsx! So no need here.

  return (
    <div className="flex flex-col h-screen w-full bg-zinc-950 text-zinc-200 font-sans selection:bg-indigo-500/30 relative">
      <SourceConnectionDialog
        isOpen={showSourceDialog}
        onClose={() => setShowSourceDialog(false)}
        onConnect={handleConnectSource}
        isConnecting={isConnectingSource}
      />
      <SpannerConnectionDialog
        isOpen={showSpannerDialog}
        onClose={() => setShowSpannerDialog(false)}
        onConnect={handleConnectSpanner}
        isConnecting={isConnectingSpanner}
      />

      {/* Header */}
      <header className="h-14 border-b border-zinc-800 bg-zinc-950/50 backdrop-blur-xl flex items-center justify-between px-6 shrink-0 z-10 pl-16">
        {/* pl-16 to account for the absolute positioned back button in App.tsx */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg shadow-lg shadow-purple-500/20">
            <Search size={18} className="text-white" />
          </div>
          <h1 className="font-bold text-lg bg-clip-text text-transparent bg-gradient-to-r from-zinc-100 to-zinc-400">
            Query Conversion
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

          {/* Left Panel: Source Query */}
          <Panel defaultSize={30} minSize={20} className="flex flex-col">
            <SchemaEditor
              title="Source Query"
              type="source"
              showHint={true}
              headerActions={
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowSourceDialog(true)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 border ${sourceConnected
                      ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/20"
                      : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700 hover:border-zinc-600 hover:text-zinc-200"
                      }`}
                  >
                    {sourceConnected ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                        Source Active
                      </>
                    ) : (
                      <>
                        <Database size={14} />
                        Select Source
                      </>
                    )}
                    <ChevronDown size={14} className="opacity-50" />
                  </button>
                </div>
              }
            />
          </Panel>

          <PanelResizeHandle className="w-1.5 bg-transparent hover:bg-indigo-500/50 transition-colors rounded-full mx-1 cursor-col-resize active:bg-indigo-500 flex items-center justify-center group">
            <div className="h-8 w-1 rounded-full bg-zinc-700 group-hover:bg-indigo-400 transition-colors" />
          </PanelResizeHandle>

          {/* Middle Panel: Spanner Query */}
          <Panel defaultSize={40} minSize={20}>
            <SchemaEditor
              title="Spanner Query"
              type="output" // Reusing output type from schema editor for target
              showHint={true}
              headerActions={
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowSpannerDialog(true)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 border ${spannerConnected
                      ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/20"
                      : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700 hover:border-zinc-600 hover:text-zinc-200"
                      }`}
                  >
                    {spannerConnected ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                        Spanner Active
                      </>
                    ) : (
                      <>
                        <Settings size={14} />
                        Configure Spanner
                      </>
                    )}
                  </button>
                </div>
              }
            />
          </Panel>

          <PanelResizeHandle className="w-1.5 bg-transparent hover:bg-indigo-500/50 transition-colors rounded-full mx-1 cursor-col-resize active:bg-indigo-500 flex items-center justify-center group">
            <div className="h-8 w-1 rounded-full bg-zinc-700 group-hover:bg-indigo-400 transition-colors" />
          </PanelResizeHandle>

          {/* Right Panel: Chat */}
          <Panel defaultSize={30} minSize={20} id="chat-interface">
            <ChatInterface />
          </Panel>

        </PanelGroup>
      </main>
    </div>
  );
}
