import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Sparkles, Code2, Check, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore, Message } from "../store";

export function ChatInterface() {
  const { messages, addMessage, isAgentTyping, setAgentTyping, selection, setSourceCode } = useStore();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isAgentTyping]);

  const handleSend = () => {
    if (!input.trim()) return;

    const contextPrefix = selection
      ? `[Regarding selection lines ${selection.startLine}-${selection.endLine}]: \n`
      : "";

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: contextPrefix + input,
    };

    addMessage(userMsg);
    setInput("");
    setAgentTyping(true);

    // Simulate Agent Response
    setTimeout(() => {
      setAgentTyping(false);

      const isFixRequest = input.toLowerCase().includes("fix") || input.toLowerCase().includes("pk") || input.toLowerCase().includes("primary key");

      if (isFixRequest) {
        addMessage({
          id: (Date.now() + 1).toString(),
          role: 'agent',
          content: "I noticed the Primary Key is 'SERIAL' which is an anti-pattern in Spanner (hotspotting). applying UUIDs is better.",
          suggestedFix: {
            description: "Replace SERIAL with UUID (STRING(36))",
            target: 'source',
            newCode: `CREATE TABLE users (
  id VARCHAR(36) NOT NULL PRIMARY KEY, -- Changed to UUID for Spanner
  username VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);`
          }
        });
      } else {
        addMessage({
          id: (Date.now() + 1).toString(),
          role: 'agent',
          content: "I see. How specifically would you like to handle this constraint? Spanner supports interleaved tables if you want to optimize for locality."
        });
      }
    }, 1500);
  };

  const handleApplyFix = (fix: NonNullable<Message['suggestedFix']>) => {
    if (fix.target === 'source') {
      setSourceCode(fix.newCode);
      addMessage({
        id: Date.now().toString(),
        role: 'agent',
        content: "Fix applied to Source Schema! 🚀"
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
                <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${msg.role === 'agent'
                    ? 'bg-zinc-800 text-zinc-100'
                    : 'bg-indigo-600 text-white'
                  }`}>
                  {msg.content}
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

      <div className="p-4 bg-zinc-950 border-t border-zinc-800">
        {selection && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-2 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded text-xs text-indigo-300 flex items-center justify-between"
          >
            <span className="truncate max-w-[200px]">Context: {selection.code.substring(0, 30)}...</span>
            <button onClick={() => useStore.getState().setSelection(null)} className="hover:text-white">✕</button>
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
      </div>
    </div>
  );
}
