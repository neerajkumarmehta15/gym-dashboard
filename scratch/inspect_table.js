async function run() {
  const supabaseUrl = 'https://mpazzwvaobcbiejomioe.supabase.co';
  const supabaseAnonKey = 'sb_publishable_JlWwP3RtaKLQBnur3tvdUg_sBNt75fS';

  console.log("Fetching a member row to inspect columns...");
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/members?limit=1`, {
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`
      }
    });
    if (!res.ok) {
      console.error("Error fetching members:", res.status, await res.text());
      return;
    }
    const data = await res.json();
    console.log("Success! Row data:", data);
  } catch (err) {
    console.error("Fetch failed:", err);
  }
}

run();
