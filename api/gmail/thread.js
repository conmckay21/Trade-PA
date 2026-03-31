import { getValidToken } from "./_token.js";

function decodeBody(data) {
  if (!data) return "";
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
}

function extractParts(payload, parts = [], attachments = []) {
  if (payload.mimeType === "text/plain" || payload.mimeType === "text/html") {
    parts.push({ type: payload.mimeType, body: decodeBody(payload.body?.data) });
  }
  if (payload.filename && payload.body?.attachmentId) {
    attachments.push({
      id: payload.body.attachmentId,
      filename: payload.filename,
      mimeType: payload.mimeType,
      size: payload.body.size,
    });
  }
  if (payload.parts) {
    payload.parts.forEach((p) => extractParts(p, parts, attachments));
  }
  return { parts, attachments };
}

export default async function handler(req, res) {
  const { userId, threadId } = req.query;
  if (!userId || !threadId) return res.status(400).json({ error: "userId and threadId required" });

  try {
    const token = await getValidToken(userId);

    const tRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=full`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const thread = await tRes.json();

    const messages = (thread.messages || []).map((msg) => {
      const headers = msg.payload?.headers || [];
      const get = (name) => headers.find((h) => h.name === name)?.value || "";
      const { parts, attachments } = extractParts(msg.payload);
      const body = parts.find((p) => p.type === "text/html")?.body
        || parts.find((p) => p.type === "text/plain")?.body
        || msg.snippet || "";
      return {
        id: msg.id,
        from: get("From"),
        to: get("To"),
        subject: get("Subject"),
        date: get("Date"),
        body,
        isHtml: parts.some((p) => p.type === "text/html"),
        attachments,
        unread: msg.labelIds?.includes("UNREAD"),
      };
    });

    await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}/modify`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ removeLabelIds: ["UNREAD"] }),
      }
    );

    res.json({ messages });
  } catch (err) {
    console.error("Gmail thread error:", err.message);
    res.status(500).json({ error: err.message });
  }
}
