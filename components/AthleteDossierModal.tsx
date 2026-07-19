'use client';

import React, { useState, useEffect } from 'react';
import { X, Activity, MessageSquare, Trash2 } from 'lucide-react';
import { supabase } from '../app/supabase';

interface MemberData {
  id: string;
  full_name: string;
  phone_number: string;
  joined_date?: string;
  status: string;
  email?: string;
  gender?: string;
  photo?: string;
}

interface Workout {
  id: string;
  member_name: string;
  exercise_name: string;
  sets: number;
  reps: number;
  weight_kg: number;
  created_at: string;
}

interface AthleteDossierModalProps {
  athlete: MemberData | null;
  onClose: () => void;
}

const getWorkoutDisplay = (exerciseName: string, weightKg: number) => {
  let isCoach = false;
  let rawName = exerciseName;

  if (rawName.endsWith(" [Coach]")) {
    isCoach = true;
    rawName = rawName.substring(0, rawName.length - 8);
  }

  const suffixRegex = /\s*\(([^)]+)\)$/;
  const match = rawName.match(suffixRegex);
  
  if (match) {
    const rawSuffix = match[1];
    const displayWeight = rawSuffix.toLowerCase().endsWith("kg") 
      ? rawSuffix 
      : `${rawSuffix} kg`;
    const cleanName = rawName.replace(suffixRegex, "");
    
    return {
      name: cleanName,
      weight: displayWeight,
      isCoach
    };
  }
  
  return {
    name: rawName,
    weight: `${weightKg} kg`,
    isCoach
  };
};

export default function AthleteDossierModal({ athlete, onClose }: AthleteDossierModalProps) {
  const [ownerSuggestion, setOwnerSuggestion] = useState('');
  const [assignEx, setAssignEx] = useState('');
  const [assignSets, setAssignSets] = useState('');
  const [assignReps, setAssignReps] = useState('');
  const [assignWeight, setAssignWeight] = useState('');
  const [assignStatus, setAssignStatus] = useState('');
  const [saveSuggestionStatus, setSaveSuggestionStatus] = useState('');
  const [athleteWorkouts, setAthleteWorkouts] = useState<Workout[]>([]);

  useEffect(() => {
    if (athlete) {
      setOwnerSuggestion('');
      setAssignEx('');
      setAssignSets('');
      setAssignReps('');
      setAssignWeight('');
      setAssignStatus('');
      setSaveSuggestionStatus('');
      fetchAthleteLogs(athlete.full_name);
    }
  }, [athlete]);

  const currentAthlete = athlete;
  if (!currentAthlete) return null;

  async function fetchAthleteLogs(memberName: string) {
    const { data } = await supabase
      .from("workouts")
      .select("*")
      .eq("member_name", memberName)
      .order("created_at", { ascending: false })
      .limit(30);

    if (data) {
      // Find the latest coach note suggestion
      const latestNote = data.find(w => w.exercise_name.startsWith("[Coach Note] "));
      setOwnerSuggestion(latestNote ? latestNote.exercise_name.substring(13) : "");

      // Filter out coach notes from the visible workouts list
      const logs = data.filter(w => !w.exercise_name.startsWith("[Coach Note] "));
      setAthleteWorkouts(logs.slice(0, 10));
    }
  }

  async function handleSaveSuggestions() {
    if (!currentAthlete) return;
    setSaveSuggestionStatus("Saving to Portal...");
    const { error } = await supabase.from("workouts").insert([{
      member_name: currentAthlete.full_name,
      exercise_name: `[Coach Note] ${ownerSuggestion}`,
      sets: 0,
      reps: 0,
      weight_kg: 0
    }]);
    
    if (!error) {
      setSaveSuggestionStatus("Suggestions Saved! ✅");
      setTimeout(() => setSaveSuggestionStatus(""), 3000);
    } else {
      setSaveSuggestionStatus(`Error: ${error.message}`);
    }
  }

  async function handleAssignWorkout(e: React.FormEvent) {
    e.preventDefault();
    if (!currentAthlete) return;

    setAssignStatus("Assigning to Matrix...");
    
    const trimmedWeight = assignWeight.trim();
    const isSimpleNumber = /^\d+(\.\d+)?$/.test(trimmedWeight);
    let finalExName = assignEx;
    let finalWeight = 0;

    if (isSimpleNumber) {
      finalWeight = parseFloat(trimmedWeight);
    } else {
      const hasNumbers = /\d/.test(trimmedWeight);
      const suffix = hasNumbers ? ` (${trimmedWeight} kg)` : ` (${trimmedWeight})`;
      const match = trimmedWeight.match(/\d+(\.\d+)?/);
      finalWeight = match ? parseFloat(match[0]) : 0;
      finalExName = `${assignEx}${suffix}`;
    }

    // Since this is assigned by the owner/coach, append " [Coach]" tag to the exercise_name
    finalExName = `${finalExName} [Coach]`;

    // Insert the workout AND update the suggestion concurrently!
    const [workoutRes, suggestionRes] = await Promise.all([
      supabase.from("workouts").insert([{ 
        member_name: currentAthlete.full_name,
        exercise_name: finalExName, 
        sets: parseInt(assignSets), 
        reps: parseInt(assignReps), 
        weight_kg: finalWeight 
      }]),
      supabase.from("workouts").insert([{
        member_name: currentAthlete.full_name,
        exercise_name: `[Coach Note] ${ownerSuggestion}`,
        sets: 0,
        reps: 0,
        weight_kg: 0
      }])
    ]);

    if (!workoutRes.error && !suggestionRes.error) {
      setAssignStatus("Workout & Suggestions Pushed! ✅");
      setAssignEx(""); setAssignSets(""); setAssignReps(""); setAssignWeight("");
      fetchAthleteLogs(currentAthlete.full_name);
      setTimeout(() => setAssignStatus(""), 3000);
    } else {
      const errMsg = workoutRes.error?.message || suggestionRes.error?.message || "Unknown error";
      setAssignStatus(`Error: ${errMsg}`);
    }
  }

  async function handleDeleteWorkout(id: string) {
    if (!currentAthlete) return;
    const { error } = await supabase.from("workouts").delete().eq("id", id);
    if (!error) fetchAthleteLogs(currentAthlete.full_name);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-4xl rounded-2xl p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"><X className="w-6 h-6" /></button>
        
        <div className="mb-8 border-b border-slate-800 pb-4">
          <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 uppercase tracking-wide font-sans">{currentAthlete.full_name}&apos;s Dossier</h2>
          <p className="text-slate-400 text-sm uppercase tracking-widest mt-1 font-sans">Live Progress & Assignment Routing</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 font-sans">
          {/* Assign Routine Form */}
          <div className="bg-slate-950/50 p-6 rounded-xl border border-slate-800 space-y-6">
            <div>
              <h3 className="text-lg font-bold text-blue-400 mb-4 flex items-center gap-2"><Activity className="w-5 h-5"/> Assign Workout Routine</h3>
              <form onSubmit={handleAssignWorkout} className="space-y-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5 uppercase font-mono tracking-widest font-bold">Pre-Planned Workout Helper</label>
                  <select 
                    onChange={(e) => {
                      if (e.target.value) {
                        setAssignEx(e.target.value);
                        if (!assignSets) setAssignSets("4");
                        if (!assignReps) setAssignReps("12");
                        if (!assignWeight) setAssignWeight("20");
                      }
                    }}
                    className="w-full bg-slate-900 border border-slate-750 rounded p-3 text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="">-- Choose Pre-Planned Routine (Optional) --</option>
                    <optgroup label="Monday: Chest & Triceps">
                      <option value="Bench Press">Flat Bench Press (Chest)</option>
                      <option value="Incline Dumbbell Press">Incline Dumbbell Press (Chest)</option>
                      <option value="Tricep Cable Pushdown">Tricep Cable Pushdown (Triceps)</option>
                      <option value="Chest Fly">Dumbbell Chest Fly (Chest)</option>
                    </optgroup>
                    <optgroup label="Tuesday: Back & Biceps">
                      <option value="Lat Pulldown">Lat Pulldown (Back)</option>
                      <option value="Seated Cable Row">Seated Cable Row (Back)</option>
                      <option value="Barbell Bicep Curl">Barbell Bicep Curl (Biceps)</option>
                      <option value="Pull-ups">Bodyweight Pull-ups (Back)</option>
                    </optgroup>
                    <optgroup label="Wednesday: Legs & Calves">
                      <option value="Barbell Squat">Barbell Squat (Legs)</option>
                      <option value="Leg Press">Leg Press (Legs)</option>
                      <option value="Leg Curl">Seated Leg Curl (Hamstrings)</option>
                      <option value="Calf Raise">Standing Calf Raise (Calves)</option>
                    </optgroup>
                    <optgroup label="Thursday: Shoulders & Abs">
                      <option value="Overhead Barbell Press">Overhead Barbell Press (Shoulders)</option>
                      <option value="Dumbbell Lateral Raise">Dumbbell Lateral Raise (Shoulders)</option>
                      <option value="Hanging Leg Raise">Hanging Leg Raise (Abs)</option>
                      <option value="Plank">Plank (Core)</option>
                    </optgroup>
                    <optgroup label="Friday: Arms & Forearms">
                      <option value="Dumbbell Bicep Curl">Dumbbell Bicep Curl (Biceps)</option>
                      <option value="Lying Tricep Extension">Lying Tricep Extension (Triceps)</option>
                      <option value="Hammer Bicep Curl">Hammer Bicep Curl (Biceps)</option>
                      <option value="Wrist Curl">Behind-Back Wrist Curl (Forearms)</option>
                    </optgroup>
                    <optgroup label="Saturday: Cardio & Core">
                      <option value="Treadmill Run">Treadmill Run (Cardio)</option>
                      <option value="Stationary Cycling">Stationary Cycling (Cardio)</option>
                      <option value="Russian Twist">Russian Twist (Core)</option>
                      <option value="Elliptical Trainer">Elliptical Trainer (Cardio)</option>
                    </optgroup>
                  </select>
                </div>
                <input type="text" required value={assignEx} onChange={(e) => setAssignEx(e.target.value)} placeholder="Exercise Name" className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-white focus:outline-none focus:border-blue-500" />
                <div className="flex gap-4">
                  <input type="number" required value={assignSets} onChange={(e) => setAssignSets(e.target.value)} placeholder="Sets" className="w-1/3 bg-slate-900 border border-slate-700 rounded p-3 text-white focus:outline-none" />
                  <input type="number" required value={assignReps} onChange={(e) => setAssignReps(e.target.value)} placeholder="Reps" className="w-1/3 bg-slate-900 border border-slate-700 rounded p-3 text-white focus:outline-none" />
                  <input type="text" required value={assignWeight} onChange={(e) => setAssignWeight(e.target.value)} placeholder="Weight (e.g. 40-60)" className="w-1/3 bg-slate-900 border border-slate-700 rounded p-3 text-white focus:outline-none" />
                </div>
                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg transition-colors uppercase tracking-widest text-sm mt-2">Push to Athlete Portal</button>
                {assignStatus && <p className="text-center mt-2 text-emerald-400 font-bold text-sm">{assignStatus}</p>}
              </form>
            </div>

            <div className="border-t border-slate-800 pt-6">
              <h3 className="text-lg font-bold text-brand-orange mb-4 flex items-center gap-2"><MessageSquare className="w-5 h-5 text-brand-orange"/> Trainer Suggestions</h3>
              <div className="space-y-4">
                <textarea 
                  value={ownerSuggestion} 
                  onChange={(e) => setOwnerSuggestion(e.target.value)} 
                  placeholder="Write training/diet suggestions (e.g. Cardio 20 mins, maintain protein goal...)" 
                  className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-white focus:outline-none focus:border-brand-orange/50 h-28 text-sm leading-relaxed"
                />

                {/* Presets */}
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "Calorie Deficit",
                    "Bulk Phase",
                    "20m Cardio Post-Workout",
                    "3L Water Daily",
                    "High Protein Intake",
                    "Rest 48h Between Legs"
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        const separator = ownerSuggestion.trim() ? "\n" : "";
                        setOwnerSuggestion(ownerSuggestion + separator + "• " + preset);
                      }}
                      className="text-[9px] bg-slate-900 border border-slate-800 hover:border-brand-orange/30 hover:text-brand-orange px-2 py-1 rounded text-gray-400 transition-colors"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>

                <div className="flex gap-2">
                  <button 
                    type="button" 
                    onClick={handleSaveSuggestions} 
                    className="flex-1 bg-brand-orange hover:bg-brand-orange/95 text-black font-extrabold py-3 rounded-lg transition-all uppercase tracking-widest text-[11px]"
                  >
                    Save Suggestions
                  </button>
                  
                  {/* WhatsApp Share */}
                  <button 
                    type="button"
                    onClick={() => {
                      const phone = currentAthlete.phone_number.replace(/\D/g, "");
                      const text = encodeURIComponent(`Hello ${currentAthlete.full_name},\n\nHere is your trainer suggestion from GYMNATION:\n\n${ownerSuggestion}`);
                      window.open(`https://wa.me/${phone.startsWith("91") ? phone : "91" + phone}?text=${text}`, "_blank");
                    }}
                    disabled={!ownerSuggestion.trim()}
                    className="px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-lg transition-colors flex items-center justify-center cursor-pointer"
                    title="Share suggestions via WhatsApp"
                  >
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.799.002-2.63-1.023-5.101-2.885-6.963C16.588 2.019 14.12 1.01 11.5 1.01c-5.448 0-9.88 4.37-9.884 9.8.002 2.03.543 4.022 1.568 5.793l-.993 3.634 3.756-.989zM15.8 12.9c-.2-.1-1.2-.6-1.39-.7-.19-.07-.32-.1-.45.1-.13.19-.5.6-.61.7-.1.1-.2.1-.4 0-.67-.3-1.28-.6-1.88-1.1-.47-.4-.78-.9-.88-1.1-.1-.2 0-.3.1-.4.07-.07.15-.17.22-.25.08-.07.1-.13.15-.22.05-.1.02-.18 0-.25-.03-.07-.45-1.08-.62-1.48-.17-.4-.36-.34-.5-.34s-.3-.02-.45-.02-.4.06-.6.27c-.2.2-.8.78-.8 1.9s.82 2.2 1 2.3c.18.18 3.2 4.9 7.8 6.9 1.1.5 1.9.8 2.6 1 .9.3 1.7.2 2.3.1.7-.1 1.39-.6 1.59-1.1.2-.6.2-1.1.1-1.2-.07-.1-.2-.2-.4-.3z"/>
                    </svg>
                  </button>
                </div>
                {saveSuggestionStatus && <p className="text-center mt-2 text-emerald-400 font-bold text-sm font-mono">{saveSuggestionStatus}</p>}
              </div>
            </div>
          </div>

          {/* View Tracked Progress */}
          <div className="bg-slate-950/50 p-6 rounded-xl border border-slate-800">
            <h3 className="text-lg font-bold text-purple-400 mb-4 flex items-center gap-2"><Activity className="w-5 h-5"/> Recent Logs</h3>
            <div className="space-y-3 max-h-[480px] overflow-y-auto pr-2">
              {athleteWorkouts.length === 0 ? (
                <p className="text-slate-500 text-center py-8">No workout data logged yet.</p>
              ) : (
                athleteWorkouts.map((workout) => {
                  const display = getWorkoutDisplay(workout.exercise_name, workout.weight_kg);
                  return (
                    <div key={workout.id} className="flex justify-between items-center bg-slate-900 p-3 rounded-lg border border-slate-700">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-200 block">{display.name}</span>
                          {display.isCoach ? (
                            <span className="text-[9px] bg-brand-orange/20 text-brand-orange border border-brand-orange/30 px-1.5 py-0.5 rounded font-mono font-bold uppercase tracking-wider">Coach</span>
                          ) : (
                            <span className="text-[9px] bg-slate-800 text-slate-400 border border-slate-700 px-1.5 py-0.5 rounded font-mono font-bold uppercase tracking-wider">Self</span>
                          )}
                        </div>
                        <span className="text-slate-400 text-sm">{workout.sets} sets × {workout.reps} reps @ {display.weight}</span>
                      </div>
                      <button onClick={() => handleDeleteWorkout(workout.id)} className="text-rose-500 hover:text-rose-400 p-2 rounded-lg hover:bg-slate-800 transition-colors"><Trash2 className="w-4 h-4"/></button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
