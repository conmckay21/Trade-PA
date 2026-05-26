# Changelog

## 2026-05-26

🚚 **Supplier orders are back, properly this time.** Open any supplier and tap **Email order or request** to send a material order or price request straight from the app — pick your items, set the quantities, add a job ref or notes, hit send. Goes out from your connected Gmail or Outlook so it lands in your sent folder like normal. Every order is now logged so you can see what you ordered from who, and when.

🤖 **AI can do it too.** Tell your PA "order 30m of 22mm copper from Plumb Centre for job 14" and it'll put the email together and send it to them — same flow, just hands-free. Useful on site when you can't be typing.

🛟 **Fixed an email outage** earlier today that knocked out Gmail and Outlook sign-in and inbox loading for about an hour. Root cause was a botched supplier-order endpoint added overnight that crashed the whole email function on cold start. Removed and rebuilt cleanly with its own isolated endpoint so this can't take down sign-in again.

✏️ **Sharper text everywhere.** Material names, job titles and stock items were rendering with a fake "browser bold" because the right font weights weren't loading. Now all weights from 200 through 800 of Plus Jakarta Sans load up front, with proper anti-aliasing — so bold text is genuinely bold instead of pixel-mashed.

📐 **Tidied list rows** in Materials, Mileage, Expenses and Stock so titles read at the same size and weight as Customers and Jobs (14px / 700) — small change, but the screens feel more consistent now.

🧹 **Cleaned up the Materials screen** — the old Supplier Quick Dial card and the duplicate supplier modal are gone now that Suppliers has its own tab. The "Order materials" button at the top of Materials still works, it just routes you to the new Suppliers tab.

## 2026-05-22

🤖 Trade PA is now on Google Play alongside the App Store. Both badges are live across the marketing site and landing page.

## 2026-05-18

📞 Fixed Gmail, Outlook, Xero, QuickBooks and Stripe connect buttons in the mobile apps — they now open in your phone's browser to complete OAuth rather than getting stuck on a blank screen.

## 2026-05-17

📑 Documents tab now shows everything in one place — files, certificates, compliance docs, RAMS, and worker docs. Filter by type or job.

## 2026-05-15

💳 Card details are no longer required to start a trial. Sign up, use the app for 30 days, add a card when you're ready to stay.
