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

    const { error } = await supabase.auth.signInWithOtp({
      email: email,
      options: { emailRedirectTo: 'http://localhost:3000/athlete/dashboard' }
    });

    setLoading(false);
    if (error) alert(error.message);
    else setStep('check');
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-slate-900 p-8 rounded-3xl border border-slate-800">
        <h2 className="text-2xl font-black text-white mb-6 text-center">ATHLETE PORTAL</h2>
        
        {step === 'email' ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <input 
              type="email" 
              placeholder="Enter your gym email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white"
              required
            />
            <button disabled={loading} className="w-full bg-emerald-500 text-slate-950 font-bold py-3 rounded-xl">
              {loading ? 'Sending...' : 'Send Magic Link'}
            </button>
          </form>
        ) : (
          <div className="text-center text-slate-400">
            <p>Check your email for the login link!</p>
          </div>
        )}
      </div>
    </div>
  );
}