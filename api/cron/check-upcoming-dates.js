// /api/cron/check-upcoming-dates.js
//
// Daily cron at 08:00 UTC (~09:00 UK). Scans three source tables for items
// hitting the 30-day or 7-day window and JIT-creates a reminder row. The
// existing reminders cron (process-reminders, every 2 min) then handles
// the push notification. Reminders only appear in the user's list when
// they're actually due to be actioned, keeping the Reminders view clean.
//
// Sources scanned:
//   1. job_cards (annual_service=true) - next_service_date
//   2. compliance_docs                  - expiry_date
//   3. worker_documents                 - expiry_date
//
// Dedup via last_warning_at + last_warning_days columns on each source row.
// If the underlying date is moved further out (>30 days remaining), dedup
// state resets so future thresholds fire correctly.

import { createClient } from '@supabase/supabase-js';
import { withSentry, captureNonFatal } from '../lib/sentry.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const THRESHOLD_HEADSUP = 30;
const THRESHOLD_URGENT = 7;

function todayUK() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
}

function daysFromTodayUK(dateStr) {
  if (!dateStr) return null;
  const today = new Date(todayUK() + 'T00:00:00Z');
  const target = new Date(dateStr + 'T00:00:00Z');
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

function formatUKDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00Z');
  return d.toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
}

function pickThreshold(days) {
  if (days < 0) return null;
  if (days <= THRESHOLD_URGENT) return THRESHOLD_URGENT;
  if (days <= THRESHOLD_HEADSUP) return THRESHOLD_HEADSUP;
  return null;
}

async function processSource({
  tableName,
  relatedType,
  dateField,
  selectCols,
  extraFilter,
  buildReminderText,
}) {
  const today = todayUK();
  const stats = { scanned: 0, fired: 0, reset: 0, errors: [] };

  let query = supabase
    .from(tableName)
    .select(selectCols)
    .is('deleted_at', null)
    .not(dateField, 'is', null)
    .gte(dateField, today);

  if (extraFilter) query = extraFilter(query);

  const { data: rows, error } = await query;
  if (error) throw error;
  stats.scanned = rows?.length || 0;

  for (const row of rows || []) {
    const days = daysFromTodayUK(row[dateField]);
    if (days === null) continue;

    // Date moved further out: reset dedup so future thresholds fire
    if (days > THRESHOLD_HEADSUP && row.last_warning_days !== null) {
      await supabase
        .from(tableName)
        .update({ last_warning_at: null, last_warning_days: null })
        .eq('id', row.id);
      stats.reset++;
      continue;
    }

    const threshold = pickThreshold(days);
    if (!threshold) continue;

    // Already fired at this threshold (or a more urgent one)?
    if (row.last_warning_days !== null && row.last_warning_days <= threshold) {
      continue;
    }

    const text = buildReminderText(row, days, threshold);

    const { error: insErr } = await supabase.from('reminders').insert({
      user_id: row.user_id,
      text,
      fire_at: new Date().toISOString(),
      related_type: relatedType,
      related_id: String(row.id),
      done: false,
      fired: false,
    });

    if (insErr) {
      stats.errors.push(tableName + ' ' + row.id + ': ' + insErr.message);
      continue;
    }

    await supabase
      .from(tableName)
      .update({ last_warning_at: today, last_warning_days: threshold })
      .eq('id', row.id);

    stats.fired++;
  }

  return stats;
}

async function handler(req, res) {
  const auth = req.headers.authorization;
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const result = {
    ok: true,
    timestamp: new Date().toISOString(),
    today_uk: todayUK(),
  };

  // 1. Annual jobs
  try {
    result.annual_jobs = await processSource({
      tableName: 'job_cards',
      relatedType: 'job',
      dateField: 'next_service_date',
      selectCols:
        'id, user_id, customer, type, next_service_date, last_warning_at, last_warning_days',
      extraFilter: (q) => q.eq('annual_service', true),
      buildReminderText: (row, days, threshold) => {
        const dateStr = formatUKDate(row.next_service_date);
        const svc = (row.type || 'service').toLowerCase();
        const cust = row.customer || 'customer';
        if (threshold === THRESHOLD_URGENT) {
          return `URGENT: ${svc} service for ${cust} due in ${days} day${days === 1 ? '' : 's'} (${dateStr})`;
        }
        return `Contact ${cust} — annual ${svc} service due ${dateStr}`;
      },
    });
  } catch (e) {
    captureNonFatal(e, { tag: 'check-upcoming-dates:annual_jobs' });
    result.annual_jobs = { error: e.message };
  }

  // 2. Compliance docs
  try {
    result.compliance_docs = await processSource({
      tableName: 'compliance_docs',
      relatedType: 'compliance_doc',
      dateField: 'expiry_date',
      selectCols:
        'id, user_id, doc_type, doc_number, expiry_date, last_warning_at, last_warning_days',
      buildReminderText: (row, days, threshold) => {
        const dateStr = formatUKDate(row.expiry_date);
        const doc = row.doc_type || 'document';
        if (threshold === THRESHOLD_URGENT) {
          return `URGENT: ${doc} expires in ${days} day${days === 1 ? '' : 's'} (${dateStr})`;
        }
        return `Renew ${doc} — expires ${dateStr}`;
      },
    });
  } catch (e) {
    captureNonFatal(e, { tag: 'check-upcoming-dates:compliance_docs' });
    result.compliance_docs = { error: e.message };
  }

  // 3. Worker documents
  try {
    result.worker_docs = await processSource({
      tableName: 'worker_documents',
      relatedType: 'worker_document',
      dateField: 'expiry_date',
      selectCols:
        'id, user_id, doc_type, doc_number, expiry_date, last_warning_at, last_warning_days',
      buildReminderText: (row, days, threshold) => {
        const dateStr = formatUKDate(row.expiry_date);
        const doc = row.doc_type || 'document';
        if (threshold === THRESHOLD_URGENT) {
          return `URGENT: Team member's ${doc} expires in ${days} day${days === 1 ? '' : 's'} (${dateStr})`;
        }
        return `Team member's ${doc} expires ${dateStr}`;
      },
    });
  } catch (e) {
    captureNonFatal(e, { tag: 'check-upcoming-dates:worker_docs' });
    result.worker_docs = { error: e.message };
  }

  // 4. Quote follow-ups (chase unanswered quotes at day 3 and day 7)
  try {
    const today = todayUK();
    const stats = { scanned: 0, fired: 0, errors: [] };

    const cutoffMs = Date.now() - 3 * 24 * 60 * 60 * 1000;
    const { data: quotes, error } = await supabase
      .from('invoices')
      .select(
        'id, user_id, customer, amount, created_at, status, portal_responded_at, last_followup_at, last_followup_days'
      )
      .eq('is_quote', true)
      .is('deleted_at', null)
      .is('portal_responded_at', null)
      .eq('status', 'sent')
      .lte('created_at', new Date(cutoffMs).toISOString());

    if (error) throw error;
    stats.scanned = quotes?.length || 0;

    for (const quote of quotes || []) {
      const created = new Date(quote.created_at);
      const ukToday = new Date(today + 'T00:00:00Z');
      const daysSince = Math.floor((ukToday - created) / (1000 * 60 * 60 * 24));

      let threshold = null;
      let reminderText = null;
      const amt =
        quote.amount != null
          ? `£${Number(quote.amount).toLocaleString('en-GB', { maximumFractionDigits: 2 })}`
          : '';
      const cust = quote.customer || 'customer';

      if (daysSince >= 7 && quote.last_followup_days !== 7) {
        threshold = 7;
        reminderText = `URGENT: Chase ${cust} — quote sent ${daysSince} days ago, still no response${amt ? ' (' + amt + ')' : ''}`;
      } else if (
        daysSince >= 3 &&
        (quote.last_followup_days === null || quote.last_followup_days < 3)
      ) {
        threshold = 3;
        reminderText = `Follow up with ${cust} — quote sent ${daysSince} days ago, no response yet${amt ? ' (' + amt + ')' : ''}`;
      }

      if (threshold) {
        const { error: insErr } = await supabase.from('reminders').insert({
          user_id: quote.user_id,
          text: reminderText,
          fire_at: new Date().toISOString(),
          related_type: 'quote',
          related_id: String(quote.id),
          done: false,
          fired: false,
        });

        if (insErr) {
          stats.errors.push('invoices ' + quote.id + ': ' + insErr.message);
          continue;
        }

        await supabase
          .from('invoices')
          .update({ last_followup_at: today, last_followup_days: threshold })
          .eq('id', quote.id);

        stats.fired++;
      }
    }

    result.quote_followups = stats;
  } catch (e) {
    captureNonFatal(e, { tag: 'check-upcoming-dates:quote_followups' });
    result.quote_followups = { error: e.message };
  }

  return res.status(200).json(result);
}

export default withSentry(handler);
