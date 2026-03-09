import { useState } from "react";
import { X, Database, CheckCircle, Server, User, Key, Globe, AlertCircle, ChevronDown } from "lucide-react";

interface SourceConnectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (config: any) => void;
  isConnecting: boolean;
  error?: string | null;
}

const DIALECTS = [
  { id: 'mysql', name: 'MySQL' },
  { id: 'postgres', name: 'PostgreSQL' },
  { id: 'oracle', name: 'Oracle' },
  { id: 'sqlserver', name: 'SQL Server' },
  { id: 'cassandra', name: 'Cassandra' },
  { id: 'neo4j', name: 'Neo4J' }
];

export function SourceConnectionDialog({ isOpen, onClose, onConnect, isConnecting, error }: SourceConnectionDialogProps) {
  const [config, setConfig] = useState({
    dialect: 'mysql',
    host: '',
    port: '',
    username: '',
    password: '',
    database: ''
  });
  const [showDropdown, setShowDropdown] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl max-w-md w-full flex flex-col animate-in zoom-in-95 duration-200 ring-1 ring-white/10">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800 bg-zinc-950/50 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-2 text-zinc-100">
            <Database size={18} className="text-indigo-400" />
            <h3 className="font-semibold">Connect Source Database</h3>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400">Database Type</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowDropdown(!showDropdown)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${config.dialect ? 'bg-indigo-500' : 'bg-zinc-600'}`} />
                  <span>{DIALECTS.find(d => d.id === config.dialect)?.name}</span>
                </div>
                <ChevronDown size={14} className={`text-zinc-500 transition-transform duration-200 group-hover:text-zinc-300 ${showDropdown ? "rotate-180" : ""}`} />
              </button>

              {showDropdown && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowDropdown(false)} />
                  <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-20 overflow-hidden py-1 animate-in fade-in zoom-in-95 duration-100">
                    {DIALECTS.map(d => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => {
                          setConfig({ ...config, dialect: d.id });
                          setShowDropdown(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2 ${config.dialect === d.id
                            ? "bg-indigo-500/10 text-indigo-400"
                            : "text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
                          }`}
                      >
                        <div className={`w-1.5 h-1.5 rounded-full ${config.dialect === d.id ? "bg-indigo-500" : "bg-transparent"}`} />
                        {d.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">Host / IP</label>
              <div className="relative">
                <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  placeholder="127.0.0.1"
                  value={config.host}
                  onChange={(e) => setConfig({ ...config, host: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-zinc-700"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">Port</label>
              <input
                type="text"
                placeholder="3306"
                value={config.port}
                onChange={(e) => setConfig({ ...config, port: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-zinc-700"
              />
            </div>
          </div>

          <div className="space-y-1.5">
             <label className="text-xs font-medium text-zinc-400">Database Name</label>
             <div className="relative">
                <Server size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  placeholder="my_database"
                  value={config.database}
                  onChange={(e) => setConfig({ ...config, database: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-zinc-700"
                />
             </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">Username</label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  placeholder="admin"
                  value={config.username}
                  onChange={(e) => setConfig({ ...config, username: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-zinc-700"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">Password</label>
              <div className="relative">
                <Key size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="password"
                  placeholder="••••••"
                  value={config.password}
                  onChange={(e) => setConfig({ ...config, password: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-zinc-700"
                />
              </div>
            </div>
          </div>


          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-2 text-red-200 text-sm animate-in fade-in slide-in-from-top-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-zinc-950/50 border-t border-zinc-800 flex justify-end gap-3 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConnect(config)}
            disabled={isConnecting}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-wait"
          >
            {isConnecting ? (
              <>
                <span className="w-3 h-3 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <CheckCircle size={16} />
                Connect
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
