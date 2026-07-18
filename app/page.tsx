"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from './supabase';
import { AlertCircle, Clock, CheckCircle, DollarSign, RefreshCw, UserPlus, X, Trash2, Power, Search, MapPin, Activity, QrCode, ArrowLeft, MoreVertical, Edit3, PlusCircle, MessageCircle, MessageSquare } from 'lucide-react';
import Link from "next/link";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface MemberData {
  id: string;
  full_name: string;
  phone_number: string;
  joined_date: string;
  status: string;
  email?: string;
  gender?: string;
  photo?: string;
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
  const [gender, setGender] = useState('Male');
  const [photoBase64, setPhotoBase64] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // --- EDIT & MANAGE MEMBER STATE ---
  const [activeMenuMemberId, setActiveMenuMemberId] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editMemberId, setEditMemberId] = useState('');
  const [editFullName, setEditFullName] = useState('');
  const [editPhoneNumber, setEditPhoneNumber] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editGender, setEditGender] = useState('Male');
  const [editPhotoBase64, setEditPhotoBase64] = useState('');

  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [subMemberId, setSubMemberId] = useState('');
  const [subMemberName, setSubMemberName] = useState('');
  const [subPlanId, setSubPlanId] = useState('');
  const [subJoiningDate, setSubJoiningDate] = useState(new Date().toISOString().split('T')[0]);
  const [subDurationMonths, setSubDurationMonths] = useState(1);
  const [subPaymentMode, setSubPaymentMode] = useState('Cash');
  const [subMemberEndDate, setSubMemberEndDate] = useState<string | null>(null);

  // --- EXPIRY ALERT STATE ---
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [alertMember, setAlertMember] = useState<MemberData | null>(null);

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
      triggerAutomaticExpiryAlerts(membersWithSubs);
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
    const { data: checkins } = await supabase.from('attendance').select('check_in_time');
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
        const dateStr = new Date(log.check_in_time).toISOString().split('T')[0];
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
      .select('id, check_in_time, member_id')
      .order('check_in_time', { ascending: false })
      .limit(5);

    if (latestCheckins && memberData) {
      const feed = latestCheckins.map((c: any) => {
        const member = memberData.find((m: any) => m.id === c.member_id);
        return {
          id: c.id,
          name: member ? member.full_name : 'Guest Athlete',
          time: new Date(c.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          date: new Date(c.check_in_time).toLocaleDateString([], { month: 'short', day: 'numeric' })
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

  // --- Edit & Manage Handlers ---
  function openEditModal(member: MemberData) {
    setEditMemberId(member.id);
    setEditFullName(member.full_name);
    setEditPhoneNumber(member.phone_number);
    setEditEmail(member.email || '');
    
    let g = member.gender || 'Male';
    if (typeof window !== 'undefined' && !member.gender) {
      const localGenders = JSON.parse(localStorage.getItem('gymnation_member_genders') || '{}');
      g = localGenders[member.id] || 'Male';
    }
    setEditGender(g);

    let p = member.photo || '';
    if (typeof window !== 'undefined' && !member.photo) {
      const localPhotos = JSON.parse(localStorage.getItem('gymnation_member_photos') || '{}');
      p = localPhotos[member.id] || '';
    }
    setEditPhotoBase64(p);

    setIsEditModalOpen(true);
  }

  async function handleEditMember(e: React.FormEvent) {
    e.preventDefault();
    if (!editFullName || !editPhoneNumber) return;
    
    setIsSubmitting(true);
    let updateError = null;
    
    try {
      const { error } = await supabase
        .from('members')
        .update({ 
          full_name: editFullName, 
          phone_number: editPhoneNumber, 
          email: editEmail || null,
          gender: editGender,
          photo: editPhotoBase64 || null
        })
        .eq('id', editMemberId);
      updateError = error;
    } catch (err) {}

    if (updateError) {
      try {
        const { error } = await supabase
          .from('members')
          .update({ 
            full_name: editFullName, 
            phone_number: editPhoneNumber, 
            email: editEmail || null,
            gender: editGender
          })
          .eq('id', editMemberId);
        updateError = error;
      } catch (err) {}
    }

    if (updateError) {
      try {
        const { error } = await supabase
          .from('members')
          .update({ 
            full_name: editFullName, 
            phone_number: editPhoneNumber, 
            email: editEmail || null
          })
          .eq('id', editMemberId);
        updateError = error;
      } catch (err) {}
    }

    if (updateError) {
      const { error } = await supabase
        .from('members')
        .update({ 
          full_name: editFullName, 
          phone_number: editPhoneNumber
        })
        .eq('id', editMemberId);
      updateError = error;
    }

    if (updateError) {
      alert(`Error: ${updateError.message}`);
      return setIsSubmitting(false);
    }

    if (typeof window !== 'undefined') {
      if (editPhotoBase64) {
        const localPhotos = JSON.parse(localStorage.getItem('gymnation_member_photos') || '{}');
        localPhotos[editMemberId] = editPhotoBase64;
        localStorage.setItem('gymnation_member_photos', JSON.stringify(localPhotos));
      }
      const localGenders = JSON.parse(localStorage.getItem('gymnation_member_genders') || '{}');
      localGenders[editMemberId] = editGender;
      localStorage.setItem('gymnation_member_genders', JSON.stringify(localGenders));
    }

    setIsSubmitting(false);
    setIsEditModalOpen(false);
    initializeEngine();
  }

  function openSubModal(member: MemberData) {
    setSubMemberId(member.id);
    setSubMemberName(member.full_name);
    setSubMemberEndDate(member.end_date || null);
    if (plans.length > 0) {
      setSubPlanId(plans[0].id.toString());
      setSubDurationMonths(plans[0].duration_months);
    }
    setSubJoiningDate(new Date().toISOString().split('T')[0]);
    setIsSubModalOpen(true);
  }

  function triggerExpiryAlert(member: MemberData) {
    setAlertMember(member);
    setIsAlertModalOpen(true);
  }

  async function triggerAutomaticExpiryAlerts(membersList: MemberData[]) {
    if (typeof window === 'undefined') return;
    
    const todayStr = new Date().toISOString().split('T')[0];
    const sentReminders = JSON.parse(localStorage.getItem('gymnation_sent_reminders') || '{}');
    let hasSentAny = false;

    // Filter members expiring in 7 days or fewer (and not expired)
    const expiringSoon = membersList.filter(m => (m.days_left || 0) > 0 && (m.days_left || 0) <= 7);

    for (const member of expiringSoon) {
      const lastSentDate = sentReminders[member.id];
      
      // If we haven't sent an alert to this member today, send it automatically!
      if (lastSentDate !== todayStr) {
        const message = `Hi ${member.full_name}, this is a reminder that your GYMNATION subscription is expiring in ${member.days_left} days on ${member.end_date}. Please renew soon to continue your training without interruptions! Thank you.`;
        
        try {
          const res = await fetch('/api/send-sms', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              to: member.phone_number,
              message: message
            })
          });
          
          if (res.ok) {
            sentReminders[member.id] = todayStr;
            hasSentAny = true;
          }
        } catch (e) {
          console.error(`Failed to send automated SMS to ${member.full_name}:`, e);
        }
      }
    }

    if (hasSentAny) {
      localStorage.setItem('gymnation_sent_reminders', JSON.stringify(sentReminders));
    }
  }

  async function handleAddSubscription(e: React.FormEvent) {
    e.preventDefault();
    if (!subMemberId || !subPlanId) return;

    setIsSubmitting(true);
    const selectedPlan = plans.find(p => p.id === Number(subPlanId));
    if (!selectedPlan) return setIsSubmitting(false);

    let startDateStr = subJoiningDate;
    const today = new Date();
    if (subMemberEndDate && new Date(subMemberEndDate) > today) {
      startDateStr = subMemberEndDate;
    }

    const startDate = new Date(startDateStr);
    const endDate = new Date(startDateStr);
    endDate.setMonth(startDate.getMonth() + Number(subDurationMonths));

    const { error } = await supabase.from('subscriptions').insert([{
      member_id: subMemberId, 
      plan_id: selectedPlan.id,
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
      amount_paid: selectedPlan.price, 
      payment_mode: subPaymentMode
    }]);

    if (error) {
      alert(`Error logging subscription: ${error.message}`);
    } else {
      alert(`Subscription logged successfully starting from ${startDateStr} to ${endDate.toISOString().split('T')[0]}!`);
    }

    setIsSubmitting(false);
    setIsSubModalOpen(false);
    initializeEngine();
  }

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName || !phoneNumber || !selectedPlanId) return;

    setIsSubmitting(true);
    const selectedPlan = plans.find(p => p.id === Number(selectedPlanId));
    if (!selectedPlan) return setIsSubmitting(false);

    let insertData: any = {
      full_name: fullName,
      phone_number: phoneNumber,
      status: 'active'
    };

    let newMember: any = null;
    let memberError: any = null;

    // Try full insert with email, gender, photo
    try {
      const { data, error } = await supabase
        .from('members')
        .insert([{ ...insertData, email: email || null, gender, photo: photoBase64 || null }])
        .select().single();
      newMember = data;
      memberError = error;
    } catch (err) {}

    // Fallback 1: retry without photo
    if (memberError || !newMember) {
      try {
        const { data, error } = await supabase
          .from('members')
          .insert([{ ...insertData, email: email || null, gender }])
          .select().single();
        newMember = data;
        memberError = error;
      } catch (err) {}
    }

    // Fallback 2: retry without gender/photo
    if (memberError || !newMember) {
      try {
        const { data, error } = await supabase
          .from('members')
          .insert([{ ...insertData, email: email || null }])
          .select().single();
        newMember = data;
        memberError = error;
      } catch (err) {}
    }

    // Fallback 3: retry with core fields only
    if (memberError || !newMember) {
      const { data, error } = await supabase
        .from('members')
        .insert([insertData])
        .select().single();
      newMember = data;
      memberError = error;
    }

    if (memberError) {
      alert(`Error: ${memberError.message}`);
      return setIsSubmitting(false);
    }

    // Cache gender and photo in localStorage
    if (newMember) {
      if (photoBase64) {
        const localPhotos = JSON.parse(localStorage.getItem('gymnation_member_photos') || '{}');
        localPhotos[newMember.id] = photoBase64;
        localStorage.setItem('gymnation_member_photos', JSON.stringify(localPhotos));
      }
      const localGenders = JSON.parse(localStorage.getItem('gymnation_member_genders') || '{}');
      localGenders[newMember.id] = gender;
      localStorage.setItem('gymnation_member_genders', JSON.stringify(localGenders));
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
    setFullName(''); setPhoneNumber(''); setEmail(''); setJoiningDate(new Date().toISOString().split('T')[0]); setDurationMonths(1); setGender('Male'); setPhotoBase64(''); setIsModalOpen(false);
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
  const expiringSoonMembers = members.filter(m => (m.days_left || 0) > 0 && (m.days_left || 0) <= 7);


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
        <div className="glass-panel glass-panel-hover p-5 rounded-2xl flex items-center gap-4"><div className="p-3 bg-brand-orange/10 text-brand-orange rounded-xl"><Clock /></div><div><p className="text-[10px] text-gray-400 uppercase tracking-widest font-mono">Expiring Soon</p><h3 className="text-2xl font-black">{expiringSoonMembers.length}</h3></div></div>
        <div className="glass-panel glass-panel-hover p-5 rounded-2xl flex items-center gap-4"><div className="p-3 bg-brand-volt/10 text-brand-volt rounded-xl"><CheckCircle /></div><div><p className="text-[10px] text-gray-400 uppercase tracking-widest font-mono">Active</p><h3 className="text-2xl font-black">{activeMembers.length}</h3></div></div>
        <div className="glass-panel glass-panel-hover p-5 rounded-2xl flex items-center gap-4"><div className="p-3 bg-brand-cyan/10 text-brand-cyan rounded-xl"><DollarSign /></div><div><p className="text-[10px] text-gray-400 uppercase tracking-widest font-mono">Total Revenue</p><h3 className="text-2xl font-black text-brand-cyan font-mono">₹{totalRevenue.toLocaleString('en-IN')}</h3></div></div>
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
            {filteredMembers.map((member) => {
              // Resolve gender
              let resolvedGender = member.gender || 'Male';
              if (typeof window !== 'undefined' && !member.gender) {
                const localGenders = JSON.parse(localStorage.getItem('gymnation_member_genders') || '{}');
                resolvedGender = localGenders[member.id] || 'Male';
              }
              
              // Resolve photo
              let resolvedPhoto = member.photo || null;
              if (typeof window !== 'undefined' && !resolvedPhoto) {
                const localPhotos = JSON.parse(localStorage.getItem('gymnation_member_photos') || '{}');
                resolvedPhoto = localPhotos[member.id] || null;
              }

              return (
                <div key={member.id} className="bg-brand-dark/40 border border-gray-900 p-4 rounded-xl flex justify-between items-center group hover:border-gray-800/90 transition-colors">
                  <div className="flex items-center gap-4">
                    {/* Avatar Container */}
                    <div className={`whatsapp-avatar ${resolvedGender === 'Female' ? 'female' : ''}`}>
                      {resolvedPhoto ? (
                        <img src={resolvedPhoto} alt={member.full_name} />
                      ) : resolvedGender === 'Female' ? (
                        <svg className="w-8 h-8 text-brand-orange/80 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <circle cx="12" cy="8" r="4" fill="rgba(255, 107, 0, 0.1)" />
                          <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
                          <path d="M12 1v3M10 2h4" strokeWidth="1" />
                        </svg>
                      ) : (
                        <svg className="w-8 h-8 text-brand-volt/80 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <circle cx="12" cy="8" r="4" fill="rgba(212, 255, 0, 0.1)" />
                          <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
                          <path d="M12 4V2" strokeWidth="2" />
                        </svg>
                      )}
                    </div>
                    
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-slate-200">{member.full_name}</h4>
                        <span className="text-[8px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-gray-400 font-mono uppercase">{resolvedGender}</span>
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
                        {(member.days_left || 0) <= 7 && (member.days_left || 0) > 0 && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              triggerExpiryAlert(member);
                            }}
                            className="text-[9px] px-2 py-0.5 rounded bg-brand-orange/20 border border-brand-orange/30 text-brand-orange hover:bg-brand-orange hover:text-black transition-all font-bold font-sans uppercase flex items-center gap-1 cursor-pointer"
                            title="Send Expiry Reminder"
                          >
                            <MessageCircle className="w-3 h-3" /> Remind
                          </button>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-400 font-mono space-y-0.5">
                        <p>{member.phone_number} • {member.email || 'No Email'}</p>
                        <p className="text-[10px] text-gray-500">
                          Active: <span className="text-gray-300 font-bold">{member.start_date}</span> ➔ Expiry: <span className="text-gray-300 font-bold">{member.end_date || 'N/A'}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => openAthleteDossier(member)} className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-dark/60 border border-gray-850 hover:bg-brand-purple/10 hover:text-brand-purple hover:border-brand-purple/20 rounded-lg text-xs font-bold text-slate-300 transition-all"><Activity className="w-3 h-3" /> Logs</button>
                  
                  <span className={`px-3 py-1 text-xs font-semibold rounded-full ${member.status === 'active' ? 'bg-brand-volt/10 text-brand-volt border border-brand-volt/20' : 'bg-rose-500/10 text-rose-450 border border-rose-500/20'}`}>{member.status.toUpperCase()}</span>
                  
                  {/* Options Menu Dropdown */}
                  <div className="relative">
                    <button 
                      onClick={() => setActiveMenuMemberId(activeMenuMemberId === member.id ? null : member.id)} 
                      className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                      title="Manage Athlete"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    
                    {activeMenuMemberId === member.id && (
                      <div className="absolute right-0 top-10 w-44 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-20 py-1.5 font-sans">
                        <button 
                          onClick={() => {
                            setActiveMenuMemberId(null);
                            openEditModal(member);
                          }} 
                          className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white flex items-center gap-2"
                        >
                          <Edit3 className="w-3.5 h-3.5" /> Edit Profile
                        </button>
                        <button 
                          onClick={() => {
                            setActiveMenuMemberId(null);
                            openSubModal(member);
                          }} 
                          className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white flex items-center gap-2"
                        >
                          <PlusCircle className="w-3.5 h-3.5" /> Add Subscription
                        </button>
                        {(member.days_left || 0) <= 7 && (member.days_left || 0) > 0 && (
                          <button 
                            onClick={() => {
                              setActiveMenuMemberId(null);
                              triggerExpiryAlert(member);
                            }} 
                            className="w-full text-left px-4 py-2 text-xs font-semibold text-brand-orange hover:bg-brand-orange/10 flex items-center gap-2"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-brand-orange" /> Send Expiry SMS
                          </button>
                        )}
                        <button 
                          onClick={() => {
                            setActiveMenuMemberId(null);
                            toggleMemberStatus(member.id, member.status);
                          }} 
                          className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white flex items-center gap-2"
                        >
                          <Power className="w-3.5 h-3.5" /> Toggle Status
                        </button>
                        <hr className="border-slate-800 my-1" />
                        <button 
                          onClick={() => {
                            setActiveMenuMemberId(null);
                            deleteMember(member.id, member.full_name);
                          }} 
                          className="w-full text-left px-4 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/10 hover:text-rose-350 flex items-center gap-2"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete Member
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
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

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2"><label className="block text-xs text-slate-400 mb-1.5">Joining Date</label><input type="date" value={joiningDate} onChange={(e) => setJoiningDate(e.target.value)} required className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-brand-orange/40 font-mono" /></div>
                <div><label className="block text-xs text-slate-400 mb-1.5">Duration</label><input type="number" min={1} max={36} value={durationMonths} onChange={(e) => setDurationMonths(Number(e.target.value))} required className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-brand-orange/40 font-mono" /></div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Gender</label>
                  <select 
                    value={gender} 
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-brand-orange/40"
                  >
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-slate-400 mb-1.5">Upload Photo <span className="text-[10px] text-gray-500 font-mono">(Optional)</span></label>
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-400 focus:outline-none focus:border-brand-orange/40 font-sans" 
                  />
                </div>
              </div>

              <button type="submit" disabled={isSubmitting} className="w-full bg-gradient-to-r from-brand-orange to-brand-volt text-slate-950 font-extrabold py-3.5 rounded-xl text-sm transition-opacity hover:opacity-90 tracking-widest uppercase font-sans mt-2">{isSubmitting ? 'Syncing...' : 'Activate & Log Payment'}</button>
            </form>
          </div>
        </div>
      )}

      {/* --- EDIT PROFILE MODAL --- */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 shadow-2xl relative font-sans">
            <button onClick={() => setIsEditModalOpen(false)} className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"><X className="w-5 h-5" /></button>
            <h3 className="text-xl font-bold text-slate-100 mb-5">Edit Profile</h3>
            <form onSubmit={handleEditMember} className="space-y-4">
              <div><label className="block text-xs text-slate-400 mb-1.5">Full Name</label><input type="text" value={editFullName} onChange={(e) => setEditFullName(e.target.value)} required className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-brand-orange/40" /></div>
              <div><label className="block text-xs text-slate-400 mb-1.5">Email Address <span className="text-[10px] text-gray-500 font-mono">(Optional)</span></label><input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="athlete@example.com" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-brand-orange/40" /></div>
              <div><label className="block text-xs text-slate-400 mb-1.5">Phone Number</label><input type="tel" value={editPhoneNumber} onChange={(e) => setEditPhoneNumber(e.target.value)} required className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-brand-orange/40" /></div>
              
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Gender</label>
                  <select 
                    value={editGender} 
                    onChange={(e) => setEditGender(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:outline-none"
                  >
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-slate-400 mb-1.5">Update Photo <span className="text-[10px] text-gray-500 font-mono">(Optional)</span></label>
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setEditPhotoBase64(reader.result as string);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-400 focus:outline-none" 
                  />
                </div>
              </div>

              <button type="submit" disabled={isSubmitting} className="w-full bg-gradient-to-r from-brand-orange to-brand-volt text-slate-950 font-extrabold py-3.5 rounded-xl text-sm transition-opacity hover:opacity-90 tracking-widest uppercase mt-2">{isSubmitting ? 'Syncing...' : 'Save Profile Changes'}</button>
            </form>
          </div>
        </div>
      )}

      {/* --- ADD SUBSCRIPTION MODAL --- */}
      {isSubModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 shadow-2xl relative font-sans">
            <button onClick={() => setIsSubModalOpen(false)} className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"><X className="w-5 h-5" /></button>
            <h3 className="text-xl font-bold text-slate-100 mb-2">New Subscription</h3>
            <p className="text-xs text-slate-400 mb-5">Assign or renew membership plan for <span className="text-brand-volt font-bold">{subMemberName}</span></p>
            
            {subMemberEndDate && new Date(subMemberEndDate) > new Date() && (
              <div className="bg-brand-volt/10 border border-brand-volt/20 text-brand-volt p-3.5 rounded-xl text-[11px] mb-4 font-sans font-semibold">
                ⚠️ Active subscription detected! This renewal will start in advance on <span className="font-bold">{subMemberEndDate}</span> right after their current plan expires.
              </div>
            )}
            
            <form onSubmit={handleAddSubscription} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Package</label>
                  <select 
                    value={subPlanId} 
                    onChange={(e) => {
                      const planId = e.target.value;
                      setSubPlanId(planId);
                      const plan = plans.find(p => p.id === Number(planId));
                      if (plan) {
                        setSubDurationMonths(plan.duration_months);
                      }
                    }} 
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:outline-none"
                  >
                    {plans.map(p => <option key={p.id} value={p.id}>{p.plan_name} (₹{p.price})</option>)}
                  </select>
                </div>
                <div><label className="block text-xs text-slate-400 mb-1.5">Payment Mode</label><select value={subPaymentMode} onChange={(e) => setSubPaymentMode(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:outline-none"><option>Cash</option><option>UPI</option><option>Card</option></select></div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2"><label className="block text-xs text-slate-400 mb-1.5">Joining/Start Date</label><input type="date" value={subJoiningDate} onChange={(e) => setSubJoiningDate(e.target.value)} required className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none font-mono" /></div>
                <div><label className="block text-xs text-slate-400 mb-1.5">Duration</label><input type="number" min={1} max={36} value={subDurationMonths} onChange={(e) => setSubDurationMonths(Number(e.target.value))} required className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none font-mono" /></div>
              </div>

              <button type="submit" disabled={isSubmitting} className="w-full bg-gradient-to-r from-brand-orange to-brand-volt text-slate-950 font-extrabold py-3.5 rounded-xl text-sm transition-opacity hover:opacity-90 tracking-widest uppercase mt-2">{isSubmitting ? 'Syncing...' : 'Activate & Log payment'}</button>
            </form>
          </div>
        </div>
      )}

      {/* --- EXPIRY ALERT MODAL --- */}
      {isAlertModalOpen && alertMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 shadow-2xl relative font-sans">
            <button 
              onClick={() => {
                setIsAlertModalOpen(false);
                setAlertMember(null);
              }} 
              className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
            
            <h3 className="text-xl font-bold text-slate-100 mb-2 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-brand-orange" /> Expiry Notification
            </h3>
            <p className="text-xs text-slate-400 mb-5">
              Send a renewal reminder alert to <span className="text-brand-orange font-bold">{alertMember.full_name}</span>.
            </p>

            <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl mb-5 space-y-2">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono font-bold">Message Preview</p>
              <p className="text-xs text-gray-300 font-sans italic leading-relaxed">
                "Hi {alertMember.full_name}, this is a reminder that your GYMNATION subscription is expiring in {alertMember.days_left} days on {alertMember.end_date}. Please renew soon to continue your training without interruptions! Thank you."
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  const message = encodeURIComponent(`Hi ${alertMember.full_name}, this is a reminder that your GYMNATION subscription is expiring in ${alertMember.days_left} days on ${alertMember.end_date}. Please renew soon to continue your training without interruptions! Thank you.`);
                  const phone = alertMember.phone_number.replace(/\D/g, '');
                  const cleanPhone = phone.length === 10 ? `91${phone}` : phone;
                  window.open(`https://wa.me/${cleanPhone}?text=${message}`, '_blank');
                  setIsAlertModalOpen(false);
                  setAlertMember(null);
                }}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" /> WhatsApp
              </button>

              <button
                onClick={() => {
                  const message = encodeURIComponent(`Hi ${alertMember.full_name}, this is a reminder that your GYMNATION subscription is expiring in ${alertMember.days_left} days on ${alertMember.end_date}. Please renew soon to continue your training without interruptions! Thank you.`);
                  window.open(`sms:${alertMember.phone_number}?body=${message}`, '_self');
                  setIsAlertModalOpen(false);
                  setAlertMember(null);
                }}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <MessageSquare className="w-4 h-4" /> Direct SMS
              </button>
            </div>
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