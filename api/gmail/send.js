import { getValidToken } from "./_token.js";

function makeRaw({ to, from, subject, body, attachmentBase64, attachmentName }) {
  const boundary = `boundary_${Date.now()}`;
  let raw;

  if (attachmentBase64) {
    raw = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      "MIME-Version: 1.0",
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      "Content-Type: text/html; charset=utf-8",
      "",
      body,
      "",
      `--${boundary}`,
      `Content-Type: application/pdf; name="${attachmentName || "invoice.pdf"}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${attachmentName || "invoice.pdf"}"`,
      "",
      attachmentBase64,
      "",
      `--${boundary}--`,
    ].join("\r\n");
  } else {
    raw = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      "MIME-Version: 1.0",
      "Content-Type: text/html; charset=utf-8",
      "",
      body,
    ].join("\r\n");
  }

  return Buffer.from(raw).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { userId, to, subject, body, attachmentBase64, attachmentName, threadId } = req.body;
  if (!userId || !to || !subject || !body) {
    return res.status(400).json({ error: "userId, to, subject, body required" });
  }

  try {
    const token = await getValidToken(userId);

    const profileRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/profile",
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const profile = await profileRes.json();
    const from = profile.emailAddress;

    const raw = makeRaw({ to, from, subject, body, attachmentBase64, attachmentName });

    const payload = { raw };
    if (threadId) payload.threadId = threadId;

    const sendRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    const result = await sendRes.json();
    if (result.error) throw new Error(result.error.message);

    res.json({ success: true, messageId: result.id });
  } catch (err) {
    console.error("Gmail send error:", err.message);
    res.status(500).json({ error: err.message });
  }
}
