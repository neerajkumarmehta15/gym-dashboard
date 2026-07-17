"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase Connection
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// TypeScript Definitions
interface Workout {
  id: string;
  exercise_name: string;
  sets: number;
  reps: number;
  weight_kg: number;
}

export default function AdminDashboard() {
  // --- STATE: WORKOUTS ---
  const [exercise, setExercise] = useState("");
  const [sets, setSets] = useState("");
  const [reps, setReps] = useState("");
  const [weight, setWeight] = useState("");
  const [workoutStatus, setWorkoutStatus] = useState("");
  const [recentWorkouts, setRecentWorkouts] = useState<Workout[]>([]);

  // --- STATE: NUTRITION ---
  const [dailyProtein, setDailyProtein] = useState(0);
  const proteinTarget = 160;
  const [nutritionStatus, setNutritionStatus] = useState("");

  // --- STATE: METRICS ---
  const [currentWeight, setCurrentWeight] = useState(74.0);
  const [currentSleep, setCurrentSleep] = useState(8.0);
  const [inputWeight, setInputWeight] = useState("");
  const [inputSleep, setInputSleep] = useState("");
  const [metricsStatus, setMetricsStatus] = useState("");

  // --- FETCH ALL DATA ---
  const fetchDashboardData = async () => {
    // 1. Get recent workouts
    const { data: wData } = await supabase
      .from("workouts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(3);
    if (wData) setRecentWorkouts(wData);

    // 2. Get today's protein total
    const today = new Date().toISOString().split("T")[0];
    const { data: nData } = await supabase
      .from("nutrition_logs")
      .select("protein_grams")
      .gte("created_at", today);
    if (nData) {
      const total = nData.reduce((acc, curr) => acc + Number(curr.protein_grams), 0);
      setDailyProtein(total);
    }

    // 3. Get latest metrics
    const { data: mData } = await supabase
      .from("recovery_metrics")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1);
    if (mData && mData.length > 0) {
      setCurrentWeight(mData[0].body_weight_kg);
      setCurrentSleep(mData[0].sleep_hours);
    }
  };

  // Run on page load
  useEffect(() => {
    fetchDashboardData();
  }, []);

  // --- SUBMIT HANDLERS ---
  const handleLogWorkout = async (e: React.FormEvent) => {
    e.preventDefault();
    setWorkoutStatus("Logging lift...");
    const { error } = await supabase.from("workouts").insert([
      { exercise_name: exercise, sets: parseInt(sets), reps: parseInt(reps), weight_kg: parseFloat(weight) }
    ]);
    if (error) setWorkoutStatus("Error saving workout.");
    else {
      setWorkoutStatus("Workout Logged! ⚡");
      setExercise(""); setSets(""); setReps(""); setWeight("");
      fetchDashboardData();
      setTimeout(() => setWorkoutStatus(""), 3000);
    }
  };

  const handleQuickLogNutrition = async (food: string, protein: number) => {
    setNutritionStatus(`Logging ${food}...`);
    const { error } = await supabase.from("nutrition_logs").insert([
      { food_item: food, protein_grams: protein }
    ]);
    if (error) setNutritionStatus("Error logging food.");
    else {
      setNutritionStatus(`Added ${food} (+${protein}g) 🥩`);
      fetchDashboardData();
      setTimeout(() => setNutritionStatus(""), 3000);
    }
  };

  const handleLogMetrics = async (e: React.FormEvent) => {
    e.preventDefault();
    setMetricsStatus("Updating metrics...");
    const w = inputWeight ? parseFloat(inputWeight) : currentWeight;
    const s = inputSleep ? parseFloat(inputSleep) : currentSleep;

    const { error } = await supabase.from("recovery_metrics").insert([
      { body_weight_kg: w, sleep_hours: s }
    ]);
    if (error) setMetricsStatus("Error saving metrics.");
    else {
      setMetricsStatus("Metrics Updated! 📈");
      setInputWeight(""); setInputSleep("");
      fetchDashboardData();
      setTimeout(() => setMetricsStatus(""), 3000);
    }
  };

  // Calculate UI progress bar
  const proteinPercentage = Math.min((dailyProtein / proteinTarget) * 100, 100);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <header className="border-b border-slate-800 pb-4">
          <h1 className="text-4xl font-bold mb-2">Iron Keep HQ</h1>
          <h2 className="text-xl text-slate-400">Athlete Command Center</h2>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* MODULE 1: STRENGTH & CORE */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 shadow-lg flex flex-col justify-between">
            <div>
              <h3 className="text-2xl font-semibold mb-4 text-blue-400">Strength & Core Log</h3>
              <form onSubmit={handleLogWorkout} className="space-y-4">
                <input type="text" required value={exercise} onChange={(e) => setExercise(e.target.value)} placeholder="Exercise" className="w-full bg-slate-800 border border-slate-700 rounded p-3 text-white focus:outline-none focus:border-blue-500" />
                <div className="flex gap-4">
                  <input type="number" required value={sets} onChange={(e) => setSets(e.target.value)} placeholder="Sets" className="w-1/3 bg-slate-800 border border-slate-700 rounded p-3 text-white focus:outline-none" />
                  <input type="number" required value={reps} onChange={(e) => setReps(e.target.value)} placeholder="Reps" className="w-1/3 bg-slate-800 border border-slate-700 rounded p-3 text-white focus:outline-none" />
                  <input type="number" required step="0.5" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="Weight (kg)" className="w-1/3 bg-slate-800 border border-slate-700 rounded p-3 text-white focus:outline-none" />
                </div>
                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 transition-colors text-white font-bold py-3 rounded mt-2">Log Workout</button>
                {workoutStatus && <p className="text-center mt-2 text-green-400">{workoutStatus}</p>}
              </form>
            </div>

            <div className="mt-6 border-t border-slate-800 pt-4">
              <h4 className="text-sm text-slate-400 uppercase tracking-wider mb-3">Recent Lifts</h4>
              <div className="space-y-2">
                {recentWorkouts.map((workout) => (
                  <div key={workout.id} className="flex justify-between items-center bg-slate-800 p-3 rounded border border-slate-700">
                    <span className="font-semibold text-white">{workout.exercise_name}</span>
                    <span className="text-slate-300 text-sm">{workout.sets} x {workout.reps} @ {workout.weight_kg}kg</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* MODULE 2: NUTRITION & MACROS */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 shadow-lg">
            <h3 className="text-2xl font-semibold mb-4 text-green-400">Nutrition & Macros</h3>
            <div className="space-y-6">
              <div className="bg-slate-800 border border-slate-700 p-4 rounded">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-slate-300">Daily Protein Target</span>
                  <span className="font-bold text-xl text-white">{dailyProtein} / {proteinTarget}g</span>
                </div>
                {/* Progress Bar */}
                <div className="w-full bg-slate-950 rounded-full h-3">
                  <div className="bg-green-500 h-3 rounded-full transition-all duration-500" style={{ width: `${proteinPercentage}%` }}></div>
                </div>
              </div>
              
              <div>
                <h4 className="text-sm text-slate-400 uppercase tracking-wider mb-3">Quick Log Staples</h4>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => handleQuickLogNutrition("Eggs (3)", 18)} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-3 rounded text-sm transition-colors text-left flex justify-between">
                    <span>🥚 Eggs</span> <span className="text-slate-400">+18g</span>
                  </button>
                  <button onClick={() => handleQuickLogNutrition("Paneer (100g)", 18)} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-3 rounded text-sm transition-colors text-left flex justify-between">
                    <span>🧀 Paneer</span> <span className="text-slate-400">+18g</span>
                  </button>
                  <button onClick={() => handleQuickLogNutrition("Soya (50g)", 26)} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-3 rounded text-sm transition-colors text-left flex justify-between">
                    <span>🌱 Soya</span> <span className="text-slate-400">+26g</span>
                  </button>
                  <button onClick={() => handleQuickLogNutrition("Whey (1 Scoop)", 25)} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-3 rounded text-sm transition-colors text-left flex justify-between">
                    <span>🥤 Whey</span> <span className="text-slate-400">+25g</span>
                  </button>
                  <button onClick={() => handleQuickLogNutrition("Creatine", 0)} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-3 rounded text-sm transition-colors text-left flex justify-between col-span-2">
                    <span>⚡ Creatine (Log Intake)</span> <span className="text-slate-400">+0g</span>
                  </button>
                </div>
                {nutritionStatus && <p className="text-center mt-3 text-green-400">{nutritionStatus}</p>}
              </div>
            </div>
          </div>

          {/* MODULE 3: BODY METRICS & RECOVERY */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 shadow-lg md:col-span-2">
            <h3 className="text-2xl font-semibold mb-4 text-purple-400">Metrics & Recovery</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              <div className="bg-slate-800 border border-slate-700 p-6 rounded text-center flex flex-col justify-center">
                <p className="text-slate-400 text-sm uppercase tracking-wide mb-1">Current Weight</p>
                <p className="text-4xl font-bold text-white">{currentWeight} <span className="text-xl text-slate-500">kg</span></p>
              </div>
              
              <div className="bg-slate-800 border border-slate-700 p-6 rounded text-center flex flex-col justify-center">
                <p className="text-slate-400 text-sm uppercase tracking-wide mb-1">Height</p>
                <p className="text-4xl font-bold text-white">5'10"</p>
              </div>
              
              <div className="bg-slate-800 border border-slate-700 p-6 rounded text-center flex flex-col justify-center">
                <p className="text-slate-400 text-sm uppercase tracking-wide mb-1">Recent Sleep</p>
                <p className="text-4xl font-bold text-white">{currentSleep} <span className="text-xl text-slate-500">hrs</span></p>
              </div>
            </div>

            {/* Update Metrics Form */}
            <form onSubmit={handleLogMetrics} className="mt-6 flex flex-col md:flex-row gap-4">
              <input type="number" step="0.1" value={inputWeight} onChange={(e) => setInputWeight(e.target.value)} placeholder={`Log new weight (kg)`} className="flex-1 bg-slate-800 border border-slate-700 rounded p-3 text-white focus:outline-none" />
              <input type="number" step="0.5" value={inputSleep} onChange={(e) => setInputSleep(e.target.value)} placeholder={`Log sleep (hrs)`} className="flex-1 bg-slate-800 border border-slate-700 rounded p-3 text-white focus:outline-none" />
              <button type="submit" className="bg-purple-600 hover:bg-purple-700 px-8 py-3 rounded font-bold text-white transition-colors">Update Logs</button>
            </form>
            {metricsStatus && <p className="text-center mt-3 text-green-400">{metricsStatus}</p>}
          </div>

        </div>
      </div>
    </div>
  );
}