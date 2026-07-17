'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../supabase';
import { useRouter } from 'next/navigation';
import { Dumbbell, Utensils, LogOut, History, X } from 'lucide-react';

export default function AthleteDashboard() {
  const [user, setUser] = useState<any>(null);
  const [isWorkoutOpen, setIsWorkoutOpen] = useState(false);
  const [isNutritionOpen, setIsNutritionOpen] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) useRouter().push('/athlete');
      else setUser(session.user);
    };
    init();
  }, []);

  async function logWorkout(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    // We use the ID directly from the state
    const { error } = await supabase.from('workout_logs').insert([{
      member_id: user.id,
      focus_area: formData.get('focus'),
      exercises: formData.get('exercises')
    }]);

    if (error) {
      console.error("Database Error:", error);
      alert("Error saving: " + error.message);
    } else {
      setIsWorkoutOpen(false);
      alert("Workout Saved Successfully!");
    }
  }

  async function logNutrition(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const { error } = await supabase.from('nutrition_logs').insert([{
      member_id: user.id,
      protein_sources: formData.get('sources'),
      total_protein_g: formData.get('protein')
    }]);

    if (error) {
      console.error("Database Error:", error);
      alert("Error saving: " + error.message);
    } else {
      setIsNutritionOpen(false);
      alert("Nutrition Saved Successfully!");
    }
  }

  if (!user) return <div className="p-10 text-white">Loading...</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-10">
          <h1 className="text-2xl font-black">Athlete Portal</h1>
          <button onClick={() => supabase.auth.signOut().then(() => window.location.reload())} className="text-rose-400"><LogOut /></button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button onClick={() => setIsWorkoutOpen(true)} className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
            <Dumbbell className="text-emerald-400 mb-2" />
            <p className="font-bold">Log Workout</p>
          </button>
          <button onClick={() => setIsNutritionOpen(true)} className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
            <Utensils className="text-cyan-400 mb-2" />
            <p className="font-bold">Log Nutrition</p>
          </button>
        </div>
      </div>

      {/* Workout Modal */}
      {isWorkoutOpen && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4">
          <form onSubmit={logWorkout} className="bg-slate-900 p-6 rounded-2xl w-full max-w-sm border border-slate-800">
            <div className="flex justify-between mb-4"><h3 className="font-bold">New Workout</h3><button onClick={() => setIsWorkoutOpen(false)}><X/></button></div>
            <input name="focus" placeholder="Focus Area (e.g. Chest)" className="w-full bg-slate-950 p-3 rounded-lg mb-3 border border-slate-800" required />
            <textarea name="exercises" placeholder="Exercises" className="w-full bg-slate-950 p-3 rounded-lg mb-3 border border-slate-800" required />
            <button className="w-full bg-emerald-500 text-slate-950 font-bold p-3 rounded-xl">Save Workout</button>
          </form>
        </div>
      )}

      {/* Nutrition Modal */}
      {isNutritionOpen && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4">
          <form onSubmit={logNutrition} className="bg-slate-900 p-6 rounded-2xl w-full max-w-sm border border-slate-800">
            <div className="flex justify-between mb-4"><h3 className="font-bold">New Nutrition</h3><button onClick={() => setIsNutritionOpen(false)}><X/></button></div>
            <input name="sources" placeholder="Sources (e.g. Eggs, Paneer)" className="w-full bg-slate-950 p-3 rounded-lg mb-3 border border-slate-800" required />
            <input name="protein" type="number" placeholder="Total Protein (g)" className="w-full bg-slate-950 p-3 rounded-lg mb-3 border border-slate-800" required />
            <button className="w-full bg-cyan-500 text-slate-950 font-bold p-3 rounded-xl">Save Nutrition</button>
          </form>
        </div>
      )}
    </div>
  );
}