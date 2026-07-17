"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

// Initialize Supabase Connection
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface Workout {
  id: string;
  exercise_name: string;
  sets: number;
  reps: number;
  weight_kg: number;
  member_name: string;
}

export default function AdminDashboard() {
  // --- STATE: AUTHENTICATION ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passcode, setPasscode] = useState("");

  // --- STATE: ACTIVE MEMBER ---
  const [activeMember, setActiveMember] = useState("Main Athlete");

  // --- STATE: WORKOUTS ---
  const [exercise, setExercise] = useState("");
  const [sets, setSets] = useState("");
  const [reps, setReps] = useState("");
  const [weight, setWeight] = useState("");
  const [workoutStatus, setWorkoutStatus] = useState("");
  const [recentWorkouts, setRecentWorkouts] = useState<Workout[]>([]);

  // --- STATE: NUTRITION & METRICS ---
  const [dailyProtein, setDailyProtein] = useState(0);
  const proteinTarget = 160;
  const [nutritionStatus, setNutritionStatus] = useState("");
  const [currentWeight, setCurrentWeight] = useState(74.0);
  const [currentSleep, setCurrentSleep] = useState(8.0);
  const [inputWeight, setInputWeight] = useState("");
  const [inputSleep, setInputSleep] = useState("");
  const [metricsStatus, setMetricsStatus] = useState("");

  // --- FETCH ALL DATA ---
  const fetchDashboardData = async () => {
    if (!isAuthenticated) return;

    // 1. Workouts
    const { data: wData } = await supabase
      .from("workouts")
      .select("*")
      .eq("member_name", activeMember)
      .order("created_at", { ascending: false })
      .limit(10);
    if (wData) setRecentWorkouts(wData);
    else setRecentWorkouts([]);

    // 2. Nutrition
    const today = new Date().toISOString().split("T")[0];
    const { data: nData } = await supabase
      .from("nutrition_logs")
      .select("protein_grams")
      .eq("member_name", activeMember)
      .gte("created_at", today);
    if (nData) {
      const total = nData.reduce((acc, curr) => acc + Number(curr.protein_grams), 0);
      setDailyProtein(total);
    } else setDailyProtein(0);

    // 3. Metrics
    const { data: mData } = await supabase
      .from("recovery_metrics")
      .select("*")
      .eq("member_name", activeMember)
      .order("created_at", { ascending: false })
      .limit(1);
    if (mData && mData.length > 0) {
      setCurrentWeight(mData[0].body_weight_kg);
      setCurrentSleep(mData[0].sleep_hours);
    } else {
      setCurrentWeight(0);
      setCurrentSleep(0);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [activeMember, isAuthenticated]);

  // --- HANDLERS ---
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcode.toLowerCase() === "ironkeep") {
      setIsAuthenticated(true);
    } else {
      alert("Unauthorized Access. Incorrect Passcode.");
      setPasscode("");
    }
  };

  const handleLogWorkout = async (e: React.FormEvent) => {
    e.preventDefault();
    setWorkoutStatus("Logging lift...");
    const { error } = await supabase.from("workouts").insert([{ 
      member_name: activeMember, exercise_name: exercise, sets: parseInt(sets), reps: parseInt(reps), weight_kg: parseFloat(weight) 
    }]);
    if (!error) {
      setWorkoutStatus("Workout Logged! ⚡");
      setExercise(""); setSets(""); setReps(""); setWeight("");
      fetchDashboardData();
      setTimeout(() => setWorkoutStatus(""), 3000);
    }
  };

  // NEW: Delete a mistake directly from the dashboard
  const handleDeleteWorkout = async (id: string) => {
    const { error } = await supabase.from("workouts").delete().eq("id", id);
    if (!error) {
      fetchDashboardData();
    } else {
      alert("Error deleting workout.");
    }
  };

  const handleQuickLogNutrition = async (food: string, protein: number) => {
    setNutritionStatus(`Logging ${food}...`);
    const { error } = await supabase.from("nutrition_logs").insert([{ member_name: activeMember, food_item: food, protein_grams: protein }]);
    if (!error) {
      setNutritionStatus(`Added ${food} (+${protein}g) 🥩`);
      fetchDashboardData();
      setTimeout(() => setNutritionStatus(""), 3000);
    }
  };

  const handleLogMetrics = async (e: React.FormEvent) => {
    e.preventDefault();
    setMetricsStatus("Updating...");
    const { error } = await supabase.from("recovery_metrics").insert([{ 
      member_name: activeMember, 
      body_weight_kg: inputWeight ? parseFloat(inputWeight) : currentWeight, 
      sleep_hours: inputSleep ? parseFloat(inputSleep) : currentSleep 
    }]);
    if (!error) {
      setMetricsStatus("Updated! 📈");
      setInputWeight(""); setInputSleep("");
      fetchDashboardData();
      setTimeout(() => setMetricsStatus(""), 3000);
    }
  };

  // --- PREPARE CHART DATA ---
  const chartData = [...recentWorkouts].reverse().map(w => ({
    name: w.exercise_name.substring(0, 8),
    Weight: w.weight_kg
  }));
  const proteinPercentage = Math.min((dailyProtein / proteinTarget) * 100, 100);

  // --- RENDER LOGIN SCREEN ---
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 text-slate-50 font-sans">
        <div className="bg-slate-900 border border-blue-900/50 p-10 rounded-2xl shadow-2xl shadow-blue-900/20 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-blue-600/20 border border-blue-500 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-6 text-2xl">🛡️</div>
          <h1 className="text-3xl font-bold mb-2 uppercase tracking-widest text-white">Iron Keep HQ</h1>
          <p className="text-blue-400 text-sm mb-8 tracking-widest uppercase">Restricted Access</p>
          <form onSubmit={handleLogin} className="space-y-6">
            <input type="password" value={passcode} onChange={(e) => setPasscode(e.target.value)} placeholder="ENTER PASSCODE" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-4 text-center tracking-[0.5em] text-white focus:outline-none focus:border-blue-500 transition-colors" />
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-lg transition-all uppercase tracking-widest text-sm shadow-lg shadow-blue-900/50 hover:shadow-blue-600/50">Initialize Session</button>
          </form>
        </div>
      </div>
    );
  }

  // --- RENDER DASHBOARD ---
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        <header className="border-b border-slate-800 pb-4 flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-bold mb-2">Iron Keep HQ</h1>
            <h2 className="text-xl text-slate-400">Gym Roster & Command Center</h2>
          </div>
          <button onClick={() => setIsAuthenticated(false)} className="text-slate-500 hover:text-red-400 transition-colors text-sm uppercase tracking-widest font-bold">Lock System</button>
        </header>

        <div className="bg-slate-800 border border-blue-900/50 rounded-lg p-4 flex flex-col md:flex-row items-center gap-4 shadow-lg shadow-blue-900/10">
          <label className="text-blue-400 font-bold uppercase tracking-widest text-sm whitespace-nowrap">Active Member :</label>
          <input type="text" value={activeMember} onChange={(e) => setActiveMember(e.target.value)} className="w-full md:w-64 bg-slate-900 border border-slate-600 rounded p-3 text-white font-bold text-lg focus:outline-none focus:border-blue-500" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* MODULE 1: STRENGTH */}
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
                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded mt-2">Log Lift</button>
                {workoutStatus && <p className="text-center mt-2 text-green-400">{workoutStatus}</p>}
              </form>
            </div>

            {/* RECENT LIFTS WITH DELETE FUNCTION */}
            <div className="mt-6 border-t border-slate-800 pt-4">
              <h4 className="text-sm text-slate-400 uppercase tracking-wider mb-3">Recent Lifts ({activeMember})</h4>
              <div className="space-y-2">
                {recentWorkouts.map((workout) => (
                  <div key={workout.id} className="flex justify-between items-center bg-slate-800 p-3 rounded border border-slate-700 hover:border-slate-500 transition-colors">
                    <div>
                      <span className="font-semibold text-white block">{workout.exercise_name}</span>
                      <span className="text-slate-300 text-sm">{workout.sets} x {workout.reps} @ {workout.weight_kg}kg</span>
                    </div>
                    <button 
                      onClick={() => handleDeleteWorkout(workout.id)} 
                      className="text-red-400 hover:text-red-300 px-3 py-1 bg-red-400/10 hover:bg-red-400/20 rounded transition-colors text-xs uppercase tracking-wider font-bold"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* MODULE 2: NUTRITION */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 shadow-lg">
            <h3 className="text-2xl font-semibold mb-4 text-green-400">Nutrition & Macros</h3>
            <div className="space-y-6">
              <div className="bg-slate-800 border border-slate-700 p-4 rounded">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-slate-300">Daily Protein Target</span>
                  <span className="font-bold text-xl text-white">{dailyProtein} / {proteinTarget}g</span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-3">
                  <div className="bg-green-500 h-3 rounded-full transition-all duration-500" style={{ width: `${proteinPercentage}%` }}></div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => handleQuickLogNutrition("Eggs", 18)} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 p-3 rounded text-sm text-left flex justify-between"><span>🥚 Eggs</span> <span className="text-slate-400">+18g</span></button>
                <button onClick={() => handleQuickLogNutrition("Paneer", 18)} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 p-3 rounded text-sm text-left flex justify-between"><span>🧀 Paneer</span> <span className="text-slate-400">+18g</span></button>
                <button onClick={() => handleQuickLogNutrition("Soya", 26)} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 p-3 rounded text-sm text-left flex justify-between"><span>🌱 Soya</span> <span className="text-slate-400">+26g</span></button>
                <button onClick={() => handleQuickLogNutrition("Whey", 25)} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 p-3 rounded text-sm text-left flex justify-between"><span>🥤 Whey</span> <span className="text-slate-400">+25g</span></button>
              </div>
            </div>
          </div>

          {/* MODULE 3: METRICS */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 shadow-lg md:col-span-2">
            <h3 className="text-2xl font-semibold mb-4 text-purple-400">Metrics & Recovery</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-800 border border-slate-700 p-6 rounded text-center">
                <p className="text-slate-400 text-sm uppercase mb-1">Weight</p>
                <p className="text-4xl font-bold">{currentWeight || "--"} <span className="text-xl text-slate-500">kg</span></p>
              </div>
              <div className="bg-slate-800 border border-slate-700 p-6 rounded text-center">
                <p className="text-slate-400 text-sm uppercase mb-1">Height</p>
                <p className="text-4xl font-bold">5'10"</p>
              </div>
              <div className="bg-slate-800 border border-slate-700 p-6 rounded text-center">
                <p className="text-slate-400 text-sm uppercase mb-1">Sleep</p>
                <p className="text-4xl font-bold">{currentSleep || "--"} <span className="text-xl text-slate-500">hrs</span></p>
              </div>
            </div>
          </div>

          {/* MODULE 4: STRENGTH PROGRESSION CHART */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 shadow-lg md:col-span-2">
            <h3 className="text-2xl font-semibold mb-6 text-orange-400">Strength Progression ({activeMember})</h3>
            <div className="h-64 w-full">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                    <YAxis stroke="#64748b" fontSize={12} unit="kg" />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }} itemStyle={{ color: '#fb923c' }} />
                    <Line type="monotone" dataKey="Weight" stroke="#fb923c" strokeWidth={3} dot={{ r: 5, fill: '#fb923c' }} activeDot={{ r: 8 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-slate-500">Not enough data to graph progression. Log some workouts!</div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}