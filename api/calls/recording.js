// api/calls/recording.js
// Called by Twilio when a recording is complete
// Downloads recording, transcribes with Whisper, classifies with Claude
// Saves to customer record and/or job card

export default async function handler(req, res) {
  // Acknowledge Twilio immediately
  res.status(200).json({ received: true });

  const {
    RecordingUrl,
    RecordingDuration,
    CallSid,
  } = req.body || {};

  const { userId, callerNumber, customerName, direction } = req.query;

  if (!RecordingUrl || !userId) {
    console.error("Missing recording URL or userId");
    return;
  }

  const isOutbound = direction === "outbound";

  try {
    // 1. Download the recording from Twilio (wait a moment for it to be ready)
    await new Promise(r => setTimeout(r, 3000));

    const recordingRes = await fetch(`${RecordingUrl}.mp3`, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
      },
    });

    if (!recordingRes.ok) throw new Error("Failed to download recording");
    const audioBuffer = await recordingRes.arrayBuffer();
    const audioBytes = Buffer.from(audioBuffer);

    // 2. Transcribe with OpenAI Whisper
    const FormData = (await import("form-data")).default;
    const formData = new FormData();
    formData.append("file", audioBytes, {
      filename: "call.mp3",
      contentType: "audio/mpeg",
    });
    formData.append("model", "whisper-1");
    formData.append("language", "en");

    const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.VITE_OPENAI_KEY}`,
        ...formData.getHeaders(),
      },
      body: formData,
    });

    const whisperData = await whisperRes.json();
    const transcript = whisperData.text || "";

    if (!transcript.trim()) {
      console.log("Empty transcript — skipping");
      return;
    }

    console.log(`Transcript for ${customerName}: ${transcript.slice(0, 100)}...`);

    // 3. Load customer's current jobs and invoices for context
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

    // Find the matching customer
    const customer = allCustomers.find(c =>
      c.name?.toLowerCase() === (customerName || "").toLowerCase() ||
      c.phone?.replace(/\s/g, "").includes((callerNumber || "").replace(/\s/g, "").slice(-10))
    );

    // Find active jobs for this customer
    const customerJobs = activeJobs.filter(j =>
      j.customer?.toLowerCase() === (customerName || "").toLowerCase()
    );

    // 4. Classify with Claude
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.VITE_ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 600,
        messages: [{
          role: "user",
          content: `You are an AI assistant for a UK sole-trader tradesperson. Analyse this phone call transcript and classify what it's about.

Customer: ${customerName || "Unknown"}
${isOutbound ? "Called number" : "Caller number"}: ${callerNumber}
Call direction: ${isOutbound ? "Outbound (tradesperson called customer)" : "Inbound (customer called tradesperson)"}
Call duration: ${RecordingDuration} seconds

Active jobs for this customer:
${customerJobs.length > 0 ? customerJobs.map(j => `- ${j.title || j.type} (${j.status}) [ID: ${j.id}]`).join("\n") : "None"}

Outstanding invoices for this customer:
${outstandingInvoices.filter(i => i.customer?.toLowerCase() === (customerName || "").toLowerCase()).map(i => `- ${i.id} £${i.amount} (${i.status})`).join("\n") || "None"}

Transcript:
${transcript}

Classify this call and respond ONLY with JSON:
{
  "category": "existing_job" | "new_enquiry" | "quote_discussion" | "invoice_payment" | "general",
  "summary": "2-3 sentence summary of what was discussed",
  "job_id": "the job ID if related to an existing job, or null",
  "action_needed": "brief description of any follow-up needed, or null",
  "suggested_action_type": "create_job" | "create_enquiry" | "update_job" | "chase_invoice" | "none",
  "key_details": "any dates, prices, or specific details mentioned"
}`,
        }],
      }),
    });

    const claudeData = await claudeRes.json();
    const raw = claudeData.content?.[0]?.text?.trim() || "{}";
    const match = raw.match(/\{[\s\S]*\}/);
    let classification = { category: "general", summary: transcript.slice(0, 200) };
    try { if (match) classification = JSON.parse(match[0]); } catch {}

    // 5. Save call log to Supabase
    const callLog = {
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
      action_needed: classification.action_needed,
      key_details: classification.key_details,
      job_id: classification.job_id || null,
      created_at: new Date().toISOString(),
    };

    await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/call_logs`, {
      method: "POST",
      headers: {
        apikey: process.env.SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(callLog),
    });

    // 6. If there's a related job, add a note to it
    if (classification.job_id) {
      const directionLabel = isOutbound ? "Call to" : "Call from";
      await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/job_notes`, {
        method: "POST",
        headers: {
          apikey: process.env.SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          job_id: classification.job_id,
          user_id: userId,
          note: `📞 ${directionLabel} ${customerName} (${Math.floor(parseInt(RecordingDuration)/60)}min ${parseInt(RecordingDuration)%60}s)\n\n${classification.summary}${classification.key_details ? `\n\nKey details: ${classification.key_details}` : ""}`,
          created_at: new Date().toISOString(),
        }),
      });
    }

    // 7. If action needed, create an AI action for approval
    if (classification.suggested_action_type && classification.suggested_action_type !== "none") {
      const directionLabel = isOutbound ? "Outbound call to" : "Call from";
      await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/email_actions`, {
        method: "POST",
        headers: {
          apikey: process.env.SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: userId,
          email_id: `call_${CallSid}`,
          email_from: `${customerName} <${callerNumber}>`,
          email_subject: `📞 ${directionLabel} ${customerName}: ${classification.summary?.slice(0, 50)}`,
          email_snippet: classification.summary?.slice(0, 300),
          action_type: classification.suggested_action_type,
          action_description: classification.action_needed || classification.summary,
          action_data: {
            customer: customerName,
            phone: callerNumber,
            summary: classification.summary,
            key_details: classification.key_details,
            job_id: classification.job_id,
            source: "phone_call",
            direction: isOutbound ? "outbound" : "inbound",
            duration: RecordingDuration,
          },
          status: "pending",
        }),
      });
    }

    console.log(`✓ Call processed for ${customerName} (${isOutbound ? "outbound" : "inbound"}): ${classification.category} — ${classification.summary?.slice(0, 80)}`);

    // 8. Send push notification to the user
    const durationStr = `${Math.floor(parseInt(RecordingDuration || 0) / 60)}m ${parseInt(RecordingDuration || 0) % 60}s`;
    await fetch(`${process.env.APP_URL}/api/push/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        title: isOutbound ? `📞 Call to ${customerName}` : `📞 Call from ${customerName}`,
        body: `${durationStr} · ${classification.summary?.slice(0, 100) || "Call recorded and transcribed"}`,
        url: "/",
        type: "call",
        tag: `call-${CallSid}`,
        requireInteraction: true,
      }),
    }).catch(() => {});

  } catch (err) {
    console.error("Recording processing error:", err.message);
  }
}
