'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../supabase'; // Note: Ensure this path correctly points to your supabase.ts file

export default function AdminMonitor() {
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    async function fetchAllData() {
      // 1. Let's try to get ANY data from the table
      const { data, error } = await supabase
        .from('workout_logs') // Ensure this matches your Supabase table name exactly
        .select('*');
      
      if (error) {
        console.error("Supabase Error:", error);
      } else {
        console.log("Fetched Data:", data);
        setLogs(data || []);
      }
    }
    fetchAllData();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 p-8 text-white font-sans">
      <h1 className="text-3xl font-black mb-8">Athlete Monitoring Hub</h1>
      
      <div className="grid gap-4">
        {logs.map((log: any) => (
          <div key={log.id} className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex justify-between items-center">
            <div>
              <p className="text-emerald-400 text-sm font-bold uppercase tracking-wider">{log.focus_area}</p>
              <p className="text-slate-100 mt-1">{log.exercises}</p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-500 font-bold">
                {new Date(log.workout_date).toLocaleDateString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}