// ─── Receipt storage helpers ────────────────────────────────────────────────
// Receipts moved from browser localStorage / DB-column-as-blob to Supabase
// Storage bucket `receipts` (27 Apr 2026, forensic audit Finding 1.1).
//
// Why: localStorage is per-device — scan a receipt on your phone, it's
// invisible on your desktop. DB-column-as-blob bloats the DB and triggers
// Supabase Free-tier ceiling at ~100 users × 50 receipts. Storage scales
// independently and gives signed URLs for cross-device viewing.
//
// Path convention: receipts/{userId}/{receiptId}.{ext}
// RLS policies ensure each user can only read/write their own folder.
//
// Functions:
//   uploadReceiptToStorage(file, userId, receiptId) — upload + return path
//   getReceiptViewUrl(material) — signed-URL preferred, falls back to legacy

import { db } from "./db.js";

export async function uploadReceiptToStorage(file, userId, receiptId) {
  if (!file || !userId || !receiptId) return null;
  const ext = (file.name || "").split(".").pop()?.toLowerCase() ||
    (file.type === "application/pdf" ? "pdf" : "jpg");
  const path = `${userId}/${receiptId}.${ext}`;
  try {
    const { error } = await db.storage
      .from("receipts")
      .upload(path, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
    if (error) {
      console.warn("[receipts] upload failed:", error.message);
      return null;
    }
    return path;
  } catch (err) {
    console.warn("[receipts] upload threw:", err.message);
    return null;
  }
}

// Generate a temporary (1 hour) signed URL for viewing a stored receipt.
// Returns null on failure — callers should fall back to legacy paths.
export async function getSignedReceiptUrl(storagePath) {
  if (!storagePath) return null;
  try {
    const { data, error } = await db.storage
      .from("receipts")
      .createSignedUrl(storagePath, 3600);
    if (error || !data?.signedUrl) {
      console.warn("[receipts] signed URL failed:", error?.message);
      return null;
    }
    return data.signedUrl;
  } catch (err) {
    console.warn("[receipts] signed URL threw:", err.message);
    return null;
  }
}

// Resolve a material's receipt to a viewable URL, in priority order:
//   1. Storage path (preferred — cross-device, durable)
//   2. In-memory receiptImage dataURL (camelCase, post-scan in-session)
//   3. localStorage cache (legacy per-device backup)
//   4. DB receipt_image (legacy column, 1 row in production)
// Returns null if nothing usable found.
export async function getReceiptViewUrl(material) {
  if (!material) return null;
  const path = material.receiptStoragePath || material.receipt_storage_path;
  if (path) {
    const signed = await getSignedReceiptUrl(path);
    if (signed) return signed;
    // Storage failed — fall through to legacy paths
  }
  if (material.receiptImage) return material.receiptImage;
  if (material.receiptId) {
    try {
      const cached = localStorage.getItem(`trade-pa-receipt-${material.receiptId}`);
      if (cached) return cached;
    } catch {}
  }
  if (material.receipt_image) return material.receipt_image; // legacy DB column
  return null;
}
