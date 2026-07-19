'use client';

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../app/supabase';

interface Plan {
  id: number;
  plan_name: string;
  price: number;
  duration_months: number;
}

interface MemberData {
  id: string;
  full_name: string;
  phone_number: string;
  joined_date?: string;
  status: string;
  email?: string;
  gender?: string;
  photo?: string;
  start_date?: string;
  end_date?: string;
  days_left?: number;
}

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  plans: Plan[];
  onMemberAdded: () => void;
}

export default function AddMemberModal({ isOpen, onClose, plans, onMemberAdded }: AddMemberModalProps) {
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [joiningDate, setJoiningDate] = useState('');
  const [durationMonths, setDurationMonths] = useState(1);
  const [gender, setGender] = useState('Male');
  const [photoBase64, setPhotoBase64] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Set defaults on open
  useEffect(() => {
    if (isOpen) {
      setJoiningDate(new Date().toISOString().split('T')[0]);
      if (plans.length > 0) {
        setSelectedPlanId(String(plans[0].id));
        setDurationMonths(plans[0].duration_months);
      }
    }
  }, [isOpen, plans]);

  if (!isOpen) return null;

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

  const handleAddMemberSubmit = async (e: React.FormEvent) => {
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
    setFullName('');
    setPhoneNumber('');
    setEmail('');
    setGender('Male');
    setPhotoBase64('');
    onMemberAdded();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"><X className="w-5 h-5" /></button>
        <h3 className="text-xl font-bold text-slate-100 mb-5">Register New Member</h3>
        <form onSubmit={handleAddMemberSubmit} className="space-y-4 font-sans">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5 font-bold uppercase tracking-wider">Full Name</label>
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-brand-orange/40" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5 font-bold uppercase tracking-wider">Email Address <span className="text-[10px] text-gray-500 font-mono font-normal">(Optional)</span></label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="athlete@example.com" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-brand-orange/40" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5 font-bold uppercase tracking-wider">Phone Number</label>
            <input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} required className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-brand-orange/40" />
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-bold uppercase tracking-wider">Package</label>
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
            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-bold uppercase tracking-wider">Payment Mode</label>
              <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-brand-orange/40">
                <option>Cash</option>
                <option>UPI</option>
                <option>Card</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-slate-400 mb-1.5 font-bold uppercase tracking-wider">Joining Date</label>
              <input type="date" value={joiningDate} onChange={(e) => setJoiningDate(e.target.value)} required className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-brand-orange/40 font-mono" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-bold uppercase tracking-wider">Duration</label>
              <input type="number" min={1} max={36} value={durationMonths} onChange={(e) => setDurationMonths(Number(e.target.value))} required className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-brand-orange/40 font-mono" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-bold uppercase tracking-wider">Gender</label>
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
              <label className="block text-xs text-slate-400 mb-1.5 font-bold uppercase tracking-wider">Upload Photo <span className="text-[10px] text-gray-500 font-mono font-normal">(Optional)</span></label>
              <input 
                type="file" 
                accept="image/*"
                onChange={handlePhotoChange}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-400 focus:outline-none focus:border-brand-orange/40" 
              />
            </div>
          </div>

          <button type="submit" disabled={isSubmitting} className="w-full bg-gradient-to-r from-brand-orange to-brand-volt text-slate-950 font-extrabold py-3.5 rounded-xl text-sm transition-opacity hover:opacity-90 tracking-widest uppercase mt-2">
            {isSubmitting ? 'Syncing...' : 'Activate & Log Payment'}
          </button>
        </form>
      </div>
    </div>
  );
}
