import { useRef } from "react";
import { Editor, OnMount } from "@monaco-editor/react";
import { Copy, FileCode2 } from "lucide-react";
import { useStore } from "../store";

interface SchemaEditorProps {
  title: string;
  isSource?: boolean;
}

export function SchemaEditor({
  title,
  isSource = false
}: SchemaEditorProps) {
  const { sourceCode, outputCode, setSourceCode, setSelection } = useStore();
  const editorRef = useRef<any>(null);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    if (isSource) {
      editor.onDidChangeCursorSelection((e: any) => {
        const selection = e.selection;
        const model = editor.getModel();
        if (selection && !selection.isEmpty() && model) {
          const content = model.getValueInRange(selection);
          setSelection({
            code: content,
            startLine: selection.startLineNumber,
            endLine: selection.endLineNumber,
            source: 'source'
          });
        } else {
          // Optional: clear selection if empty? 
          // setSelection(null); 
          // User might want to keep context if they just clicked away, but for now let's clear it
          // actually standard behavior is to clear.
        }
      });
    }
  };

  const code = isSource ? sourceCode : outputCode;

  return (
    <div className="flex flex-col h-full bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden shadow-xl">
      <div className="flex items-center justify-between px-4 py-3 bg-zinc-950 border-b border-zinc-800">
        <div className="flex items-center gap-2 text-zinc-100">
          <FileCode2 size={16} className={isSource ? "text-indigo-400" : "text-emerald-400"} />
          <span className="text-sm font-semibold tracking-wide">{title}</span>
        </div>
        <button
          onClick={() => navigator.clipboard.writeText(code)}
          className="text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <Copy size={14} />
        </button>
      </div>
      <div className="flex-1 relative group">
        <Editor
          height="100%"
          defaultLanguage="sql"
          value={code}
          onChange={(val) => isSource && setSourceCode(val || "")}
          theme="vs-dark"
          onMount={handleEditorDidMount}
          options={{
            readOnly: !isSource,
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
        {/* Helper hint for selection */}
        {isSource && (
          <div className="absolute bottom-4 right-6 pointer-events-none opacity-0 group-hover:opacity-50 transition-opacity bg-black/50 text-white text-[10px] px-2 py-1 rounded">
            Highlight code to ask agent
          </div>
        )}
      </div>
    </div>
  );
}
