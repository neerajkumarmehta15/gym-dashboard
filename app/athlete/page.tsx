'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useRouter } from 'next/navigation';
import { Mail, ArrowRight, ShieldCheck, Lock, Sparkles, KeyRound } from 'lucide-react';

export default function AthleteLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpToken, setOtpToken] = useState('');
  const [authMode, setAuthMode] = useState<'otp' | 'password'>('otp');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'email' | 'otp-verify'>('email');
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

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    const { error } = await supabase.auth.signInWithOtp({
      email: email,
    });

    setLoading(false);
    if (error) {
      setErrorMsg(error.message);
    } else {
      setStep('otp-verify');
      setSuccessMsg('A 6-digit verification code has been sent to your email.');
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    // Try type 'email' first
    const { error } = await supabase.auth.verifyOtp({
      email: email,
      token: otpToken,
      type: 'email'
    });

    if (error) {
      // Fallback to type 'magiclink'
      const { error: retryError } = await supabase.auth.verifyOtp({
        email: email,
        token: otpToken,
        type: 'magiclink'
      });

      setLoading(false);
      if (retryError) {
        setErrorMsg('Invalid or expired code. Please try again.');
      } else {
        router.push('/athlete/dashboard');
      }
    } else {
      setLoading(false);
      router.push('/athlete/dashboard');
    }
  }

  async function handlePasswordLogin(e: React.FormEvent) {
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

  return (
    <div className="min-h-screen bg-brand-dark flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Glow ambient background elements */}
      <div className="absolute top-[-20%] left-[-20%] w-[500px] h-[500px] bg-brand-orange/10 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-20%] w-[500px] h-[500px] bg-brand-volt/10 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="w-full max-w-md glass-panel p-8 md:p-10 rounded-3xl relative z-10">
        <div className="flex justify-center mb-6">
          <div className="p-3 bg-brand-volt/10 text-brand-volt rounded-2xl glow-btn-volt border border-brand-volt/20">
            {authMode === 'otp' ? <KeyRound className="w-8 h-8" /> : <Lock className="w-8 h-8" />}
          </div>
        </div>

        <h2 className="text-3xl font-black text-white mb-2 text-center tracking-tight font-sans">
          ATHLETE PORTAL
        </h2>
        <p className="text-center text-gray-400 text-sm mb-6">
          {authMode === 'otp' 
            ? "Verify your account using a one-time verification code." 
            : "Sign in directly using your registered account password."}
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
        
        {authMode === 'otp' ? (
          <div>
            {step === 'email' ? (
              <form onSubmit={handleSendOtp} className="space-y-5">
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
                <button 
                  disabled={loading} 
                  className="w-full bg-brand-volt hover:bg-brand-volt/95 text-black font-extrabold py-3.5 rounded-xl transition-all duration-300 transform active:scale-95 flex items-center justify-center gap-2 tracking-widest text-sm font-sans glow-btn-volt"
                >
                  {loading ? 'Sending Code...' : 'SEND OTP CODE'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 font-mono">Enter 6-Digit OTP</label>
                  <input 
                    type="text" 
                    placeholder="123456"
                    maxLength={6}
                    value={otpToken}
                    onChange={(e) => setOtpToken(e.target.value)}
                    className="w-full bg-brand-dark/60 border border-gray-800 rounded-xl px-4 py-3.5 text-white text-center tracking-[0.5em] text-lg font-bold focus:outline-none focus:border-brand-volt/50 transition-colors font-mono"
                    required
                  />
                </div>
                <button 
                  disabled={loading} 
                  className="w-full bg-brand-volt hover:bg-brand-volt/95 text-black font-extrabold py-3.5 rounded-xl transition-all duration-300 transform active:scale-95 flex items-center justify-center gap-2 tracking-widest text-sm font-sans glow-btn-volt"
                >
                  {loading ? 'Verifying Code...' : 'VERIFY & ENTER PORTAL'}
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button 
                  type="button" 
                  onClick={() => setStep('email')} 
                  className="w-full text-center text-xs text-gray-500 hover:text-gray-400 mt-2 font-mono uppercase tracking-wider block"
                >
                  Back to Email
                </button>
              </form>
            )}
          </div>
        ) : (
          <form onSubmit={handlePasswordLogin} className="space-y-5">
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
        )}

        <div className="text-center mt-6 pt-5 border-t border-slate-800/80">
          {authMode === 'otp' ? (
            <button 
              type="button"
              onClick={() => { setAuthMode('password'); setErrorMsg(''); setSuccessMsg(''); }}
              className="text-xs text-brand-volt font-bold uppercase tracking-widest hover:underline font-mono"
            >
              Log in with Password instead
            </button>
          ) : (
            <button 
              type="button"
              onClick={() => { setAuthMode('otp'); setErrorMsg(''); setSuccessMsg(''); setStep('email'); }}
              className="text-xs text-brand-volt font-bold uppercase tracking-widest hover:underline font-mono"
            >
              Log in with OTP Verification Code
            </button>
          )}
        </div>
      </div>
    </div>
  );
}