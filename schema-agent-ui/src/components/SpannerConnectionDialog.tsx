import { X, Cloud, CheckCircle, Database, AlertCircle, Lock, Unlock } from "lucide-react";
import { useEffect, useState } from "react";
import { useStore } from "../store";

interface SpannerConnectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (config: any) => void;
  isConnecting: boolean;
  error?: string | null;
}

export function SpannerConnectionDialog({ isOpen, onClose, onConnect, isConnecting, error }: SpannerConnectionDialogProps) {
  const { spannerConfig } = useStore();
  const [config, setConfig] = useState({
    projectId: spannerConfig?.projectId || '',
    instanceId: spannerConfig?.instanceId || '',
    databaseId: spannerConfig?.databaseId || ''
  });
  const [isProjectLocked, setIsProjectLocked] = useState(true);
  const [isInstanceLocked, setIsInstanceLocked] = useState(true);

  // Fetch defaults when dialog opens if not already set in store
  useEffect(() => {
    if (isOpen) {
      // If we already have values in the store (e.g. from previous migration), stick with them (or maybe we should still fetch defaults if empty?)
      // The user likely wants the defaults if they haven't manually overridden them or if the store is empty.
      // But if `spannerConfig` exists, it might be what they want. 
      // Let's safe-guard: if fields are empty, try to fill them.

      const shouldFetch = !config.projectId || !config.instanceId;

      if (shouldFetch) {
        import('../services/api').then(module => {
          module.api.getConfig().then(defaults => {
            setConfig(prev => ({
              ...prev,
              projectId: prev.projectId || defaults.spanner_project_id,
              instanceId: prev.instanceId || defaults.spanner_instance_id
            }));
          }).catch(err => console.error("Failed to load config defaults", err));
        });
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl max-w-md w-full flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 ring-1 ring-white/10">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800 bg-zinc-950/50 flex items-center justify-between">
          <div className="flex items-center gap-2 text-zinc-100">
            <Cloud size={18} className="text-indigo-400" />
            <h3 className="font-semibold">Configure Spanner</h3>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">GCP Project ID</label>
            <div className="relative">
              <input
                type="text"
                placeholder="my-gcp-project"
                value={config.projectId}
                onChange={(e) => setConfig({ ...config, projectId: e.target.value })}
                className={`w-full bg-zinc-950 border rounded-lg pl-3 pr-9 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-zinc-700 ${isProjectLocked ? "border-zinc-800 opacity-60 cursor-not-allowed" : "border-zinc-700 focus:border-indigo-500"}`}
                disabled={isProjectLocked}
              />
              <button
                type="button"
                onClick={() => setIsProjectLocked(!isProjectLocked)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors"
                disabled={isConnecting}
              >
                {isProjectLocked ? <Lock size={14} /> : <Unlock size={14} />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Spanner Instance ID</label>
            <div className="relative">
              <input
                type="text"
                placeholder="my-spanner-instance"
                value={config.instanceId}
                onChange={(e) => setConfig({ ...config, instanceId: e.target.value })}
                className={`w-full bg-zinc-950 border rounded-lg pl-3 pr-9 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-zinc-700 ${isInstanceLocked ? "border-zinc-800 opacity-60 cursor-not-allowed" : "border-zinc-700 focus:border-indigo-500"}`}
                disabled={isInstanceLocked}
              />
              <button
                type="button"
                onClick={() => setIsInstanceLocked(!isInstanceLocked)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors"
                disabled={isConnecting}
              >
                {isInstanceLocked ? <Lock size={14} /> : <Unlock size={14} />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Database ID</label>
             <div className="relative">
                <Database size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  placeholder="my-database"
                  value={config.databaseId}
                  onChange={(e) => setConfig({ ...config, databaseId: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-zinc-700"
                />
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
        <div className="px-6 py-4 bg-zinc-950/50 border-t border-zinc-800 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConnect({
              project_id: config.projectId,
              instance_id: config.instanceId,
              database_id: config.databaseId
            })}
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
