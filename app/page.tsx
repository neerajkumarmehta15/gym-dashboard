"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { AlertCircle, Clock, CheckCircle, DollarSign, RefreshCw, UserPlus, X, Trash2, Power, Search, Activity, MoreVertical, Edit3, PlusCircle, MessageCircle, MessageSquare, Settings, Download } from 'lucide-react';
import dynamic from 'next/dynamic';
import MetricsCard from '../components/MetricsCard';

const ManagePlansModal = dynamic(() => import('../components/ManagePlansModal'), { ssr: false });
const AddMemberModal = dynamic(() => import('../components/AddMemberModal'), { ssr: false });
const AthleteDossierModal = dynamic(() => import('../components/AthleteDossierModal'), { ssr: false });
const TechkritiGalaxyCanvas = dynamic(() => import('../components/TechkritiGalaxyCanvas'), { ssr: false });

interface MemberData {
  id: string;
  full_name: string;
  phone_number: string;
  joined_date: string;
  status: string;
  email?: string;
  gender?: string;
  photo?: string;
  pin?: string | null;
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

const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return 'N/A';
  try {
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      return `${match[3]}/${match[2]}/${match[1]}`;
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  } catch {
    return dateStr;
  }
};

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
  const [isSubmitting, setIsSubmitting] = useState(false);

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
  const [isBatchWhatsAppOpen, setIsBatchWhatsAppOpen] = useState(false);
  const [sentWhatsAppIds, setSentWhatsAppIds] = useState<string[]>([]);
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
        const message = `Hi ${member.full_name}, this is a reminder that your GYMNATION subscription is expiring in ${member.days_left} days on ${formatDate(member.end_date)}. Please renew soon to continue your training without interruptions! Thank you.`;
        
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
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('owner_session_active', 'true');
    }

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
      setTimeout(() => triggerAutomaticExpiryAlerts(membersWithSubs), 1200);
      if (typeof window !== 'undefined') {
        localStorage.setItem('gymnation_owner_members', JSON.stringify(membersWithSubs));
      }
    }

    if (planData) {
      setPlans(planData);
      if (typeof window !== 'undefined') {
        localStorage.setItem('gymnation_owner_plans', JSON.stringify(planData));
      }
    }

    if (subDetails) {
      const revenue = subDetails.reduce((sum, sub) => sum + Number(sub.amount_paid || 0), 0);
      setTotalRevenue(revenue);
      if (typeof window !== 'undefined') {
        localStorage.setItem('gymnation_owner_revenue', String(revenue));
      }
    }
    
    setIsSyncing(false);
  }

  useEffect(() => { 
    let isMounted = true;

    // Load cached data for instant 0ms loading UI
    if (typeof window !== 'undefined') {
      const cachedM = localStorage.getItem('gymnation_owner_members');
      const cachedP = localStorage.getItem('gymnation_owner_plans');
      const cachedR = localStorage.getItem('gymnation_owner_revenue');
      const isOwnerSession = sessionStorage.getItem('owner_session_active') === 'true';

      if (cachedM && isMounted) setMembers(JSON.parse(cachedM));
      if (cachedP && isMounted) setPlans(JSON.parse(cachedP));
      if (cachedR && isMounted) setTotalRevenue(Number(cachedR));
      
      if (isOwnerSession && cachedM && isMounted) {
        setAuthStatus('owner');
        setIsSyncing(false);
      }
    }

    // 1. Check session without blocking UI thread
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (isMounted) {
        if (session) {
          initializeEngine(session);
        } else {
          if (typeof window !== 'undefined') {
            sessionStorage.removeItem('owner_session_active');
          }
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

  // --- REAL-TIME DATA SUBSCRIPTIONS FOR OWNER DASHBOARD ---
  useEffect(() => {
    if (authStatus !== 'owner') return;

    const ownerChannel = supabase
      .channel('owner-realtime-global')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'members' },
        () => { initializeEngine(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'subscriptions' },
        () => { initializeEngine(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'membership_plans' },
        () => { initializeEngine(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'workouts' },
        () => { initializeEngine(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'recovery_metrics' },
        () => { initializeEngine(); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ownerChannel);
    };
  }, [authStatus]);

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
    // Optimistic UI update
    setMembers(prev => prev.filter(m => m.id !== id));
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

  function exportMembersToCSV() {
    if (members.length === 0) {
      alert('No member data available to export.');
      return;
    }

    const headers = ['Full Name', 'Phone Number', 'Email', 'Gender', 'Status', 'Joined Date', 'Expiry Date', 'Days Left'];
    
    const csvRows = members.map(m => {
      let resolvedGender = m.gender || 'Male';
      if (typeof window !== 'undefined' && !m.gender) {
        const localGenders = JSON.parse(localStorage.getItem('gymnation_member_genders') || '{}');
        resolvedGender = localGenders[m.id] || 'Male';
      }
      resolvedGender = resolvedGender.split('|')[0] || 'Male';

      const cleanPhone = `"${m.phone_number.replace(/"/g, '""')}"`;
      const cleanName = `"${m.full_name.replace(/"/g, '""')}"`;
      const cleanEmail = `"${(m.email || 'N/A').replace(/"/g, '""')}"`;
      const joined = formatDate(m.joined_date);
      const expiry = m.end_date ? formatDate(m.end_date) : 'N/A';

      return [
        cleanName,
        cleanPhone,
        cleanEmail,
        resolvedGender,
        m.status.toUpperCase(),
        joined,
        expiry,
        m.days_left || 0
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...csvRows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `GYMNATION_Members_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function sendWhatsAppReminder(member: MemberData) {
    const message = encodeURIComponent(`Hi ${member.full_name}, 👋 this is a friendly reminder from GYMNATION. Your membership ${(member.days_left || 0) > 0 ? `expires in ${member.days_left} days on ${formatDate(member.end_date)}` : 'has expired'}. Please renew your plan today to keep your fitness goals on track! Thank you.`);
    const phone = member.phone_number.replace(/\D/g, '');
    const cleanPhone = phone.length === 10 ? `91${phone}` : phone;
    window.open(`https://wa.me/${cleanPhone}?text=${message}`, '_blank');
    setSentWhatsAppIds(prev => Array.from(new Set([...prev, member.id])));
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
      alert(`Subscription logged successfully starting from ${formatDate(startDateStr)} to ${formatDate(endDate.toISOString().split('T')[0])}!`);
    }

    setIsSubmitting(false);
    setIsSubModalOpen(false);
    initializeEngine();
  }

  async function openAthleteDossier(athlete: MemberData) {
    setSelectedAthlete(athlete);
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
      <div className="min-h-screen text-gray-100 p-6 font-sans relative overflow-hidden flex flex-col justify-between">
        {/* 3D Techkriti Rotating Star Particle Galaxy Background */}
        <TechkritiGalaxyCanvas />

        {/* ambient glows */}
        <div className="absolute top-[-10%] left-[-15%] w-[500px] h-[500px] bg-brand-orange/10 blur-[120px] rounded-full pointer-events-none z-0"></div>
        <div className="absolute bottom-[-10%] right-[-15%] w-[500px] h-[500px] bg-brand-volt/10 blur-[120px] rounded-full pointer-events-none z-0"></div>

        {/* Top Header / Brand */}
        <header className="max-w-6xl w-full mx-auto flex justify-center items-center py-4 border-b border-slate-900 relative z-10">
          <h1 
            onClick={() => window.location.reload()}
            className="text-3xl text-3d-gymnation cursor-pointer select-none text-center"
            title="Refresh Page"
          >
            GYMNATION
          </h1>
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

      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 border-b border-slate-900 pb-5 relative z-10">
        <div className="flex items-center gap-3.5">
          <div>
            <h1 
              onClick={() => window.location.reload()}
              className="text-2xl sm:text-3xl text-3d-gymnation cursor-pointer select-none"
              title="Refresh Page"
            >
              GYMNATION
            </h1>
            <p className="text-xs text-gray-400 font-mono uppercase tracking-widest mt-0.5">Live Database Matrix Engine</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-start sm:justify-end">
          <button 
            onClick={exportMembersToCSV}
            className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 hover:border-brand-cyan/40 px-3.5 py-2 rounded-xl text-xs uppercase tracking-wider font-mono text-brand-cyan transition-all cursor-pointer"
            title="Export Members Database to Excel/CSV"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
          {(expiringSoonMembers.length > 0 || expiredMembers.length > 0) && (
            <button 
              onClick={() => setIsBatchWhatsAppOpen(true)} 
              className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 px-3.5 py-2 rounded-xl text-xs uppercase tracking-wider font-sans font-bold transition-all cursor-pointer"
            >
              <MessageCircle className="w-3.5 h-3.5 text-emerald-400" /> Auto WhatsApp ({expiringSoonMembers.length + expiredMembers.length})
            </button>
          )}
          <button onClick={() => setIsPlansModalOpen(true)} className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 hover:border-brand-orange/40 px-3.5 py-2 rounded-xl text-xs uppercase tracking-wider font-sans text-white transition-all"><Settings className="w-3.5 h-3.5" /> Plans</button>
          <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-1.5 bg-brand-volt text-black font-extrabold px-3.5 py-2 rounded-xl text-xs uppercase tracking-wider font-sans transition-all glow-btn-volt"><UserPlus className="w-3.5 h-3.5" /> Add Member</button>
          <button onClick={async () => { await supabase.auth.signOut(); if (typeof window !== 'undefined') { sessionStorage.removeItem('owner_session_active'); sessionStorage.removeItem('owner_refresh_count'); window.location.href = '/'; } }} className="flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-xl text-xs uppercase tracking-wider font-mono font-bold text-rose-400 hover:bg-rose-500/20 transition-all">Log Out</button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 md:gap-5 mb-8 relative z-10 select-none">
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
              resolvedGender = resolvedGender.split('|')[0] || 'Male';
              
              // Resolve photo
              let resolvedPhoto = member.photo || null;
              if (typeof window !== 'undefined' && !resolvedPhoto) {
                const localPhotos = JSON.parse(localStorage.getItem('gymnation_member_photos') || '{}');
                resolvedPhoto = localPhotos[member.id] || null;
              }

              return (
                <div key={member.id} className="bg-brand-dark/40 border border-gray-900 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 group hover:border-gray-800/90 transition-colors">
                  <div className="flex items-center gap-3.5">
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
                          Active: <span className="text-gray-300 font-bold">{formatDate(member.start_date)}</span> ➔ Expiry: <span className="text-gray-300 font-bold">{formatDate(member.end_date)}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end border-t border-slate-900/60 sm:border-t-0 pt-2 sm:pt-0">
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
      <AddMemberModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        plans={plans}
        onMemberAdded={() => initializeEngine()}
      />

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
                &quot;Hi {alertMember.full_name}, this is a reminder that your GYMNATION subscription is expiring in {alertMember.days_left} days on {formatDate(alertMember.end_date)}. Please renew soon to continue your training without interruptions! Thank you.&quot;
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  const message = encodeURIComponent(`Hi ${alertMember.full_name}, this is a reminder that your GYMNATION subscription is expiring in ${alertMember.days_left} days on ${formatDate(alertMember.end_date)}. Please renew soon to continue your training without interruptions! Thank you.`);
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
                  const message = encodeURIComponent(`Hi ${alertMember.full_name}, this is a reminder that your GYMNATION subscription is expiring in ${alertMember.days_left} days on ${formatDate(alertMember.end_date)}. Please renew soon to continue your training without interruptions! Thank you.`);
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

      {/* --- AUTOMATED BATCH WHATSAPP MODAL --- */}
      {isBatchWhatsAppOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-emerald-500/30 w-full max-w-lg rounded-2xl p-6 shadow-2xl relative font-sans max-h-[90vh] flex flex-col">
            <button 
              onClick={() => setIsBatchWhatsAppOpen(false)} 
              className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <MessageCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white uppercase tracking-tight">Auto WhatsApp Reminders</h3>
                <p className="text-xs text-gray-400">Batch Dispatcher for Expiring & Expired Athletes</p>
              </div>
            </div>

            <p className="text-xs text-gray-300 my-3 bg-slate-950 p-3 rounded-xl border border-slate-850">
              ⚡ Click <strong>&quot;Send Next WhatsApp&quot;</strong> to automatically open WhatsApp Web/Mobile with pre-filled renewal reminders for each member!
            </p>

            {/* List of Target Members */}
            <div className="flex-1 overflow-y-auto space-y-2.5 my-2 pr-1 max-h-[350px]">
              {[...expiringSoonMembers, ...expiredMembers].map((member) => {
                const isSent = sentWhatsAppIds.includes(member.id);
                return (
                  <div key={member.id} className="bg-slate-950/80 border border-slate-800 p-3 rounded-xl flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white">{member.full_name}</span>
                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                          (member.days_left || 0) > 0 ? 'bg-brand-orange/20 text-brand-orange' : 'bg-rose-500/20 text-rose-400'
                        }`}>
                          {(member.days_left || 0) > 0 ? `${member.days_left} Days Left` : 'Expired'}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400 font-mono mt-0.5">{member.phone_number}</p>
                    </div>

                    <button
                      onClick={() => sendWhatsAppReminder(member)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                        isSent 
                          ? 'bg-slate-800 text-emerald-400 border border-emerald-500/30' 
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg'
                      }`}
                    >
                      <MessageCircle className="w-3.5 h-3.5" /> {isSent ? 'Sent ✅' : 'Send WhatsApp'}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Master Action Button */}
            <div className="pt-3 border-t border-slate-800 flex justify-between items-center">
              <span className="text-xs text-gray-400 font-mono">
                {sentWhatsAppIds.length} of {expiringSoonMembers.length + expiredMembers.length} sent
              </span>
              
              <button
                onClick={() => {
                  const remaining = [...expiringSoonMembers, ...expiredMembers].filter(m => !sentWhatsAppIds.includes(m.id));
                  if (remaining.length > 0) {
                    sendWhatsAppReminder(remaining[0]);
                  } else {
                    alert('All WhatsApp reminders in this queue have been dispatched!');
                  }
                }}
                className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-extrabold px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-xl"
              >
                <MessageCircle className="w-4 h-4" /> Send Next WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- ATHLETE DOSSIER MODAL --- */}
      <AthleteDossierModal 
        athlete={selectedAthlete}
        onClose={() => setSelectedAthlete(null)}
      />

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