import { Search } from "lucide-react";

export function QueryConverter() {
  return (
    <div className="flex flex-col h-screen w-full bg-zinc-950 text-zinc-200">
      {/* Header */}
      <header className="h-14 border-b border-zinc-800 bg-zinc-950/50 backdrop-blur-xl flex items-center px-6 shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg shadow-lg shadow-purple-500/20">
            <Search size={18} className="text-white" />
          </div>
          <h1 className="font-bold text-lg bg-clip-text text-transparent bg-gradient-to-r from-zinc-100 to-zinc-400">
            Query Conversion
          </h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-6 bg-grid-zinc-900/50 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/50 to-zinc-950 pointer-events-none" />
        
        <div className="z-10 text-center space-y-4 max-w-md">
          <div className="w-16 h-16 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center mx-auto shadow-2xl">
            <Search size={32} className="text-zinc-600" />
          </div>
          <h2 className="text-2xl font-semibold text-zinc-200">Ready for Queries</h2>
          <p className="text-zinc-500">
            This module will be implemented soon to handle complex SQL transformations.
          </p>
        </div>
      </main>
    </div>
  );
}
