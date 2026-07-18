import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { to, message } = await req.json();
    if (!to || !message) {
      return NextResponse.json({ error: 'Missing to or message parameters' }, { status: 400 });
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_FROM_NUMBER;
    const fast2smsKey = process.env.FAST2SMS_API_KEY;

    // 1. Try sending via Twilio if credentials are set
    if (accountSid && authToken && fromNumber) {
      const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            From: fromNumber,
            To: to,
            Body: message
          })
        }
      );

      const data = await response.json();
      if (response.ok) {
        return NextResponse.json({ success: true, provider: 'Twilio', data });
      } else {
        return NextResponse.json({ error: 'Twilio API error', details: data }, { status: 502 });
      }
    }

    // 2. Try sending via Fast2SMS (popular Indian gateway) if credentials are set
    if (fast2smsKey) {
      // Clean phone number for Fast2SMS (needs 10-digit number)
      const cleanTo = to.replace(/\D/g, '').slice(-10);
      const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: {
          'authorization': fast2smsKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          route: 'q',
          message: message,
          language: 'english',
          flash: 0,
          numbers: cleanTo
        })
      });

      const data = await response.json();
      if (data.return) {
        return NextResponse.json({ success: true, provider: 'Fast2SMS', data });
      } else {
        return NextResponse.json({ error: 'Fast2SMS API error', details: data }, { status: 502 });
      }
    }

    // 3. Fallback: Local dev simulation (always succeeds to prevent errors if keys aren't configured yet)
    console.log(`[SMS Simulation Mode] To: ${to} | Message: "${message}"`);
    return NextResponse.json({ 
      success: true, 
      provider: 'Simulation', 
      note: 'SMS Simulated. Add TWILIO_ACCOUNT_SID or FAST2SMS_API_KEY in environment variables to send real SMS.' 
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
