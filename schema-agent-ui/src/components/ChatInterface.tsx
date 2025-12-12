import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Sparkles, Code2, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore, Message } from "../store";
import { api } from "../services/api";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

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
      const responseText = await api.chat(input, sourceCode, outputCode, selection);

      addMessage({
        id: (Date.now() + 1).toString(),
        role: 'agent',
        content: responseText
      });

      // We can add logic here to parse 'suggestedFix' from response if the Agent returns structured data
      // For now, the backend returns raw text, so we display it directly.

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

  const handleApplyFix = (fix: NonNullable<Message['suggestedFix']>) => {
    if (fix.target === 'source') {
      useStore.getState().setSourceCode(fix.newCode);
      addMessage({
        id: Date.now().toString(),
        role: 'agent',
        content: "Fix applied to Source Schema! 🚀"
      });
    } else if (fix.target === 'output') {
      useStore.getState().setOutputCode(fix.newCode);
      addMessage({
        id: Date.now().toString(),
        role: 'agent',
        content: "Fix applied to Spanner Output! 🚀"
      });
    }
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
                  style={msg.isReport ? {
                    animation: 'flash-highlight 4s ease-out forwards'
                  } : {}}
                >
                  <style>{`
                    @keyframes flash-highlight {
                      0% { background-color: rgba(99, 102, 241, 0.5); box-shadow: 0 0 15px rgba(99, 102, 241, 0.3); }
                      20% { background-color: rgba(99, 102, 241, 0.3); box-shadow: 0 0 10px rgba(99, 102, 241, 0.2); }
                      100% { background-color: #27272a; box-shadow: none; } 
                    }
                  `}</style>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      code(props) {
                        const { children, className, node, ref, ...rest } = props
                        const match = /language-(\w+)/.exec(className || '')
                        return match ? (
                          <SyntaxHighlighter
                            {...rest}
                            PreTag="div"
                            children={String(children).replace(/\n$/, '')}
                            language={match[1]}
                            style={vscDarkPlus}
                            customStyle={{ margin: 0, borderRadius: '0.5rem', background: '#18181b' }}
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
                      onClick={() => handleApplyFix(msg.suggestedFix!)}
                      className="flex items-center justify-center gap-2 w-full py-1.5 bg-zinc-800 hover:bg-emerald-500/10 hover:text-emerald-400 text-zinc-300 text-xs font-medium rounded transition-all border border-zinc-700 hover:border-emerald-500/50"
                    >
                      <Check size={12} /> Apply Fix
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

