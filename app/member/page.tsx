"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { UserPlus } from 'lucide-react';
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

export default function MemberPortal() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginName, setLoginName] = useState("");
  
  // --- NEW: VERIFICATION STATES ---
  const [isVerifying, setIsVerifying] = useState(false);
  const [loginError, setLoginError] = useState("");

  // --- STATE: MEMBER DATA ---
  const [exercise, setExercise] = useState("");
  const [sets, setSets] = useState("");
  const [reps, setReps] = useState("");
  const [weight, setWeight] = useState("");
  const [workoutStatus, setWorkoutStatus] = useState("");
  const [recentWorkouts, setRecentWorkouts] = useState<Workout[]>([]);
  const [dailyProtein, setDailyProtein] = useState(0);
  const proteinTarget = 160;
  const [nutritionStatus, setNutritionStatus] = useState("");
  const [currentWeight, setCurrentWeight] = useState(0);
  const [currentSleep, setCurrentSleep] = useState(0);
  const [inputWeight, setInputWeight] = useState("");
  const [inputSleep, setInputSleep] = useState("");
  const [metricsStatus, setMetricsStatus] = useState("");

  async function fetchMemberData(verifiedName: string) {
    if (!verifiedName) return;
    
    // Workouts
    const { data: wData } = await supabase.from("workouts").select("*").eq("member_name", verifiedName).order("created_at", { ascending: false }).limit(10);
    if (wData) setRecentWorkouts(wData);

    // Nutrition
    const today = new Date().toISOString().split("T")[0];
    const { data: nData } = await supabase.from("nutrition_logs").select("protein_grams").eq("member_name", verifiedName).gte("created_at", today);
    if (nData) setDailyProtein(nData.reduce((acc, curr) => acc + Number(curr.protein_grams), 0));

    // Metrics
    const { data: mData } = await supabase.from("recovery_metrics").select("*").eq("member_name", verifiedName).order("created_at", { ascending: false }).limit(1);
    if (mData && mData.length > 0) {
      setCurrentWeight(mData[0].body_weight_kg);
      setCurrentSleep(mData[0].sleep_hours);
    }
  }

  // --- UPGRADED LOGIN HANDLER WITH DB VERIFICATION ---
  const handleMemberLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");

    if (loginName.trim() !== "") {
      setIsVerifying(true);

      // Query the CRM members table to verify the name exists (case-insensitive)
      const { data, error } = await supabase
        .from('members')
        .select('full_name')
        .ilike('full_name', `%${loginName.trim()}%`)
        .limit(1);

      if (data && data.length > 0) {
        // Name found in database! Update state to exact database name and log them in.
        const verifiedName = data[0].full_name;
        setLoginName(verifiedName); 
        setIsAuthenticated(true);
        fetchMemberData(verifiedName);
      } else {
        // Name not found
        setLoginError("Athlete not found in Database. Please check spelling or register.");
      }
      
      setIsVerifying(false);
    }
  };

  const handleLogWorkout = async (e: React.FormEvent) => {
    e.preventDefault();
    setWorkoutStatus("Logging lift...");
    const { error } = await supabase.from("workouts").insert([{ member_name: loginName, exercise_name: exercise, sets: parseInt(sets), reps: parseInt(reps), weight_kg: parseFloat(weight) }]);
    if (!error) {
      setWorkoutStatus("Workout Logged! ⚡");
      setExercise(""); setSets(""); setReps(""); setWeight("");
      fetchMemberData(loginName);
      setTimeout(() => setWorkoutStatus(""), 3000);
    }
  };

  const handleDeleteWorkout = async (id: string) => {
    const { error } = await supabase.from("workouts").delete().eq("id", id);
    if (!error) fetchMemberData(loginName);
  };

  const handleQuickLogNutrition = async (food: string, protein: number) => {
    setNutritionStatus(`Logging ${food}...`);
    const { error } = await supabase.from("nutrition_logs").insert([{ member_name: loginName, food_item: food, protein_grams: protein }]);
    if (!error) {
      setNutritionStatus(`Added ${food} (+${protein}g) 🥩`);
      fetchMemberData(loginName);
      setTimeout(() => setNutritionStatus(""), 3000);
    }
  };

  const handleLogMetrics = async (e: React.FormEvent) => {
    e.preventDefault();
    setMetricsStatus("Updating...");
    const { error } = await supabase.from("recovery_metrics").insert([{ member_name: loginName, body_weight_kg: inputWeight ? parseFloat(inputWeight) : currentWeight, sleep_hours: inputSleep ? parseFloat(inputSleep) : currentSleep }]);
    if (!error) {
      setMetricsStatus("Updated! 📈");
      setInputWeight(""); setInputSleep("");
      fetchMemberData(loginName);
      setTimeout(() => setMetricsStatus(""), 3000);
    }
  };

  // --- RENDER LOGIN SCREEN ---
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 font-sans">
        <h1 className="text-4xl font-bold text-white mb-2 tracking-widest uppercase text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Iron Keep Athlete</h1>
        <p className="text-slate-400 mb-12 uppercase tracking-widest text-sm">Member Portal</p>
        
        <div className="w-full max-w-md bg-slate-900 border border-blue-900/50 p-8 rounded-2xl shadow-xl shadow-blue-900/10">
          <h2 className="text-2xl font-bold text-blue-400 mb-6 flex items-center gap-2 justify-center"><UserPlus className="w-6 h-6"/> Athlete Login</h2>
          
          <form onSubmit={handleMemberLogin} className="space-y-4">
            <input 
              type="text" 
              required 
              value={loginName} 
              onChange={(e) => setLoginName(e.target.value)} 
              placeholder="Enter Your Full Name" 
              className="w-full bg-slate-950 border border-slate-700 p-4 rounded-lg text-white focus:border-blue-500 focus:outline-none text-center font-bold" 
            />
            
            {loginError && <p className="text-rose-400 text-xs text-center font-bold">{loginError}</p>}
            
            <button 
              type="submit" 
              disabled={isVerifying}
              className={`w-full font-bold py-4 rounded-lg uppercase tracking-widest shadow-lg transition-all ${
                isVerifying 
                  ? "bg-slate-700 text-slate-400 cursor-not-allowed" 
                  : "bg-gradient-to-r from-blue-600 to-cyan-500 text-white hover:opacity-90"
              }`}
            >
              {isVerifying ? "Verifying..." : "View Training Logs"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- RENDER DASHBOARD ---
  const chartData = [...recentWorkouts].reverse().map(w => ({ name: w.exercise_name.substring(0, 8), Weight: w.weight_kg }));
  const proteinPercentage = Math.min((dailyProtein / proteinTarget) * 100, 100);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="border-b border-slate-800 pb-4 flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-bold mb-2 uppercase text-blue-400">Iron Keep Logs</h1>
            <h2 className="text-xl text-slate-400">Athlete: <span className="text-white font-bold">{loginName}</span></h2>
          </div>
          <button onClick={() => { setIsAuthenticated(false); setLoginName(""); }} className="text-slate-500 hover:text-red-400 transition-colors text-sm uppercase tracking-widest font-bold">Sign Out</button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Module 1: Strength */}
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
            <div className="mt-6 border-t border-slate-800 pt-4">
              <h4 className="text-sm text-slate-400 uppercase tracking-wider mb-3">Recent Lifts</h4>
              <div className="space-y-2">
                {recentWorkouts.map((workout) => (
                  <div key={workout.id} className="flex justify-between items-center bg-slate-800 p-3 rounded border border-slate-700 hover:border-slate-500 transition-colors">
                    <div>
                      <span className="font-semibold text-white block">{workout.exercise_name}</span>
                      <span className="text-slate-300 text-sm">{workout.sets} x {workout.reps} @ {workout.weight_kg}kg</span>
                    </div>
                    <button onClick={() => handleDeleteWorkout(workout.id)} className="text-red-400 hover:text-red-300 px-3 py-1 bg-red-400/10 hover:bg-red-400/20 rounded transition-colors text-xs uppercase tracking-wider font-bold">Delete</button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Module 2: Nutrition */}
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

          {/* Module 3: Metrics */}
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
            <form onSubmit={handleLogMetrics} className="mt-6 flex flex-col md:flex-row gap-4">
              <input type="number" step="0.1" value={inputWeight} onChange={(e) => setInputWeight(e.target.value)} placeholder={`Log new weight (kg)`} className="flex-1 bg-slate-800 border border-slate-700 rounded p-3 text-white focus:outline-none" />
              <input type="number" step="0.5" value={inputSleep} onChange={(e) => setInputSleep(e.target.value)} placeholder={`Log sleep (hrs)`} className="flex-1 bg-slate-800 border border-slate-700 rounded p-3 text-white focus:outline-none" />
              <button type="submit" className="bg-purple-600 hover:bg-purple-700 px-8 py-3 rounded font-bold text-white transition-colors">Update Logs</button>
            </form>
            {metricsStatus && <p className="text-center mt-3 text-green-400">{metricsStatus}</p>}
          </div>

          {/* Module 4: Progression Chart */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 shadow-lg md:col-span-2">
            <h3 className="text-2xl font-semibold mb-6 text-orange-400">Strength Progression</h3>
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