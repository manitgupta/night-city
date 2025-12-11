import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { SchemaEditor } from "./components/SchemaEditor";
import { ChatInterface } from "./components/ChatInterface";
import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Sparkles, Code2, Check, Database } from "lucide-react";

function App() {
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
              title="Source Schema (PostgreSQL)"
              isSource={true}
            />
          </Panel>

          <PanelResizeHandle className="w-1.5 bg-transparent hover:bg-indigo-500/50 transition-colors rounded-full mx-1 cursor-col-resize active:bg-indigo-500 flex items-center justify-center group">
            <div className="h-8 w-1 rounded-full bg-zinc-700 group-hover:bg-indigo-400 transition-colors" />
          </PanelResizeHandle>

          {/* Middle Panel: Output */}
          <Panel defaultSize={40} minSize={20}>
            <SchemaEditor
              title="Cloud Spanner DDL"
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
