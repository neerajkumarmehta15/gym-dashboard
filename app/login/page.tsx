'use client';

import { useState } from 'react';
import { supabase } from '../supabase';
import { useRouter } from 'next/navigation';
import { ShieldAlert, ArrowRight } from 'lucide-react';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setIsAuthenticating(true);
    setError('');

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setIsAuthenticating(false);
    } else {
      router.push('/'); // Teleport to the dashboard on success
    }
  }

  return (
    <div className="min-h-screen bg-brand-dark flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Glow ambient background elements */}
      <div className="absolute top-[-20%] left-[-20%] w-[500px] h-[500px] bg-brand-orange/10 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-20%] w-[500px] h-[500px] bg-brand-volt/10 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="w-full max-w-md glass-panel p-8 md:p-10 rounded-3xl relative z-10">
        <div className="flex justify-center mb-6">
          <div className="p-3 bg-brand-orange/10 text-brand-orange rounded-xl border border-brand-orange/20">
            <ShieldAlert className="w-8 h-8" />
          </div>
        </div>
        
        <h2 className="text-3xl font-black text-center text-slate-100 mb-2 tracking-tight font-sans">
          IRON KEEP HQ
        </h2>
        <p className="text-center text-gray-400 text-sm mb-8 font-sans">
          Restricted Access. Authenticate to enter the command center.
        </p>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs p-3.5 rounded-xl mb-6 text-center font-mono">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 font-mono">Admin Email</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-brand-dark/60 border border-gray-800 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-brand-orange/50 transition-colors font-mono"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 font-mono">Passcode</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-brand-dark/60 border border-gray-800 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-brand-orange/50 transition-colors font-mono"
              required
            />
          </div>
          
          <div className="pt-4">
            <button 
              type="submit"
              disabled={isAuthenticating}
              className="w-full bg-brand-orange hover:bg-brand-orange/95 text-white font-extrabold py-3.5 rounded-xl text-sm transition-all flex items-center justify-center gap-2 tracking-widest font-sans disabled:opacity-50"
            >
              {isAuthenticating ? 'VERIFYING CREDENTIALS...' : 'INITIALIZE SESSION'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}