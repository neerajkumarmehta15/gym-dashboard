'use client';

import { useState } from 'react';
import { supabase } from '../supabase';
import { useRouter } from 'next/navigation';
import { Mail, ArrowRight, ShieldCheck } from 'lucide-react';

export default function AthleteLogin() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'email' | 'check'>('email');
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const redirectUrl = typeof window !== 'undefined' 
      ? `${window.location.origin}/athlete/dashboard` 
      : 'http://localhost:3000/athlete/dashboard';

    const { error } = await supabase.auth.signInWithOtp({
      email: email,
      options: { emailRedirectTo: redirectUrl }
    });

    setLoading(false);
    if (error) alert(error.message);
    else setStep('check');
  }

  return (
    <div className="min-h-screen bg-brand-dark flex items-center justify-center p-4 relative overflow-hidden">
      {/* Glow ambient background elements */}
      <div className="absolute top-[-20%] left-[-20%] w-[500px] h-[500px] bg-brand-orange/10 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-20%] w-[500px] h-[500px] bg-brand-volt/10 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="w-full max-w-md glass-panel p-8 md:p-10 rounded-3xl relative z-10">
        <div className="flex justify-center mb-6">
          <div className="p-3 bg-brand-volt/10 text-brand-volt rounded-2xl glow-btn-volt border border-brand-volt/20">
            <Mail className="w-8 h-8" />
          </div>
        </div>

        <h2 className="text-3xl font-black text-white mb-2 text-center tracking-tight font-sans">
          ATHLETE PORTAL
        </h2>
        <p className="text-center text-gray-400 text-sm mb-8">
          Verify your session. We'll send a secure login link to your inbox.
        </p>
        
        {step === 'email' ? (
          <form onSubmit={handleLogin} className="space-y-5">
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
              className="w-full bg-brand-volt hover:bg-brand-volt/95 text-black font-extrabold py-3.5 rounded-xl transition-all duration-300 transform active:scale-95 flex items-center justify-center gap-2 tracking-widest text-sm font-sans"
            >
              {loading ? 'Routing Magic Link...' : 'SEND MAGIC LINK'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        ) : (
          <div className="text-center space-y-4 py-4">
            <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-2">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-white text-lg">Check your email</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              We sent a secure, one-click authorization link to <span className="text-brand-volt font-mono">{email}</span>. Click it to open your dashboard.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}