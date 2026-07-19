"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { AlertCircle, Clock, CheckCircle, DollarSign, RefreshCw, UserPlus, X, Trash2, Power, Search, Activity, ArrowLeft, MoreVertical, Edit3, PlusCircle, MessageCircle, MessageSquare, Settings } from 'lucide-react';
import MetricsCard from '../components/MetricsCard';
import ManagePlansModal from '../components/ManagePlansModal';

interface MemberData {
  id: string;
  full_name: string;
  phone_number: string;
  joined_date: string;
  status: string;
  email?: string;
  gender?: string;
  photo?: string;
  suggestions?: string;
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

interface SubscriptionData {
  member_id: string;
  start_date: string;
  end_date: string;
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
  const [email, setEmail] = useState('');
  const [joiningDate, setJoiningDate] = useState(new Date().toISOString().split('T')[0]);
  const [durationMonths, setDurationMonths] = useState(1);
  const [gender, setGender] = useState('Male');
  const [photoBase64, setPhotoBase64] = useState('');

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

  // --- PHOTO PREVIEW STATE ---
  const [expandedPhotoMemberId, setExpandedPhotoMemberId] = useState<string | null>(null);

  // --- PLAN MANAGER STATE ---
  const [isPlansModalOpen, setIsPlansModalOpen] = useState(false);

  // --- TRACKING & ASSIGNMENT STATE ---
  const [selectedAthlete, setSelectedAthlete] = useState<MemberData | null>(null);
  const [athleteWorkouts, setAthleteWorkouts] = useState<Workout[]>([]);
  const [ownerSuggestion, setOwnerSuggestion] = useState("");
  const [saveSuggestionStatus, setSaveSuggestionStatus] = useState("");
  const [assignEx, setAssignEx] = useState("");
  const [assignSets, setAssignSets] = useState("");
  const [assignReps, setAssignReps] = useState("");
  const [assignWeight, setAssignWeight] = useState("");
  const [assignStatus, setAssignStatus] = useState("");

  // ==========================================
  // AUTOMATIC EXPIRY ALERTS MATRIX
  // ==========================================
  async function triggerAutomaticExpiryAlerts(membersList: MemberData[]) {
    if (typeof window === 'undefined') return;
    
    const todayStr = new Date().toISOString().split('T')[0];
    const sentReminders = JSON.parse(localStorage.getItem('gymnation_sent_reminders') || '{}');
    let hasSentAny = false;

    // Filter members expiring in 3 days or fewer (and not expired)
    const expiringSoon = membersList.filter(m => (m.days_left || 0) > 0 && (m.days_left || 0) <= 3);

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

  // ==========================================
  // INITIALIZE ENGINE
  // ==========================================
  async function initializeEngine(passedSession?: Session) {
    setIsSyncing(true);

    let session = passedSession;
    if (!session) {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession) {
        setAuthStatus('guest');
        setIsSyncing(false);
        return; 
      }
      session = currentSession;
    }

    // Check if the logged-in user is an athlete
    const userEmail = session.user.email || '';
    const userFullName = session.user.user_metadata?.full_name || '';

    // Parallelize the athlete check and the owner metrics/CRM data fetch to eliminate sequential network waterfall.
    const checkAthletePromise = (async () => {
      if (typeof window !== 'undefined' && sessionStorage.getItem('owner_session_active') === 'true') {
        return false;
      }
      try {
        const [emailRes, nameRes] = await Promise.all([
          userEmail ? supabase.from('members').select('id').eq('email', userEmail).maybeSingle() : Promise.resolve({ data: null }),
          userFullName ? supabase.from('members').select('id').eq('full_name', userFullName).maybeSingle() : Promise.resolve({ data: null })
        ]);
        return !!(emailRes?.data || nameRes?.data);
      } catch {
        return false;
      }
    })();

    const [
      isAthlete,
      memberDataRes,
      subDetailsRes,
      planDataRes
    ] = await Promise.all([
      checkAthletePromise,
      supabase.from('members').select('*').order('joined_date', { ascending: false }),
      supabase.from('subscriptions').select('*'),
      supabase.from('membership_plans').select('*').order('price', { ascending: true })
    ]);

    if (isAthlete) {
      router.push('/athlete/dashboard');
      return;
    }
    
    setAuthStatus('owner');

    const memberData = memberDataRes?.data;
    const subDetails = subDetailsRes?.data;
    const planData = planDataRes?.data;

    if (memberData) {
      const membersWithSubs = memberData.map((m: MemberData) => {
        const mSubs = subDetails ? subDetails.filter((s: SubscriptionData) => s.member_id === m.id) : [];
        let latestSub: SubscriptionData | null = null;
        if (mSubs.length > 0) {
          latestSub = mSubs.reduce((prev: SubscriptionData, current: SubscriptionData) => {
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

    if (planData) {
      setPlans(planData);
      if (planData.length > 0 && !selectedPlanId) {
        setSelectedPlanId(planData[0].id.toString());
        setDurationMonths(planData[0].duration_months);
      }
    }

    if (subDetails) {
      // Calculate revenue directly from the fetched subscriptions details to save another database query
      const revenue = subDetails.reduce((sum, sub) => sum + Number(sub.amount_paid || 0), 0);
      setTotalRevenue(revenue);
    }
    
    setIsSyncing(false);
  }

  useEffect(() => { 
    let isMounted = true;

    // 1. Initial check from storage & flush if fresh visit
    const checkSession = async () => {
      if (typeof window !== 'undefined' && !sessionStorage.getItem('owner_session_active')) {
        await supabase.auth.signOut();
        sessionStorage.setItem('owner_session_active', 'true');
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (isMounted) {
        if (session) {
          initializeEngine(session);
        } else {
          setAuthStatus('guest');
        }
      }
    };
    checkSession();

    // 2. Listen for auth changes (including when Magic Link tokens in URL are processed)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      if (session) {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          initializeEngine(session);
        }
      } else {
        if (event === 'SIGNED_OUT') {
          setAuthStatus('guest');
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- INACTIVITY AUTO-LOGOUT (10 MINS) & REFRESH LIMITER ---
  useEffect(() => {
    // Only apply if user is authenticated as owner
    if (authStatus !== 'owner') return;

    let timeoutId: NodeJS.Timeout;

    const handleAutoLogout = async () => {
      await supabase.auth.signOut();
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('owner_session_active');
        sessionStorage.removeItem('owner_refresh_count');
      }
      router.push('/login');
    };

    // 1. Inactivity Timer Reset
    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      // 10 minutes = 600,000 ms
      timeoutId = setTimeout(() => {
        handleAutoLogout();
      }, 10 * 60 * 1000);
    };

    // 2. Track Refreshes
    if (typeof window !== 'undefined') {
      const countStr = sessionStorage.getItem('owner_refresh_count') || '0';
      const nextCount = parseInt(countStr, 10) + 1;
      sessionStorage.setItem('owner_refresh_count', nextCount.toString());
      if (nextCount > 3) {
        sessionStorage.removeItem('owner_refresh_count');
        handleAutoLogout();
        alert('Logged out due to refreshing the page more than 3 times.');
        return;
      }
    }

    // Set up inactivity events
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach((event) => {
      window.addEventListener(event, resetTimer);
    });

    // Start initial timer
    resetTimer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach((event) => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [authStatus, router]);

  // Click outside listener to close active dropdown menu or expanded photo
  useEffect(() => {
    if (activeMenuMemberId === null && expandedPhotoMemberId === null) return;

    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // Close dropdown if clicked outside
      if (activeMenuMemberId !== null) {
        if (!target.closest('.options-menu-btn') && !target.closest('.options-menu-dropdown')) {
          setActiveMenuMemberId(null);
        }
      }

      // Close expanded photo if clicked outside
      if (expandedPhotoMemberId !== null) {
        if (!target.closest('.active-zoom')) {
          setExpandedPhotoMemberId(null);
        }
      }
    };

    document.addEventListener('click', handleOutsideClick);
    return () => {
      document.removeEventListener('click', handleOutsideClick);
    };
  }, [activeMenuMemberId, expandedPhotoMemberId]);

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
    } catch {
    }

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
      } catch {}
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
      } catch {}
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

    const insertData = {
      full_name: fullName,
      phone_number: phoneNumber,
      status: 'active'
    };

    let newMember: MemberData | null = null;
    let memberError: { message: string } | null = null;

    // Try full insert with email, gender, photo
    try {
      const { data, error } = await supabase
        .from('members')
        .insert([{ ...insertData, email: email || null, gender, photo: photoBase64 || null }])
        .select().single();
      newMember = data;
      memberError = error;
    } catch {}

    // Fallback 1: retry without photo
    if (memberError || !newMember) {
      try {
        const { data, error } = await supabase
          .from('members')
          .insert([{ ...insertData, email: email || null, gender }])
          .select().single();
        newMember = data;
        memberError = error;
      } catch {}
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
      } catch {}
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

    if (memberError || !newMember) {
      alert(`Error: ${memberError?.message || 'Failed to create member'}`);
      return setIsSubmitting(false);
    }

    // Cache gender and photo in localStorage
    if (photoBase64) {
      const localPhotos = JSON.parse(localStorage.getItem('gymnation_member_photos') || '{}');
      localPhotos[newMember.id] = photoBase64;
      localStorage.setItem('gymnation_member_photos', JSON.stringify(localPhotos));
    }
    const localGenders = JSON.parse(localStorage.getItem('gymnation_member_genders') || '{}');
    localGenders[newMember.id] = gender;
    localStorage.setItem('gymnation_member_genders', JSON.stringify(localGenders));

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
    setOwnerSuggestion(athlete.suggestions || "");
    fetchAthleteLogs(athlete.full_name);
  }

  async function handleSaveSuggestions() {
    if (!selectedAthlete) return;
    setSaveSuggestionStatus("Saving to Portal...");
    const { error } = await supabase
      .from('members')
      .update({ suggestions: ownerSuggestion })
      .eq('id', selectedAthlete.id);
    
    if (!error) {
      setSaveSuggestionStatus("Suggestions Saved! ✅");
      setSelectedAthlete(prev => prev ? { ...prev, suggestions: ownerSuggestion } : null);
      setMembers(prev => prev.map(m => m.id === selectedAthlete.id ? { ...m, suggestions: ownerSuggestion } : m));
      setTimeout(() => setSaveSuggestionStatus(""), 3000);
    } else {
      setSaveSuggestionStatus(`Error: ${error.message}`);
    }
  }

  async function fetchAthleteLogs(memberName: string) {
    const { data } = await supabase.from("workouts").select("*").eq("member_name", memberName).order("created_at", { ascending: false }).limit(10);
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
    
    let matchesStatus = true;
    if (statusFilter === 'active') {
      matchesStatus = m.status === 'active';
    } else if (statusFilter === 'expired') {
      matchesStatus = m.status === 'expired';
    } else if (statusFilter === 'expiring_soon') {
      matchesStatus = (m.days_left || 0) > 0 && (m.days_left || 0) <= 3;
    }
    
    return matchesSearch && matchesStatus;
  });

  const activeMembers = members.filter(m => m.status === 'active');
  const expiredMembers = members.filter(m => m.status === 'expired');
  const expiringSoonMembers = members.filter(m => (m.days_left || 0) > 0 && (m.days_left || 0) <= 3);


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
  // RENDER 2: GUEST HOMEPAGE / PORTAL SELECTION
  // ==========================================
  if (authStatus === 'guest') {
    return (
      <div className="min-h-screen bg-brand-dark text-gray-100 p-6 font-sans relative overflow-hidden flex flex-col justify-between">
        {/* ambient glows */}
        <div className="absolute top-[-10%] left-[-15%] w-[500px] h-[500px] bg-brand-orange/5 blur-[120px] rounded-full pointer-events-none"></div>
        <div className="absolute bottom-[-10%] right-[-15%] w-[500px] h-[500px] bg-brand-volt/5 blur-[120px] rounded-full pointer-events-none"></div>

        {/* Top Header / Brand */}
        <header className="max-w-6xl w-full mx-auto flex justify-between items-center py-4 border-b border-slate-900 relative z-10">
          <div className="flex items-center gap-2">
            <h1 
              onClick={() => window.location.reload()}
              className="text-3xl text-3d-gymnation cursor-pointer select-none"
              title="Refresh Page"
            >
              GYMNATION
            </h1>
          </div>
          <p className="text-xs text-gray-500 font-mono uppercase tracking-wider hidden sm:block">Matrix Portal v1.0</p>
        </header>

        {/* Main Content Hero */}
        <main className="max-w-4xl w-full mx-auto py-12 flex flex-col items-center justify-center gap-10 text-center relative z-10 flex-1">
          <div className="space-y-3">
            <h2 className="text-4xl md:text-5xl font-black tracking-tight uppercase bg-clip-text text-transparent bg-gradient-to-r from-gray-100 to-gray-400">
              Welcome to the Matrix
            </h2>
            <p className="text-gray-400 max-w-lg mx-auto text-sm md:text-base leading-relaxed">
              Access your personalized portal below to log your metrics, track progress, or manage gym operations.
            </p>
          </div>

          {/* Cards Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl mt-4">
            
            {/* Owner Portal card */}
            <div className="glass-panel glass-panel-hover p-8 rounded-2xl flex flex-col justify-between items-center text-center gap-6 border-slate-800/60">
              <div className="space-y-2.5">
                <div className="w-12 h-12 rounded-xl bg-brand-orange/10 border border-brand-orange/20 text-brand-orange flex items-center justify-center mx-auto text-xl font-bold">
                  💼
                </div>
                <h3 className="text-lg font-bold text-white tracking-wide uppercase">Owner Portal</h3>
                <p className="text-xs text-gray-450 leading-relaxed max-w-xs mx-auto">
                  Access the Live CRM Database engine, manage plans, members, and review daily revenue logs.
                </p>
              </div>
              <button 
                onClick={() => router.push('/login')} 
                className="w-full bg-brand-orange/10 hover:bg-brand-orange/20 border border-brand-orange/30 text-brand-orange font-bold py-3 rounded-xl text-xs uppercase tracking-widest transition-all"
              >
                Sign In As Owner
              </button>
            </div>

            {/* Athlete Portal card */}
            <div className="glass-panel glass-panel-hover p-8 rounded-2xl flex flex-col justify-between items-center text-center gap-6 border-slate-800/60">
              <div className="space-y-2.5">
                <div className="w-12 h-12 rounded-xl bg-brand-volt/10 border border-brand-volt/20 text-brand-volt flex items-center justify-center mx-auto text-xl font-bold">
                  ⚡
                </div>
                <h3 className="text-lg font-bold text-white tracking-wide uppercase">Athlete Portal</h3>
                <p className="text-xs text-gray-450 leading-relaxed max-w-xs mx-auto">
                  Track strength logs, update daily protein metrics, log body weight, and access digital check-in passes.
                </p>
              </div>
              <button 
                onClick={() => router.push('/athlete')} 
                className="w-full bg-brand-volt/10 hover:bg-brand-volt/20 border border-brand-volt/30 text-brand-volt font-bold py-3 rounded-xl text-xs uppercase tracking-widest transition-all"
              >
                Enter Athlete Portal
              </button>
            </div>

          </div>
        </main>

        {/* Footer */}
        <footer className="max-w-6xl w-full mx-auto text-center py-4 border-t border-slate-900 text-[10px] text-gray-500 font-mono relative z-10">
          © {new Date().getFullYear()} GYMNATION. All Rights Secured.
        </footer>
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
            <h1 
              onClick={() => window.location.reload()}
              className="text-3xl text-3d-gymnation cursor-pointer select-none"
              title="Refresh Page"
            >
              GYMNATION
            </h1>
            <p className="text-xs text-gray-400 font-mono uppercase tracking-widest mt-1">Live Database Matrix Engine</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setIsPlansModalOpen(true)} className="flex items-center gap-2 bg-slate-900 border border-slate-800 hover:border-brand-orange/40 px-4 py-2.5 rounded-xl text-xs uppercase tracking-widest font-sans text-white transition-all"><Settings className="w-4 h-4" /> Manage Plans</button>
          <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-brand-volt text-black font-extrabold px-4 py-2.5 rounded-xl text-xs uppercase tracking-widest font-sans transition-all glow-btn-volt"><UserPlus className="w-4 h-4" /> Add Member</button>
          <button onClick={async () => { await supabase.auth.signOut(); if (typeof window !== 'undefined') { sessionStorage.removeItem('owner_session_active'); sessionStorage.removeItem('owner_refresh_count'); } window.location.reload(); }} className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 px-4 py-2.5 rounded-xl text-xs uppercase tracking-widest font-mono font-bold text-rose-400 hover:bg-rose-500/20 transition-all">Log Out</button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-5 mb-8 relative z-10 select-none">
        <MetricsCard 
          title="Expired"
          value={expiredMembers.length}
          icon={<AlertCircle />}
          isActive={statusFilter === 'expired'}
          activeRingClass="ring-rose-500 bg-rose-500/5"
          iconContainerClass="bg-rose-500/10 text-rose-400"
          onClick={() => setStatusFilter('expired')}
          titleTooltip="Filter Expired Members"
        />
        <MetricsCard 
          title="Expiring Soon"
          value={expiringSoonMembers.length}
          icon={<Clock />}
          isActive={statusFilter === 'expiring_soon'}
          activeRingClass="ring-brand-orange bg-brand-orange/5"
          iconContainerClass="bg-brand-orange/10 text-brand-orange"
          onClick={() => setStatusFilter('expiring_soon')}
          titleTooltip="Filter Expiring Soon Members"
        />
        <MetricsCard 
          title="Active"
          value={activeMembers.length}
          icon={<CheckCircle />}
          isActive={statusFilter === 'active'}
          activeRingClass="ring-brand-volt bg-brand-volt/5"
          iconContainerClass="bg-brand-volt/10 text-brand-volt"
          onClick={() => setStatusFilter('active')}
          titleTooltip="Filter Active Members"
        />
        <MetricsCard 
          title="Total Revenue"
          value={`₹${totalRevenue.toLocaleString('en-IN')}`}
          icon={<DollarSign />}
          isActive={statusFilter === 'all'}
          activeRingClass="ring-brand-cyan bg-brand-cyan/5"
          iconContainerClass="bg-brand-cyan/10 text-brand-cyan"
          onClick={() => setStatusFilter('all')}
          titleTooltip="Filter All Members"
        />
      </div>



      <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-4 mb-6 relative z-10 font-sans">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input type="text" placeholder="Search athletes by name or phone..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-brand-dark/50 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-brand-volt/40 transition-all font-sans" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['all', 'active', 'expired', 'expiring_soon'].map(status => (
            <button 
              key={status} 
              onClick={() => setStatusFilter(status)} 
              className={`px-4 py-2 rounded-xl text-sm font-semibold capitalize transition-all border ${
                statusFilter === status 
                  ? status === 'expiring_soon'
                    ? 'bg-brand-orange/20 border-brand-orange/40 text-brand-orange'
                    : status === 'active'
                      ? 'bg-brand-volt/20 border-brand-volt/40 text-brand-volt'
                      : status === 'expired'
                        ? 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                        : 'bg-brand-cyan/20 border-brand-cyan/40 text-brand-cyan'
                  : 'bg-slate-900/40 border-slate-800/80 text-slate-400 hover:bg-slate-800'
              }`}
            >
              {status.replace('_', ' ')}
            </button>
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
                    {/* Avatar Container with In-Place Zoom */}
                    <div className="relative flex items-center justify-center w-12 h-12">
                      {/* Normal Avatar (visible when not zoomed, behaves as layout space placeholder) */}
                      <div 
                        className={`whatsapp-avatar ${resolvedGender === 'Female' ? 'female' : ''} ${resolvedPhoto ? 'cursor-pointer' : ''}`}
                        style={{ opacity: expandedPhotoMemberId === member.id ? 0 : 1 }}
                        onClick={() => {
                          if (resolvedPhoto) {
                            setExpandedPhotoMemberId(expandedPhotoMemberId === member.id ? null : member.id);
                          }
                        }}
                      >
                        {resolvedPhoto ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
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

                      {/* Zoomed Circular Popover Card (In same place, absolute positioned) */}
                      {expandedPhotoMemberId === member.id && resolvedPhoto && (
                        <div 
                          className={`whatsapp-avatar active-zoom absolute ${resolvedGender === 'Female' ? 'female' : ''} z-30 cursor-pointer shadow-2xl border-4 border-slate-800/90`}
                          style={{
                            width: '180px',
                            height: '180px',
                            top: '-66px', // Center vertically over the 48px avatar: (180 - 48)/2 = 66px
                            left: '-66px', // Center horizontally
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedPhotoMemberId(null);
                          }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={resolvedPhoto} alt={member.full_name} className="w-full h-full object-cover" />
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-slate-200">{member.full_name}</h4>
                        <span className="text-[8px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-gray-400 font-mono uppercase">{resolvedGender}</span>
                        {member.end_date && (
                          <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold font-mono uppercase ${
                            (member.days_left || 0) > 3 
                              ? 'bg-brand-volt/10 text-brand-volt border border-brand-volt/20' 
                              : (member.days_left || 0) > 0 
                                ? 'bg-brand-orange/10 text-brand-orange border border-brand-orange/20' 
                                : 'bg-rose-500/10 text-rose-450 border border-rose-500/20'
                          }`}>
                            {(member.days_left || 0) > 0 ? `${member.days_left} Days Left` : 'Expired'}
                          </span>
                        )}
                        {(member.days_left || 0) <= 3 && (member.days_left || 0) > 0 && (
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
                      className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors options-menu-btn"
                      title="Manage Athlete"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    
                    {activeMenuMemberId === member.id && (
                      <div className="absolute right-0 top-10 w-44 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-20 py-1.5 font-sans options-menu-dropdown">
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
                        {(member.days_left || 0) <= 3 && (member.days_left || 0) > 0 && (
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
                &quot;Hi {alertMember.full_name}, this is a reminder that your GYMNATION subscription is expiring in {alertMember.days_left} days on {alertMember.end_date}. Please renew soon to continue your training without interruptions! Thank you.&quot;
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
              <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 uppercase tracking-wide">{selectedAthlete.full_name}&apos;s Dossier</h2>
              <p className="text-slate-400 text-sm uppercase tracking-widest mt-1">Live Progress & Assignment Routing</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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
                        className="w-full bg-slate-900 border border-slate-750 rounded p-3 text-sm text-white focus:outline-none focus:border-blue-500 font-sans"
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
                      <input type="number" required step="0.5" value={assignWeight} onChange={(e) => setAssignWeight(e.target.value)} placeholder="Weight (kg)" className="w-1/3 bg-slate-900 border border-slate-700 rounded p-3 text-white focus:outline-none" />
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
                        className="flex-1 bg-brand-orange hover:bg-brand-orange/95 text-black font-extrabold py-3 rounded-lg transition-all uppercase tracking-widest text-[11px] tracking-wider"
                      >
                        Save Suggestions
                      </button>
                      
                      {/* WhatsApp Share */}
                      <button 
                        type="button"
                        onClick={() => {
                          const phone = selectedAthlete.phone_number.replace(/\D/g, "");
                          const text = encodeURIComponent(`Hello ${selectedAthlete.full_name},\n\nHere is your trainer suggestion from GYMNATION:\n\n${ownerSuggestion}`);
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

      {/* --- MANAGE PLANS MODAL --- */}
      <ManagePlansModal 
        isOpen={isPlansModalOpen}
        onClose={() => setIsPlansModalOpen(false)}
        plans={plans}
        onPlansUpdated={() => initializeEngine()}
      />

    </div>
  );
}