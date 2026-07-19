'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../supabase';
import { Camera, CheckCircle, AlertTriangle, Users, ArrowLeft, RefreshCw } from 'lucide-react';

interface CheckedInMember {
  id: string;
  name: string;
  photo?: string;
  status: string;
  time: string;
}

export default function QRScannerPage() {
  const router = useRouter();
  const [cameras, setCameras] = useState<any[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{ success: boolean; message: string; name?: string; photo?: string } | null>(null);
  const [checkInFeed, setCheckInFeed] = useState<CheckedInMember[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(false);

  const scannerRef = useRef<any>(null);
  const scannerContainerId = 'qr-reader-viewport';

  useEffect(() => {
    fetchCheckInFeed();
  }, []);

  // Fetch recent check-ins logged today
  async function fetchCheckInFeed() {
    setLoadingFeed(true);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('workouts')
      .select('*')
      .eq('exercise_name', '[Check-In] Present')
      .gte('created_at', todayStart.toISOString())
      .order('created_at', { ascending: false })
      .limit(10);

    if (data && data.length > 0) {
      // Map check-in names to member profiles to retrieve status and photo
      const memberNames = Array.from(new Set(data.map(w => w.member_name)));
      const { data: members } = await supabase
        .from('members')
        .select('id, full_name, photo, status')
        .in('full_name', memberNames);

      const feedItems = data.map(w => {
        const profile = members?.find(m => m.full_name === w.member_name);
        return {
          id: w.id,
          name: w.member_name,
          status: profile?.status || 'active',
          photo: profile?.photo || undefined,
          time: new Date(w.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        };
      });
      setCheckInFeed(feedItems);
    } else {
      setCheckInFeed([]);
    }
    setLoadingFeed(false);
  }

  // Synthesize Web Audio chime sounds
  const playFeedbackChime = (isSuccess: boolean) => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      if (isSuccess) {
        // High-pitched pleasant double beep
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        osc.start();

        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12); // A5
        gain.gain.setValueAtTime(0.15, ctx.currentTime + 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.stop(ctx.currentTime + 0.4);
      } else {
        // Sawtooth error buzzer tone
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(130, ctx.currentTime);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
        osc.stop(ctx.currentTime + 0.6);
      }
    } catch {}
  };

  // Process scanned athlete UUID
  const handleScanSuccess = async (scannedId: string) => {
    if (!scannedId) return;

    // Pause scanner temporarily to avoid duplicate triggers
    if (scannerRef.current) {
      try {
        await scannerRef.current.pause(true);
      } catch {}
    }

    try {
      // 1. Look up profile details
      const { data: member, error } = await supabase
        .from('members')
        .select('*')
        .eq('id', scannedId.trim())
        .maybeSingle();

      if (error || !member) {
        playFeedbackChime(false);
        setScanResult({ success: false, message: 'Invalid or unknown athlete pass.' });
      } else if (member.status !== 'active') {
        playFeedbackChime(false);
        setScanResult({
          success: false,
          message: `Check-in Denied: Membership is ${member.status.toUpperCase()}.`,
          name: member.full_name,
          photo: member.photo || undefined
        });
      } else {
        // 2. Active member: Log check-in workout entry
        const { error: insertError } = await supabase.from('workouts').insert([{
          member_name: member.full_name,
          exercise_name: '[Check-In] Present',
          sets: 0,
          reps: 0,
          weight_kg: 0
        }]);

        if (insertError) {
          playFeedbackChime(false);
          setScanResult({ success: false, message: 'Database sync failure. Try again.' });
        } else {
          playFeedbackChime(true);
          setScanResult({
            success: true,
            message: 'Check-in Approved. Enjoy your workout!',
            name: member.full_name,
            photo: member.photo || undefined
          });
          fetchCheckInFeed();
        }
      }
    } catch (err) {
      setScanResult({ success: false, message: 'Unexpected server response.' });
    }

    // Resume scanning after 3.5 seconds feedback delay
    setTimeout(async () => {
      setScanResult(null);
      if (scannerRef.current) {
        try {
          await scannerRef.current.resume();
        } catch {}
      }
    }, 3500);
  };

  // Initialize camera scanner
  const startScanner = async (cameraId: string) => {
    if (scanning) await stopScanner();

    // Dynamically import to ensure code runs only in standard client window context
    const { Html5Qrcode } = await import('html5-qrcode');
    const qrScanner = new Html5Qrcode(scannerContainerId);
    scannerRef.current = qrScanner;

    try {
      await qrScanner.start(
        cameraId,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 }
        },
        handleScanSuccess,
        () => {}
      );
      setScanning(true);
    } catch (err) {
      alert('Unable to capture camera feed. Please verify camera permissions.');
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current && scanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current = null;
        setScanning(false);
      } catch {}
    }
  };

  // Discover and list cameras
  useEffect(() => {
    let active = true;

    async function setupCameras() {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0 && active) {
          setCameras(devices);
          setSelectedCameraId(devices[0].id);
          // Auto-start scanner
          setTimeout(() => {
            startScanner(devices[0].id);
          }, 300);
        }
      } catch {}
    }

    setupCameras();

    return () => {
      active = false;
      stopScanner();
    };
  }, []);

  return (
    <div className="min-h-screen bg-brand-dark flex flex-col font-sans text-slate-200">
      
      {/* Header Area */}
      <header className="border-b border-gray-900 bg-brand-dark/95 backdrop-blur px-6 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => {
              stopScanner().then(() => router.push('/'));
            }} 
            className="p-2 rounded-lg hover:bg-slate-900 border border-gray-850 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-400 hover:text-white" />
          </button>
          <div>
            <h1 className="text-lg font-black tracking-widest text-brand-volt">GYMNATION SCANNER</h1>
            <p className="text-[10px] text-gray-500 font-mono tracking-wider uppercase">Front Desk Check-in Interface</p>
          </div>
        </div>
        
        {cameras.length > 1 && (
          <select 
            value={selectedCameraId}
            onChange={(e) => {
              const cid = e.target.value;
              setSelectedCameraId(cid);
              startScanner(cid);
            }}
            className="bg-slate-900 border border-gray-800 text-xs text-white rounded-lg p-2.5 outline-none font-bold"
          >
            {cameras.map((c, i) => (
              <option key={c.id} value={c.id}>
                Camera {i + 1} ({c.label || 'Generic'})
              </option>
            ))}
          </select>
        )}
      </header>

      {/* Main Control Console */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-8 p-6 max-w-7xl mx-auto w-full">
        
        {/* Left Column: QR Code scanning Viewport */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="glass-panel p-6 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden border border-brand-volt/20 min-h-[400px]">
            
            {/* Holographic scanner guidelines overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-brand-volt/5 to-transparent pointer-events-none" />
            <div className="absolute top-6 left-6 w-8 h-8 border-t-4 border-l-4 border-brand-volt/50 rounded-tl" />
            <div className="absolute top-6 right-6 w-8 h-8 border-t-4 border-r-4 border-brand-volt/50 rounded-tr" />
            <div className="absolute bottom-6 left-6 w-8 h-8 border-b-4 border-l-4 border-brand-volt/50 rounded-bl" />
            <div className="absolute bottom-6 right-6 w-8 h-8 border-b-4 border-r-4 border-brand-volt/50 rounded-br" />

            <div id={scannerContainerId} className="w-full max-w-sm rounded-xl overflow-hidden shadow-2xl bg-black border border-gray-900" />
            
            {!scanning && (
              <div className="text-center space-y-2 mt-4 z-15">
                <Camera className="w-10 h-10 text-gray-500 mx-auto animate-pulse" />
                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Starting scanning Matrix...</p>
              </div>
            )}
          </div>

          {/* Hologram Popup Notification on check-in state updates */}
          {scanResult && (
            <div className={`p-6 rounded-2xl border flex items-start gap-4 transition-all duration-300 ${
              scanResult.success 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                : 'bg-rose-500/10 border-rose-500/30 text-rose-450'
            }`}>
              {scanResult.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img 
                  src={scanResult.photo} 
                  alt="Scanned Athlete" 
                  className="w-16 h-16 rounded-full border-2 border-current object-cover bg-slate-900" 
                />
              ) : (
                <div className="w-16 h-16 rounded-full border-2 border-current flex items-center justify-center bg-slate-900">
                  {scanResult.success ? (
                    <CheckCircle className="w-8 h-8 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-8 h-8 text-rose-500" />
                  )}
                </div>
              )}
              <div>
                <h3 className="text-lg font-bold tracking-tight text-white uppercase select-none">
                  {scanResult.success ? 'Access Approved ✅' : 'Access Denied ❌'}
                </h3>
                {scanResult.name && (
                  <p className="text-sm font-bold text-gray-200 uppercase mt-0.5">{scanResult.name}</p>
                )}
                <p className="text-xs mt-1.5 font-bold uppercase tracking-wider font-mono opacity-80">{scanResult.message}</p>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Real-time Check-In Attendance Feed */}
        <div className="glass-panel p-6 rounded-2xl flex flex-col gap-4 border border-slate-800">
          <div className="flex justify-between items-center border-b border-slate-850 pb-3">
            <h2 className="text-md font-bold tracking-wider text-brand-volt flex items-center gap-2 uppercase">
              <Users className="w-4 h-4 text-brand-volt" /> Live Check-Ins
            </h2>
            <button 
              onClick={fetchCheckInFeed}
              className="p-2 hover:bg-slate-900 rounded-lg text-gray-400 hover:text-white transition-colors"
              title="Refresh log feed"
            >
              <RefreshCw className={`w-4 h-4 ${loadingFeed ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 max-h-[500px]">
            {checkInFeed.length === 0 ? (
              <div className="text-center py-12 text-gray-500 text-xs italic font-sans">
                No check-ins logged yet today.
              </div>
            ) : (
              checkInFeed.map((item) => (
                <div key={item.id} className="flex items-center justify-between bg-slate-950/60 border border-slate-850 p-3.5 rounded-xl hover:border-slate-800 transition-colors">
                  <div className="flex items-center gap-3">
                    {item.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img 
                        src={item.photo} 
                        alt={item.name} 
                        className="w-10 h-10 rounded-full border border-gray-700 object-cover bg-slate-900" 
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-400">
                        {item.name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <span className="font-bold text-sm text-slate-200 block truncate max-w-[120px] uppercase">{item.name}</span>
                      <span className="text-[10px] text-gray-500 font-mono">{item.time}</span>
                    </div>
                  </div>

                  <span className={`text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${
                    item.status === 'active' 
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                      : 'bg-rose-500/10 border-rose-500/20 text-rose-450'
                  }`}>
                    {item.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

      </main>
    </div>
  );
}
