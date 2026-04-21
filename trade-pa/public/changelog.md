# What's new

---

## 2026-04-21

### Get paid by card 💳
Customers can now pay your quotes and invoices by card direct from your portal link. Money goes straight to your Stripe account — we don't take a cut.

### Card Payments settings
New Stripe tile in Settings → Integrations. One tap to connect, one tap to disconnect.

### Disconnect buttons everywhere
Xero, QuickBooks and Stripe all have clear Disconnect buttons now. Change your mind? No problem.

### Updates reach you faster ✨
Deployed a new version? You'll see a friendly banner within a minute (we now poll for new versions properly — the previous banner setup never fired). Tap Reload and you're on the latest.

### Pay link now on invoices too 💷
Every invoice now has its own "Pay Online" link — not just quotes. Share it with customers and they can view the invoice and pay by card (or see your bank details) without signing up. Auto-included as a button in your invoice emails too.

### Cleaner quote portal 🧾
The customer's quote page no longer shows card payment buttons or bank details — those only appear on the invoice after you've converted it. Quotes now show a simple "Payment terms" note so customers know what they're signing up for, without any way to accidentally pay before accepting. No more confused customers tapping Pay instead of Accept.

### Bottom bar matches your theme 🎨
The navigation bar at the bottom now follows your theme — frosted white in light mode, dark in dark mode. Less jarring, more native, easier on the eyes.

### "What's new" matches your theme too 🎨
Same fix for the What's new modal — light in light mode, dark in dark mode, instead of always-dark.

### No more zoom-on-tap 📵
Tapping any text box no longer zooms the screen in (an iOS Safari "feature" we've finally throttled). Forms now stay where they are when you're typing — way less infuriating.

### Big numbers fit on big jobs 💷
The Total Cost card on Materials now shrinks the figure font when you've got a really chunky total, so figures up to £9,999,999.99 still fit cleanly without wrapping or being cut off.

### Chase emails now escalate properly 📈
Previously every chase email got sent as "friendly reminder #1" — the counter reset every time the app reloaded. Now chase count is saved properly, so you get gentle reminder → second reminder → final notice in the right order, no matter how many times you sign out or reload.

### Pay link in every outgoing email 🔗
Every email you send now has a "View Online" button and a plain-text link — whether it's the initial invoice, a quote, or a payment chase. Button works in most email apps; the plain link is there for forwarding, printing, or older mail clients that mangle buttons. Chase emails now include the link too, so your customers can pay straight from the reminder. Locked down so it stays readable in dark-mode email clients (iOS Mail, Outlook, etc.) — no more invisible header or button.

### Converted quotes stick around 🧷
Turning an accepted quote into an invoice now saves the invoice properly — so the Pay Online link works, and the invoice shows up everywhere it should. Your quote stays in the Quotes tab marked Accepted, so you can see your win rate and keep the history. (Before, converted invoices lived in memory only and disappeared on reload.)

### Pick your AI's voice 🎙
Settings → AI Assistant → Manage assistant now has 5 voices to choose from: Eve (upbeat), Ara (warm), Leo (steady), Rex (confident), Sal (neutral). Tap Preview to hear each before you pick.

### "What's new" changelog
Tap Settings → Help → What's new ✨ any time to see the latest updates, like this one.

### First-message voice fix
Fixed a bug where the AI's first reply after tapping the mic was silent on the app. First-time users got confused — the reply was generating, it just wasn't playing. Sorted.

### Faster, more reliable
App now reloads properly after updates (no more stale screens), and the AI's exit phrases like "that's absolutely everything, thank you" now end hands-free mode cleanly.

---

## 2026-04-20

### Customer portal + shareable quote links
Every quote now gets its own shareable link. Customers view, accept or decline without signing up — and you get a push notification when they respond.

### Portal subdomain
Your portal links now live at view.tradespa.co.uk instead of the main domain. Cleaner for customers, safer for you.

### Quote expiry tracking
Quotes now show how long until they expire (or how long ago they did). Extend with a single tap.

---

## 2026-04-19

### Tax-year reports 📊
"Tax Year 25/26" and "Tax Year 26/27" are now one-tap presets on your reports page. UK tax year dates baked in.

### CSV export for everything
Every report type now has a "⬇ CSV" button. Opens cleanly in Excel, numbers unformatted so you can sum them.

### Calendar subscription
Subscribe to your jobs from Apple Calendar, Google Calendar, Outlook, anywhere. Settings → Notifications → Calendar Subscription.

### Workers tab
Faster access to your team from the main nav.

---

## 2026-04-15

### Voice state indicators
Your AI Assistant now shows clearly what it's doing — listening, transcribing, thinking, speaking. No more wondering if it heard you.

### Voice goes faster
Switched to Grok voice processing for faster, more natural replies. Fallback to Deepgram and Whisper kicks in automatically if anything wobbles.

### Streaming replies
AI responses now stream in as they're generated rather than appearing all at once. Feels snappier.

---

## 2026-04-10

### Email templates
Welcome, trial-ending and payment-failed emails now come from proper addresses (hello@, billing@) with your branding. Supabase auth emails too.

### Error tracking
When something goes wrong, we'll know about it now — and fix it faster.

### Reminders via email
Job reminders now come as branded emails with Mark Done / Snooze / Open App buttons right in the email.
