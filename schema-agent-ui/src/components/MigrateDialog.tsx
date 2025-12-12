import { useState } from 'react';
import { Database, AlertTriangle, Loader2, CheckCircle, ExternalLink } from 'lucide-react';

interface MigrateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onMigrate: (projectId: string, instanceId: string, databaseId: string) => Promise<void>;
  isMigrating: boolean;
  migrationResult?: {
    success: boolean;
    database_uri: string;
    message: string;
  } | null;
}

export function MigrateDialog({ isOpen, onClose, onMigrate, isMigrating, migrationResult }: MigrateDialogProps) {
  const [projectId, setProjectId] = useState('');
  const [instanceId, setInstanceId] = useState('');
  const [databaseId, setDatabaseId] = useState('');

  if (!isOpen) return null;

  if (migrationResult?.success) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div
          className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200 ring-1 ring-white/10"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-8 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="text-emerald-500" size={32} />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Migration Successful!</h3>
            <p className="text-zinc-400 text-sm mb-6">
              Your database has been created and the schema has been applied.
            </p>

            <div className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 mb-6 text-left">
              <div className="text-xs text-zinc-500 mb-1 uppercase tracking-wider font-semibold">Database URI</div>
              <div className="text-sm font-mono text-zinc-300 break-all select-all">
                {migrationResult.database_uri}
              </div>
            </div>

            <a
              href={`https://console.cloud.google.com/spanner/instances/${instanceId}/databases/${databaseId}/details?project=${projectId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-indigo-500/20 mb-3"
            >
              <ExternalLink size={16} />
              Open in Cloud Console
            </a>

            <button
              onClick={onClose}
              className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onMigrate(projectId, instanceId, databaseId);
  };

  const isFormValid = projectId.trim() && instanceId.trim() && databaseId.trim();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div
        className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200 ring-1 ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-zinc-800 bg-zinc-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg">
              <Database className="text-indigo-400" size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-100">Migrate to Spanner</h3>
              <p className="text-xs text-zinc-400">Create database and apply schema</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Project ID</label>
            <input
              type="text"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              placeholder="my-gcp-project"
              className="w-full px-4 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 placeholder:text-zinc-600"
              disabled={isMigrating}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Instance ID</label>
            <input
              type="text"
              value={instanceId}
              onChange={(e) => setInstanceId(e.target.value)}
              placeholder="my-spanner-instance"
              className="w-full px-4 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 placeholder:text-zinc-600"
              disabled={isMigrating}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">New Database Name</label>
            <input
              type="text"
              value={databaseId}
              onChange={(e) => setDatabaseId(e.target.value)}
              placeholder="new-database-name"
              className="w-full px-4 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 placeholder:text-zinc-600"
              disabled={isMigrating}
            />
          </div>

          <div className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-lg flex gap-3 items-start mt-4">
            <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={16} />
            <div className="text-xs text-amber-200/80 leading-relaxed">
              Ensure the backend service has <span className="font-mono text-amber-200 bg-amber-500/10 px-1 rounded">spanner.databases.create</span> permission on the specified instance.
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isMigrating}
              className="flex-1 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isFormValid || isMigrating}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isMigrating ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  Creating...
                </>
              ) : (
                "Create Database"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
