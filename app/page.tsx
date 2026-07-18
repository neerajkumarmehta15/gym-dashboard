"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from "@supabase/supabase-js";
import { AlertCircle, Clock, CheckCircle, DollarSign, RefreshCw, UserPlus, X, Trash2, Power, Search, MapPin, Activity, QrCode, ArrowLeft } from 'lucide-react';
import Link from "next/link";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

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
  email?: string;
  start_date?: string;
  end_date?: string | null;
  days_left?: number;
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

  // --- ANALYTICS STATE ---
  const [attendanceChartData, setAttendanceChartData] = useState<any[]>([]);
  const [packageChartData, setPackageChartData] = useState<any[]>([]);
  const [recentCheckins, setRecentCheckins] = useState<any[]>([]);

  // --- MEMBER MODAL STATE ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [email, setEmail] = useState('');
  const [joiningDate, setJoiningDate] = useState(new Date().toISOString().split('T')[0]);
  const [durationMonths, setDurationMonths] = useState(1);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

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
      router.push('/login');
      return; 
    }

    // Check if the logged-in user is an athlete
    const userEmail = session.user.email || '';
    const userFullName = session.user.user_metadata?.full_name || '';
    let isAthlete = false;

    try {
      const { data: hasEmail } = await supabase
        .from('members')
        .select('id')
        .eq('email', userEmail)
        .maybeSingle();
      
      if (hasEmail) {
        isAthlete = true;
      } else if (userFullName) {
        const { data: hasName } = await supabase
          .from('members')
          .select('id')
          .eq('full_name', userFullName)
          .maybeSingle();
        if (hasName) {
          isAthlete = true;
        }
      }
    } catch (e) {
      // Table check failed
    }

    if (isAthlete) {
      router.push('/athlete/dashboard');
      return;
    }
    
    setAuthStatus('owner');

    const { data: memberData } = await supabase.from('members').select('*').order('joined_date', { ascending: false });
    const { data: subDetails } = await supabase.from('subscriptions').select('*');

    if (memberData) {
      const membersWithSubs = memberData.map((m: any) => {
        const mSubs = subDetails ? subDetails.filter((s: any) => s.member_id === m.id) : [];
        let latestSub = null;
        if (mSubs.length > 0) {
          latestSub = mSubs.reduce((prev: any, current: any) => {
            return (new Date(prev.end_date) > new Date(current.end_date)) ? prev : current;
          });
        }
        
        let daysLeft = 0;
        if (latestSub) {
          const diffTime = new Date(latestSub.end_date).getTime() - new Date().getTime();
          daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }

        return {
          ...m,
          start_date: latestSub ? latestSub.start_date : m.joined_date,
          end_date: latestSub ? latestSub.end_date : null,
          days_left: daysLeft > 0 ? daysLeft : 0
        };
      });
      setMembers(membersWithSubs);
    }

    const { data: planData } = await supabase.from('membership_plans').select('*').order('price', { ascending: true });
    if (planData) {
      setPlans(planData);
      if (planData.length > 0 && !selectedPlanId) {
        setSelectedPlanId(planData[0].id.toString());
        setDurationMonths(planData[0].duration_months);
      }
    }

    const { data: subData } = await supabase.from('subscriptions').select('amount_paid');
    if (subData) {
      const revenue = subData.reduce((sum, sub) => sum + Number(sub.amount_paid), 0);
      setTotalRevenue(revenue);
    }

    // Fetch and calculate attendance chart data (last 7 days)
    const { data: checkins } = await supabase.from('attendance').select('created_at');
    if (checkins) {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return {
          dateStr: d.toISOString().split('T')[0],
          label: days[d.getDay()],
          count: 0
        };
      });

      checkins.forEach((log: any) => {
        const dateStr = new Date(log.created_at).toISOString().split('T')[0];
        const match = last7Days.find(d => d.dateStr === dateStr);
        if (match) {
          match.count++;
        }
      });
      setAttendanceChartData(last7Days);
    }

    // Calculate package distribution chart data
    if (memberData) {
      const packageCounts: { [key: string]: number } = {};
      memberData.forEach((m: any) => {
        const pkg = m.package_name || 'Standard Pass';
        packageCounts[pkg] = (packageCounts[pkg] || 0) + 1;
      });
      
      const COLORS = ['#ff6b00', '#d4ff00', '#00f0ff', '#a855f7'];
      const packageData = Object.keys(packageCounts).map((key, idx) => ({
        name: key,
        value: packageCounts[key],
        color: COLORS[idx % COLORS.length]
      }));
      setPackageChartData(packageData);
    }

    // Load recent check-in feed
    const { data: latestCheckins } = await supabase
      .from('attendance')
      .select('id, created_at, member_id')
      .order('created_at', { ascending: false })
      .limit(5);

    if (latestCheckins && memberData) {
      const feed = latestCheckins.map((c: any) => {
        const member = memberData.find((m: any) => m.id === c.member_id);
        return {
          id: c.id,
          name: member ? member.full_name : 'Guest Athlete',
          time: new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          date: new Date(c.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })
        };
      });
      setRecentCheckins(feed);
    }
    
    setIsSyncing(false);
  }

  useEffect(() => { 
    initializeEngine(); 
  }, []);

  useEffect(() => {
    let scanner: any = null;

    if (isScannerOpen) {
      import('html5-qrcode').then((module) => {
        const Html5QrcodeScanner = module.Html5QrcodeScanner;
        scanner = new Html5QrcodeScanner(
          "reader",
          { fps: 10, qrbox: { width: 250, height: 250 } },
          false
        );

        scanner.render(
          async (decodedText: string) => {
            scanner.clear().catch((e: any) => console.error(e));
            setIsScannerOpen(false);
            await handleCheckInById(decodedText);
          },
          (error: any) => {
            // ignore scan errors
          }
        );
      });
    }

    return () => {
      if (scanner) {
        scanner.clear().catch((err: any) => console.error("Failed to clear scanner", err));
      }
    };
  }, [isScannerOpen]);

  async function handleCheckInById(id: string) {
    const { data: memberData } = await supabase.from('members').select('full_name').eq('id', id).maybeSingle();
    if (memberData) {
      const { error } = await supabase.from('attendance').insert([{ member_id: id }]);
      if (error) alert(`Check-in failed: ${error.message}`);
      else alert(`✅ Check-in success: Welcome back, ${memberData.full_name}!`);
    } else {
      alert("❌ Scan Error: Athlete registration ID not found in roster database.");
    }
  }

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
      .insert([{ full_name: fullName, phone_number: phoneNumber, email: email || null, status: 'active' }])
      .select().single();

    if (memberError) {
      alert(`Error: ${memberError.message}`);
      return setIsSubmitting(false);
    }

    const startDate = new Date(joiningDate);
    const endDate = new Date(joiningDate);
    endDate.setMonth(startDate.getMonth() + Number(durationMonths));

    await supabase.from('subscriptions').insert([{
      member_id: newMember.id, plan_id: selectedPlan.id,
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
      amount_paid: selectedPlan.price, payment_mode: paymentMode
    }]);

    setIsSubmitting(false);
    setFullName(''); setPhoneNumber(''); setEmail(''); setJoiningDate(new Date().toISOString().split('T')[0]); setDurationMonths(1); setIsModalOpen(false);
    initializeEngine();
  }

  // ==========================================
  // TRACKING & ASSIGNMENT HANDLERS
  // ==========================================
  async function openAthleteDossier(athlete: MemberData) {
    setSelectedAthlete(athlete);
    fetchAthleteLogs(athlete.id);
  }

  async function fetchAthleteLogs(memberId: string) {
    const { data } = await supabase.from("workouts").select("*").eq("member_id", memberId).order("created_at", { ascending: false }).limit(10);
    if (data) setAthleteWorkouts(data);
  }

  async function handleAssignWorkout(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAthlete) return;

    setAssignStatus("Assigning to Matrix...");
    const { error } = await supabase.from("workouts").insert([{ 
      member_name: selectedAthlete.full_name,
      member_id: selectedAthlete.id,
      exercise_name: assignEx, 
      sets: parseInt(assignSets), 
      reps: parseInt(assignReps), 
      weight_kg: parseFloat(assignWeight) 
    }]);

    if (!error) {
      setAssignStatus("Workout Assigned! ✅");
      setAssignEx(""); setAssignSets(""); setAssignReps(""); setAssignWeight("");
      fetchAthleteLogs(selectedAthlete.id);
      setTimeout(() => setAssignStatus(""), 3000);
    } else {
      setAssignStatus(`Error: ${error.message}`);
    }
  }

  async function handleDeleteWorkout(id: string) {
    const { error } = await supabase.from("workouts").delete().eq("id", id);
    if (!error && selectedAthlete) fetchAthleteLogs(selectedAthlete.id);
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
      <div className="min-h-screen bg-brand-dark flex items-center justify-center font-sans text-brand-volt">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-8 h-8 animate-spin" />
          <p className="tracking-widest uppercase text-xs font-mono font-bold">Querying CRM Database...</p>
        </div>
      </div>
    );
  }



  // ==========================================
  // RENDER 3: CRM DASHBOARD
  // ==========================================
  return (
    <div className="min-h-screen bg-brand-dark text-gray-100 p-6 font-sans relative overflow-hidden">
      {/* ambient glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-brand-orange/5 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-brand-volt/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-6xl mx-auto flex justify-between items-center mb-8 border-b border-slate-900 pb-5 relative z-10">
        <div className="flex items-center gap-3.5">
          <button 
            onClick={() => window.history.back()} 
            className="p-2.5 bg-slate-900/60 border border-gray-800 hover:border-brand-orange/40 rounded-xl text-gray-400 hover:text-white transition-all duration-200"
            title="Go Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-3xl text-3d-gymnation">GYMNATION</h1>
            <p className="text-xs text-gray-400 font-mono uppercase tracking-widest mt-1">Live Database Matrix Engine</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-brand-volt text-black font-extrabold px-4 py-2.5 rounded-xl text-xs uppercase tracking-widest font-sans transition-all glow-btn-volt"><UserPlus className="w-4 h-4" /> Add Member</button>
          <button onClick={async () => { await supabase.auth.signOut(); window.location.reload(); }} className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 px-4 py-2.5 rounded-xl text-xs uppercase tracking-widest font-mono font-bold text-rose-400 hover:bg-rose-500/20 transition-all">Log Out</button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-5 mb-8 relative z-10">
        <div className="glass-panel glass-panel-hover p-5 rounded-2xl flex items-center gap-4"><div className="p-3 bg-rose-500/10 text-rose-400 rounded-xl"><AlertCircle /></div><div><p className="text-[10px] text-gray-400 uppercase tracking-widest font-mono">Expired</p><h3 className="text-2xl font-black">{expiredMembers.length}</h3></div></div>
        <div className="glass-panel glass-panel-hover p-5 rounded-2xl flex items-center gap-4"><div className="p-3 bg-brand-orange/10 text-brand-orange rounded-xl"><Clock /></div><div><p className="text-[10px] text-gray-400 uppercase tracking-widest font-mono">Expiring Soon</p><h3 className="text-2xl font-black">0</h3></div></div>
        <div className="glass-panel glass-panel-hover p-5 rounded-2xl flex items-center gap-4"><div className="p-3 bg-brand-volt/10 text-brand-volt rounded-xl"><CheckCircle /></div><div><p className="text-[10px] text-gray-400 uppercase tracking-widest font-mono">Active</p><h3 className="text-2xl font-black">{activeMembers.length}</h3></div></div>
        <div className="glass-panel glass-panel-hover p-5 rounded-2xl flex items-center gap-4"><div className="p-3 bg-brand-cyan/10 text-brand-cyan rounded-xl"><DollarSign /></div><div><p className="text-[10px] text-gray-400 uppercase tracking-widest font-mono">Total Revenue</p><h3 className="text-2xl font-black text-brand-cyan font-mono">₹{totalRevenue.toLocaleString('en-IN')}</h3></div></div>
      </div>

      {/* Analytics Grid */}
      <div className="max-w-6xl mx-auto mb-8 relative z-10 font-sans">
        {/* Weekly Attendance Chart */}
        <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between min-h-[300px]">
          <div>
            <h3 className="text-sm font-bold text-gray-200 uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-5 h-5 text-brand-volt" /> Check-In Trends (Last 7 Days)
            </h3>
            <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-wide">Daily athlete gate check-in statistics</p>
          </div>
          <div className="h-[200px] w-full mt-4">
            {attendanceChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={attendanceChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <XAxis dataKey="label" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#090d16', border: '1px solid #1e293b', borderRadius: '12px' }}
                    labelStyle={{ color: '#94a3b8', fontSize: '10px', fontFamily: 'monospace' }}
                    itemStyle={{ color: '#d4ff00', fontSize: '12px', fontWeight: 'bold' }}
                  />
                  <Bar dataKey="count" fill="#d4ff00" radius={[6, 6, 0, 0]}>
                    {attendanceChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 6 ? '#ff6b00' : '#d4ff00'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-gray-500 font-mono">No Check-in Data Found</div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-4 mb-6 relative z-10 font-sans">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input type="text" placeholder="Search athletes by name or phone..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-brand-dark/50 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-brand-volt/40 transition-all font-sans" />
        </div>
        <div className="flex gap-2">
          {['all', 'active', 'expired'].map(status => (
            <button key={status} onClick={() => setStatusFilter(status)} className={`px-4 py-2 rounded-xl text-sm font-semibold capitalize transition-all border ${statusFilter === status ? 'bg-brand-cyan/20 border-brand-cyan/40 text-brand-cyan' : 'bg-slate-900/40 border-slate-800/80 text-slate-400 hover:bg-slate-800'}`}>{status}</button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto glass-panel p-6 rounded-2xl relative z-10">
        {isSyncing ? <div className="text-center text-slate-500 py-8 font-mono text-sm">Querying database...</div> : filteredMembers.length === 0 ? <div className="text-center text-slate-500 py-12 text-sm">No records match your filters.</div> : (
          <div className="space-y-3">
            {filteredMembers.map((member) => (
              <div key={member.id} className="bg-brand-dark/40 border border-gray-900 p-4 rounded-xl flex justify-between items-center group hover:border-gray-800/90 transition-colors">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-bold text-slate-200">{member.full_name}</h4>
                    {member.end_date && (
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold font-mono uppercase ${
                        (member.days_left || 0) > 15 
                          ? 'bg-brand-volt/10 text-brand-volt border border-brand-volt/20' 
                          : (member.days_left || 0) > 0 
                            ? 'bg-brand-orange/10 text-brand-orange border border-brand-orange/20' 
                            : 'bg-rose-500/10 text-rose-450 border border-rose-500/20'
                      }`}>
                        {(member.days_left || 0) > 0 ? `${member.days_left} Days Left` : 'Expired'}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-gray-400 font-mono space-y-0.5">
                    <p>{member.phone_number} • {member.email || 'No Email'}</p>
                    <p className="text-[10px] text-gray-500">
                      Active: <span className="text-gray-300 font-bold">{member.start_date}</span> ➔ Expiry: <span className="text-gray-300 font-bold">{member.end_date || 'N/A'}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <button onClick={() => openAthleteDossier(member)} className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-dark/60 border border-gray-850 hover:bg-brand-purple/10 hover:text-brand-purple hover:border-brand-purple/20 rounded-lg text-xs font-bold text-slate-300 transition-all"><Activity className="w-3 h-3" /> Logs</button>
                  
                  <button onClick={() => handleCheckIn(member.id, member.full_name)} className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-dark/60 border border-gray-850 hover:bg-brand-cyan/10 hover:text-brand-cyan hover:border-brand-cyan/20 rounded-lg text-xs font-bold text-slate-300 transition-all"><MapPin className="w-3 h-3" /> Check In</button>
                  <span className={`px-3 py-1 text-xs font-semibold rounded-full ${member.status === 'active' ? 'bg-brand-volt/10 text-brand-volt border border-brand-volt/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>{member.status.toUpperCase()}</span>
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
              <div><label className="block text-xs text-slate-400 mb-1.5">Full Name</label><input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-brand-orange/40" /></div>
              <div><label className="block text-xs text-slate-400 mb-1.5">Email Address <span className="text-[10px] text-gray-500 font-mono">(Optional)</span></label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="athlete@example.com" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-brand-orange/40" /></div>
              <div><label className="block text-xs text-slate-400 mb-1.5">Phone Number</label><input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} required className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-brand-orange/40" /></div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Package</label>
                  <select 
                    value={selectedPlanId} 
                    onChange={(e) => {
                      const planId = e.target.value;
                      setSelectedPlanId(planId);
                      const plan = plans.find(p => p.id === Number(planId));
                      if (plan) {
                        setDurationMonths(plan.duration_months);
                      }
                    }} 
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-brand-orange/40"
                  >
                    {plans.map(p => <option key={p.id} value={p.id}>{p.plan_name} (₹{p.price})</option>)}
                  </select>
                </div>
                <div><label className="block text-xs text-slate-400 mb-1.5">Payment Mode</label><select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-brand-orange/40"><option>Cash</option><option>UPI</option><option>Card</option></select></div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-slate-400 mb-1.5">Joining Date</label><input type="date" value={joiningDate} onChange={(e) => setJoiningDate(e.target.value)} required className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-brand-orange/40 font-mono" /></div>
                <div><label className="block text-xs text-slate-400 mb-1.5">Duration (Months)</label><input type="number" min={1} max={36} value={durationMonths} onChange={(e) => setDurationMonths(Number(e.target.value))} required className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-brand-orange/40 font-mono" /></div>
              </div>

              <button type="submit" disabled={isSubmitting} className="w-full bg-gradient-to-r from-brand-orange to-brand-volt text-slate-950 font-extrabold py-3.5 rounded-xl text-sm transition-opacity hover:opacity-90 tracking-widest uppercase font-sans mt-2">{isSubmitting ? 'Syncing...' : 'Activate & Log Payment'}</button>
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

      {/* --- QR CODE SCANNER MODAL --- */}
      {isScannerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 shadow-2xl relative">
            <button onClick={() => setIsScannerOpen(false)} className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"><X className="w-5 h-5" /></button>
            <h3 className="text-xl font-bold text-slate-100 mb-5 flex items-center gap-2"><QrCode className="text-cyan-400" /> Scan Athlete QR Pass</h3>
            <div className="bg-black/40 rounded-xl overflow-hidden p-2 border border-slate-800">
              <div id="reader" className="w-full"></div>
            </div>
            <p className="text-center text-xs text-slate-500 mt-4 uppercase tracking-widest">HQ Camera Access Required</p>
          </div>
        </div>
      )}
    </div>
  );
}