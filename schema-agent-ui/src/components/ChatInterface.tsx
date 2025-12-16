
import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Sparkles, Code2, ChevronDown, ChevronRight, BrainCircuit } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore, Message } from "../store";
import { api } from "../services/api";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

function ThoughtProcess({ thoughts, isComplete }: { thoughts: string, isComplete: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false);

  // If incomplete (streaming), render naturally without collapsible UI
  if (!isComplete) {
    if (!thoughts) return null;
    return (
      <div className="mb-2 animate-in fade-in duration-300">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            pre: ({ node, ...props }) => (
              <pre {...props} className="whitespace-pre-wrap break-words overflow-x-hidden max-w-full bg-zinc-800/50 rounded-lg p-2 my-1" />
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
                  style={vscDarkPlus}
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
          {thoughts}
        </ReactMarkdown>
      </div>
    );
  }

  // If complete, show collapsible UI
  if (!thoughts) return null;

  return (
    <div className="mb-3 rounded-lg border border-zinc-800 bg-zinc-900/50 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors"
      >
        <BrainCircuit size={14} className={isExpanded ? "text-indigo-400" : "text-zinc-600"} />
        <span>Show Thinking</span>
        <div className="ml-auto">
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-3 pb-3 pt-0 overflow-x-auto text-xs font-mono text-zinc-500 leading-relaxed max-h-[400px] overflow-y-auto custom-scrollbar">
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
                        style={vscDarkPlus}
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
                {thoughts}
              </ReactMarkdown>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ChatInterface() {
  const { messages, addMessage, isAgentTyping, setAgentTyping, selection, sourceCode, outputCode } = useStore();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isAgentTyping]);

  const handleSend = async () => {
    if (!input.trim()) return;

    // We no longer prefix the message with context since we send it structured
    // But we can still keep the UI consistent with what the user sees
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user', 
      content: input, // Clean content, context is hidden/structured
      // We could optionally allow showing the context attachment in the UI message list if we updated the Message type
    };

    addMessage(userMsg);
    setInput("");
    setAgentTyping(true);

    try {
      // Pass full context to backend
      const responseData = await api.chat(input, sourceCode, outputCode, selection);

      // Create message with optional suggested fix
      // If suggest_fix is present, we map it to store's Message format if needed, 
      // or just store it in the message content as metadata? 
      // The Store Message interface has suggestedFix optional prop.

      const newMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'agent',
        content: responseData.response,
        suggestedFix: responseData.suggested_fix ? {
          description: responseData.suggested_fix.explanation,
          newCode: responseData.suggested_fix.fixed_ddl,
          target: 'output' // Default to output for DDL changes from chat
        } : undefined
      };

      addMessage(newMsg);

    } catch (error) {
      console.error("Chat error:", error);
      addMessage({
        id: (Date.now() + 1).toString(),
        role: 'agent',
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : "Unknown error"}`
      });
    } finally {
      setAgentTyping(false);
    }
  };

  const handleReviewFix = (fix: NonNullable<Message['suggestedFix']>) => {
    // Trigger global review state
    useStore.getState().setReviewState({
      isActive: true,
      originalCode: useStore.getState().outputCode,
      modifiedCode: fix.newCode,
      explanation: fix.description
    });
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden shadow-xl">
      <div className="flex items-center gap-2 px-4 py-3 bg-zinc-950 border-b border-zinc-800">
        <Sparkles size={16} className="text-purple-400" />
        <span className="text-sm font-semibold text-zinc-100 tracking-wide">Agent Chat</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'agent' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-zinc-700/50 text-zinc-300'
                }`}>
                {msg.role === 'agent' ? <Bot size={16} /> : <User size={16} />}
              </div>
              <div className={`flex flex-col gap-2 max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div
                  className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed prose prose-invert prose-p:my-1 prose-pre:my-2 prose-pre:bg-zinc-900 prose-pre:p-0 prose-pre:rounded-lg max-w-none ${msg.role === 'agent'
                    ? 'bg-zinc-800 text-zinc-100'
                    : 'bg-indigo-600 text-white'
                    }`}
                  style={{
                    ...(msg.isReport ? { animation: 'flash-highlight 4s ease-out forwards' } : {}),
                    ...(msg.isHelpful ? { animation: 'pulse-glow 3s infinite' } : {})
                  }}
                >
                  <style>{`
                    @keyframes flash-highlight {
                      0% { background-color: rgba(99, 102, 241, 0.5); box-shadow: 0 0 15px rgba(99, 102, 241, 0.3); }
                      20% { background-color: rgba(99, 102, 241, 0.3); box-shadow: 0 0 10px rgba(99, 102, 241, 0.2); }
                      100% { background-color: #27272a; box-shadow: none; } 
                    }
                    @keyframes pulse-glow {
                      0% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0); border: 1px solid rgba(99, 102, 241, 0.1); }
                      50% { box-shadow: 0 0 15px 0 rgba(99, 102, 241, 0.3); border: 1px solid rgba(99, 102, 241, 0.5); }
                      100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0); border: 1px solid rgba(99, 102, 241, 0.1); }
                    }
                  `}</style>

                  {msg.thoughts && (
                    <ThoughtProcess
                      thoughts={msg.thoughts}
                      isComplete={!!msg.isReport}
                    />
                  )}

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
                            style={vscDarkPlus}
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
                    {msg.content}
                  </ReactMarkdown>
                </div>

                {msg.suggestedFix && (
                  <div className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 overflow-hidden">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-emerald-400 flex items-center gap-1">
                        <Code2 size={12} /> Suggested Change
                      </span>
                    </div>
                    <div className="text-xs text-zinc-400 mb-3 border-l-2 border-zinc-700 pl-2">
                      {msg.suggestedFix.description}
                    </div>
                    <button
                      onClick={() => handleReviewFix(msg.suggestedFix!)}
                      className="flex items-center justify-center gap-2 w-full py-1.5 bg-zinc-800 hover:bg-emerald-500/10 hover:text-emerald-400 text-zinc-300 text-xs font-medium rounded transition-all border border-zinc-700 hover:border-emerald-500/50"
                    >
                      <Code2 size={12} /> Review Changes
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
          {isAgentTyping && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center shrink-0">
                <Bot size={16} />
              </div>
              <div className="bg-zinc-800 rounded-2xl px-4 py-3 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      <div className="relative p-4 bg-zinc-950 border-t border-zinc-800">
        {selection && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute bottom-full left-0 mb-2 w-full px-4"
          >
            <div className="flex items-center justify-between text-xs bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 px-3 py-2 rounded-lg backdrop-blur-md">
              <span className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse" />
                Active Selection: <b>{selection.source === 'source' ? 'Source' : 'Spanner'} Lines {selection.startLine}-{selection.endLine}</b>
              </span>
              <button
                onClick={() => useStore.getState().setSelection(null)}
                className="hover:bg-indigo-500/20 p-1 rounded transition-colors"
                title="Clear Selection"
              >
                ✕
              </button>
            </div>
          </motion.div>
        )}
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={selection ? "Ask about selection..." : "Ask agent..."}
            className="w-full bg-zinc-900 border border-zinc-700 text-zinc-100 rounded-xl pl-4 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 placeholder:text-zinc-600 transition-all"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 disabled:hover:bg-indigo-500 text-white rounded-lg transition-colors"
          >
            <Send size={14} />
          </button>
        </div>
        <p className="text-center text-[10px] text-zinc-600 mt-2 font-medium">
          Gemini can make mistakes, so double-check its output
        </p>
      </div>
    </div>
  );
}


