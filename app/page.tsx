"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from "@supabase/supabase-js";
import { AlertCircle, Clock, CheckCircle, DollarSign, RefreshCw, UserPlus, X, Trash2, Power, Search, MapPin, Activity } from 'lucide-react';
import Link from "next/link";

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface MemberData {
  id: string;
  full_name: string;
  phone_number: string;
  joined_date: string;
  status: string;
}

interface PlanData {
  id: number;
  plan_name: string;
  duration_months: number;
  price: number;
}

interface Workout {
  id: string;
  exercise_name: string;
  sets: number;
  reps: number;
  weight_kg: number;
  member_name: string;
}

export default function MasterSequence() {
  const router = useRouter();
  
  // --- SEQUENCE STATE ---
  const [authStatus, setAuthStatus] = useState<'loading' | 'owner' | 'guest'>('loading');

  // --- CRM STATE ---
  const [members, setMembers] = useState<MemberData[]>([]);
  const [plans, setPlans] = useState<PlanData[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // --- MEMBER MODAL STATE ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- TRACKING & ASSIGNMENT STATE ---
  const [selectedAthlete, setSelectedAthlete] = useState<MemberData | null>(null);
  const [athleteWorkouts, setAthleteWorkouts] = useState<Workout[]>([]);
  const [assignEx, setAssignEx] = useState("");
  const [assignSets, setAssignSets] = useState("");
  const [assignReps, setAssignReps] = useState("");
  const [assignWeight, setAssignWeight] = useState("");
  const [assignStatus, setAssignStatus] = useState("");

  // ==========================================
  // INITIALIZE ENGINE
  // ==========================================
  async function initializeEngine() {
    setIsSyncing(true);

    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      setAuthStatus('guest'); 
      setIsSyncing(false);
      return; 
    }
    
    setAuthStatus('owner');

    const { data: memberData } = await supabase.from('members').select('*').order('joined_date', { ascending: false });
    if (memberData) setMembers(memberData);

    const { data: planData } = await supabase.from('membership_plans').select('*').order('price', { ascending: true });
    if (planData) {
      setPlans(planData);
      if (planData.length > 0 && !selectedPlanId) setSelectedPlanId(planData[0].id.toString());
    }

    const { data: subData } = await supabase.from('subscriptions').select('amount_paid');
    if (subData) {
      const revenue = subData.reduce((sum, sub) => sum + Number(sub.amount_paid), 0);
      setTotalRevenue(revenue);
    }
    
    setIsSyncing(false);
  }

  useEffect(() => { 
    initializeEngine(); 
  }, []);

  // ==========================================
  // CRM HANDLERS
  // ==========================================
  async function handleCheckIn(id: string, name: string) {
    const { error } = await supabase.from('attendance').insert([{ member_id: id }]);
    if (error) alert(`Check-in failed: ${error.message}`);
    else alert(`✅ ${name} checked in successfully!`);
  }

  async function toggleMemberStatus(id: string, currentStatus: string) {
    const nextStatus = currentStatus === 'active' ? 'expired' : 'active';
    await supabase.from('members').update({ status: nextStatus }).eq('id', id);
    initializeEngine();
  }

  async function deleteMember(id: string, name: string) {
    if (!confirm(`Permanently delete ${name}?`)) return;
    await supabase.from('members').delete().eq('id', id);
    initializeEngine();
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName || !phoneNumber || !selectedPlanId) return;

    setIsSubmitting(true);
    const selectedPlan = plans.find(p => p.id === Number(selectedPlanId));
    if (!selectedPlan) return setIsSubmitting(false);

    const { data: newMember, error: memberError } = await supabase
      .from('members')
      .insert([{ full_name: fullName, phone_number: phoneNumber, status: 'active' }])
      .select().single();

    if (memberError) {
      alert(`Error: ${memberError.message}`);
      return setIsSubmitting(false);
    }

    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(startDate.getMonth() + selectedPlan.duration_months);

    await supabase.from('subscriptions').insert([{
      member_id: newMember.id, plan_id: selectedPlan.id,
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
      amount_paid: selectedPlan.price, payment_mode: paymentMode
    }]);

    setIsSubmitting(false);
    setFullName(''); setPhoneNumber(''); setIsModalOpen(false);
    initializeEngine();
  }

  // ==========================================
  // TRACKING & ASSIGNMENT HANDLERS
  // ==========================================
  async function openAthleteDossier(athlete: MemberData) {
    setSelectedAthlete(athlete);
    fetchAthleteLogs(athlete.full_name);
  }

  async function fetchAthleteLogs(name: string) {
    const { data } = await supabase.from("workouts").select("*").eq("member_name", name).order("created_at", { ascending: false }).limit(10);
    if (data) setAthleteWorkouts(data);
  }

  async function handleAssignWorkout(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAthlete) return;

    setAssignStatus("Assigning to Matrix...");
    const { error } = await supabase.from("workouts").insert([{ 
      member_name: selectedAthlete.full_name, 
      exercise_name: assignEx, 
      sets: parseInt(assignSets), 
      reps: parseInt(assignReps), 
      weight_kg: parseFloat(assignWeight) 
    }]);

    if (!error) {
      setAssignStatus("Workout Assigned! ✅");
      setAssignEx(""); setAssignSets(""); setAssignReps(""); setAssignWeight("");
      fetchAthleteLogs(selectedAthlete.full_name);
      setTimeout(() => setAssignStatus(""), 3000);
    } else {
      setAssignStatus(`Error: ${error.message}`);
    }
  }

  async function handleDeleteWorkout(id: string) {
    const { error } = await supabase.from("workouts").delete().eq("id", id);
    if (!error && selectedAthlete) fetchAthleteLogs(selectedAthlete.full_name);
  }

  // --- Search Filter Logic ---
  const filteredMembers = members.filter(m => {
    const matchesSearch = m.full_name.toLowerCase().includes(searchQuery.toLowerCase()) || m.phone_number.includes(searchQuery);
    const matchesStatus = statusFilter === 'all' ? true : m.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const activeMembers = members.filter(m => m.status === 'active');
  const expiredMembers = members.filter(m => m.status === 'expired');


  // ==========================================
  // RENDER 1: LOADING STATE
  // ==========================================
  if (authStatus === 'loading') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center font-sans text-emerald-500">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-8 h-8 animate-spin" />
          <p className="tracking-widest uppercase text-sm font-bold">Querying Database...</p>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER 2: GUEST GATEWAY
  // ==========================================
  if (authStatus === 'guest') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-emerald-600/10 blur-[100px] rounded-full pointer-events-none"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-cyan-600/10 blur-[100px] rounded-full pointer-events-none"></div>

        <div className="text-center space-y-4 mb-16 z-10">
          <h1 className="text-5xl md:text-7xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 drop-shadow-lg">
            Iron Keep HQ
          </h1>
          <p className="text-slate-400 text-lg uppercase tracking-widest">Central Command Terminal</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl z-10">
          <Link href="/login" className="group relative bg-slate-900 border border-emerald-900/50 p-10 rounded-2xl shadow-xl shadow-emerald-900/10 hover:border-emerald-500/50 hover:shadow-emerald-500/20 transition-all text-center flex flex-col items-center justify-center gap-6 overflow-hidden">
            <div className="w-20 h-20 bg-emerald-900/40 border border-emerald-500/50 text-emerald-400 rounded-full flex items-center justify-center text-4xl z-10 group-hover:scale-110 transition-transform">🛡️</div>
            <div className="z-10"><h2 className="text-3xl font-bold text-slate-100 mb-2">Owner Matrix</h2><p className="text-slate-400 text-sm uppercase">Manage Roster & Revenue</p></div>
          </Link>
          <Link href="/member" className="group relative bg-slate-900 border border-cyan-900/50 p-10 rounded-2xl shadow-xl shadow-cyan-900/10 hover:border-cyan-500/50 hover:shadow-cyan-500/20 transition-all text-center flex flex-col items-center justify-center gap-6 overflow-hidden">
            <div className="w-20 h-20 bg-cyan-900/40 border border-cyan-500/50 text-cyan-400 rounded-full flex items-center justify-center text-4xl z-10 group-hover:scale-110 transition-transform">🏋️</div>
            <div className="z-10"><h2 className="text-3xl font-bold text-slate-100 mb-2">Athlete Login</h2><p className="text-slate-400 text-sm uppercase">Log Workouts & Macros</p></div>
          </Link>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER 3: CRM DASHBOARD
  // ==========================================
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 font-sans relative">
      <div className="max-w-6xl mx-auto flex justify-between items-center mb-8 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">IRON KEEP HQ</h1>
          <p className="text-sm text-slate-400 mt-1">Live Database Matrix Engine</p>
        </div>
        <div className="flex gap-3">
          <button onClick={async () => { await supabase.auth.signOut(); window.location.reload(); }} className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 px-4 py-2 rounded-lg text-sm font-semibold text-rose-400 hover:bg-rose-500/20 transition-all">Log Out</button>
          <button onClick={initializeEngine} className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-4 py-2 rounded-lg text-sm hover:bg-slate-800 text-slate-300 transition-all"><RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} /> Sync</button>
          <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-bold px-4 py-2 rounded-lg text-sm hover:opacity-90 transition-all"><UserPlus className="w-4 h-4" /> Add Member</button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
        <div className="bg-slate-900/50 border border-slate-800 p-5 rounded-2xl flex items-center gap-4"><div className="p-3 bg-rose-500/10 text-rose-400 rounded-xl"><AlertCircle /></div><div><p className="text-xs text-slate-400 font-semibold">Expired</p><h3 className="text-2xl font-black">{expiredMembers.length}</h3></div></div>
        <div className="bg-slate-900/50 border border-slate-800 p-5 rounded-2xl flex items-center gap-4"><div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl"><Clock /></div><div><p className="text-xs text-slate-400 font-semibold">Expiring Soon</p><h3 className="text-2xl font-black">0</h3></div></div>
        <div className="bg-slate-900/50 border border-slate-800 p-5 rounded-2xl flex items-center gap-4"><div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl"><CheckCircle /></div><div><p className="text-xs text-slate-400 font-semibold">Active</p><h3 className="text-2xl font-black">{activeMembers.length}</h3></div></div>
        <div className="bg-slate-900/50 border border-slate-800 p-5 rounded-2xl flex items-center gap-4"><div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-xl"><DollarSign /></div><div><p className="text-xs text-slate-400 font-semibold">Total Revenue</p><h3 className="text-2xl font-black text-cyan-400">₹{totalRevenue.toLocaleString('en-IN')}</h3></div></div>
      </div>

      <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input type="text" placeholder="Search athletes by name or phone..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-slate-900/50 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50 transition-all" />
        </div>
        <div className="flex gap-2">
          {['all', 'active', 'expired'].map(status => (
            <button key={status} onClick={() => setStatusFilter(status)} className={`px-4 py-2 rounded-xl text-sm font-semibold capitalize transition-all border ${statusFilter === status ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:bg-slate-800'}`}>{status}</button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto bg-slate-900/30 border border-slate-800/80 rounded-2xl p-6">
        {isSyncing ? <div className="text-center text-slate-500 py-8">Querying database...</div> : filteredMembers.length === 0 ? <div className="text-center text-slate-500 py-12">No records match your filters.</div> : (
          <div className="space-y-3">
            {filteredMembers.map((member) => (
              <div key={member.id} className="bg-slate-900/60 border border-slate-800/60 p-4 rounded-xl flex justify-between items-center group">
                <div>
                  <h4 className="font-bold text-slate-200">{member.full_name}</h4>
                  <p className="text-xs text-slate-400 mt-0.5">{member.phone_number} • Joined: {member.joined_date}</p>
                </div>
                <div className="flex items-center gap-4">
                  {/* NEW BUTTON: Track Progress & Assign */}
                  <button onClick={() => openAthleteDossier(member)} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs font-bold text-slate-300 hover:bg-purple-500/20 hover:text-purple-400 hover:border-purple-500/30 transition-all"><Activity className="w-3 h-3" /> Logs</button>
                  
                  <button onClick={() => handleCheckIn(member.id, member.full_name)} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs font-bold text-slate-300 hover:bg-cyan-500/20 hover:text-cyan-400 hover:border-cyan-500/30 transition-all"><MapPin className="w-3 h-3" /> Check In</button>
                  <span className={`px-3 py-1 text-xs font-semibold rounded-full ${member.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>{member.status.toUpperCase()}</span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => toggleMemberStatus(member.id, member.status)} className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800"><Power className="w-4 h-4" /></button>
                    <button onClick={() => deleteMember(member.id, member.full_name)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* --- ADD NEW MEMBER MODAL --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
           <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 shadow-2xl relative">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"><X className="w-5 h-5" /></button>
            <h3 className="text-xl font-bold text-slate-100 mb-5">Register New Member</h3>
            <form onSubmit={handleAddMember} className="space-y-4">
              <div><label className="block text-xs text-slate-400 mb-1.5">Full Name</label><input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100" /></div>
              <div><label className="block text-xs text-slate-400 mb-1.5">Phone Number</label><input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} required className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-slate-400 mb-1.5">Package</label><select value={selectedPlanId} onChange={(e) => setSelectedPlanId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-100">{plans.map(p => <option key={p.id} value={p.id}>{p.plan_name} (₹{p.price})</option>)}</select></div>
                <div><label className="block text-xs text-slate-400 mb-1.5">Payment</label><select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-100"><option>Cash</option><option>UPI</option><option>Card</option></select></div>
              </div>
              <button type="submit" disabled={isSubmitting} className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-bold py-2.5 rounded-xl text-sm hover:opacity-90">{isSubmitting ? 'Syncing...' : 'Activate & Log Payment'}</button>
            </form>
          </div>
        </div>
      )}

      {/* --- NEW: ATHLETE DOSSIER MODAL (Tracking & Assignment) --- */}
      {selectedAthlete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-4xl rounded-2xl p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setSelectedAthlete(null)} className="absolute top-4 right-4 p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"><X className="w-6 h-6" /></button>
            
            <div className="mb-8 border-b border-slate-800 pb-4">
              <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 uppercase tracking-wide">{selectedAthlete.full_name}'s Dossier</h2>
              <p className="text-slate-400 text-sm uppercase tracking-widest mt-1">Live Progress & Assignment Routing</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Assign Routine Form */}
              <div className="bg-slate-950/50 p-6 rounded-xl border border-slate-800">
                <h3 className="text-lg font-bold text-blue-400 mb-4 flex items-center gap-2"><Activity className="w-5 h-5"/> Assign Workout Routine</h3>
                <form onSubmit={handleAssignWorkout} className="space-y-4">
                  <input type="text" required value={assignEx} onChange={(e) => setAssignEx(e.target.value)} placeholder="Exercise Name" className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-white focus:outline-none focus:border-blue-500" />
                  <div className="flex gap-4">
                    <input type="number" required value={assignSets} onChange={(e) => setAssignSets(e.target.value)} placeholder="Sets" className="w-1/3 bg-slate-900 border border-slate-700 rounded p-3 text-white focus:outline-none" />
                    <input type="number" required value={assignReps} onChange={(e) => setAssignReps(e.target.value)} placeholder="Reps" className="w-1/3 bg-slate-900 border border-slate-700 rounded p-3 text-white focus:outline-none" />
                    <input type="number" required step="0.5" value={assignWeight} onChange={(e) => setAssignWeight(e.target.value)} placeholder="Weight (kg)" className="w-1/3 bg-slate-900 border border-slate-700 rounded p-3 text-white focus:outline-none" />
                  </div>
                  <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg transition-colors uppercase tracking-widest text-sm mt-2">Push to Athlete Portal</button>
                  {assignStatus && <p className="text-center mt-2 text-emerald-400 font-bold text-sm">{assignStatus}</p>}
                </form>
              </div>

              {/* View Tracked Progress */}
              <div className="bg-slate-950/50 p-6 rounded-xl border border-slate-800">
                <h3 className="text-lg font-bold text-purple-400 mb-4 flex items-center gap-2"><Activity className="w-5 h-5"/> Recent Logs</h3>
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                  {athleteWorkouts.length === 0 ? (
                    <p className="text-slate-500 text-center py-8">No workout data found for this athlete.</p>
                  ) : (
                    athleteWorkouts.map((workout) => (
                      <div key={workout.id} className="flex justify-between items-center bg-slate-900 p-3 rounded-lg border border-slate-700">
                        <div>
                          <span className="font-bold text-slate-200 block">{workout.exercise_name}</span>
                          <span className="text-slate-400 text-sm">{workout.sets} sets × {workout.reps} reps @ {workout.weight_kg}kg</span>
                        </div>
                        <button onClick={() => handleDeleteWorkout(workout.id)} className="text-rose-500 hover:text-rose-400 p-2 rounded-lg hover:bg-slate-800 transition-colors"><Trash2 className="w-4 h-4"/></button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}