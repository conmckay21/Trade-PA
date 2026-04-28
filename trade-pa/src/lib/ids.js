// ─── ID generators + exempt-account check ──────────────────────────────────
// Portal tokens, UUIDs for enquiries, sequential invoice/quote IDs.
// isExemptAccount uses EXEMPT_EMAILS from constants.js.

import { EXEMPT_EMAILS } from "./constants.js";

// ─── Portal token generator ─────────────────────────────────────────────────
// 24 random bytes, base-36 encoded → 24-character alphanumeric string that
// maps to /quote/<token> (works for both quotes AND invoices; the portal page
// reads is_quote on the record to decide whether to show accept/decline or
// Pay Now). Keep in sync with /api/portal.js token validation regex.
export function generatePortalToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map(b => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");
}

// Generate a proper UUID for enquiry IDs (and any other client-generated id
// that needs to match a Postgres uuid column). crypto.randomUUID() is the
// clean modern path; fall back to a manual v4-shape build using
// getRandomValues for older browsers that don't have randomUUID yet.
//
// Why this matters: the setEnquiries wrapper used to wipe-and-reinsert the
// whole enquiries table on every write, which hid the fact that in-memory
// enquiries had inconsistent id types (missing, Date.now() numbers, or
// uuids depending on entry path). With per-row upsert, IDs must match the
// uuid column type — so every creation path now generates one up front.
export function newEnquiryId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

// Sequential invoice/quote ID generators
export function nextInvoiceId(invoices) {
  const existing = (invoices || [])
    .filter(i => !i.isQuote)
    .map(i => parseInt((i.id || "").replace(/\D/g, ""), 10))
    .filter(n => !isNaN(n));
  const max = existing.length > 0 ? Math.max(...existing) : 0;
  return `INV-${String(max + 1).padStart(3, "0")}`;
}

export function nextQuoteId(invoices) {
  const existing = (invoices || [])
    .filter(i => i.isQuote)
    .map(i => parseInt((i.id || "").replace(/\D/g, ""), 10))
    .filter(n => !isNaN(n));
  const max = existing.length > 0 ? Math.max(...existing) : 0;
  return `QTE-${String(max + 1).padStart(3, "0")}`;
}

export function isExemptAccount(email) {
  return EXEMPT_EMAILS.includes((email || "").toLowerCase());
}
