# What's new

---

## 2026-04-24

### Top-up add-ons resized for the new plans 🔋

The mid-month add-ons have been resized to make sense alongside the smaller per-tier caps. Previously a top-up gave you +500 conversations or +10 hours hands-free for £39/£19 — sized for plans that don't exist anymore. The new top-ups: **+100 conversations for £25**, **+1 hour hands-free for £5**, or a **combo (+100 conv + 1 hour hands-free) for £28** (saves you £2). Same one-off model — you're charged on your saved card, the extra capacity is live within seconds and expires at your next billing rollover. If you regularly need extra, upgrading a tier is still the cheaper route long-term.

### Pricing page rebuilt 💷

The pricing page (tradespa.co.uk/pricing) now matches the actual product. We replaced the three old tiers (Solo £49 / Team £89 / Pro £129 with annual options) with the four real tiers — Solo £39, Pro Solo £59, Team £89, Business £129 — all monthly only, no annual lock-in. Conversation and hands-free caps on each card now match what the app actually allows. The Help Centre articles for plans, monthly limits and free trial have been refreshed to match. Annual plans, the Founding Member offer, and any references to "Pro" as a 10-user tier have all been retired. If you'd been confused by the page saying one thing and the app doing another — that's resolved.

### Founding Member offer retired 👋

We're retiring the Founding Member programme — the £39/mo Solo price that was originally locked in for the first 100 sign-ups is now just the standard Solo price for everyone. Removed the banner, the help article and the slot counter from the pricing page. Existing customers (none yet) wouldn't be affected; this is a forward-looking simplification so the pricing page tells one clean story instead of two.

### Pro Solo plan: cleaner capacity step-up 🎯

Tightened the Pro Solo conversation cap to 200/month (was 300). Pro Solo now sits as a clean 2× capacity bump from Solo, giving you a logical ladder: 100 (Solo) → 200 (Pro Solo) → 400 (Team) → 800 (Business). If you're a heavy user who was comfortably running on 300, this is the moment to think about whether Team makes sense — you get extra capacity AND up to 5 user seats for £30 more.

### Smarter AI routing: faster for simple stuff, full power for complex 🎯

The AI assistant now uses two brains instead of one. Simple commands like "log 20 miles to Patel" or "show me my unpaid invoices" get routed to a faster, cheaper AI model (Claude Haiku 4.5). Complex requests that need careful thinking — multi-action batches, "chase the biggest overdue invoice", disambiguation when two customers share a name, mid-RAMS flow — still go to the most capable model (Claude Sonnet 4.6). The routing happens instantly in the background with zero extra wait time (it's a pattern match, not another AI call). You shouldn't notice any difference in quality for the hard stuff, and simple stuff might even feel snappier. A handful of other internal AI tasks — voice-to-form field filling, reminder time parsing, RAMS hazard suggestions — also moved to the faster model since they don't need the heavy lifter. These are small changes individually but together they materially change the economics at scale.

### Ran out of turns? Now you'll know 🕐

If the assistant ever hits its internal processing limit midway through a big request, it now tells you directly instead of failing silently. You'll see a clear message saying "Hit my processing limit partway through — check what landed and let me know what to retry."

### Delete confirmations are now harder to fool 🔐

Fixed a real edge case: if you had multiple invoices for the same customer (say three Smith invoices) and asked to delete "the Smith invoice", the assistant used to silently delete the first match. It now lists the candidates and asks which one. Same for deleting jobs, customers, and enquiries. Also strengthened the voice-safety wording: if a delete is mixed in with other actions, the confirmation question is now phrased so that "yes" can't accidentally confirm the wrong thing.

### Workers and subcontractors now read from a unified table 📚

Internal plumbing: every place the app looks up workers or subbies now reads from a new unified `team_members` table instead of the two separate legacy tables. No visible change — same lists, same data, same UI. This is step 2 of 4 toward simplifying how people are tracked (the old tables stay in place for now and are still being written to in parallel, so nothing breaks). Voice tests over the coming week will confirm everything's working, then steps 3 and 4 will retire the old tables.

### Multi-action fixes: the assistant's better at juggling now 🤹

When you rattle off several things at once — "invoice Smith £900, log 4 hours on Wilson, and remind me to chase Thompson" — the assistant was already pretty good at handling that, but there were some edge cases that needed tightening. Fixed a genuine bug where creating a new customer and invoicing them in the same breath meant the invoice couldn't find the customer's address (React state hadn't caught up yet — now it does, through a within-turn tracker). Raised the internal "how many rounds of tool-calling" limit from 5 to 8 so big batches don't get silently cut off mid-way. Added a batch of prompt rules covering: what to do when one action in a batch is ambiguous (do the clear ones first, ask about the ambiguous one), how to phrase delete confirmations when they're mixed with other actions (so "yes" can't be misread), how to handle a closing phrase that's fused with actions ("...thanks, that's everything"), how to link a mileage second-leg properly, and when NOT to claim "the biggest" or "the oldest" without checking.

### Voice assistant: big tune-up across 93 tools 🎙️

Did a proper sweep of every voice command the app understands. Found and fixed four real bugs: the "add a job for Patel" case (where it was asking for a date you never mentioned), empty-payload calls to send/chase invoice (which were silently failing), a conflicting default on "what's expiring" (30 days vs 60 days — now 30), and a contradiction in the mileage command that made it oscillate between "just log it" and asking questions. Beyond those: every voice command now has a proper confirmation template so you hear a consistent "done — here's what I did" at the end of each action. Added smarter disambiguation rules where two things could match (stock "used" vs "received", multiple invoices for the same customer, RAMS step transitions). Tightened guardrails so the AI can't fabricate IDs or log zero-value payments. Full audit report lives at `docs/ai-audit/2026-04-24-voice-tools-audit.md` for anyone who wants to see what was flagged and what changed.

### Smarter reminder linking 🧠

Small tweak to how the assistant decides whether to link a reminder to a specific job, invoice, customer or enquiry. Clearer rules on which signals mean what ("chase X" is almost always an invoice, "call X" is almost always a customer, etc.) and explicit guidance on what to do when the same name matches two things — it'll now ask rather than guess. You should see more reminder emails come through with the full context block attached, rather than falling back to plain text.

### Quiet groundwork: unified workers + subs table 🏗️

Behind-the-scenes only — no user-visible change. Started consolidating the two separate lists (Workers and Subcontractors) that overlap heavily in practice, into a single underlying table. Today's step: created the new table, copied existing records into it, and wired every add/edit/delete to keep it in sync automatically. The old lists and UI work exactly as before. Over the next couple of sessions we'll migrate the reads over so you eventually see one unified list with a clear employed/self-employed filter instead of two lists you have to flip between.

### Reminder emails now show context 📧

Previously, reminder emails just showed the reminder text and three buttons — Mark Done, Snooze, Open App. Useful, but often you'd still need to open the app to figure out what the reminder was even about. Now when a reminder is about something specific — a particular invoice, job, customer, or enquiry — the email shows the relevant details inline. So a "chase the Patel invoice at 2pm" reminder email now shows the amount, the status (paid/sent/overdue), and the due date. A "call Steve tomorrow" reminder shows Steve's phone and email. A "follow up on the Miller kitchen job next week" shows the customer, address, job value, and current status. The status is live at send-time, so if the customer already paid the invoice, the email shows "Paid" and you can stop worrying. Reminders that aren't about anything specific (buy milk, MOT the van) look exactly as they did before — no change.

Small related tidy: every transactional email now carries Trade PA Ltd's registered company name and Companies House number in the footer, as required under s.82 of the Companies Act.

### Enquiries stay put 🗂️

Subtle but serious fix. Every time an enquiry was added, edited, deleted, or status-changed, the whole enquiries table was being wiped and re-inserted behind the scenes — which meant every enquiry got a brand new database ID on every change. That was silent up until now but would've broken anything relying on stable enquiry IDs (reminders linked to a specific enquiry, deep links from push notifications, and so on). There was also a duplicate-insert bug in the inbox-to-enquiry flow that could create two records for the same email. Both fixed now with a proper per-row sync pattern. Existing enquiries are unaffected — they kept their most recent IDs. Nothing to do on your side.

### Server-side errors now surface to Sentry 🚨

Until now, errors happening server-side — failed reminder emails, broken Stripe webhooks, transcription cascades that all fail — went completely unnoticed unless a tradie complained. Sentry on the frontend was already catching browser errors, but the API routes were dark. Now wrapped with shared error capture across **every single API route** (52 of them — voice pipeline, Stripe webhooks, cron jobs, invoice emails, push notifications, Twilio call handlers, Xero/QuickBooks sync, OAuth callbacks, the lot). Anything that throws server-side now lands in Sentry within seconds with the route name, the user (where identifiable), and the full stack. Means future flaky behaviour gets diagnosed in minutes instead of "hmm, did anyone else hit that?".

(One step on Connor's side to fully activate — see internal ops doc.)

### Two small dedup fixes 🛠️

**Cross-list duplicate catching now sees archived people too.** When you try to add the same person to both your workers and subcontractors lists, the warning we shipped yesterday only checked active records. So if you'd archived someone in one list and tried to add them to the other, it slipped through. Now caught — with a clear message saying they're archived and explaining how to restore.

**Enquiry deletes are slightly more robust.** Tightened the comment on the enquiry-delete code path with a note about a deeper data-handling pattern that needs cleaning up in a future session — doesn't change behaviour today, just makes the intent obvious for anyone reading the code later.

### Stage payments now show up on the job card 💰

Yesterday's fix made stage payment invoices actually save to the database — but the only place to *see* them was the Invoices tab. Now they show up right on the job card itself, in the Profit tab, with the live status of each one. Set up a 30/40/30 split, the three stages appear as their own section showing the amount, the invoice number, and whether each is still a draft, sent, or paid. Quick visual at a glance: "1/3 paid". Tap any stage to jump to Invoices.

### Refresh button up top 🔄

A proper refresh icon next to the bell. Tap it and the app re-fetches your jobs, invoices, enquiries, materials, customers and notifications — without losing your place, kicking you out of any modal, or wiping the AI conversation. The icon spins while it's working. Should mean one less reason to close-and-reopen the app.

### Bell badge counts what the bell actually shows

Pre-existing quirk: the bell icon was counting overdue reminders + notifications + future reminders, but the panel it opened only showed notifications. So you'd clear all your notifications and the badge would still say "2" because it was secretly counting reminders that you'd never see in that panel. Now the badge counts only what the panel surfaces (overdue items + unread notifications), and tapping a red badge takes you straight to Reminders if that's what's actually urgent. Future reminders no longer add to the badge — those still surface via emails, browser push, and the Reminders view's own badge.

---

## 2026-04-23

### A handful of quiet fixes from the forensic audit 🔧

A few things that were silently misbehaving and are now sorted:

**Failed saves no longer vanish in silence.** If saving a daywork sheet or a compliance certificate ever hit a database error — bad network, odd characters, whatever — the previous code just quietly dropped it and the form closed like it worked. Now you get a clear message telling you what went wrong, so you know to retry instead of finding a missing record two weeks later.

**Mark Done / Snooze on reminder emails now reliably work.** Background change: every reminder you set by voice now carries its proper database ID from the moment it's created. Before, there was a brief gap where the in-app reminder and the database copy had different IDs — which in rare cases meant tapping Mark Done from the reminder email didn't line up with the in-app entry. Fully aligned now.

**"Delete the Patel enquiry" holds up across refreshes.** Small robustness fix — the delete-by-voice path for enquiries now matches by ID rather than object reference, so deletions stick cleanly even if the enquiries list has been refreshed from the server in the background.

**Adding the same person twice across workers and subcontractors is now caught.** If you try to add "John Smith" as a subcontractor but he's already in your workers list (or the other way round), the AI will now tell you where he already lives and suggest updating the existing record, instead of quietly creating two separate entries for the same person. Longer-term the two lists will merge into one — see the internal migration doc — but this closes the gap in the meantime.

### Chase button actually chases now 📨

Before tonight, tapping the Chase button on an invoice just flipped its status from "overdue" back to "sent" — it didn't actually send a chase email. The AI voice command "chase the Patel invoice" worked perfectly; the button on screen did not. Two very different behaviours hiding behind the same ✉ icon. Fixed now: tapping Chase from either the Invoices list or the Payments dashboard sends a real chase email to the customer, same escalation tones as the voice command (gentle reminder → firm follow-up → final notice on chase #3), same PDF attachment, same payment link, same Supabase tracking. A "Chasing..." loading state keeps you informed while it's in flight, and you get a toast confirming which tone went out.

Small related tweak: the Chase button now shows up on "sent" invoices too, not only "overdue" ones. Plenty of jobs sit unpaid for a week or two before they're technically overdue — no reason to wait before giving the customer a nudge.

### Verbal triggers for Xero & QuickBooks expanded 🎙️

The voice assistant now recognises a much wider range of natural phrasings for syncing invoices and receipts to your accounting software. All of these now work for Xero: *"upload that to Xero"*, *"fire it over to Xero"*, *"get that on Xero"*, *"pop that on Xero"*, *"post it to Xero"*, *"log it in Xero"*, *"chuck that in Xero"*, *"stick that on Xero"*, *"Xero that invoice"*. Plus the original triggers still work — "send to Xero", "sync to Xero", "push to Xero". QuickBooks has the same treatment (including shortcuts like "QB that one"). Supplier receipts (for bills, not sales invoices) have their own set: *"upload that receipt to Xero"*, *"log that receipt in Xero"*, etc. Point is you can talk to Trade PA like you'd tell a real PA to do it — no need to remember exact commands.

### Four forensic-audit bug fixes 🔧

**CIS rate now defaults correctly for new subbies and workers.** When you add a subcontractor without a UTR on file, the CIS deduction rate now defaults to **30%** (the HMRC rule for unverified subs), not 20%. If you've got the UTR, it still defaults to 20%. Previously everyone defaulted to 20% regardless — which could have under-deducted tax on unregistered subs and landed you with an HMRC bill later. The AI also now tells you when it's assumed 30% so you can verify and flip to 20% once you've checked the UTR with HMRC.

**Sent invoices and quotes actually show as sent now.** When the AI sends an invoice or quote by email, it correctly flips from "draft" to "sent" status afterwards — previously it stayed marked as draft even after the email went out, which was confusing and risked double-sending. Paid and overdue invoices are never demoted.

**Deleting a CIS statement no longer loses the record.** Under the hood, deleting now archives the statement rather than wiping it — keeps a copy for your HMRC 6-year record retention, but removes it from your active list. Matches the retention promise in the privacy policy.

**Adding a worker twice by accident is now caught.** If you say "add John Smith as a worker" and he's already on your team, the AI now tells you he's already there instead of creating a duplicate. And if John was archived previously, adding him by the same name silently reactivates him with his time logs intact.

### Proper Privacy Policy and Terms of Service live ⚖️
Full-fat versions of both legal docs are now shipping — the earlier files were skeleton stubs. New versions cover everything regulators actually expect: Trade PA Ltd named as data controller, ICO registration reference (filled in once the ZA number arrives later this week), UK GDPR rights and lawful-basis tables, all 12 third-party processors listed with purpose and location, AI-provider no-training commitments, retention schedule, international transfer safeguards, consumer-contract cancellation rights, 30-day trial terms, all four subscription plans priced correctly, VAT status stated honestly (not yet VAT-registered — prices exclusive), AI output accuracy disclaimers, HMRC/CIS/tax responsibility clarifications, acceptable use, liability caps, and ICO complaints route. Around 3,500 words each. No more placeholder-only pages — these are the versions we'd hand to a solicitor for review without blushing.

### Companies House — we're official ✅
Trade PA Ltd is now registered in England &amp; Wales (Company No. 17176983). Landed the required Companies Act 2006 disclosures in all the places the law asks for:

- All system emails (welcome, trial-ending, payment-failed, reminders, auth) carry "Trade PA Ltd · Registered in England &amp; Wales · Company No. 17176983" in the footer.
- Terms of service and Privacy Policy contact cards updated — privacy policy now correctly names Trade PA Ltd as the data controller, terms names it as the contracting party.
- Marketing site footers (about, pricing, terms, privacy) updated.
- Customer portal page — quotes and invoices you share with clients now have a tiny "Trade PA Ltd · Company No. 17176983" disclosure below the "Delivered via Trade PA" line.

Your own invoice PDFs are untouched — those are issued by **your** business, not Trade PA Ltd, and correctly show your trading name, VAT number, and (if you want) your own company number via Settings → Business Details.

### Three invisible-but-real bugs fixed 🕵️
A systematic sweep across every database write in the app turned up three columns the code was trying to write to that didn't actually exist in the database. Each one was causing a silent 400 error that users would never see:

- **Customer phone on invoices** — voice was pulling the phone from the customer record and trying to save it on the invoice so chase tools wouldn't need to re-join tables. Wasn't persisting.
- **Quote expiry extensions** — extending a quote's validity via the "extend" button was only updating the screen. On reload it reverted to the original expiry.
- **Editing a worker's address** — saving any edit to a worker from the Workers tab was failing silently if the change included the address field.

All three columns now exist. The writes that had been failing start succeeding the next time those features are used. No data lost; no action needed from you.

### Archiving a sub or worker now keeps their records 🗃️
Before: if you said "delete Joe" (a subbie), he was hard-deleted from the database — and because the payment records were linked to him by ID, the FK cascade wiped every CIS-deducted payment you'd ever logged for him. That's HMRC-reportable data you're legally required to keep for 6 years. Same risk for workers — delete them and their CSCS cards, right-to-work checks, insurance certs, and job assignment history all vanished.

Now: "delete" for subs and workers means archive. They stop appearing in your active lists, but every payment record, document, time log and job assignment stays in the database untouched. The voice response tells you what was kept ("3 payment records kept for CIS reporting", "8 documents, 2 job assignments kept for HR records"). If you add someone with the same name as an archived contact, they're silently reactivated with their history intact — no need to re-add from scratch.

### Voice commands now work across Schedule AND Jobs 🎯
Turned out voice had a split brain. If you scheduled a job in your diary ("add Karen's kitchen for Tuesday") and later said "log 2 hours on Karen's kitchen", it would say "no job card found" — because the schedule entry and the rich job card were two different records and voice only looked at one. Now every voice command (log time, add materials, log expenses, add variations, add compliance certs, log daywork) works against scheduled jobs too — the first time you log something, the system quietly creates a job card from your schedule entry so everything attaches properly. The schedule entry stays in your diary; the job card shows up in Jobs with all the tracking. Same goes for "mark Karen's kitchen complete" — now updates both the Schedule entry and the Job Card in one go.

### Deleting a job card no longer risks losing records 🛡️
Before: if you said "delete Karen's kitchen" by mistake, you could silently lose every time log, customer signature, compliance certificate (CP12, EICR), daywork sheet, site photo, and variation order attached to it. All gone with one voice command. And if the job had any expenses logged against it, the delete would silently fail at the database level — the voice tool said "deleted!" but the job was still there.

Now: nothing attached to the job is deleted. Time logs, certs, variations, photos — all survive the job deletion and become "unattached" records you can reassign or archive later. The voice response tells you exactly what was kept ("5 time logs, 2 certificates, 1 variation kept but unattached"). If the delete fails for any reason, the voice tool surfaces the actual error instead of pretending success.

This is a quiet change but a significant one for HMRC compliance — you're required to keep business records for 6 years and a voice-triggered cascade delete was a legal risk.

### Job expenses finally show up in job profit 📊
If you said "log £30 parking on the Bishop job", the expense was saved but never actually linked to the job. The job's profit breakdown showed £0 for expenses no matter what. Now when you say "log £30 for fuel on the Jones rewire" or similar, the expense links properly and shows up in that job's profit reckoning. Works off customer name or job title. (Existing unlinked expenses stay where they are — this only affects new ones.)

### Variation orders now update the job's headline total 📈
When you added a £2k variation to a £10k job, the variation got saved but the job's main value stayed at £10k. Reports reading from the job's headline value came out wrong. Now adding a variation bumps the job's total — so a £10k job + £2k variation shows as £12k. The profit breakdown still shows the two lines separately, nothing changes there — just the top-line figure is honest now.

### Compliance certs without an expiry date no longer error 📅
Edge case: logging a cert (CP12, EICR, PAT) without specifying an expiry date was trying to save an empty string into a date field, which Postgres rejects. Fixed — empty expiry is now properly saved as "no expiry". Doesn't affect certs with expiries.

### Two voice confirmations were mixed up 🏷️
When adding a compliance cert or logging daywork and the system needed to disambiguate which job you meant, the prompt said "log daywork to" for certs and "add this certificate to" for daywork. Swapped. Purely cosmetic but confusing — you'd hear the wrong action label in the clarifying question.

### Stage payments now actually save 🪜
A subtle but bad bug we found by auditing the live database: when you said "set up 30/40/30 stage payments on Karen's job", the system was trying to save it but the column it was writing to didn't exist. Result: every stage-payments call has been silently failing since the feature was added. The column now exists, the migration is applied, the next time you say "set up stage payments on the Bishop job" it will actually save.

### VAT-registered tradies — your VAT setting now sticks 💷
If you've turned on VAT in your settings (because you're above the £85k threshold), every new invoice and quote created from now on — by voice OR by tapping "+ New Invoice" — will pre-fill VAT enabled at your default rate. Previously, even though the setting existed, every new invoice came in with VAT off and you had to toggle it manually. Same for CIS. So that's a lot of clicks saved per month. (Existing invoices unchanged.)

### Invoices created from a job card now link back to the job 🔗
When you said "invoice the Bishop kitchen" via voice and the system pulled the line items from the job card to build the invoice — the new invoice was created, but the job card had no idea its invoice existed. So the job stayed showing "no invoice yet" and you couldn't see the relationship. Fixed. The job card now stores the invoice ID and updates its status to "invoiced". Reverse lookups (and "what jobs need invoicing?" reports) now work properly.

### "Mark paid in Xero" now syncs everywhere ✅
If you used the specific "mark paid in Xero" voice command (separate from the generic "mark invoice paid"), it was only updating Xero — not QuickBooks if you also had that connected, no push notification, no analytics tracking. Now it does everything the generic mark-paid does, plus the explicit Xero confirmation. Same outcome whichever phrasing you use.

### Email-approved quote acceptance now actually saves the invoice 🛟
When you approved an email saying "yes I accept the quote" via the inbox, the system was creating the invoice in your screen but losing it before it hit the database. Result: the invoice would appear briefly then vanish on next refresh, and the original quote was getting deleted from the system. Now: the new invoice is properly saved, the quote is preserved (marked accepted), AND a job card is auto-created linking them — so when you log time or materials against that customer later, it all attaches to the right job. This brings email approvals in line with the way "Convert to Invoice" works when you tap it manually.

### "I'll get a job booked in" emails no longer assume you're a plumber 🔧
When an email-accepted quote didn't match any quote in your system (because you hadn't entered one), the app was creating a placeholder job with the type set to "Boiler Installation". If you're a sparks or a roofer that was obviously wrong. Removed the hardcoded type and the placeholder now goes to your Jobs tab as a proper job card, ready for you to fill in the details.

### Mark-paid analytics now match across UI and voice 📊
Internal — you won't see this directly. When you marked an invoice paid by tapping the button instead of saying it, the action wasn't being logged in our analytics. So the dashboard was undercounting tap-to-pay actions vs voice. Now both routes log the same event with the same data.

### Voice deletes will always confirm before doing anything destructive 🛑
Voice has a small risk: STT can mishear, especially on cellular. Saying "add a customer called Karen" could in rare cases be heard as "delete a customer called Karen". To be safe, the assistant will now ALWAYS confirm with you before calling any delete action — naming the exact thing being deleted (invoice number, customer name, job title) and waiting for a clear yes before proceeding. If your message is ambiguous (e.g. you have two customers called Smith), it'll list them and ask which one rather than guessing.

### Onboarding won't re-trigger for returning users on slow connections 📱
If you logged back into Trade PA on a train wifi, cellular out on site, or any flaky connection, the app sometimes thought you were a brand new user and tried to walk you through setup again. That was an old 600ms timing bug — the app was checking your profile too early before the data loaded. Fixed properly now: a specific server flag marks when you've completed setup, checked every login. No more false welcome screens. Also fixes a rare case where anyone whose business name ended with "'s Trades" got pushed through onboarding on every reinstall.

### Voice transcripts won't ever be silent-empty again 🎙
Minor under-the-hood fix. When our primary speech-to-text provider occasionally returned a blank transcript (rather than an actual error), the app was treating that as success and showing you nothing. Now an empty or too-short result counts as a miss and falls through to the backup providers. Much less likely you'll ever press mic, speak, and see no text come back.

### Enquiry pushes from email approvals now actually fire 📩
When you approved an enquiry email from the Inbox tab, the "📩 New Enquiry" push notification was supposed to pop up on your phone — but it was silently failing because of a plumbing issue. Fixed. Approve an enquiry email, get the push. Same as it was always meant to work.

### I'll get a morning ping if anyone's costing more than expected 💰
Internal thing — not user-facing. A new daily check runs at 09:15 UTC that estimates each user's monthly AI spend (Claude conversations, hands-free minutes, email scanning) and emails Connor if anyone is over £10/month. Quiet on normal days, surfaces outliers fast. Helps keep margins honest as user numbers grow.

### Your AI knows what's waiting in your inbox, wherever you ask from 🧠
Used to be: if you tapped the floating mic from somewhere other than the Inbox tab and asked "anything to approve?", the AI would have to go and check. Now it already knows how many are pending — a live count that updates whenever you approve or dismiss anything, on any screen. Faster answers, less back-and-forth.

### "Approve that" by voice now actually does the thing 🗣
This one was a proper silent bug. When you approved an inbox action by voice — "approve that booking" or "yes, mark Dave's invoice as paid" — the action disappeared from your inbox like it worked, but nothing actually happened. No job on the calendar. No confirmation reply to the customer. No invoice marked paid. Approving through the Inbox tab's buttons worked fine; voice was the only path that was broken. Now voice runs the full approval — it creates the job, sends the reply from your own inbox, parses supplier PDFs, marks invoices paid — same as tapping the buttons. Dismissing by voice now also teaches the email classifier why you dismissed, so it stops making the same mistake. And whichever way you approve or dismiss, the other screen refreshes properly.

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
