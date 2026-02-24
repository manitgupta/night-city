import { useState, useRef, useEffect } from "react";
import { FolderSync, Loader2, TerminalSquare, BrainCircuit, CheckCircle2, ArrowLeft, ArrowRight } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { API_BASE_URL } from "../services/api";

interface StreamEvent {
  type: 'live_activity' | 'log' | 'thought' | 'result' | 'error';
  content?: string;
  report?: string;
  workspace_dir?: string;
  git_diff?: string;
}

interface AppMigrationProps {
  onBack: () => void;
}

export function AppMigration({ onBack }: AppMigrationProps) {
  const [githubUrl, setGithubUrl] = useState("");
  const [migrationState, setMigrationState] = useState<'idle' | 'streaming' | 'complete' | 'error'>('idle');

  const [activities, setActivities] = useState<string[]>([]);
  const [thoughtText, setThoughtText] = useState<string>("");
  const [logs, setLogs] = useState<string[]>([]);
  const [resultReport, setResultReport] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [workspaceDir, setWorkspaceDir] = useState<string | null>(null);
  const [gitDiff, setGitDiff] = useState<string | null>(null);

  const terminalRef = useRef<HTMLDivElement>(null);
  const thoughtRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logic for feeds
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    if (thoughtRef.current) {
      thoughtRef.current.scrollTop = thoughtRef.current.scrollHeight;
    }
  }, [thoughtText]);

  const handleStartMigration = async () => {
    if (!githubUrl.trim()) return;

    // Reset states
    setActivities([]);
    setThoughtText("");
    setLogs([]);
    setResultReport(null);
    setErrorDetails(null);
    setWorkspaceDir(null);
    setGitDiff(null);
    setMigrationState('streaming');

    try {
      const response = await fetch(`${API_BASE_URL}/api/migrate-app`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/x-ndjson"
        },
        body: JSON.stringify({ github_url: githubUrl })
      });

      if (!response.body) throw new Error("ReadableStream not supported in this browser.");
      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${await response.text()}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let boundary = buffer.indexOf('\n');
        while (boundary !== -1) {
          const chunkStr = buffer.slice(0, boundary).trim();
          buffer = buffer.slice(boundary + 1);

          if (chunkStr) {
            try {
              const event = JSON.parse(chunkStr) as StreamEvent;

              switch (event.type) {
                case 'live_activity':
                  if (event.content) setActivities(prev => [...prev, event.content!]);
                  break;
                case 'log':
                  if (event.content) setLogs(prev => [...prev, event.content!]);
                  break;
                case 'thought':
                  if (event.content) setThoughtText(prev => prev + event.content!);
                  break;
                case 'result':
                  if (event.report) {
                    setResultReport(event.report);
                    if (event.workspace_dir) {
                      setWorkspaceDir(event.workspace_dir);
                    }
                    if (event.git_diff) {
                      setGitDiff(event.git_diff);
                    }
                    setMigrationState('complete');
                  }
                  break;
                case 'error':
                  if (event.content) {
                    setErrorDetails(event.content);
                    setMigrationState('error');
                  }
                  break;
              }
            } catch (err) {
              console.warn("Failed to parse chunk:", chunkStr, err);
            }
          }
          boundary = buffer.indexOf('\n');
        }
      }
    } catch (err: any) {
      console.error(err);
      setErrorDetails(err.message || "Failed to initiate migration.");
      setMigrationState('error');
    }
  };

  const handleDownload = () => {
    if (!workspaceDir) return;

    // Create an invisible anchor tag to trigger the browser download
    const url = `http://localhost:8000/api/download-workspace?workspace_path=${encodeURIComponent(workspaceDir)}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = 'migrated_app.zip'; // The backend determines the actual filename, but this is a fallback hint
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="h-screen w-full bg-zinc-950 p-6 flex flex-col font-sans text-zinc-300 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={onBack}
          className="mr-1 p-2 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={24} />
        </button>
        <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400">
          <FolderSync size={24} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-zinc-100">Application Migration</h2>
          <p className="text-sm text-zinc-500">Autonomous Spanner code refactoring</p>
        </div>
      </div>

      {migrationState === 'idle' && (
        <div className="max-w-4xl mx-auto mt-32 w-full flex flex-col items-center justify-center relative animate-in fade-in slide-in-from-bottom-8 duration-700">
          {/* Aesthetic Spotlights */}
          <div className="absolute inset-0 -z-10 translate-y-[-20%] pointer-events-none">
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-emerald-600/20 blur-[120px] rounded-full mix-blend-screen" />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[400px] bg-cyan-600/10 blur-[100px] rounded-full mix-blend-screen" />
          </div>

          <h3 className="text-5xl font-bold mb-6 bg-gradient-to-br from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent text-center tracking-tight">
            Migrate Legacy Codebases
          </h3>
          <p className="text-lg text-zinc-400 mb-12 text-center max-w-2xl leading-relaxed">
            Provide a GitHub repository URL and watch our autonomous agents refactor your application for Google Cloud Spanner in real-time.
          </p>

          <div className="w-full max-w-3xl relative group">
            {/* Glowing Border effect */}
            <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/40 via-cyan-500/40 to-emerald-500/40 rounded-full blur-md opacity-30 group-hover:opacity-60 transition duration-700 group-hover:duration-200"></div>

            {/* Input Container */}
            <div className="relative flex items-center bg-zinc-900/90 backdrop-blur-xl border border-zinc-800/80 rounded-full p-2 shadow-2xl transition-all duration-300">
              <input
                type="text"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                placeholder="https://github.com/user/repo"
                className="flex-1 bg-transparent px-6 py-4 text-zinc-100 placeholder-zinc-500 focus:outline-none font-mono text-lg"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleStartMigration();
                }}
              />
              <button
                onClick={handleStartMigration}
                disabled={!githubUrl.trim()}
                className="bg-zinc-100 hover:bg-white text-zinc-950 font-semibold px-8 py-4 rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 group/btn"
              >
                Start
                <ArrowRight size={20} className="group-hover/btn:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      )}

      {migrationState === 'streaming' && (
        <div className="flex-1 flex flex-col md:flex-row gap-6 min-h-0 animate-in fade-in slide-in-from-bottom-8 duration-700">
          {/* Stepper / Status */}
          <div className="w-full md:w-1/3 bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 flex flex-col gap-4 overflow-hidden">
            <h3 className="font-semibold text-zinc-100 mb-2 flex items-center gap-2">
              <Loader2 className="animate-spin text-emerald-500" size={18} />
              Live Activity Tracker
            </h3>

            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
              {activities.length === 0 ? (
                <div className="text-sm text-zinc-500 italic">Initializing...</div>
              ) : (
                  [...activities].reverse().map((act, idx) => {
                    const originalIndex = activities.length - 1 - idx;
                    const isLatest = originalIndex === activities.length - 1;
                    const isFirstInReversed = idx === 0;

                    return (
                      <div key={originalIndex} className="flex gap-3 text-sm">
                        <div className="flex flex-col items-center mt-1 text-emerald-500">
                          {isLatest && migrationState === 'streaming' ? (
                            <Loader2 className="animate-spin min-w-[16px] min-h-[16px]" size={16} />
                          ) : (
                            <CheckCircle2 className="min-w-[16px] min-h-[16px]" size={16} />
                          )}
                          {!isFirstInReversed && <div className="w-px h-full bg-zinc-800 my-1"></div>}
                        </div>
                        <div className={`${isLatest ? 'text-zinc-200 font-medium' : 'text-zinc-500'}`}>
                          {act}
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>

          {/* Thoughts & Terminal (Right Side) */}
          <div className="flex-1 flex flex-col gap-6 w-full md:w-2/3 h-full min-h-0">
            <div className="h-1/2 bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 overflow-y-auto flex flex-col" ref={thoughtRef}>
              <h3 className="font-semibold text-zinc-100 mb-4 flex items-center gap-2">
                <BrainCircuit className="text-purple-400" size={18} />
                Agent Thoughts
              </h3>
              <div className="space-y-4">
                {!thoughtText ? (
                  <p className="text-sm text-zinc-500 font-mono italic">Waiting for agent to initialize...</p>
                ) : (
                    <div className="text-zinc-300 bg-zinc-800/30 p-4 rounded-xl border border-zinc-700/50">
                      <div className="prose prose-invert prose-sm max-w-none prose-pre:bg-zinc-900 prose-pre:border prose-pre:border-zinc-800">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            pre: ({ node, ...props }) => (
                              <pre {...props} className="whitespace-pre-wrap break-words overflow-x-hidden max-w-full bg-zinc-900 rounded-lg p-2" />
                            ),
                            code(props) {
                              const { children, className, node, ref, ...rest } = props
                              const match = /language-(\w+)/.exec(className || '')
                              return match ? (
                                <SyntaxHighlighter
                                  {...rest}
                                  PreTag="div"
                                  children={children ? String(children).replace(/\n$/, '') : ''}
                                  language={match[1]}
                                  style={vscDarkPlus as any}
                                  wrapLongLines={true}
                                  customStyle={{ margin: 0, borderRadius: '0.5rem', background: '#18181b', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                                />
                              ) : (
                                <code {...rest} className={className}>
                                  {children}
                                </code>
                              )
                            }
                          }}
                        >
                          {thoughtText}
                        </ReactMarkdown>
                      </div>
                    </div>
                )}
              </div>
            </div>

            <div className="h-1/2 flex flex-col">
              <h3 className="font-semibold text-zinc-100 mb-2 flex items-center gap-2">
                <TerminalSquare className="text-emerald-400" size={18} />
                Terminal Output
              </h3>
              <div
                ref={terminalRef}
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-2xl p-4 font-mono text-xs overflow-y-auto text-zinc-400"
              >
                <div className="mb-2 text-zinc-600">night-city-agent ~$ starting migration sequence...</div>
                {logs.map((log, i) => (
                  <div key={i} className="whitespace-pre-wrap mb-2">
                    {log.startsWith('🔧') ? (
                      <span className="text-cyan-400 font-bold">{log}</span>
                    ) : log.startsWith('Result') ? (
                      <span className="text-zinc-300">{log}</span>
                    ) : (
                      <span className="text-zinc-500">{log}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {(migrationState === 'complete' || migrationState === 'error') && (
        <div className={`flex-1 flex flex-col items-center justify-center w-full min-h-0 mt-6 animate-in fade-in slide-in-from-bottom-8 duration-700`}>
          {migrationState === 'error' ? (
            <div className={`max-w-5xl mx-auto w-full bg-zinc-900/50 border border-red-500/30 rounded-2xl p-8 flex flex-col items-center`}>
              <h3 className="text-3xl font-bold text-red-400 mb-4">Migration Failed</h3>
              <div className="bg-red-950/30 border border-red-900 text-red-200 p-4 rounded-lg w-full font-mono text-sm whitespace-pre-wrap">
                {errorDetails}
              </div>
            </div>
          ) : (
              <div className="w-full h-full flex flex-col min-h-0">
                <div className="flex justify-between items-end mb-6 shrink-0">
                  <div>
                    <h3 className="text-3xl font-bold text-zinc-100 mb-2">Migration Complete!</h3>
                    <p className="text-zinc-400">The application was successfully refactored to use Google Cloud Spanner configurations.</p>
                  </div>

                  <div className="flex gap-4">
                    <button
                      onClick={() => setMigrationState('idle')}
                      className="bg-zinc-800 hover:bg-zinc-700 text-white font-medium px-6 py-2 rounded-xl transition-colors text-sm"
                    >
                      Start New Migration
                    </button>
                    <button
                      onClick={handleDownload}
                      disabled={!workspaceDir}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-6 py-2 rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      <FolderSync size={16} />
                      Download Repository ZIP
                    </button>
                  </div>
                </div>

                <div className="flex-1 flex flex-col md:flex-row gap-6 min-h-0">
                  {/* Markdown Report Panel */}
                  <div className="w-full md:w-1/2 bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 overflow-y-auto flex flex-col">
                    <h4 className="text-lg font-bold text-zinc-200 mb-4 border-b border-zinc-800 pb-2">Refactoring Report</h4>
                    <div className="prose prose-invert prose-sm max-w-none prose-pre:bg-zinc-950/50 prose-pre:border prose-pre:border-zinc-800 flex-1">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          pre: ({ node, ...props }) => (
                            <pre {...props} className="whitespace-pre-wrap break-words overflow-x-hidden max-w-full bg-zinc-900 rounded-lg p-2" />
                          ),
                          code(props) {
                            const { children, className, node, ref, ...rest } = props
                            const match = /language-(\w+)/.exec(className || '')
                            return match ? (
                              <SyntaxHighlighter
                                {...rest}
                                PreTag="div"
                                children={children ? String(children).replace(/\n$/, '') : ''}
                                language={match[1]}
                                style={vscDarkPlus as any}
                                wrapLongLines={true}
                                customStyle={{ margin: 0, borderRadius: '0.5rem', background: '#18181b', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                              />
                            ) : (
                              <code {...rest} className={className}>
                                {children}
                              </code>
                            )
                          }
                        }}
                      >
                        {resultReport || ""}
                      </ReactMarkdown>
                    </div>
                  </div>

                  {/* Git Diff Panel */}
                  <div className="w-full md:w-1/2 bg-zinc-950/80 border border-zinc-800 rounded-2xl p-6 overflow-hidden flex flex-col">
                    <h4 className="text-lg font-bold text-zinc-200 mb-4 border-b border-zinc-800 pb-2 flex items-center gap-2">
                      <TerminalSquare size={18} className="text-emerald-500" />
                      Source Code Diff
                    </h4>
                    <div className="flex-1 overflow-y-auto w-full custom-scrollbar pr-2 rounded-lg bg-zinc-900 border border-zinc-800/50">
                      <SyntaxHighlighter
                        language="diff"
                        style={vscDarkPlus as any}
                        customStyle={{ margin: 0, padding: '1rem', background: 'transparent', fontSize: '13px' }}
                        wrapLines={true}
                        showLineNumbers={false}
                      >
                        {gitDiff || "No code changes tracked by Git."}
                      </SyntaxHighlighter>
                    </div>
                  </div>
                </div>
              </div>
          )}
        </div>
      )}
    </div>
  );
}
