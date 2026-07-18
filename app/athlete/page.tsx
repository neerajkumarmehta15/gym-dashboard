'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useRouter } from 'next/navigation';
import { Mail, ArrowRight, Lock, KeyRound, UserPlus } from 'lucide-react';

export default function AthleteLogin() {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const router = useRouter();

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.push('/athlete/dashboard');
      }
    };
    checkSession();
  }, []);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    const { error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    setLoading(false);
    if (error) {
      setErrorMsg(error.message);
    } else {
      router.push('/athlete/dashboard');
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    // 1. Perform Supabase Sign Up
    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password,
    });

    if (error) {
      setLoading(false);
      setErrorMsg(error.message);
      return;
    }

    // 2. Automatically register the athlete in the 'members' table
    const { error: insertError } = await supabase
      .from('members')
      .insert([{
        full_name: fullName,
        email: email,
        status: 'active',
        joined_date: new Date().toISOString().split('T')[0]
      }]);

    setLoading(false);
    if (insertError) {
      setErrorMsg(`Account created, but database profile setup failed: ${insertError.message}`);
    } else {
      if (data?.session) {
        setSuccessMsg('Account registered successfully! Redirecting...');
        setTimeout(() => router.push('/athlete/dashboard'), 1500);
      } else {
        setSuccessMsg('Sign up successful! Please log in using your password.');
        setAuthMode('signin');
        setPassword('');
      }
    }
  }

  return (
    <div className="min-h-screen bg-brand-dark flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Glow ambient background elements */}
      <div className="absolute top-[-20%] left-[-20%] w-[500px] h-[500px] bg-brand-orange/10 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-20%] w-[500px] h-[500px] bg-brand-volt/10 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="w-full max-w-md glass-panel p-8 md:p-10 rounded-3xl relative z-10">
        <div className="flex justify-center mb-6">
          <div className="p-3 bg-brand-volt/10 text-brand-volt rounded-2xl glow-btn-volt border border-brand-volt/20">
            {authMode === 'signin' ? <Lock className="w-8 h-8" /> : <UserPlus className="w-8 h-8" />}
          </div>
        </div>

        <h2 className="text-3xl font-black text-white mb-2 text-center tracking-tight font-sans">
          ATHLETE PORTAL
        </h2>
        <p className="text-center text-gray-400 text-sm mb-6">
          {authMode === 'signin' 
            ? "Sign in directly using your registered account password." 
            : "Create your athlete password to register your account."}
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
        
        {authMode === 'signin' ? (
          <form onSubmit={handleSignIn} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 font-mono">Gym Email Address</label>
              <input 
                type="email" 
                placeholder="athlete@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-brand-dark/60 border border-gray-800 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:border-brand-volt/50 transition-colors font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 font-mono">Password</label>
              <input 
                type="password" 
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-brand-dark/60 border border-gray-800 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:border-brand-volt/50 transition-colors font-mono"
                required
              />
            </div>
            <button 
              disabled={loading} 
              className="w-full bg-brand-volt hover:bg-brand-volt/95 text-black font-extrabold py-3.5 rounded-xl transition-all duration-300 transform active:scale-95 flex items-center justify-center gap-2 tracking-widest text-sm font-sans glow-btn-volt"
            >
              {loading ? 'Authenticating...' : 'SIGN IN'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        ) : (
          <form onSubmit={handleSignUp} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 font-mono">Full Name</label>
              <input 
                type="text" 
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-brand-dark/60 border border-gray-800 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:border-brand-volt/50 transition-colors font-sans"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 font-mono">Gym Email Address</label>
              <input 
                type="email" 
                placeholder="athlete@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-brand-dark/60 border border-gray-800 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:border-brand-volt/50 transition-colors font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 font-mono">Choose Password</label>
              <input 
                type="password" 
                placeholder="Minimum 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-brand-dark/60 border border-gray-800 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:border-brand-volt/50 transition-colors font-mono"
                required
                minLength={6}
              />
            </div>
            <button 
              disabled={loading} 
              className="w-full bg-brand-volt hover:bg-brand-volt/95 text-black font-extrabold py-3.5 rounded-xl transition-all duration-300 transform active:scale-95 flex items-center justify-center gap-2 tracking-widest text-sm font-sans glow-btn-volt"
            >
              {loading ? 'Registering Account...' : 'CREATE ACCOUNT'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        <div className="text-center mt-6 pt-5 border-t border-slate-800/80">
          {authMode === 'signin' ? (
            <button 
              type="button"
              onClick={() => { setAuthMode('signup'); setErrorMsg(''); setSuccessMsg(''); }}
              className="text-xs text-brand-volt font-bold uppercase tracking-widest hover:underline font-mono"
            >
              Need an account? Register Here
            </button>
          ) : (
            <button 
              type="button"
              onClick={() => { setAuthMode('signin'); setErrorMsg(''); setSuccessMsg(''); }}
              className="text-xs text-brand-volt font-bold uppercase tracking-widest hover:underline font-mono"
            >
              Already have an account? Sign In
            </button>
          )}
        </div>
      </div>
    </div>
  );
}