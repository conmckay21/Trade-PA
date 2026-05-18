# DraftEmailFromReminder — wiring guide

The component is self-contained: button + modal + send pipe all live in
`DraftEmailFromReminder.jsx`. To activate it, two small changes in
`trade-pa/src/App.jsx`.

## 1. Add the import (near the other component imports at top of App.jsx)

```jsx
import DraftEmailFromReminder from './components/DraftEmailFromReminder';
```

## 2. Render it next to each reminder in the list

Find where reminders are rendered. Quick grep:

```bash
grep -n "useReminders" ~/Trade-PA/trade-pa/src/App.jsx
```

That'll show the destructure line (probably something like
`const { reminders, ... } = useReminders(...)`). From there, find the
`.map()` call that renders each reminder row. Inside the row, add:

```jsx
<DraftEmailFromReminder
  reminder={r}
  user={user}
  brand={brand}
  db={supabase}
/>
```

Substitute `r`, `user`, `brand`, `supabase` with whatever variable names
exist in scope. The component renders nothing unless
`reminder.related_type === 'job'`, so it's safe to drop on every reminder.

## Props
- **reminder** — reminder object (needs `related_type` and `related_id`)
- **user** — auth user (needs `user.id`)
- **brand** — business info (uses `brand.tradingName` for the signature)
- **db** — Supabase client instance (used to look up the linked job)

## What happens at runtime
1. Tradie sees a reminder like *"Contact John Smith — annual boiler service due 18 May 2027"* in their Reminders list.
2. The **Draft email to customer** button appears underneath it (only because `related_type='job'`).
3. Tap → modal opens, fetches the linked job from `job_cards`, pre-fills:
   - Subject: *"Annual boiler service — booking time"*
   - Body: friendly template with customer name + due date + signature.
4. Tradie types/pastes the recipient email, edits anything, taps Send.
5. POST to `/api/send-invoice-email` (same pipe AIAssistant.jsx uses for invoices/quotes/review requests).
6. On success: green checkmark for 1.5s, modal closes.

## Out of scope (deferred)
- Auto-resolving customer email from the `customers` table by fuzzy-matching `job_cards.customer` (free-text, brittle).
- SMS variant (the original Q3 mentioned email/SMS; this ships email only — Twilio SMS plumbing is a separate job).
- Mark the reminder Done after sending (tradie taps the existing Done button as normal).
