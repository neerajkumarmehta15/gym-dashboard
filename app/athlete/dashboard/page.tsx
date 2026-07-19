'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../supabase';
import { useRouter } from 'next/navigation';
import { User } from '@supabase/supabase-js';
import { Dumbbell, Utensils, LogOut, X, Trash2, Activity, QrCode, ClipboardList, CheckCircle, Sparkles } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface MemberProfile {
  id: string;
  full_name: string;
  phone_number: string;
  joined_date: string;
  status: string;
  email: string;
  suggestions?: string;
}

interface Workout {
  id: string;
  exercise_name: string;
  sets: number;
  reps: number;
  weight_kg: number;
  created_at?: string;
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

export default function AthleteDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // Modals state
  const [isWorkoutOpen, setIsWorkoutOpen] = useState(false);
  const [isNutritionOpen, setIsNutritionOpen] = useState(false);
  const [isQrOpen, setIsQrOpen] = useState(false);

  // Forms state
  const [exercise, setExercise] = useState('');
  const [sets, setSets] = useState('');
  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState('');
  const [workoutStatus, setWorkoutStatus] = useState('');

  const [inputWeight, setInputWeight] = useState('');
  const [inputSleep, setInputSleep] = useState('');
  const [metricsStatus, setMetricsStatus] = useState('');

  const [nutritionStatus, setNutritionStatus] = useState('');

  // Password Setup state
  const [newPassword, setNewPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState('');

  // Dashboard logs
  const [recentWorkouts, setRecentWorkouts] = useState<Workout[]>([]);
  const [selectedExerciseFilter, setSelectedExerciseFilter] = useState('All');
  const [dailyProtein, setDailyProtein] = useState(0);
  const [currentWeight, setCurrentWeight] = useState<number | null>(null);
  const [currentSleep, setCurrentSleep] = useState<number | null>(null);
  const [coachSuggestion, setCoachSuggestion] = useState('');

  const proteinTarget = 160;

  async function fetchAthleteData(memberName: string) {
    const today = new Date().toISOString().split('T')[0];

    // Parallelize all raw athlete data fetching queries to speed up loads
    const [workoutsRes, nutritionRes, recoveryRes] = await Promise.all([
      supabase
        .from('workouts')
        .select('*')
        .eq('member_name', memberName)
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('nutrition_logs')
        .select('protein_grams')
        .eq('member_name', memberName)
        .gte('created_at', today),
      supabase
        .from('recovery_metrics')
        .select('*')
        .eq('member_name', memberName)
        .order('created_at', { ascending: false })
        .limit(1)
    ]);

    if (workoutsRes.data) {
      // Find the latest coach note suggestion
      const latestNote = workoutsRes.data.find(w => w.exercise_name.startsWith("[Coach Note] "));
      setCoachSuggestion(latestNote ? latestNote.exercise_name.substring(13) : "");

      // Filter out coach notes from the visible workouts list
      const actualWorkouts = workoutsRes.data.filter(w => !w.exercise_name.startsWith("[Coach Note] "));
      setRecentWorkouts(actualWorkouts.slice(0, 10));
    }
    if (nutritionRes.data) {
      setDailyProtein(nutritionRes.data.reduce((acc, curr) => acc + Number(curr.protein_grams), 0));
    }
    if (recoveryRes.data && recoveryRes.data.length > 0) {
      setCurrentWeight(recoveryRes.data[0].body_weight_kg);
      setCurrentSleep(recoveryRes.data[0].sleep_hours);
    }
  }

  async function fetchProfile(email: string, userFullName: string) {
    setProfileLoading(true);
    let matchedProfile = null;

    try {
      // Query email and name matches concurrently to eliminate waterfall
      const [emailRes, nameRes] = await Promise.all([
        email ? supabase.from('members').select('*').eq('email', email).maybeSingle() : Promise.resolve({ data: null }),
        userFullName ? supabase.from('members').select('*').eq('full_name', userFullName).maybeSingle() : Promise.resolve({ data: null })
      ]);
      matchedProfile = emailRes.data || nameRes?.data;
    } catch {
      // Fallback
    }

    if (matchedProfile) {
      setProfile(matchedProfile);
      fetchAthleteData(matchedProfile.full_name);
    }
    setProfileLoading(false);
  }

  // Initialize Session, Profile, and Listen to Auth Changes
  useEffect(() => {
    let isMounted = true;

    const checkSession = async () => {
      // 1. Check custom direct password-less session first
      if (typeof window !== 'undefined') {
        const directId = localStorage.getItem('athlete_logged_id');
        if (directId) {
          const today = new Date().toISOString().split('T')[0];

          // Fetch the profileData first to get the athlete's full name, then fetch their workouts & metrics in parallel
          const { data: profileData } = await supabase.from('members').select('*').eq('id', directId).maybeSingle();
          
          if (profileData && isMounted) {
            setProfile(profileData);
            
            const [workoutsRes, nutritionRes, recoveryRes] = await Promise.all([
              supabase.from('workouts').select('*').eq('member_name', profileData.full_name).order('created_at', { ascending: false }).limit(30),
              supabase.from('nutrition_logs').select('protein_grams').eq('member_name', profileData.full_name).gte('created_at', today),
              supabase.from('recovery_metrics').select('*').eq('member_name', profileData.full_name).order('created_at', { ascending: false }).limit(1)
            ]);

            if (workoutsRes.data) {
              const latestNote = workoutsRes.data.find(w => w.exercise_name.startsWith("[Coach Note] "));
              setCoachSuggestion(latestNote ? latestNote.exercise_name.substring(13) : "");

              const actualWorkouts = workoutsRes.data.filter(w => !w.exercise_name.startsWith("[Coach Note] "));
              setRecentWorkouts(actualWorkouts.slice(0, 10));
            }
            if (nutritionRes.data) {
              setDailyProtein(nutritionRes.data.reduce((acc, curr) => acc + Number(curr.protein_grams), 0));
            }
            if (recoveryRes.data && recoveryRes.data.length > 0) {
              setCurrentWeight(recoveryRes.data[0].body_weight_kg);
              setCurrentSleep(recoveryRes.data[0].sleep_hours);
            }
            setProfileLoading(false);
            return;
          } else {
            localStorage.removeItem('athlete_logged_id');
          }
        }
      }

      // 2. Fallback: Check Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      if (session && isMounted) {
        setUser(session.user);
        fetchProfile(session.user.email || '', session.user.user_metadata?.full_name || '');
      } else {
        setProfileLoading(false);
        router.push('/athlete');
      }
    };

    checkSession();

    // Listen for auth changes (if not using direct login)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      // If we have a direct login, ignore Supabase auth changes/sign outs
      if (typeof window !== 'undefined' && localStorage.getItem('athlete_logged_id')) {
        return;
      }

      if (session) {
        setUser(session.user);
        fetchProfile(session.user.email || '', session.user.user_metadata?.full_name || '');
      } else {
        if (event === 'INITIAL_SESSION' || event === 'SIGNED_OUT') {
          router.push('/athlete');
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Workouts logging
  async function handleLogWorkout(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setWorkoutStatus('Logging lift...');

    const trimmedWeight = weight.trim();
    const isSimpleNumber = /^\d+(\.\d+)?$/.test(trimmedWeight);
    let finalExName = exercise;
    let finalWeight = 0;

    if (isSimpleNumber) {
      finalWeight = parseFloat(trimmedWeight);
    } else {
      const hasNumbers = /\d/.test(trimmedWeight);
      const suffix = hasNumbers ? ` (${trimmedWeight} kg)` : ` (${trimmedWeight})`;
      const match = trimmedWeight.match(/\d+(\.\d+)?/);
      finalWeight = match ? parseFloat(match[0]) : 0;
      finalExName = `${exercise}${suffix}`;
    }

    const { error } = await supabase.from('workouts').insert([{
      member_name: profile.full_name,
      exercise_name: finalExName,
      sets: parseInt(sets),
      reps: parseInt(reps),
      weight_kg: finalWeight
    }]);

    if (!error) {
      setWorkoutStatus('Workout Logged! ⚡');
      setExercise(''); setSets(''); setReps(''); setWeight('');
      fetchAthleteData(profile.full_name);
      setTimeout(() => {
        setWorkoutStatus('');
        setIsWorkoutOpen(false);
      }, 1500);
    } else {
      setWorkoutStatus(`Error: ${error.message}`);
    }
  }

  async function handleDeleteWorkout(id: string) {
    if (!profile) return;
    const { error } = await supabase.from('workouts').delete().eq('id', id);
    if (!error) fetchAthleteData(profile.full_name);
  }

  // Nutrition logging
  async function handleQuickLogNutrition(food: string, protein: number) {
    if (!profile) return;
    setNutritionStatus(`Logging ${food}...`);

    const { error } = await supabase.from('nutrition_logs').insert([{
      member_name: profile.full_name,
      food_item: food,
      protein_grams: protein
    }]);

    if (!error) {
      setNutritionStatus(`Added ${food} (+${protein}g) 🥩`);
      fetchAthleteData(profile.full_name);
      setTimeout(() => setNutritionStatus(''), 3000);
    } else {
      setNutritionStatus(`Error: ${error.message}`);
    }
  }

  async function handleCustomLogNutrition(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!profile) return;
    const formData = new FormData(e.currentTarget);
    const sources = formData.get('sources')?.toString() || '';
    const protein = parseInt(formData.get('protein')?.toString() || '0');

    setNutritionStatus(`Logging...`);
    const { error } = await supabase.from('nutrition_logs').insert([{
      member_name: profile.full_name,
      food_item: sources,
      protein_grams: protein
    }]);

    if (!error) {
      setNutritionStatus(`Logged! ✅`);
      fetchAthleteData(profile.full_name);
      e.currentTarget.reset();
      setTimeout(() => {
        setNutritionStatus('');
        setIsNutritionOpen(false);
      }, 1500);
    } else {
      setNutritionStatus(`Error: ${error.message}`);
    }
  }

  // Recovery metrics logging
  async function handleLogMetrics(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setMetricsStatus('Updating recovery metrics...');

    const { error } = await supabase.from('recovery_metrics').insert([{
      member_name: profile.full_name,
      body_weight_kg: inputWeight ? parseFloat(inputWeight) : currentWeight,
      sleep_hours: inputSleep ? parseFloat(inputSleep) : currentSleep
    }]);

    if (!error) {
      setMetricsStatus('Recovery Metrics Saved! 📈');
      setInputWeight(''); setInputSleep('');
      fetchAthleteData(profile.full_name);
      setTimeout(() => setMetricsStatus(''), 3000);
    } else {
      setMetricsStatus(`Error: ${error.message}`);
    }
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) {
      setPasswordStatus('Password must be at least 6 characters.');
      return;
    }
    setPasswordStatus('Saving password...');
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setPasswordStatus(`Error: ${error.message}`);
    } else {
      setPasswordStatus('Password set successfully! ✅');
      setNewPassword('');
      setTimeout(() => setPasswordStatus(''), 3000);
    }
  }

  // Sign out handler
  const handleSignOut = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('athlete_logged_id');
    }
    supabase.auth.signOut().then(() => {
      router.push('/athlete');
    });
  };

  if ((!user && !profile) || profileLoading) {
    return (
      <div className="min-h-screen bg-brand-dark flex items-center justify-center font-sans text-brand-volt">
        <div className="flex flex-col items-center gap-4">
          <Activity className="w-8 h-8 animate-pulse text-brand-volt" />
          <p className="tracking-widest uppercase text-xs font-mono font-bold">Querying Profile Matrix...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-brand-dark flex items-center justify-center p-6 text-gray-100">
        <div className="w-full max-w-md glass-panel p-8 text-center space-y-6">
          <div className="w-16 h-16 bg-brand-orange/20 border border-brand-orange text-brand-orange rounded-full flex items-center justify-center mx-auto text-3xl">⚠️</div>
          <h2 className="text-2xl font-black tracking-tight uppercase">Profile Unregistered</h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            Your account (<span className="text-white font-mono">{user?.email || 'credential'}</span>) is authenticated, but it has not been linked to a member record in the gym&apos;s database.
          </p>
          <p className="text-brand-volt text-xs font-bold uppercase tracking-widest leading-relaxed">
            Please ask the gym administrator or owner to add your email address to your profile in the CRM dashboard.
          </p>
          <button onClick={handleSignOut} className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl transition-colors uppercase tracking-widest text-xs flex items-center justify-center gap-2">
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </div>
    );
  }

  // Get workout displays mapping
  const workoutDisplays = recentWorkouts.map(w => ({
    ...w,
    display: getWorkoutDisplay(w.exercise_name, w.weight_kg)
  }));

  // Filter progression chart by the selected exercise, and use formatted date for X-axis labels
  const uniqueExercises = Array.from(new Set(workoutDisplays.map(w => w.display.name)));
  const filteredChartWorkouts = selectedExerciseFilter === 'All' 
    ? workoutDisplays 
    : workoutDisplays.filter(w => w.display.name === selectedExerciseFilter);

  const chartData = [...filteredChartWorkouts].reverse().map(w => ({
    name: w.created_at ? new Date(w.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : w.display.name.substring(0, 8),
    Weight: w.weight_kg
  }));
  const proteinPercentage = Math.min((dailyProtein / proteinTarget) * 100, 100);

  return (
    <div className="min-h-screen bg-brand-dark text-gray-100 p-4 md:p-8 relative overflow-hidden font-sans">
      {/* Background glow effects */}
      <div className="absolute top-[-10%] left-[-15%] w-96 h-96 bg-brand-volt/5 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-15%] w-96 h-96 bg-brand-orange/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-6xl mx-auto space-y-6 relative z-10">
        
        {/* Header */}
        <header className="glass-panel p-5 md:p-6 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3.5">
            <button 
              onClick={handleSignOut} 
              className="p-2.5 bg-slate-900/60 border border-gray-800 hover:border-rose-500/40 rounded-xl text-gray-400 hover:text-rose-450 hover:bg-rose-500/5 transition-all duration-200"
              title="Log Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-2xl md:text-3xl text-3d-gymnation">
                GYMNATION
              </h1>
            <p className="text-sm text-gray-400 mt-1 flex items-center gap-2">
              Athlete Portal: <span className="text-white font-extrabold">{profile.full_name}</span> 
              <span className={`px-2 py-0.5 text-[10px] font-mono rounded-full font-bold uppercase ${profile.status === 'active' ? 'bg-brand-volt/20 text-brand-volt border border-brand-volt/20' : 'bg-rose-500/20 text-rose-400 border border-rose-500/20'}`}>
                {profile.status}
              </span>
            </p>
          </div>
        </div>
        <div className="flex w-full sm:w-auto gap-3">
            <button 
              onClick={() => setIsQrOpen(true)}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-slate-900/60 border border-gray-800 hover:border-brand-volt/30 hover:text-brand-volt px-4 py-2.5 rounded-xl text-sm font-bold transition-all"
            >
              <QrCode className="w-4 h-4" /> Check In QR
            </button>
          </div>
        </header>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Logs Area - Columns 1 & 2 */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Strength Module */}
            <div className="glass-panel p-6 rounded-2xl space-y-5">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold tracking-tight text-brand-volt flex items-center gap-2">
                  <Dumbbell className="w-5 h-5" /> STRENGTH TRACKER
                </h3>
                <button 
                  onClick={() => setIsWorkoutOpen(true)}
                  className="bg-brand-volt text-black font-extrabold px-4 py-2 rounded-xl text-xs tracking-wider transition-all transform active:scale-95 glow-btn-volt"
                >
                  ADD WORKOUT
                </button>
              </div>

              {/* Recent Lifts list */}
              <div className="space-y-3">
                <h4 className="text-xs uppercase tracking-wider text-gray-400 font-mono">Recent Logs</h4>
                {recentWorkouts.length === 0 ? (
                  <div className="bg-brand-dark/40 border border-gray-900/60 p-8 rounded-xl text-center text-gray-500 text-sm">
                    No strength logs registered yet. Hit &quot;Add Workout&quot; to start logging!
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {workoutDisplays.map((workout) => (
                      <div key={workout.id} className="bg-brand-dark/40 border border-gray-900 p-4 rounded-xl flex justify-between items-center hover:border-gray-800 transition-colors">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-white block tracking-tight">{workout.display.name}</span>
                            {workout.display.isCoach ? (
                              <span className="text-[10px] bg-brand-orange/20 text-brand-orange border border-brand-orange/30 px-1.5 py-0.5 rounded font-mono font-bold uppercase tracking-wider">Coach</span>
                            ) : (
                              <span className="text-[10px] bg-slate-800 text-slate-400 border border-slate-700 px-1.5 py-0.5 rounded font-mono font-bold uppercase tracking-wider">Self</span>
                            )}
                          </div>
                          <span className="text-gray-400 text-xs font-mono mt-0.5 block">{workout.sets} sets × {workout.reps} reps</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-brand-volt font-mono font-bold text-sm bg-brand-volt/5 px-2.5 py-1 rounded-lg border border-brand-volt/10">{workout.display.weight}</span>
                          <button 
                            onClick={() => handleDeleteWorkout(workout.id)} 
                            className="p-1 rounded-lg text-gray-500 hover:text-rose-400 hover:bg-slate-900 transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Progression Chart */}
            <div className="glass-panel p-6 rounded-2xl space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold tracking-tight text-brand-cyan flex items-center gap-2">
                  <Activity className="w-5 h-5" /> STRENGTH PROGRESSION
                </h3>
                {recentWorkouts.length > 0 && (
                  <select 
                    value={selectedExerciseFilter} 
                    onChange={(e) => setSelectedExerciseFilter(e.target.value)}
                    className="bg-brand-dark/80 border border-gray-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-brand-cyan/40 font-mono"
                  >
                    <option value="All">All Exercises</option>
                    {uniqueExercises.map(ex => (
                      <option key={ex} value={ex}>{ex}</option>
                    ))}
                  </select>
                )}
              </div>
              <div className="h-64 w-full pt-2">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="glowingArea" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#d4ff00" stopOpacity={0.25}/>
                          <stop offset="95%" stopColor="#d4ff00" stopOpacity={0.01}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" opacity={0.5} />
                      <XAxis dataKey="name" stroke="#6b7280" fontSize={11} tickLine={false} />
                      <YAxis stroke="#6b7280" fontSize={11} tickLine={false} unit="kg" />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0b0f19', border: '1px solid #1f2937', borderRadius: '12px' }} 
                        itemStyle={{ color: '#d4ff00' }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="Weight" 
                        stroke="#d4ff00" 
                        strokeWidth={3} 
                        fill="url(#glowingArea)"
                        dot={{ r: 5, fill: '#030712', stroke: '#d4ff00', strokeWidth: 2 }} 
                        activeDot={{ r: 7 }} 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-gray-500 text-sm">
                    Log at least one lift to initialize strength graph metrics.
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Sidebar Area - Column 3 */}
          <div className="space-y-6">

            {/* Coach Recommendation Module */}
            <div className="glass-panel p-6 rounded-2xl space-y-4 border border-brand-orange/30 bg-brand-orange/5">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold tracking-tight text-brand-orange flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-brand-orange animate-pulse" /> COACH RECOMMENDATION
                </h3>
                {coachSuggestion && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(coachSuggestion || "");
                      alert("Copied suggestions to clipboard! 📋");
                    }}
                    className="text-[10px] font-mono text-brand-orange hover:underline font-bold uppercase tracking-wider cursor-pointer"
                    title="Copy Recommendations"
                  >
                    Copy
                  </button>
                )}
              </div>
              <div className="bg-brand-dark/50 border border-gray-900/60 p-4 rounded-xl">
                {coachSuggestion ? (
                  <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-line font-sans">
                    {coachSuggestion}
                  </p>
                ) : (
                  <p className="text-gray-500 text-xs italic font-sans text-center py-2">
                    No suggestions or workout plan notes logged by your trainer yet.
                  </p>
                )}
              </div>
            </div>
            
            {/* Nutrition Module */}
            <div className="glass-panel p-6 rounded-2xl space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold tracking-tight text-emerald-400 flex items-center gap-2">
                  <Utensils className="w-5 h-5" /> NUTRITION LOGS
                </h3>
                <button 
                  onClick={() => setIsNutritionOpen(true)}
                  className="text-xs font-extrabold text-emerald-400 hover:text-emerald-300 transition-colors uppercase tracking-wider"
                >
                  Log Custom
                </button>
              </div>

              {/* Protein Target Circular Progress bar replacement */}
              <div className="bg-brand-dark/40 border border-gray-900/60 p-4 rounded-xl space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-xs uppercase tracking-widest font-mono">Daily Protein Goal</span>
                  <span className="font-extrabold text-white text-lg font-mono">{dailyProtein} <span className="text-xs text-gray-500 font-bold">/ {proteinTarget}g</span></span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden border border-gray-800">
                  <div 
                    className="bg-gradient-to-r from-emerald-500 to-teal-400 h-3 rounded-full transition-all duration-700" 
                    style={{ width: `${proteinPercentage}%` }}
                  ></div>
                </div>
                {proteinPercentage >= 100 && (
                  <p className="text-[10px] text-emerald-400 font-extrabold uppercase flex items-center gap-1.5 pt-0.5">
                    <CheckCircle className="w-3.5 h-3.5" /> Target Achieved! Great job, athlete!
                  </p>
                )}
              </div>

              {/* Quick log presets */}
              <div className="space-y-2">
                <h4 className="text-xs uppercase tracking-wider text-gray-400 font-mono">Quick Logs</h4>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => handleQuickLogNutrition('Eggs (3)', 18)} 
                    className="bg-brand-dark/50 hover:bg-slate-900/80 border border-gray-800/80 p-3 rounded-xl text-left flex justify-between items-center transition-all text-xs"
                  >
                    <span>🥚 Eggs</span>
                    <span className="text-emerald-400 font-bold font-mono">+18g</span>
                  </button>
                  <button 
                    onClick={() => handleQuickLogNutrition('Paneer (100g)', 18)} 
                    className="bg-brand-dark/50 hover:bg-slate-900/80 border border-gray-800/80 p-3 rounded-xl text-left flex justify-between items-center transition-all text-xs"
                  >
                    <span>🧀 Paneer</span>
                    <span className="text-emerald-400 font-bold font-mono">+18g</span>
                  </button>
                  <button 
                    onClick={() => handleQuickLogNutrition('Soya Chunks', 26)} 
                    className="bg-brand-dark/50 hover:bg-slate-900/80 border border-gray-800/80 p-3 rounded-xl text-left flex justify-between items-center transition-all text-xs"
                  >
                    <span>🌱 Soya</span>
                    <span className="text-emerald-400 font-bold font-mono">+26g</span>
                  </button>
                  <button 
                    onClick={() => handleQuickLogNutrition('Whey Protein', 25)} 
                    className="bg-brand-dark/50 hover:bg-slate-900/80 border border-gray-800/80 p-3 rounded-xl text-left flex justify-between items-center transition-all text-xs"
                  >
                    <span>🥤 Whey</span>
                    <span className="text-emerald-400 font-bold font-mono">+25g</span>
                  </button>
                </div>
                {nutritionStatus && (
                  <p className="text-center font-bold text-xs text-emerald-400 mt-3 font-mono">{nutritionStatus}</p>
                )}
              </div>
            </div>

            {/* Recovery Metrics Module */}
            <div className="glass-panel p-6 rounded-2xl space-y-5">
              <h3 className="text-xl font-bold tracking-tight text-brand-purple flex items-center gap-2">
                <ClipboardList className="w-5 h-5" /> RECOVERY & METRICS
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-brand-dark/40 border border-gray-900 p-4 rounded-xl text-center">
                  <p className="text-gray-500 text-xs uppercase font-mono tracking-widest">Weight</p>
                  <p className="text-2xl font-black text-white mt-1 font-mono">
                    {currentWeight !== null ? `${currentWeight}` : '--'} 
                    <span className="text-xs text-gray-500 font-bold ml-1">kg</span>
                  </p>
                </div>
                <div className="bg-brand-dark/40 border border-gray-900 p-4 rounded-xl text-center">
                  <p className="text-gray-500 text-xs uppercase font-mono tracking-widest">Sleep</p>
                  <p className="text-2xl font-black text-white mt-1 font-mono">
                    {currentSleep !== null ? `${currentSleep}` : '--'} 
                    <span className="text-xs text-gray-500 font-bold ml-1">hrs</span>
                  </p>
                </div>
              </div>

              {/* Log new metrics form */}
              <form onSubmit={handleLogMetrics} className="space-y-3 pt-2">
                <div className="flex gap-3">
                  <input 
                    type="number" 
                    step="0.1" 
                    value={inputWeight} 
                    onChange={(e) => setInputWeight(e.target.value)} 
                    placeholder="Log Weight (kg)" 
                    className="w-1/2 bg-brand-dark/60 border border-gray-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-brand-purple/50 font-mono" 
                  />
                  <input 
                    type="number" 
                    step="0.5" 
                    value={inputSleep} 
                    onChange={(e) => setInputSleep(e.target.value)} 
                    placeholder="Log Sleep (hrs)" 
                    className="w-1/2 bg-brand-dark/60 border border-gray-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-brand-purple/50 font-mono" 
                  />
                </div>
                <button 
                  type="submit" 
                  className="w-full bg-brand-purple/20 hover:bg-brand-purple/30 border border-brand-purple/30 hover:border-brand-purple/50 text-purple-300 font-bold py-2.5 rounded-xl text-xs tracking-wider uppercase transition-all"
                >
                  Update Logs
                </button>
                {metricsStatus && (
                  <p className="text-center text-xs text-brand-purple font-mono font-bold mt-2">{metricsStatus}</p>
                )}
              </form>
            </div>

            {/* Account Security Module */}
            <div className="glass-panel p-6 rounded-2xl space-y-5">
              <h3 className="text-xl font-bold tracking-tight text-brand-orange flex items-center gap-2">
                <Sparkles className="w-5 h-5 animate-pulse text-brand-orange" /> ACCOUNT PASSWORD
              </h3>
              <p className="text-xs text-gray-450 leading-relaxed font-sans">
                Set or update your password to log in directly next time without waiting for a magic link email.
              </p>
              <form onSubmit={handleSetPassword} className="space-y-3 pt-2">
                <input 
                  type="password" 
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Set New Password" 
                  required
                  minLength={6}
                  className="w-full bg-brand-dark/60 border border-gray-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-brand-orange/50 font-mono" 
                />
                <button 
                  type="submit" 
                  className="w-full bg-brand-orange/20 hover:bg-brand-orange/30 border border-brand-orange/30 hover:border-brand-orange/50 text-brand-orange font-bold py-2.5 rounded-xl text-xs tracking-wider uppercase transition-all"
                >
                  Save Password
                </button>
                {passwordStatus && (
                  <p className="text-center text-xs text-brand-orange font-mono font-bold mt-2">{passwordStatus}</p>
                )}
              </form>
            </div>

          </div>

        </div>

      </div>

      {/* --- WORKOUT FORM MODAL --- */}
      {isWorkoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <div className="glass-modal w-full max-w-md rounded-2xl p-6 shadow-2xl relative">
            <button 
              onClick={() => setIsWorkoutOpen(false)} 
              className="absolute top-4 right-4 p-2 rounded-lg text-gray-400 hover:text-white hover:bg-slate-900 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-bold text-white mb-5 flex items-center gap-2 uppercase tracking-tight">
              <Dumbbell className="w-5 h-5 text-brand-volt" /> Log Workout Routine
            </h3>
            <form onSubmit={handleLogWorkout} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5 uppercase font-mono tracking-widest font-bold">Pre-Planned Workout Helper</label>
                <select 
                  onChange={(e) => {
                    if (e.target.value) {
                      setExercise(e.target.value);
                      if (!sets) setSets("4");
                      if (!reps) setReps("12");
                      if (!weight) setWeight("20");
                    }
                  }}
                  className="w-full bg-brand-dark/80 border border-gray-850 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-volt/50 font-sans"
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
              <div>
                <label className="block text-xs text-gray-400 mb-1.5 uppercase font-mono tracking-widest font-bold">Exercise Name</label>
                <input 
                  type="text" 
                  value={exercise} 
                  onChange={(e) => setExercise(e.target.value)} 
                  required 
                  placeholder="e.g. Bench Press"
                  className="w-full bg-brand-dark/80 border border-gray-850 rounded-xl px-4 py-3 text-sm text-white" 
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5 uppercase font-mono tracking-widest font-bold">Sets</label>
                  <input 
                    type="number" 
                    value={sets} 
                    onChange={(e) => setSets(e.target.value)} 
                    required 
                    placeholder="4"
                    className="w-full bg-brand-dark/80 border border-gray-850 rounded-xl px-3 py-3 text-sm text-white text-center font-mono" 
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5 uppercase font-mono tracking-widest font-bold">Reps</label>
                  <input 
                    type="number" 
                    value={reps} 
                    onChange={(e) => setReps(e.target.value)} 
                    required 
                    placeholder="10"
                    className="w-full bg-brand-dark/80 border border-gray-850 rounded-xl px-3 py-3 text-sm text-white text-center font-mono" 
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5 uppercase font-mono tracking-widest font-bold">Weight (kg)</label>
                  <input 
                    type="text" 
                    value={weight} 
                    onChange={(e) => setWeight(e.target.value)} 
                    required 
                    placeholder="e.g. 60 or 40-60"
                    className="w-full bg-brand-dark/80 border border-gray-850 rounded-xl px-3 py-3 text-sm text-white text-center font-sans" 
                  />
                </div>
              </div>
              <button 
                type="submit" 
                className="w-full bg-brand-volt text-black font-extrabold py-3 rounded-xl text-sm transition-all uppercase tracking-widest glow-btn-volt mt-2"
              >
                Log Lift
              </button>
              {workoutStatus && (
                <p className="text-center font-bold text-xs text-brand-volt mt-3 font-mono">{workoutStatus}</p>
              )}
            </form>
          </div>
        </div>
      )}

      {/* --- CUSTOM NUTRITION MODAL --- */}
      {isNutritionOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <div className="glass-modal w-full max-w-md rounded-2xl p-6 shadow-2xl relative">
            <button 
              onClick={() => setIsNutritionOpen(false)} 
              className="absolute top-4 right-4 p-2 rounded-lg text-gray-400 hover:text-white hover:bg-slate-900 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-bold text-white mb-5 flex items-center gap-2 uppercase tracking-tight">
              <Utensils className="w-5 h-5 text-emerald-400" /> Log Custom Meal
            </h3>
            <form onSubmit={handleCustomLogNutrition} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5 uppercase font-mono tracking-widest font-bold">Meal description</label>
                <input 
                  name="sources" 
                  type="text" 
                  required 
                  placeholder="e.g. Soya Chunks & Rice"
                  className="w-full bg-brand-dark/80 border border-gray-850 rounded-xl px-4 py-3 text-sm text-white" 
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5 uppercase font-mono tracking-widest font-bold">Protein Content (grams)</label>
                <input 
                  name="protein" 
                  type="number" 
                  required 
                  placeholder="30"
                  className="w-full bg-brand-dark/80 border border-gray-850 rounded-xl px-4 py-3 text-sm text-white font-mono" 
                />
              </div>
              <button 
                type="submit" 
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold py-3 rounded-xl text-sm transition-all uppercase tracking-widest mt-2"
              >
                Log Meal
              </button>
              {nutritionStatus && (
                <p className="text-center font-bold text-xs text-emerald-400 mt-3 font-mono">{nutritionStatus}</p>
              )}
            </form>
          </div>
        </div>
      )}

      {/* --- QR CHECK IN MODAL --- */}
      {isQrOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <div className="glass-modal w-full max-w-sm rounded-2xl p-8 shadow-2xl relative text-center">
            <button 
              onClick={() => setIsQrOpen(false)} 
              className="absolute top-4 right-4 p-2 rounded-lg text-gray-400 hover:text-white hover:bg-slate-900 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-bold text-white mb-2 uppercase tracking-tight">Check In Pass</h3>
            <p className="text-gray-400 text-xs mb-6 uppercase tracking-wider font-mono">Present to HQ Scanner</p>
            
            {/* Render QR code based on user memberProfile.id */}
            <div className="bg-white p-4 rounded-2xl inline-block shadow-inner mb-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${profile.id}`} 
                alt="HQ Check-in QR" 
                className="w-48 h-48"
              />
            </div>
            
            <div className="space-y-1">
              <span className="font-extrabold text-sm text-white block">{profile.full_name}</span>
              <span className="text-[10px] text-gray-500 font-mono select-all block">{profile.id}</span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}