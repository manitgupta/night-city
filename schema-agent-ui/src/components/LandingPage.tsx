import { motion } from "framer-motion";
import { Database, Search, ArrowRight, Sparkles } from "lucide-react";

interface LandingPageProps {
  onSelectMode: (mode: 'schema' | 'query') => void;
}

export function LandingPage({ onSelectMode }: LandingPageProps) {
  return (
    <div className="min-h-screen w-full bg-zinc-950 flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans selection:bg-indigo-500/30">
      {/* Background Gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-purple-500/5 blur-[100px] rounded-full pointer-events-none" />

      <div className="relative z-10 max-w-5xl w-full flex flex-col items-center gap-12">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-center space-y-6"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900/50 border border-zinc-800 backdrop-blur-md mb-4">
            <Sparkles size={14} className="text-amber-300" />
            <span className="text-xs font-medium text-zinc-400">Intelligent Spanner Migration</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold bg-clip-text text-transparent bg-gradient-to-br from-white via-zinc-200 to-zinc-500 tracking-tight">
            Night City
          </h1>
          <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            Your gateway to seamless database modernization. Choose your path to transform schemas or queries with agentic intelligence.
          </p>
        </motion.div>

        {/* Action Cards */}
        <div className="grid md:grid-cols-2 gap-6 w-full max-w-4xl px-4">
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
                <span>Start Migration</span>
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
