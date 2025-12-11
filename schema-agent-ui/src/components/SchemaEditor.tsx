import React, { useRef } from "react";
import { Editor, OnMount } from "@monaco-editor/react";
import { Copy, FileCode2 } from "lucide-react";
import { useStore } from "../store";

interface SchemaEditorProps {
  title: string;
  type: 'source' | 'output';
  showHint?: boolean;
  readOnly?: boolean;
  headerActions?: React.ReactNode;
  isLoading?: boolean;
}

const LOADING_TEXTS = [
  "Summoning the Spanner Daemon...",
  "Translating SQL to Google-speak...",
  "Optimizing atoms for scalability...",
  "Consulting the High Priests of Sharding...",
  "Teaching the database how to scale...",
  "Converting logic into raw power...",
  "Reticulating splines...",
  "Verifying constraints in the void...",
  "Calculating the answer (it's 42)...",
  "Normalizing data structures..."
];

export function SchemaEditor({ 
  title,
  type,
  showHint = false,
  readOnly = false,
  headerActions,
  isLoading = false
}: SchemaEditorProps) {
  const { sourceCode, outputCode, setSourceCode, setOutputCode, setSelection } = useStore();
  const editorRef = useRef<any>(null);
  const [loadingTextIndex, setLoadingTextIndex] = React.useState(0);

  React.useEffect(() => {
    if (!isLoading) return;
    const interval = setInterval(() => {
      setLoadingTextIndex((prev) => (prev + 1) % LOADING_TEXTS.length);
    }, 2000); // Rotate every 2s
    return () => clearInterval(interval);
  }, [isLoading]);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    // Listen for selection changes to update context
    editor.onDidChangeCursorSelection((e: any) => {
      const selection = e.selection;
      const model = editor.getModel();
      if (selection && !selection.isEmpty() && model) {
        const content = model.getValueInRange(selection);
        setSelection({
          code: content,
          startLine: selection.startLineNumber,
          endLine: selection.endLineNumber,
          source: type
        });
      }
    });
  };

  const code = type === 'source' ? sourceCode : outputCode;
  const setCode = type === 'source' ? setSourceCode : setOutputCode;
  const isSource = type === 'source';

  return (
    <div className="flex flex-col h-full bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden shadow-xl relative">
      <div className="flex items-center justify-between px-4 py-3 bg-zinc-950 border-b border-zinc-800">
        <div className="flex items-center gap-2 text-zinc-100">
          <FileCode2 size={16} className={isSource ? "text-indigo-400" : "text-emerald-400"} />
          <span className="text-sm font-semibold tracking-wide">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          {headerActions}
          <div className="w-px h-4 bg-zinc-800 mx-1" />
          <button
            onClick={() => navigator.clipboard.writeText(code)}
            disabled={isLoading}
            className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 hover:bg-zinc-800 rounded disabled:opacity-50"
            title="Copy to clipboard"
          >
            <Copy size={14} />
          </button>
        </div>
      </div>
      <div className="flex-1 relative group bg-zinc-900">
        <Editor
          height="100%"
          defaultLanguage="sql"
          value={code}
          onChange={(val) => setCode(val || "")}
          theme="vs-dark"
          onMount={handleEditorDidMount}
          options={{
            readOnly: readOnly || isLoading, // Lock editor while loading
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            automaticLayout: true,
            padding: { top: 16, bottom: 16 },
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            renderLineHighlight: "all",
          }}
        />

        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 z-50 bg-zinc-900/80 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in duration-300">
            <div className="relative">
              {/* Spinning blobs/glow */}
              <div className="absolute -inset-4 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full blur-xl opacity-30 animate-pulse"></div>
              <div className="w-12 h-12 border-4 border-zinc-800 border-t-indigo-500 rounded-full animate-spin relative z-10 shadow-2xl"></div>
            </div>
            <p className="mt-6 text-zinc-300 font-medium text-sm animate-pulse tracking-wide font-mono">
              {LOADING_TEXTS[loadingTextIndex]}
            </p>
          </div>
        )}

        {/* Helper hint for selection */}
        {showHint && !isLoading && (
          <div className="absolute bottom-6 right-6 z-10 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <div className="bg-zinc-800/90 backdrop-blur border border-zinc-700 text-zinc-200 text-xs px-3 py-1.5 rounded-full shadow-lg flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
              Highlight to ask agent
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
