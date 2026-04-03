// api/calls/recording.js
import { waitUntil } from "@vercel/functions";

async function processRecording(req) {
  const { RecordingUrl, RecordingDuration, CallSid } = req.body || {};
  const { userId, callerNumber, customerName, direction } = req.query;

  if (!RecordingUrl || !userId) {
    console.error("recording.js: Missing RecordingUrl or userId");
    return;
  }

  const isOutbound = direction === "outbound";
  console.log(`recording.js: Starting for ${customerName} (${callerNumber}) CallSid: ${CallSid}`);
  console.log(`recording.js: RecordingUrl: ${RecordingUrl}`);

  try {
    // 1. Wait for recording to be ready then retry up to 5 times
    await new Promise(r => setTimeout(r, 5000));

    // Keep the regional URL — recording is stored in IE1 region
    // Standard api.twilio.com returns 404 for IE1 recordings
    const downloadUrl = RecordingUrl;
    console.log(`recording.js: Downloading from: ${downloadUrl}.mp3`);

    // Download with retries
    console.log("recording.js: Downloading recording...");
    let recordingRes;
    for (let attempt = 1; attempt <= 5; attempt++) {
      recordingRes = await fetch(`${downloadUrl}.mp3`, {
        headers: {
          Authorization: `Basic ${Buffer.from(`${process.env.TWILIO_API_KEY}:${process.env.TWILIO_API_SECRET}`).toString("base64")}`,
        },
      });
      if (recordingRes.ok) {
        console.log(`recording.js: Download succeeded on attempt ${attempt}`);
        break;
      }
      console.log(`recording.js: Download attempt ${attempt} failed — status ${recordingRes.status}, retrying...`);
      await new Promise(r => setTimeout(r, 5000 * attempt));
    }

    if (!recordingRes?.ok) {
      console.error(`recording.js: Failed to download after 5 attempts`);
      return;
    }

    const audioBuffer = await recordingRes.arrayBuffer();
    const audioBytes = Buffer.from(audioBuffer);
    console.log(`recording.js: Audio size: ${audioBytes.length} bytes`);

    // 3. Transcribe with Whisper
    console.log("recording.js: Sending to Whisper...");
    const { Blob } = await import("buffer");
    const audioBlob = new Blob([audioBytes], { type: "audio/mpeg" });

    const formData = new FormData();
    formData.append("file", audioBlob, "call.mp3");
    formData.append("model", "whisper-1");
    formData.append("language", "en");

    const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.VITE_OPENAI_KEY}`,
      },
      body: formData,
    });

    if (!whisperRes.ok) {
      console.error(`recording.js: Whisper failed — status ${whisperRes.status}`);
      const whisperErr = await whisperRes.text();
      console.error(`recording.js: Whisper error: ${whisperErr}`);
      return;
    }

    const whisperData = await whisperRes.json();
    const transcript = whisperData.text || "";
    console.log(`recording.js: Transcript: ${transcript.slice(0, 100)}`);

    if (!transcript.trim()) {
      console.log("recording.js: Empty transcript — skipping");
      return;
    }

    // 4. Load context
    console.log("recording.js: Loading context from Supabase...");
    const [jobsRes, invoicesRes, customersRes] = await Promise.all([
      fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/job_cards?user_id=eq.${userId}&status=neq.completed&select=id,title,customer,status,type&order=created_at.desc&limit=20`, {
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
    console.log(`recording.js: Loaded ${activeJobs.length} jobs, ${allCustomers.length} customers`);

    const customer = allCustomers.find(c =>
      c.name?.toLowerCase() === (customerName || "").toLowerCase() ||
      c.phone?.replace(/\s/g, "").includes((callerNumber || "").replace(/\s/g, "").slice(-10))
    );
    const customerJobs = activeJobs.filter(j => j.customer?.toLowerCase() === (customerName || "").toLowerCase());

    // 5. Classify with Claude — returns multiple actions if needed
    console.log("recording.js: Calling Claude...");
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.VITE_ANTHROPIC_KEY,
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
${customerJobs.length > 0 ? customerJobs.map(j => `- ${j.title || j.type} (${j.status}) [ID: ${j.id}]`).join("\n") : "None"}

Outstanding invoices:
${outstandingInvoices.filter(i => i.customer?.toLowerCase() === (customerName || "").toLowerCase()).map(i => `- ${i.id} £${i.amount} (${i.status})`).join("\n") || "None"}

Transcript:
${transcript}

Extract EVERY action from this call. A single call may have multiple actions.

Action types available:
- mark_invoice_paid: customer confirmed payment or paying an invoice
- update_job: mark a job as complete or update its status  
- create_job: new work to be booked in
- create_enquiry: new enquiry from customer
- chase_invoice: invoice still outstanding, needs chasing
- none: no action needed

Respond ONLY with JSON:
{
  "category": "existing_job" | "new_enquiry" | "quote_discussion" | "invoice_payment" | "general",
  "summary": "2-3 sentence summary of the full call",
  "job_id": "existing job ID if discussed, or null",
  "key_details": "invoice numbers, amounts, dates, job completions mentioned",
  "actions": [
    {
      "action_type": "mark_invoice_paid",
      "description": "Mark invoice 129 as paid — £1,000 received",
      "invoice_number": "129",
      "job_id": null
    },
    {
      "action_type": "update_job",
      "description": "Mark stage 1 job as complete",
      "invoice_number": null,
      "job_id": "the-job-id-here-or-null"
    },
    {
      "action_type": "create_job",
      "description": "Book stage 2 when customer is ready",
      "invoice_number": null,
      "job_id": null
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
    console.log(`recording.js: Classification: ${classification.category} — ${classification.actions.length} actions — ${classification.summary?.slice(0, 60)}`);

    // 6. Save call log
    console.log("recording.js: Saving to call_logs...");
    const saveRes = await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/call_logs`, {
      method: "POST",
      headers: {
        apikey: process.env.SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: userId,
        customer_id: customer?.id || null,
        customer_name: customerName || "Unknown",
        caller_number: callerNumber,
        call_sid: CallSid,
        direction: isOutbound ? "outbound" : "inbound",
        duration_seconds: parseInt(RecordingDuration) || 0,
        recording_url: RecordingUrl,
        transcript,
        category: classification.category,
        summary: classification.summary,
        action_needed: classification.actions.map(a => a.description).join("; "),
        key_details: classification.key_details,
        job_id: classification.job_id || null,
        created_at: new Date().toISOString(),
      }),
    });

    if (!saveRes.ok) {
      const saveErr = await saveRes.text();
      console.error(`recording.js: Failed to save call log — ${saveErr}`);
    } else {
      console.log("recording.js: ✓ Call log saved");
    }

    // 7. Add job note
    if (classification.job_id) {
      const directionLabel = isOutbound ? "Call to" : "Call from";
      await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/job_notes`, {
        method: "POST",
        headers: { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: classification.job_id,
          user_id: userId,
          note: `📞 ${isOutbound ? "Call to" : "Call from"} ${customerName} (${Math.floor(parseInt(RecordingDuration)/60)}min ${parseInt(RecordingDuration)%60}s)\n\n${classification.summary}${classification.key_details ? `\n\nKey details: ${classification.key_details}` : ""}`,
          created_at: new Date().toISOString(),
        }),
      });
      console.log("recording.js: ✓ Job note added");
    }

    // 8. Create AI actions — one per detected action
    const actionsToCreate = (classification.actions || []).filter(a => a.action_type && a.action_type !== "none");
    if (actionsToCreate.length === 0 && classification.summary) {
      console.log("recording.js: No actions to create");
    }

    for (const action of actionsToCreate) {
      const directionLabel = isOutbound ? "Outbound call to" : "Call from";
      await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/email_actions`, {
        method: "POST",
        headers: { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          email_id: `call_${CallSid}_${action.action_type}`,
          email_from: `${customerName} <${callerNumber}>`,
          email_subject: `📞 ${directionLabel} ${customerName}${action.invoice_number ? ` Invoice ${action.invoice_number}` : ""}: ${action.description?.slice(0, 60)}`,
          email_snippet: classification.summary?.slice(0, 300),
          action_type: action.action_type,
          action_description: action.description,
          action_data: {
            customer: customerName,
            phone: callerNumber,
            summary: classification.summary,
            key_details: classification.key_details,
            job_id: action.job_id || classification.job_id,
            source: "phone_call",
            direction: isOutbound ? "outbound" : "inbound",
            duration: RecordingDuration,
            invoice_number: action.invoice_number,
          },
          status: "pending",
        }),
      });
      console.log(`recording.js: ✓ AI action created: ${action.action_type} — ${action.description?.slice(0, 50)}`);
    }

    // 9. Push notification
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
    console.error(err.stack);
  }
}

export default async function handler(req, res) {
  res.status(200).json({ received: true });
  waitUntil(processRecording(req));
}
