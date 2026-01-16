import { motion } from 'framer-motion';
import { HelpCircle, AlertTriangle, CheckCircle } from 'lucide-react';

interface ConfidenceBadgeProps {
  score: number;
  explanation: string;
  isLoading?: boolean;
}

export function ConfidenceBadge({ score, explanation, isLoading = false }: ConfidenceBadgeProps) {

  const getBarColor = (s: number) => {
    if (s >= 90) return 'bg-emerald-500';
    if (s >= 70) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getIcon = (s: number) => {
    if (s >= 90) return <CheckCircle size={14} className="text-emerald-400" />;
    if (s >= 70) return <HelpCircle size={14} className="text-yellow-400" />;
    return <AlertTriangle size={14} className="text-red-400" />;
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900/50 border border-zinc-800 animate-pulse">
        <span className="w-3 h-3 border-2 border-zinc-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-medium text-zinc-400">Calculating confidence...</span>
      </div>
    );
  }

  return (
    <div className="group relative flex items-center gap-3 px-3 py-1.5 rounded-lg bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 transition-colors cursor-help">
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2 text-xs font-medium text-zinc-400">
          <span>Confidence</span>
          <span className={score >= 70 ? "text-zinc-200" : "text-red-300"}>{score}%</span>
        </div>

        {/* Progress Bar Container */}
        <div className="w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${score}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className={`h-full rounded-full ${getBarColor(score)} shadow-[0_0_8px_rgba(255,255,255,0.2)]`}
          />
        </div>
      </div>

      {getIcon(score)}

      {/* Tooltip */}
      <div className="absolute top-full right-0 mt-3 w-64 p-4 bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 rounded-xl text-xs text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-2xl origin-top-right scale-95 group-hover:scale-100 ring-1 ring-white/10">
        <div className="font-semibold text-zinc-100 mb-1 flex items-center gap-2">
          Syntactic Equivalence Assessment
        </div>
        <p className="leading-relaxed opacity-90">
          {explanation}
        </p>
        <div className="mt-2 text-[10px] text-zinc-500 font-mono pt-2 border-t border-zinc-800">
          Based on conversion logic & divergence
        </div>
      </div>
    </div>
  );
}
