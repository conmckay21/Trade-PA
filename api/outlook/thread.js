import { getValidOutlookToken } from "./_token.js";

export default async function handler(req, res) {
  const { userId, messageId } = req.query;
  if (!userId || !messageId) {
    return res.status(400).json({ error: "userId and messageId required" });
  }

  try {
    const token = await getValidOutlookToken(userId);

    const msgRes = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages/${messageId}?$select=id,subject,from,toRecipients,receivedDateTime,body,hasAttachments`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const msg = await msgRes.json();
    if (msg.error) throw new Error(msg.error.message);

    let attachments = [];
    if (msg.hasAttachments) {
      const attRes = await fetch(
        `https://graph.microsoft.com/v1.0/me/messages/${messageId}/attachments?$select=id,name,contentType,size`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const attData = await attRes.json();
      attachments = (attData.value || []).map((a) => ({
        id: a.id,
        filename: a.name,
        mimeType: a.contentType,
        size: a.size,
      }));
    }

    await fetch(
      `https://graph.microsoft.com/v1.0/me/messages/${messageId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isRead: true }),
      }
    );

    const message = {
      id: msg.id,
      from: msg.from?.emailAddress
        ? `${msg.from.emailAddress.name} <${msg.from.emailAddress.address}>`
        : "",
      to: msg.toRecipients?.map((r) => r.emailAddress?.address).join(", ") || "",
      subject: msg.subject,
      date: msg.receivedDateTime,
      body: msg.body?.content || "",
      isHtml: msg.body?.contentType === "html",
      attachments,
      unread: false,
    };

    res.json({ messages: [message] });
  } catch (err) {
    console.error("Outlook thread error:", err.message);
    res.status(500).json({ error: err.message });
  }
}
