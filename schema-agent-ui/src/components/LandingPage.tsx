import { motion } from "framer-motion";
import { Database, Search, ArrowRight, Sparkles, FolderSync } from "lucide-react";

interface LandingPageProps {
  onSelectMode: (mode: 'schema' | 'query' | 'migration') => void;
}

export function LandingPage({ onSelectMode }: LandingPageProps) {
  return (
    <div className="min-h-screen w-full bg-zinc-950 flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans selection:bg-indigo-500/30">
      {/* Background Gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-purple-500/5 blur-[100px] rounded-full pointer-events-none" />

      <div className="flex-1 w-full max-w-7xl mx-auto px-6 py-12 flex flex-col justify-center relative z-10 min-h-[calc(100vh-80px)]">
        <div className="text-center space-y-6 mb-16">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-900 border border-zinc-800 text-sm text-zinc-400"
          >
            <Sparkles size={16} className="text-yellow-500" />
            <span>Intelligent Spanner Migration</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-5xl md:text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-white via-zinc-200 to-zinc-500 tracking-tight"
          >
            Night City
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed"
          >
            Your gateway to seamless database modernization. Choose your path to transform schemas, queries, or entire applications with agentic intelligence.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-6xl mx-auto">
          {/* Schema Conversion Card */}
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            onClick={() => onSelectMode('schema')}
            className="group relative flex flex-col items-start p-8 h-80 rounded-3xl bg-zinc-900/40 border border-zinc-800 hover:border-indigo-500/50 hover:bg-zinc-900/60 transition-all duration-300 backdrop-blur-sm text-left overflow-hidden isolate"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            
            <div className="p-3 bg-indigo-500/20 rounded-2xl mb-auto group-hover:scale-110 transition-transform duration-300 text-indigo-400">
              <Database size={32} />
            </div>

            <div className="space-y-4 relative z-10">
              <h3 className="text-2xl font-semibold text-zinc-100 group-hover:text-indigo-200 transition-colors">
                Schema Conversion
              </h3>
              <p className="text-zinc-400 leading-relaxed max-w-sm">
                Transform your existing database schema to Google Cloud Spanner DDL with intelligent type mapping and validation.
              </p>
              
              <div className="flex items-center gap-2 text-sm font-medium text-indigo-400 group-hover:translate-x-1 transition-transform">
                <span>Start Schema Conversion</span>
                <ArrowRight size={16} />
              </div>
            </div>
          </motion.button>

          {/* Query Conversion Card */}
          <motion.button
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            onClick={() => onSelectMode('query')}
            className="group relative flex flex-col items-start p-8 h-80 rounded-3xl bg-zinc-900/40 border border-zinc-800 hover:border-purple-500/50 hover:bg-zinc-900/60 transition-all duration-300 backdrop-blur-sm text-left overflow-hidden isolate"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            
            <div className="p-3 bg-purple-500/20 rounded-2xl mb-auto group-hover:scale-110 transition-transform duration-300 text-purple-400">
              <Search size={32} />
            </div>

            <div className="space-y-4 relative z-10">
              <h3 className="text-2xl font-semibold text-zinc-100 group-hover:text-purple-200 transition-colors">
                Query Conversion
              </h3>
              <p className="text-zinc-400 leading-relaxed max-w-sm">
                Convert complex SQL queries to Spanner SQL dialects. Optimize for performance and compatibility.
              </p>
              
              <div className="flex items-center gap-2 text-sm font-medium text-purple-400 group-hover:translate-x-1 transition-transform">
                <span>Convert Queries</span>
                <ArrowRight size={16} />
              </div>
            </div>
          </motion.button>
          {/* Application Migration Card */}
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            onClick={() => onSelectMode('migration')}
            className="group relative flex flex-col items-start p-8 h-80 rounded-3xl bg-zinc-900/40 border border-zinc-800 hover:border-emerald-500/50 hover:bg-zinc-900/60 transition-all duration-300 backdrop-blur-sm text-left overflow-hidden isolate col-span-1"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <div className="p-3 bg-emerald-500/20 rounded-2xl mb-auto group-hover:scale-110 transition-transform duration-300 text-emerald-400">
              <FolderSync size={32} />
            </div>

            <div className="space-y-4 relative z-10">
              <h3 className="text-2xl font-semibold text-zinc-100 group-hover:text-emerald-200 transition-colors">
                Application Migration
              </h3>
              <p className="text-zinc-400 leading-relaxed max-w-sm">
                End-to-end autonomous migration of your codebase. Point to a GitHub repo and let our agent refactor configurations and fix tests for you.
              </p>

              <div className="flex items-center gap-2 text-sm font-medium text-emerald-400 group-hover:translate-x-1 transition-transform">
                <span>Start Application Migration</span>
                <ArrowRight size={16} />
              </div>
            </div>
          </motion.button>
        </div>
      </div>
      
      {/* Footer / Info */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="absolute bottom-6 text-zinc-500 text-xs text-center"
      >
        <p>© 2026 Night City Project. Powered by Google Cloud Spanner & Vertex AI.</p>
      </motion.div>
    </div>
  );
}
