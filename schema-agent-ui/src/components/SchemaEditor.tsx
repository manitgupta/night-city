import { useRef } from "react";
import { Editor, OnMount } from "@monaco-editor/react";
import { Copy, FileCode2 } from "lucide-react";
import { useStore } from "../store";

interface SchemaEditorProps {
  title: string;
  type: 'source' | 'output';
  interactive?: boolean;
}

export function SchemaEditor({ 
  title,
  type,
  interactive = false
}: SchemaEditorProps) {
  const { sourceCode, outputCode, setSourceCode, setOutputCode, setSelection } = useStore();
  const editorRef = useRef<any>(null);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    if (interactive) {
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
    }
  };

  const code = type === 'source' ? sourceCode : outputCode;
  const setCode = type === 'source' ? setSourceCode : setOutputCode;
  const isSource = type === 'source';

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
      <div className="flex-1 relative group bg-zinc-900">
        <Editor
          height="100%"
          defaultLanguage="sql"
          value={code}
          onChange={(val) => setCode(val || "")}
          theme="vs-dark"
          onMount={handleEditorDidMount}
          options={{
            readOnly: !interactive,
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
        {interactive && (
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
