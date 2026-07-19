import React, { useState } from 'react';
import { X, Trash2, Plus, DollarSign, Clock, Sparkles } from 'lucide-react';
import { supabase } from '../app/supabase';

interface PlanData {
  id: number;
  plan_name: string;
  duration_months: number;
  price: number;
}

interface ManagePlansModalProps {
  isOpen: boolean;
  onClose: () => void;
  plans: PlanData[];
  onPlansUpdated: () => void;
}

export default function ManagePlansModal({
  isOpen,
  onClose,
  plans,
  onPlansUpdated
}: ManagePlansModalProps) {
  const [name, setName] = useState('');
  const [duration, setDuration] = useState('');
  const [price, setPrice] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  async function handleAddPlan(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !duration || !price) return;
    setIsLoading(true);

    const { error } = await supabase.from('membership_plans').insert([{
      plan_name: name,
      duration_months: Number(duration),
      price: Number(price)
    }]);

    setIsLoading(false);
    if (error) {
      alert(`Error adding plan: ${error.message}`);
    } else {
      setName('');
      setDuration('');
      setPrice('');
      onPlansUpdated();
    }
  }

  async function handleDeletePlan(id: number, planName: string) {
    if (!confirm(`Are you sure you want to permanently delete the plan "${planName}"?`)) return;

    const { error } = await supabase.from('membership_plans').delete().eq('id', id);
    if (error) {
      alert(`Error: This plan cannot be deleted because it is linked to active subscriptions.`);
    } else {
      onPlansUpdated();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl p-6 shadow-2xl relative flex flex-col max-h-[90vh]">
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-xl font-bold text-slate-100 mb-5 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-brand-orange" /> Manage Membership Plans
        </h3>

        {/* Existing Plans list */}
        <div className="flex-1 overflow-y-auto mb-6 pr-1 space-y-3">
          <label className="block text-xs text-slate-400 font-mono uppercase tracking-widest font-bold mb-2">Existing Plans ({plans.length})</label>
          {plans.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-4 text-center">No plans created yet. Add one below!</p>
          ) : (
            plans.map((plan) => (
              <div 
                key={plan.id} 
                className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-xl flex justify-between items-center hover:border-slate-700/60 transition-colors"
              >
                <div>
                  <h4 className="font-extrabold text-white text-sm">{plan.plan_name}</h4>
                  <span className="text-gray-400 text-xs font-mono mt-0.5 block flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 inline text-slate-500" /> {plan.duration_months} Month{plan.duration_months > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-brand-orange font-mono font-bold text-sm bg-brand-orange/5 px-2.5 py-1 rounded-lg border border-brand-orange/15">
                    ₹{plan.price.toLocaleString('en-IN')}
                  </span>
                  <button 
                    onClick={() => handleDeletePlan(plan.id, plan.plan_name)} 
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-900 transition-all"
                    title="Delete Plan"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Add Plan Form */}
        <form onSubmit={handleAddPlan} className="border-t border-slate-800/80 pt-5 space-y-4 font-sans">
          <label className="block text-xs text-slate-400 font-mono uppercase tracking-widest font-bold">Create New Plan</label>
          
          <div className="space-y-3">
            <div>
              <input 
                type="text" 
                placeholder="Plan Name (e.g. 3 Months Gold)" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-brand-orange/40 font-sans"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <input 
                  type="number" 
                  min="1"
                  max="120"
                  placeholder="Duration (Months)" 
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-brand-orange/40 font-sans"
                />
              </div>
              <div className="relative">
                <input 
                  type="number" 
                  min="0"
                  placeholder="Price (₹)" 
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-brand-orange/40 font-sans"
                />
              </div>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-brand-orange hover:bg-brand-orange/95 text-white font-extrabold py-3 rounded-xl text-xs uppercase tracking-widest transition-all duration-300 transform active:scale-95 flex items-center justify-center gap-2 glow-btn-orange mt-1 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> {isLoading ? 'Adding Plan...' : 'Add Plan'}
          </button>
        </form>
      </div>
    </div>
  );
}
