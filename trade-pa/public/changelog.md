# What's new

---

## 2026-04-23

### No email will slip past the scan on a busy morning 🛡
Bit of a quiet fix this one but it matters. If you got a flood of emails in one hour — say you sent a batch of quote follow-ups and replies all came back at once — the old scan could only handle the most recent 8 in an hour and the oldest ones just fell off the back. Not anymore. The scan now bookmarks itself by the arrival time of the newest email it actually processed, so any overflow stays first in the queue for the next tick. The Check Now button works the same way. You might see classifications arrive across two hourly ticks instead of one on a mental busy day, but nothing ever goes missing.

### Old suggestions stop cluttering your Inbox 🧹
Pending suggestions the AI made for you more than a month ago now clear themselves out automatically. If you never got round to approving or dismissing a "book Mrs Patel's tap" suggestion from six weeks back, it was still sitting in your Inbox with out-of-date context — that just stops now. Anything still relevant stays. Anything recent stays. Only genuinely stale stuff quietly disappears.

### We'll spot if your inbox connection breaks 🔌
If you change your Google/Microsoft password or revoke Trade PA's access, your inbox connection stops working and the hourly scan goes quiet. The cron now notices this specifically instead of silently failing every hour, so your connection row gets flagged — ready for the Inbox tab to show a clear "reconnect your inbox" banner when that's wired up on the front end. No more scans failing in the dark.

### Hourly inbox scan now catches reschedules, cancellations, completions, CIS statements and more 📬
Your background hourly scan used to spot six kinds of email (jobs, enquiries, payments, materials, contacts, ignore). It now spots all eleven — same brain the Check Now button uses. So reschedule requests, cancellations, job-completion confirmations, quote acceptances and monthly CIS statements from contractors will all get picked up automatically without you having to tap anything. The scan also reads past dismissals you've made, so if you've told it "that's spam" or "wrong customer" a few times, it learns and stops making the same mistake.

### "Check Now" button is quicker and smarter 📬
The Check Now button in your Inbox tab used to re-read the last 48 hours every single time — even if nothing new had landed. Now it only looks at emails that have actually arrived since the last check (whether that was the hourly auto-scan or the last time you tapped it). If nothing new has come in, the tap finishes instantly with no fuss. If new emails have landed, they get picked up fast. Same Claude smarts behind the scenes, just no pointless re-reading.

### Pricing page "Start free trial" buttons now actually work 🔧
The big amber buttons on the pricing cards weren't taking you anywhere when tapped. Fixed — click any plan's button now and it jumps you straight to signup with that plan pre-selected, same as the other CTAs on the page. Sorry to anyone who bounced off that one.

### New pricing plans 💷
Fairer pricing that matches what you actually use. **Solo £39.99/mo** (100 conversations, 1 hour hands-free), new **Pro Solo £59.99/mo** for busier tradies (300 conversations, 3 hours hands-free), **Team £89/mo** for crews up to 5 (400 conversations, 4 hours hands-free), and **Business £129/mo** for firms up to 10 (800 conversations, 8 hours hands-free). Caps reset on the 1st of every month, same as before.

### New Pro Solo tier for power users ⚡
If you're a sole trader using the app all day every day, Pro Solo gives you 3× the conversations and hands-free time without jumping to a team plan you don't need.

### Team and Business caps now company-wide 🔒
Team and Business plans use one shared pool for the whole company now (400 or 800 conversations respectively), which is fair to everyone paying the right price for their crew size.

### Behind the scenes: usage tracking 📊
We're now quietly tracking which tools are used most, voice session lengths, and payment events. This means the next round of product improvements will be driven by real usage data, not guesswork. Nothing visible changes for you — this is an engine room upgrade.

### Updated Terms and Privacy Policy 📝
We've refreshed our Terms of Service and Privacy Policy to reflect the new pricing plans and to clearly explain the usage tracking. Nothing sneaky — just honest and up to date. You can read them any time at [tradespa.co.uk/terms.html](https://www.tradespa.co.uk/terms.html) and [tradespa.co.uk/privacy-policy.html](https://www.tradespa.co.uk/privacy-policy.html).

### Know when customers open your quotes and invoices 👀
Every time a customer opens one of your portal links — quotes or invoices — you'll get a push notification AND a new entry in the bell icon in the app. No more guessing if they've seen it. You'll even see if they open it multiple times ("they've looked four times today, they're thinking about it"). Your own previews never trigger the notification — the app remembers it's you.

### New Notifications view 🔔
Tap the bell icon in the top-right to see a proper feed of recent alerts — customer views, payments, accepted quotes and more. Unread notifications show with an amber dot; tap to mark as read and jump straight to the relevant invoice or quote. Running total in the badge so you never miss anything.

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
