'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from './supabase';

export default function RefreshRedirect() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // If on homepage, reset count
    if (pathname === '/') {
      sessionStorage.setItem('refresh_count', '0');
      return;
    }

    const currentCount = parseInt(sessionStorage.getItem('refresh_count') || '0', 10);
    const newCount = currentCount + 1;

    if (newCount >= 3) {
      sessionStorage.setItem('refresh_count', '0'); // Reset count
      
      const checkAndRedirect = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          // Check if athlete
          const userEmail = session.user.email || '';
          const userFullName = session.user.user_metadata?.full_name || '';
          let isAthlete = false;
          
          try {
            const { data: hasEmail } = await supabase
              .from('members')
              .select('id')
              .eq('email', userEmail)
              .maybeSingle();
            
            if (hasEmail) {
              isAthlete = true;
            } else if (userFullName) {
              const { data: hasName } = await supabase
                .from('members')
                .select('id')
                .eq('full_name', userFullName)
                .maybeSingle();
              if (hasName) {
                isAthlete = true;
              }
            }
          } catch (e) {
            // Table check failed
          }

          if (isAthlete) {
            router.push('/athlete/dashboard');
            return;
          }
        }
        router.push('/');
      };
      checkAndRedirect();
    } else {
      sessionStorage.setItem('refresh_count', newCount.toString());
    }
  }, [pathname]);

  return null;
}
