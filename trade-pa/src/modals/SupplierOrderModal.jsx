import { useState } from "react";

const C = {
  amber: "#F59E0B",
  black: "#0A0A0A",
  cream: "#F0F0F0",
  border: "#e5e5e5",
  text: "#0A0A0A",
  muted: "#666",
  danger: "#dc2626",
};

const S = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.5)",
    zIndex: 999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modal: {
    background: "white",
    borderRadius: 12,
    maxWidth: 560,
    width: "100%",
    maxHeight: "90vh",
    overflowY: "auto",
    padding: 20,
    boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  title: { fontSize: 18, fontWeight: 700, margin: 0 },
  subtitle: { fontSize: 13, color: C.muted, marginTop: 0, marginBottom: 16 },
  closeBtn: {
    background: "none",
    border: "none",
    fontSize: 24,
    cursor: "pointer",
    color: C.muted,
    padding: 4,
    lineHeight: 1,
  },
  label: {
    display: "block",
    fontSize: 12,
    fontWeight: 700,
    color: C.muted,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid " + C.border,
    borderRadius: 8,
    fontSize: 14,
    fontFamily: "inherit",
    boxSizing: "border-box",
  },
  textarea: {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid " + C.border,
    borderRadius: 8,
    fontSize: 14,
    fontFamily: "inherit",
    boxSizing: "border-box",
    minHeight: 60,
    resize: "vertical",
  },
  toggleRow: { display: "flex", gap: 8, marginBottom: 16 },
  toggleBtn: (active) => ({
    flex: 1,
    padding: "10px 12px",
    border: "1px solid " + (active ? C.amber : C.border),
    borderRadius: 8,
    background: active ? C.amber : "white",
    color: active ? C.black : C.muted,
    fontWeight: active ? 700 : 500,
    cursor: "pointer",
    fontSize: 14,
  }),
  itemRow: {
    display: "grid",
    gridTemplateColumns: "1fr 80px 36px",
    gap: 8,
    marginBottom: 8,
    alignItems: "start",
  },
  itemRemove: {
    background: "none",
    border: "none",
    color: C.danger,
    cursor: "pointer",
    fontSize: 22,
    padding: 6,
    lineHeight: 1,
  },
  addRow: {
    background: "none",
    border: "1px dashed " + C.border,
    color: C.muted,
    padding: "10px 12px",
    borderRadius: 8,
    cursor: "pointer",
    width: "100%",
    fontSize: 14,
    marginBottom: 16,
  },
  field: { marginBottom: 16 },
  buttons: { display: "flex", gap: 8, marginTop: 8 },
  send: (canSend) => ({
    flex: 1,
    padding: "12px 16px",
    border: "none",
    borderRadius: 8,
    background: canSend ? C.amber : "#ddd",
    color: canSend ? C.black : "#888",
    fontWeight: 700,
    fontSize: 15,
    cursor: canSend ? "pointer" : "not-allowed",
  }),
  cancel: {
    padding: "12px 16px",
    border: "1px solid " + C.border,
    borderRadius: 8,
    background: "white",
    color: C.text,
    fontWeight: 600,
    fontSize: 15,
    cursor: "pointer",
  },
  error: {
    padding: 10,
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: C.danger,
    borderRadius: 8,
    fontSize: 14,
    marginBottom: 12,
  },
  success: {
    padding: 10,
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    color: "#15803d",
    borderRadius: 8,
    fontSize: 14,
    marginBottom: 12,
  },
  warning: {
    padding: 10,
    background: "#fffbeb",
    border: "1px solid #fde68a",
    color: "#92400e",
    borderRadius: 8,
    fontSize: 14,
    marginBottom: 12,
  },
};

export default function SupplierOrderModal({ open, supplier, userId, prefillItems, prefillKind, prefillJobRef, onClose, onSent }) {
  const [kind, setKind] = useState(prefillKind || "order");
  const [items, setItems] = useState(
    Array.isArray(prefillItems) && prefillItems.length > 0
      ? prefillItems.map((p) => ({
          item: p.item || "",
          qty: p.qty != null ? p.qty : 1,
          notes: p.notes || "",
        }))
      : [{ item: "", qty: 1, notes: "" }]
  );
  const [notes, setNotes] = useState("");
  const [jobRef, setJobRef] = useState(prefillJobRef || "");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  if (!open || !supplier) return null;

  const hasNoEmail = !supplier.email || !supplier.email.trim();
  const validItems = items.filter((i) => i.item && i.item.trim());
  const canSend = !sending && !hasNoEmail && validItems.length > 0;

  const reset = () => {
    setKind("order");
    setItems([{ item: "", qty: 1, notes: "" }]);
    setNotes("");
    setJobRef("");
    setError("");
    setSending(false);
  };

  const handleClose = () => {
    if (sending) return;
    reset();
    if (onClose) onClose();
  };

  const updateItem = (i, field, value) => {
    const next = items.slice();
    next[i] = Object.assign({}, next[i], { [field]: value });
    setItems(next);
  };

  const addItem = () => {
    setItems(items.concat([{ item: "", qty: 1, notes: "" }]));
  };

  const removeItem = (i) => {
    if (items.length === 1) return;
    setItems(items.filter((_, idx) => idx !== i));
  };

  const handleSend = async () => {
    if (!canSend) return;
    setError("");
    setSending(true);
    try {
      const res = await fetch("/api/suppliers/send-material-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          supplierId: supplier.id,
          items: validItems.map((i) => ({
            item: i.item.trim(),
            qty: Number(i.qty) || 1,
            notes: i.notes ? i.notes.trim() : undefined,
          })),
          kind,
          notes: notes.trim() || undefined,
          jobRef: jobRef.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Send failed");
      }
      reset();
      if (onSent) onSent(data);
      if (onClose) onClose();
    } catch (err) {
      setError(err.message || "Failed to send. Try again.");
      setSending(false);
    }
  };

  return (
    <div style={S.overlay} onClick={handleClose}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>
        <div style={S.header}>
          <h3 style={S.title}>Email {supplier.name}</h3>
          <button style={S.closeBtn} onClick={handleClose}>×</button>
        </div>
        <p style={S.subtitle}>{supplier.email || "No email on file"}</p>

        {hasNoEmail && (
          <div style={S.warning}>
            {supplier.name} has no email on file. Edit the supplier and add an email address first.
          </div>
        )}

        {error && <div style={S.error}>{error}</div>}

        <div style={S.toggleRow}>
          <button style={S.toggleBtn(kind === "order")} onClick={() => setKind("order")}>
            Material order
          </button>
          <button style={S.toggleBtn(kind === "price_request")} onClick={() => setKind("price_request")}>
            Price request
          </button>
        </div>

        <div style={S.field}>
          <label style={S.label}>Items</label>
          {items.map((it, i) => (
            <div key={i} style={S.itemRow}>
              <input
                style={S.input}
                placeholder="e.g. 25mm copper pipe"
                value={it.item}
                onChange={(e) => updateItem(i, "item", e.target.value)}
                disabled={sending}
              />
              <input
                style={S.input}
                type="number"
                min="0"
                step="0.5"
                placeholder="Qty"
                value={it.qty}
                onChange={(e) => updateItem(i, "qty", e.target.value)}
                disabled={sending}
              />
              <button
                style={S.itemRemove}
                onClick={() => removeItem(i)}
                disabled={items.length === 1 || sending}
                title="Remove row"
                aria-label="Remove row"
              >×</button>
            </div>
          ))}
          <button style={S.addRow} onClick={addItem} disabled={sending}>+ Add another item</button>
        </div>

        <div style={S.field}>
          <label style={S.label}>Job ref (optional)</label>
          <input
            style={S.input}
            placeholder="e.g. JOB-2026-014"
            value={jobRef}
            onChange={(e) => setJobRef(e.target.value)}
            disabled={sending}
          />
        </div>

        <div style={S.field}>
          <label style={S.label}>Notes (optional)</label>
          <textarea
            style={S.textarea}
            placeholder="Anything else they need to know"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={sending}
          />
        </div>

        <div style={S.buttons}>
          <button style={S.cancel} onClick={handleClose} disabled={sending}>Cancel</button>
          <button
            style={S.send(canSend)}
            onClick={handleSend}
            disabled={!canSend}
          >
            {sending ? "Sending…" : kind === "order" ? "Send order" : "Send request"}
          </button>
        </div>
      </div>
    </div>
  );
}
