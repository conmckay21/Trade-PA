// src/components/DraftEmailFromReminder.jsx
//
// Renders a "Draft email to customer" button for reminders that link to
// an annual-service job (related_type='job'). On click, opens a modal
// pre-filled with subject + body templated from the linked job's
// customer name + service type + due date. The tradie enters the
// recipient email and sends.
//
// Renders NOTHING for reminders that aren't job-linked, so it's safe to
// drop next to every reminder in the list unconditionally.
//
// Send pipe mirrors sendEmailViaConnectedAccount in AIAssistant.jsx:
// posts /api/send-invoice-email with a fallback to /api/gmail/send or
// /api/outlook/send if the unified endpoint isn't available.

import { useState, useEffect } from 'react';

async function sendEmailViaPipe({ userId, to, subject, body, db }) {
  const res = await fetch('/api/send-invoice-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, to, subject, body }),
  });
  if (res.ok) return await res.json().catch(() => ({}));

  if (res.status === 404 && db) {
    const { data: conns } = await db
      .from('email_connections')
      .select('provider')
      .eq('user_id', userId)
      .limit(1);
    const provider = conns?.[0]?.provider;
    if (!provider) {
      throw new Error(
        'No email account connected. Go to the Inbox tab to connect Gmail or Outlook first.'
      );
    }
    const endpoint = provider === 'outlook' ? '/api/outlook/send' : '/api/gmail/send';
    const fb = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, to, subject, body }),
    });
    if (!fb.ok) throw new Error(`Email send failed (${fb.status})`);
    return {};
  }

  const txt = await res.text().catch(() => '');
  throw new Error(`Email send failed (${res.status}): ${txt}`);
}

export default function DraftEmailFromReminder({ reminder, user, brand, db }) {
  const [open, setOpen] = useState(false);
  const [jobLoaded, setJobLoaded] = useState(false);
  const [compose, setCompose] = useState({ to: '', subject: '', body: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState(null);

  if (reminder?.related_type !== 'job' || !reminder?.related_id) return null;

  useEffect(() => {
    if (!open || jobLoaded || !db) return;
    (async () => {
      try {
        const { data } = await db
          .from('job_cards')
          .select('customer, type, next_service_date')
          .eq('id', reminder.related_id)
          .maybeSingle();

        const customer = data?.customer || 'there';
        const service = (data?.type || 'service').toLowerCase();
        const dueDate = data?.next_service_date
          ? new Date(data.next_service_date + 'T00:00:00Z').toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              timeZone: 'UTC',
            })
          : 'soon';
        const tradieName =
          brand?.tradingName || user?.user_metadata?.name || 'your tradesperson';

        setCompose((c) => ({
          ...c,
          subject: `Annual ${service} service — booking time`,
          body:
            `Hi ${customer},\n\n` +
            `Hope you're well. Your annual ${service} service is coming up — it's due on ${dueDate}.\n\n` +
            `Let me know when works for you to get it booked in.\n\n` +
            `Thanks,\n${tradieName}`,
        }));
      } catch {
        setCompose((c) => ({
          ...c,
          subject: 'Annual service — booking time',
          body:
            "Hi,\n\nYour annual service is coming up — let me know when works for you to get it booked in.\n\nThanks,\n" +
            (brand?.tradingName || user?.user_metadata?.name || 'your tradesperson'),
        }));
      } finally {
        setJobLoaded(true);
      }
    })();
  }, [open, jobLoaded, reminder.related_id, db, brand, user]);

  const handleSend = async () => {
    if (!compose.to || !compose.subject || !compose.body) return;
    setSending(true);
    setErr(null);
    try {
      await sendEmailViaPipe({
        userId: user.id,
        to: compose.to,
        subject: compose.subject,
        body: compose.body,
        db,
      });
      setSent(true);
      setTimeout(() => {
        setOpen(false);
        setSent(false);
        setJobLoaded(false);
        setCompose({ to: '', subject: '', body: '' });
      }, 1500);
    } catch (e) {
      setErr(e?.message || 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        style={{
          marginTop: 6,
          padding: '6px 10px',
          fontSize: 12,
          fontWeight: 600,
          background: '#f59e0b',
          color: 'white',
          border: 'none',
          borderRadius: 6,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        ✉️ Draft email to customer
      </button>

      {open && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: 16,
          }}
        >
          <div
            style={{
              background: 'white',
              borderRadius: 12,
              maxWidth: 500,
              width: '100%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
            }}
          >
            <div
              style={{
                padding: '14px 18px',
                borderBottom: '1px solid #e5e7eb',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
                Draft email to customer
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 22,
                  cursor: 'pointer',
                  color: '#6b7280',
                  padding: 0,
                  lineHeight: 1,
                }}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div style={{ padding: 18, overflow: 'auto', flex: 1 }}>
              {sent ? (
                <div style={{ textAlign: 'center', padding: '32px 16px' }}>
                  <div style={{ fontSize: 48 }}>✅</div>
                  <div style={{ fontSize: 15, fontWeight: 600, marginTop: 10 }}>
                    Email sent
                  </div>
                </div>
              ) : (
                <>
                  {err && (
                    <div
                      style={{
                        background: '#fef2f2',
                        color: '#991b1b',
                        padding: 10,
                        borderRadius: 6,
                        fontSize: 12,
                        marginBottom: 12,
                      }}
                    >
                      {err}
                    </div>
                  )}
                  <label
                    style={{
                      display: 'block',
                      fontSize: 11,
                      fontWeight: 600,
                      color: '#6b7280',
                      marginBottom: 4,
                    }}
                  >
                    To
                  </label>
                  <input
                    type="email"
                    placeholder="customer@example.com"
                    value={compose.to}
                    onChange={(e) => setCompose((p) => ({ ...p, to: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: 10,
                      fontSize: 14,
                      marginBottom: 12,
                      border: '1px solid #d1d5db',
                      borderRadius: 6,
                      boxSizing: 'border-box',
                    }}
                  />
                  <label
                    style={{
                      display: 'block',
                      fontSize: 11,
                      fontWeight: 600,
                      color: '#6b7280',
                      marginBottom: 4,
                    }}
                  >
                    Subject
                  </label>
                  <input
                    type="text"
                    value={compose.subject}
                    onChange={(e) => setCompose((p) => ({ ...p, subject: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: 10,
                      fontSize: 14,
                      marginBottom: 12,
                      border: '1px solid #d1d5db',
                      borderRadius: 6,
                      boxSizing: 'border-box',
                    }}
                  />
                  <label
                    style={{
                      display: 'block',
                      fontSize: 11,
                      fontWeight: 600,
                      color: '#6b7280',
                      marginBottom: 4,
                    }}
                  >
                    Message
                  </label>
                  <textarea
                    rows={10}
                    value={compose.body}
                    onChange={(e) => setCompose((p) => ({ ...p, body: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: 10,
                      fontSize: 14,
                      border: '1px solid #d1d5db',
                      borderRadius: 6,
                      fontFamily: 'inherit',
                      resize: 'vertical',
                      boxSizing: 'border-box',
                    }}
                  />
                </>
              )}
            </div>

            {!sent && (
              <div
                style={{
                  padding: 14,
                  borderTop: '1px solid #e5e7eb',
                  display: 'flex',
                  gap: 8,
                }}
              >
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={sending}
                  style={{
                    flex: 1,
                    padding: 12,
                    fontSize: 14,
                    fontWeight: 600,
                    background: '#f3f4f6',
                    color: '#374151',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={sending || !compose.to || !compose.subject || !compose.body}
                  style={{
                    flex: 2,
                    padding: 12,
                    fontSize: 14,
                    fontWeight: 600,
                    background: '#f59e0b',
                    color: 'white',
                    border: 'none',
                    borderRadius: 6,
                    cursor: sending ? 'wait' : 'pointer',
                    opacity:
                      !compose.to || !compose.subject || !compose.body ? 0.5 : 1,
                  }}
                >
                  {sending ? 'Sending…' : 'Send →'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
