import { getValidOutlookToken } from "./_token.js";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.VITE_ANTHROPIC_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { userId, messageId, attachmentId } = req.body;
  if (!userId || !messageId || !attachmentId) {
    return res.status(400).json({ error: "userId, messageId, attachmentId required" });
  }

  try {
    const token = await getValidOutlookToken(userId);

    const attRes = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages/${messageId}/attachments/${attachmentId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const att = await attRes.json();
    if (att.error) throw new Error(att.error.message);

    const pdfBase64 = att.contentBytes;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: pdfBase64 },
            },
            {
              type: "text",
              text: `This is a supplier invoice. Extract all line items and return ONLY a JSON array, no other text, no markdown.
Format: [{"item": "item name", "qty": number, "unit": "each/m/box/etc", "unitPrice": number, "total": number}]
If quantity or price is unclear, use 1 and 0. Extract every product/material line item you can find.`,
            },
          ],
        },
      ],
    });

    const text = response.content[0]?.text?.trim() || "[]";
    let items = [];
    try {
      items = JSON.parse(text.replace(/```json|```/g, "").trim());
    } catch {
      items = [];
    }

    res.json({ success: true, items });
  } catch (err) {
    console.error("Outlook supplier parser error:", err.message);
    res.status(500).json({ error: err.message });
  }
}
