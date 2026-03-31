import { getValidToken } from "./_token.js";

export default async function handler(req, res) {
  const { userId, pageToken, label = "INBOX" } = req.query;
  if (!userId) return res.status(400).json({ error: "userId required" });

  try {
    const token = await getValidToken(userId);

    const params = new URLSearchParams({ maxResults: "20", labelIds: label });
    if (pageToken) params.set("pageToken", pageToken);

    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads?${params}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const list = await listRes.json();

    if (!list.threads?.length) return res.json({ threads: [], nextPageToken: null });

    const threads = await Promise.all(
      list.threads.map(async (t) => {
        const tRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/threads/${t.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const thread = await tRes.json();
        const msg = thread.messages?.[thread.messages.length - 1];
        const headers = msg?.payload?.headers || [];
        const get = (name) => headers.find((h) => h.name === name)?.value || "";
        return {
          id: t.id,
          messageCount: thread.messages?.length || 1,
          subject: get("Subject") || "(no subject)",
          from: get("From"),
          to: get("To"),
          date: get("Date"),
          snippet: msg?.snippet || "",
          unread: msg?.labelIds?.includes("UNREAD") || false,
          hasAttachment: msg?.payload?.parts?.some((p) => p.filename) || false,
        };
      })
    );

    res.json({ threads, nextPageToken: list.nextPageToken || null });
  } catch (err) {
    console.error("Gmail inbox error:", err.message);
    res.status(500).json({ error: err.message });
  }
}
