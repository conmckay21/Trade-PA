// api/calls/recording.js
// Handles call recording webhook from Twilio — works for ALL calls
// Whether answered on app or mobile (conference bridge keeps Twilio in the middle)
// Transcribes via Deepgram (primary) or Whisper (fallback) — keys server-side only
import { waitUntil } from "@vercel/functions";
import { withSentry } from "../lib/sentry.js";

async function transcribeAudio(audioBytes) {
  // Try Deepgram first (faster, cheaper, no OpenAI dependency)
  const deepgramKey = process.env.DEEPGRAM_API_KEY;
  if (deepgramKey) {
    try {
      const dgRes = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&language=en-GB&smart_format=true&punctuate=true', {
        method: 'POST',
        headers: { 'Authorization': `Token ${deepgramKey}`, 'Content-Type': 'audio/mpeg' },
        body: audioBytes,
      });
      if (dgRes.ok) {
        const dgData = await dgRes.json();
        const text = dgData.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
        if (text) { console.log('recording.js: Transcribed via Deepgram'); return text; }
      }
    } catch (e) { console.warn('Deepgram failed, trying Whisper:', e.message); }
  }

  // Fallback to OpenAI Whisper — key is server-side only (no VITE_ prefix)
  const openAiKey = process.env.OPENAI_API_KEY;
  if (!openAiKey) throw new Error('No transcription service configured');

  const { Blob } = await import("buffer");
  const audioBlob = new Blob([audioBytes], { type: "audio/mpeg" });
  const formData = new FormData();
  formData.append("file", audioBlob, "call.mp3");
  formData.append("model", "whisper-1");
  formData.append("language", "en");

  const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${openAiKey}` },
    body: formData,
  });
  if (!whisperRes.ok) throw new Error(`Whisper failed: ${whisperRes.status}`);
  const whisperData = await whisperRes.json();
  console.log('recording.js: Transcribed via Whisper');
  return whisperData.text || '';
}

async function processRecording(req) {
  const { RecordingUrl, RecordingDuration, CallSid } = req.body || {};
  const { userId, callerNumber, customerName, direction } = req.query;

  if (!RecordingUrl || !userId) {
    console.error("recording.js: Missing RecordingUrl or userId");
    return;
  }

  const isOutbound = direction === "outbound";
  console.log(`recording.js: Processing for ${customerName} (${callerNumber}) — ${RecordingDuration}s`);

  try {
    // 1. Wait for recording to be ready then download with retries
    await new Promise(r => setTimeout(r, 5000));

    let recordingRes;
    for (let attempt = 1; attempt <= 5; attempt++) {
      recordingRes = await fetch(`${RecordingUrl}.mp3`, {
        headers: {
          Authorization: `Basic ${Buffer.from(`${process.env.TWILIO_API_KEY}:${process.env.TWILIO_API_SECRET}`).toString("base64")}`,
        },
      });
      if (recordingRes.ok) { console.log(`recording.js: Downloaded on attempt ${attempt}`); break; }
      console.log(`recording.js: Download attempt ${attempt} failed (${recordingRes.status}), retrying...`);
      await new Promise(r => setTimeout(r, 5000 * attempt));
    }

    if (!recordingRes?.ok) { console.error("recording.js: Failed to download after 5 attempts"); return; }

    const audioBuffer = await recordingRes.arrayBuffer();
    const audioBytes = Buffer.from(audioBuffer);
    console.log(`recording.js: Audio size: ${audioBytes.length} bytes`);

    // 2. Transcribe — Deepgram or Whisper, both server-side
    const transcript = await transcribeAudio(audioBytes);
    console.log(`recording.js: Transcript: ${transcript.slice(0, 100)}`);
    if (!transcript.trim()) { console.log("recording.js: Empty transcript — skipping"); return; }

    // 3. Load context from Supabase
    const [jobsRes, invoicesRes, customersRes] = await Promise.all([
      fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/job_cards?user_id=eq.${userId}&status=neq.completed&select=id,title,customer,status,type,value&order=created_at.desc&limit=20`, {
        headers: { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` },
      }),
      fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/invoices?user_id=eq.${userId}&status=neq.paid&select=id,customer,amount,status&order=created_at.desc&limit=10`, {
        headers: { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` },
      }),
      fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/customers?user_id=eq.${userId}&select=id,name,phone&limit=100`, {
        headers: { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` },
      }),
    ]);

    const activeJobs = await jobsRes.json() || [];
    const outstandingInvoices = await invoicesRes.json() || [];
    const allCustomers = await customersRes.json() || [];

    const customer = allCustomers.find(c =>
      c.name?.toLowerCase() === (customerName || "").toLowerCase() ||
      c.phone?.replace(/\s/g, "").includes((callerNumber || "").replace(/\s/g, "").slice(-10))
    );
    const customerJobs = activeJobs.filter(j => j.customer?.toLowerCase() === (customerName || "").toLowerCase());

    // 4. Classify with Claude — server-side key only
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 800,
        messages: [{
          role: "user",
          content: `You are an AI assistant for a UK sole-trader tradesperson. Analyse this phone call and identify ALL actions needed.

Customer: ${customerName || "Unknown"}
Direction: ${isOutbound ? "Outbound" : "Inbound"}
Duration: ${RecordingDuration} seconds

Active jobs:
${customerJobs.length > 0 ? customerJobs.map(j => `- ${j.title || j.type} (${j.status}) [ID: ${j.id}]${j.value ? ` £${j.value}` : ""}`).join("\n") : "None"}

Outstanding invoices:
${outstandingInvoices.filter(i => i.customer?.toLowerCase() === (customerName || "").toLowerCase()).map(i => `- ${i.id} £${i.amount} (${i.status})`).join("\n") || "None"}

Transcript:
${transcript}

Respond ONLY with JSON:
{
  "category": "existing_job" | "new_enquiry" | "quote_discussion" | "invoice_payment" | "general",
  "summary": "2-3 sentence summary",
  "job_id": "existing job ID if discussed, or null",
  "key_details": "invoice numbers, amounts, dates mentioned",
  "actions": [
    {
      "action_type": "mark_invoice_paid" | "update_job" | "create_job" | "create_enquiry" | "chase_invoice" | "none",
      "description": "what to do",
      "invoice_number": null,
      "job_id": null,
      "job_value": null
    }
  ]
}`,
        }],
      }),
    });

    const claudeData = await claudeRes.json();
    const raw = claudeData.content?.[0]?.text?.trim() || "{}";
    const rawMatch = raw.match(/\{[\s\S]*\}/);
    let classification = { category: "general", summary: transcript.slice(0, 200), actions: [] };
    try { if (rawMatch) classification = JSON.parse(rawMatch[0]); } catch {}
    if (!classification.actions) classification.actions = [];

    console.log(`recording.js: ${classification.category} — ${classification.actions.length} actions`);

    // 5. Save call log
    await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/call_logs`, {
      method: "POST",
      headers: { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId, customer_id: customer?.id || null,
        customer_name: customerName || "Unknown", caller_number: callerNumber,
        call_sid: CallSid, direction: isOutbound ? "outbound" : "inbound",
        duration_seconds: parseInt(RecordingDuration) || 0,
        recording_url: RecordingUrl, transcript,
        category: classification.category, summary: classification.summary,
        action_needed: classification.actions.map(a => a.description).join("; "),
        key_details: classification.key_details, job_id: classification.job_id || null,
        created_at: new Date().toISOString(),
      }),
    });
    console.log("recording.js: ✓ Call log saved");

    // ─── Increment phone-plan minutes used this month ───────────────────────
    // Uses increment_phone_minutes RPC (atomic, SECURITY DEFINER).
    // Silently no-ops for users without a phone_plan set in call_tracking.
    try {
      const minutes = Math.ceil(parseInt(RecordingDuration || 0) / 60);
      if (minutes > 0) {
        const rpcRes = await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/rpc/increment_phone_minutes`, {
          method: "POST",
          headers: { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ p_user_id: userId, p_minutes: minutes }),
        });
        if (rpcRes.ok) {
          const quotaResult = await rpcRes.json();
          console.log(`recording.js: Minutes incremented — ${JSON.stringify(quotaResult)}`);

          // If crossed soft cap, notify user
          if (quotaResult?.over_soft_cap && !quotaResult?.over_hard_cap) {
            fetch(`${process.env.APP_URL}/api/push/send`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                userId,
                title: "📞 Call allowance running low",
                body: `You've used ${quotaResult.minutes_used_month}/${quotaResult.monthly_minute_quota} minutes on your ${quotaResult.phone_plan} plan. Upgrade to avoid hitting the cap.`,
                url: "/", type: "phone_quota", tag: "phone-quota-warn",
              }),
            }).catch(() => {});
          }
        }
      }
    } catch (mErr) {
      console.error("recording.js: Failed to increment minutes:", mErr.message);
    }

    // 6. Add job note if job identified
    if (classification.job_id) {
      await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/job_notes`, {
        method: "POST",
        headers: { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: classification.job_id, user_id: userId,
          note: `📞 ${isOutbound ? "Call to" : "Call from"} ${customerName} (${Math.floor(parseInt(RecordingDuration)/60)}m ${parseInt(RecordingDuration)%60}s)\n\n${classification.summary}${classification.key_details ? `\n\nKey details: ${classification.key_details}` : ""}`,
          created_at: new Date().toISOString(),
        }),
      });
    }

    // 7. Create inbox actions
    for (const action of (classification.actions || []).filter(a => a.action_type && a.action_type !== "none")) {
      await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/email_actions`, {
        method: "POST",
        headers: { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          email_id: `call_${CallSid}_${action.action_type}`,
          email_from: `${customerName} <${callerNumber}>`,
          email_subject: `📞 ${isOutbound ? "Call to" : "Call from"} ${customerName}: ${action.description?.slice(0, 60)}`,
          email_snippet: classification.summary?.slice(0, 300),
          action_type: action.action_type,
          action_description: action.description,
          action_data: {
            customer: customerName, phone: callerNumber,
            summary: classification.summary, key_details: classification.key_details,
            job_id: action.job_id || classification.job_id,
            source: "phone_call", direction: isOutbound ? "outbound" : "inbound",
            duration: RecordingDuration, invoice_number: action.invoice_number,
          },
          status: "pending",
        }),
      });
      console.log(`recording.js: ✓ Action: ${action.action_type}`);
    }

    // 8. Push notification
    const durationStr = `${Math.floor(parseInt(RecordingDuration || 0) / 60)}m ${parseInt(RecordingDuration || 0) % 60}s`;
    await fetch(`${process.env.APP_URL}/api/push/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        title: isOutbound ? `📞 Call to ${customerName}` : `📞 Call from ${customerName}`,
        body: `${durationStr} · ${classification.summary?.slice(0, 100) || "Call recorded and transcribed"}`,
        url: "/", type: "call", tag: `call-${CallSid}`, requireInteraction: true,
      }),
    }).catch(() => {});

    console.log(`recording.js: ✓ Complete for ${customerName}`);
  } catch (err) {
    console.error(`recording.js: ERROR — ${err.message}`);
  }
}

async function handler(req, res) {
  res.status(200).json({ received: true });
  waitUntil(processRecording(req));
}

export default withSentry(handler, { routeName: "calls/recording" });
