import { getValidOutlookToken } from "./_token.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { userId, to, subject, body, attachmentBase64, attachmentName, replyToId } = req.body;
  if (!userId || !to || !subject || !body) {
    return res.status(400).json({ error: "userId, to, subject, body required" });
  }

  try {
    const token = await getValidOutlookToken(userId);

    const message = {
      subject,
      body: { contentType: "HTML", content: body },
      toRecipients: [{ emailAddress: { address: to } }],
    };

    if (attachmentBase64) {
      message.attachments = [{
        "@odata.type": "#microsoft.graph.fileAttachment",
        name: attachmentName || "invoice.pdf",
        contentType: "application/pdf",
        contentBytes: attachmentBase64,
      }];
    }

    let url, payload;
    if (replyToId) {
      url = `https://graph.microsoft.com/v1.0/me/messages/${replyToId}/reply`;
      payload = { message, comment: "" };
    } else {
      url = "https://graph.microsoft.com/v1.0/me/sendMail";
      payload = { message, saveToSentItems: true };
    }

    const sendRes = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!sendRes.ok) {
      const err = await sendRes.json();
      throw new Error(err.error?.message || "Send failed");
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Outlook send error:", err.message);
    res.status(500).json({ error: err.message });
  }
}
