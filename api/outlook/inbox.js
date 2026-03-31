import { getValidOutlookToken } from "./_token.js";

export default async function handler(req, res) {
  const { userId, skipToken } = req.query;
  if (!userId) return res.status(400).json({ error: "userId required" });

  try {
    const token = await getValidOutlookToken(userId);

    let url =
      "https://graph.microsoft.com/v1.0/me/mailFolders/Inbox/messages" +
      "?$top=20&$orderby=receivedDateTime desc" +
      "&$select=id,subject,from,toRecipients,receivedDateTime,bodyPreview,isRead,hasAttachments,conversationId";

    if (skipToken) url += `&$skiptoken=${encodeURIComponent(skipToken)}`;

    const msgRes = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await msgRes.json();

    if (data.error) throw new Error(data.error.message);

    const threads = (data.value || []).map((msg) => ({
      id: msg.conversationId,
      messageId: msg.id,
      subject: msg.subject || "(no subject)",
      from: msg.from?.emailAddress
        ? `${msg.from.emailAddress.name} <${msg.from.emailAddress.address}>`
        : "",
      to: msg.toRecipients?.[0]?.emailAddress?.address || "",
      date: msg.receivedDateTime,
      snippet: msg.bodyPreview || "",
      unread: !msg.isRead,
      hasAttachment: msg.hasAttachments || false,
      messageCount: 1,
    }));

    const nextLink = data["@odata.nextLink"] || null;
    let nextSkipToken = null;
    if (nextLink) {
      const match = nextLink.match(/\$skiptoken=([^&]+)/);
      if (match) nextSkipToken = decodeURIComponent(match[1]);
    }

    res.json({ threads, nextPageToken: nextSkipToken });
  } catch (err) {
    console.error("Outlook inbox error:", err.message);
    res.status(500).json({ error: err.message });
  }
}
