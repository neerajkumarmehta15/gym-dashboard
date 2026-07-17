export default function AdminDashboard() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <header className="border-b border-slate-800 pb-4">
          <h1 className="text-4xl font-bold mb-2">Iron Keep HQ</h1>
          <h2 className="text-xl text-slate-400">Athlete Command Center</h2>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Module 1: Strength & Core Tracking */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 shadow-lg">
            <h3 className="text-2xl font-semibold mb-4 text-blue-400">Strength & Core Log</h3>
            <form className="space-y-4">
              <input 
                type="text" 
                placeholder="Exercise (e.g., Bench Press, Cable Crunches)" 
                className="w-full bg-slate-800 border border-slate-700 rounded p-3 text-white focus:outline-none focus:border-blue-500" 
              />
              <div className="flex gap-4">
                <input type="number" placeholder="Sets" className="w-1/3 bg-slate-800 border border-slate-700 rounded p-3 text-white focus:outline-none" />
                <input type="number" placeholder="Reps" className="w-1/3 bg-slate-800 border border-slate-700 rounded p-3 text-white focus:outline-none" />
                <input type="number" placeholder="Weight (kg)" className="w-1/3 bg-slate-800 border border-slate-700 rounded p-3 text-white focus:outline-none" />
              </div>
              <button type="button" className="w-full bg-blue-600 hover:bg-blue-700 transition-colors text-white font-bold py-3 rounded mt-2">
                Log Workout
              </button>
            </form>
          </div>

          {/* Module 2: Nutrition & Macros */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 shadow-lg">
            <h3 className="text-2xl font-semibold mb-4 text-green-400">Nutrition & Macros</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-slate-800 border border-slate-700 p-4 rounded">
                <span className="text-slate-300">Daily Protein Target</span>
                <span className="font-bold text-xl text-white">160g</span>
              </div>
              
              <h4 className="text-sm text-slate-400 uppercase tracking-wider mt-4 mb-2">Quick Log Staples</h4>
              <div className="flex flex-wrap gap-2">
                <button className="bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2 rounded text-sm transition-colors">🥚 Eggs</button>
                <button className="bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2 rounded text-sm transition-colors">🧀 Paneer</button>
                <button className="bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2 rounded text-sm transition-colors">🌱 Soya</button>
                <button className="bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2 rounded text-sm transition-colors">🥤 Whey Protein</button>
                <button className="bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2 rounded text-sm transition-colors">⚡ Creatine</button>
              </div>
            </div>
          </div>

          {/* Module 3: Body Metrics & Recovery */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 shadow-lg md:col-span-2">
            <h3 className="text-2xl font-semibold mb-4 text-purple-400">Metrics & Recovery</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              <div className="bg-slate-800 border border-slate-700 p-6 rounded">
                <p className="text-slate-400 text-sm uppercase tracking-wide mb-1">Body Weight</p>
                <p className="text-4xl font-bold text-white">74 <span className="text-xl text-slate-500">kg</span></p>
              </div>
              <div className="bg-slate-800 border border-slate-700 p-6 rounded">
                <p className="text-slate-400 text-sm uppercase tracking-wide mb-1">Height</p>
                <p className="text-4xl font-bold text-white">5'10"</p>
              </div>
              <div className="bg-slate-800 border border-slate-700 p-6 rounded">
                <p className="text-slate-400 text-sm uppercase tracking-wide mb-1">Sleep Logs</p>
                <p className="text-4xl font-bold text-white">8.0 <span className="text-xl text-slate-500">hrs</span></p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}