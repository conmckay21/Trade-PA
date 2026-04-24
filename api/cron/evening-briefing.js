// api/cron/evening-briefing.js
// Sends each Trade PA user their schedule for tomorrow via SMS
// Runs nightly at 17:00 UTC (6pm UK winter / 6pm UK summer with offset)

import { createClient } from '@supabase/supabase-js';
import { withSentry } from "../lib/sentry.js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function sendSms(to, body) {
  // Normalise UK numbers to E.164
  let number = to.replace(/\s+/g, '');
  if (number.startsWith('07')) number = '+44' + number.slice(1);
  else if (number.startsWith('0')) number = '+44' + number.slice(1);
  else if (!number.startsWith('+')) number = '+44' + number;

  const credentials = Buffer.from(
    `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
  ).toString('base64');

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: process.env.TWILIO_BRIEFING_NUMBER || process.env.TWILIO_PHONE_NUMBER,
        To: number,
        Body: body,
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Twilio SMS failed: ${err}`);
  }
  return await res.json();
}

function formatTime(dateObj) {
  return new Date(dateObj).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/London',
  });
}

function getTomorrow() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow;
}

async function handler(req, res) {
  // Vercel cron jobs call with CRON_SECRET header — reject anything else
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorised' });
  }

  const tomorrow = getTomorrow();
  const tomorrowStr = tomorrow.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
    timeZone: 'Europe/London',
  });

  // Date range for tomorrow in UTC (covers BST and GMT)
  const tomorrowDate = tomorrow.toISOString().split('T')[0];
  const rangeStart = `${tomorrowDate}T00:00:00`;
  const rangeEnd   = `${tomorrowDate}T23:59:59`;

  // Load all users who have evening briefing enabled
  const { data: allSettings, error: settingsErr } = await supabase
    .from('user_settings')
    .select('user_id, brand_data');

  if (settingsErr) {
    console.error('Failed to load user settings:', settingsErr.message);
    return res.status(500).json({ error: settingsErr.message });
  }

  const eligible = (allSettings || []).filter(
    s => s.brand_data?.eveningBriefing === true && s.brand_data?.phone
  );

  console.log(`Evening briefing: ${eligible.length} eligible users`);

  const results = [];

  for (const setting of eligible) {
    const { user_id, brand_data } = setting;
    const phone      = brand_data.phone;
    const tradeName  = brand_data.tradingName || 'Trade PA';
    const sendTime   = brand_data.eveningBriefingTime || '18:00';

    try {
      // Load tomorrow's jobs for this user
      const { data: jobs, error: jobsErr } = await supabase
        .from('jobs')
        .select('*')
        .eq('user_id', user_id)
        .gte('date_obj', rangeStart)
        .lte('date_obj', rangeEnd)
        .order('date_obj', { ascending: true });

      if (jobsErr) throw new Error(jobsErr.message);

      let message;

      if (!jobs || jobs.length === 0) {
        // Nothing on — still send so they know the app is working
        message =
          `Trade PA 📋\n` +
          `Tomorrow (${tomorrowStr}) — nothing booked.\n` +
          `Enjoy the time off! 🎉`;
      } else {
        const totalValue = jobs.reduce((s, j) => s + (parseFloat(j.value) || 0), 0);

        const jobLines = jobs
          .map(j => {
            const time    = j.date_obj ? formatTime(j.date_obj) : null;
            const address = j.address ? ` · ${j.address}` : '';
            return `${time ? time + ' ' : ''}${j.customer}${address}`;
          })
          .join('\n');

        message =
          `Trade PA 📋 Tomorrow (${tomorrowStr})\n` +
          `${jobs.length} job${jobs.length !== 1 ? 's' : ''}` +
          `${totalValue > 0 ? ` · £${totalValue.toLocaleString('en-GB')}` : ''}\n\n` +
          jobLines;
      }

      await sendSms(phone, message);
      results.push({ user_id, phone: phone.slice(0, 6) + '***', jobs: jobs?.length ?? 0, status: 'sent' });

    } catch (err) {
      console.error(`Briefing failed for user ${user_id}:`, err.message);
      results.push({ user_id, status: 'failed', error: err.message });
    }
  }

  return res.status(200).json({
    sent: results.filter(r => r.status === 'sent').length,
    failed: results.filter(r => r.status === 'failed').length,
    results,
  });
}

export default withSentry(handler, { routeName: "cron/evening-briefing" });
