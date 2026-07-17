export default function AdminDashboard() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-2">Iron Keep HQ</h1>
        <h2 className="text-xl text-slate-400 mb-8">Admin Dashboard</h2>
        
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
          <p className="text-lg">
            Welcome to the command center. Your database connection is ready.
          </p>
        </div>
      </div>
    </div>
  );
}