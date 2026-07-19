'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useRouter } from 'next/navigation';
import { ArrowRight, Lock, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function AthleteLogin() {
  const [credential, setCredential] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const router = useRouter();

  useEffect(() => {
    const clearSession = async () => {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('athlete_logged_id');
      }
      await supabase.auth.signOut();
    };
    clearSession();
  }, []);

  async function handleDirectLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    const searchVal = credential.trim();
    if (!searchVal) {
      setErrorMsg('Please enter your email or mobile number.');
      setLoading(false);
      return;
    }

    try {
      // 1. Try matching by email
      const { data: emailMatch, error: emailError } = await supabase
        .from('members')
        .select('*')
        .eq('email', searchVal)
        .maybeSingle();

      if (emailError) {
        throw new Error(emailError.message);
      }

      let matchedMember = emailMatch;

      // 2. Try matching by phone_number if no email match
      if (!matchedMember) {
        const { data: phoneMatch, error: phoneError } = await supabase
          .from('members')
          .select('*')
          .eq('phone_number', searchVal)
          .maybeSingle();
        
        if (phoneError) {
          throw new Error(phoneError.message);
        }
        matchedMember = phoneMatch;
      }

      if (matchedMember) {
        // Save the direct athlete ID in localStorage
        localStorage.setItem('athlete_logged_id', matchedMember.id);
        setSuccessMsg(`Welcome back, ${matchedMember.full_name}! Accessing portal...`);
        setTimeout(() => {
          router.push('/athlete/dashboard');
        }, 1200);
      } else {
        setErrorMsg('No athlete record found. Please verify with your gym owner.');
        setLoading(false);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Verification failed. Please try again.';
      setErrorMsg(errorMessage);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-brand-dark flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Back to Owner Portal link */}
      <Link href="/login" className="absolute top-6 left-6 flex items-center gap-2 text-xs uppercase tracking-widest font-mono font-bold text-gray-500 hover:text-brand-volt transition-all z-20">
        <ArrowLeft className="w-4 h-4" /> Owner Portal
      </Link>

      {/* Glow ambient background elements */}
      <div className="absolute top-[-20%] left-[-20%] w-[500px] h-[500px] bg-brand-orange/10 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-20%] w-[500px] h-[500px] bg-brand-volt/10 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="w-full max-w-md glass-panel p-8 md:p-10 rounded-3xl relative z-10">
        <div className="flex justify-center mb-6">
          <div className="p-3 bg-brand-volt/10 text-brand-volt rounded-2xl glow-btn-volt border border-brand-volt/20">
            <Lock className="w-8 h-8" />
          </div>
        </div>

        <h2 className="text-3xl text-3d-gymnation text-center mb-2 tracking-tight">
          GYMNATION
        </h2>
        <p className="text-center text-slate-400 text-xs font-mono uppercase tracking-widest mb-6">
          Athlete Portal
        </p>
        <p className="text-center text-gray-400 text-sm mb-6">
          Enter the email address or mobile number registered with your gym membership. No password required.
        </p>

        {errorMsg && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs p-3.5 rounded-xl mb-5 text-center font-mono">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="bg-brand-volt/10 border border-brand-volt/20 text-brand-volt text-xs p-3.5 rounded-xl mb-5 text-center font-mono">
            {successMsg}
          </div>
        )}
        
        <form onSubmit={handleDirectLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 font-mono">Email or Mobile Number</label>
            <input 
              type="text" 
              placeholder="e.g. athlete@gmail.com or 9876543210"
              value={credential}
              onChange={(e) => setCredential(e.target.value)}
              className="w-full bg-brand-dark/60 border border-gray-800 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:border-brand-volt/50 transition-colors font-mono"
              required
            />
          </div>
          <button 
            disabled={loading} 
            className="w-full bg-brand-volt hover:bg-brand-volt/95 text-black font-extrabold py-3.5 rounded-xl transition-all duration-300 transform active:scale-95 flex items-center justify-center gap-2 tracking-widest text-sm font-sans glow-btn-volt"
          >
            {loading ? 'Accessing Portal...' : 'ENTER PORTAL'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}