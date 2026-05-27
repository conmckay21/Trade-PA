## 2026-05-26

🎯 **Fresh welcome screen on iOS and Android.** Open the app fresh on your phone and you now get a clean dark welcome. The TP mark, the promise ("Stop losing evenings to admin."), the descriptor ("voice-first PA for UK trades") and one big Sign In button. No marketing scroll-fest, no pricing waffle, no clutter. Existing subscribers in two taps. New downloads get pointed to tradespa.co.uk to sign up. Web users on laptop or desktop still see the full landing page unchanged.

📦 **Bring your gear across from another app.** New **Import from another app** option on the welcome screen lets you bulk-import from a CSV. Customers, jobs, and invoices/quotes. Pick what you're importing, drop the file, we auto-detect the columns and let you tweak the matches if anything's off. Duplicate detection on customer names and job titles so you don't end up with two of everything. Switchers from Tradify, Powered Now, Service M8: export your data to CSV and pull it across here. Imported invoices and quotes get clearly marked IDs (`INV-IMP-…` / `QTE-IMP-…`) so they're distinct from invoices you raise here.

## 2026-05-26

📚 **Help guides now live on the web.** New public help page at tradespa.co.uk/help.html. Eight topic sections covering everything from your first invoice to CIS deductions, RAMS generation and voice commands. Searchable in Google so prospects can find answers before they sign up, plus deep-linkable so we can point customers at specific guides.

## 2026-05-26

🎯 **Setup tour now tells the truth.** The walkthrough used to promise "three buttons in the top-right". But Help and Feedback actually live in the avatar menu, not as standalone buttons. The tour now describes what's really there: bell up top for reminders and notifications, and your avatar for Settings, Help, Feedback and Sign out. One less step too. Went from 8 stops to 7.

## 2026-05-26

🎙 **"What can my PA do?" got a proper answer.** The Help article that lists what your PA can handle was a thin five-bullet stub. It's now a full reference. Eight categories of what your PA does (add, get paid, update, find, plan, message, compliance, settings) plus 20 real example commands like "Invoice Patel £580 for the second-fix work" or "Order 4 sheets of 18mm ply from Wickes for the Beech Road job". Find it in Help → Voice & AI → What can my PA do?

## 2026-05-26

📖 **Help button now knows where you are.** Open the avatar menu and tap Help from any screen. You'll land straight on the article that matches what you're looking at. On Customers? You get the "Add a customer" guide. On Inbox? Inbox help. No more scrolling through the index to find the right page.

## 2026-05-26

💬 **No more "what do I say?" on the chat screen.** When you first land in the AI chat during setup, you'll now see three example commands at the top. Tap one and your PA gets going straight away. Or hit Skip to jump to naming your assistant.

## 2026-05-26

✨ **Sharper onboarding.** The welcome screen now leads with the actual job ("Stop losing evenings to admin") instead of generic AI talk, and the "try your first command" step now shows three example commands you can tap (customer, expense or quote) to see your PA actually do something. Or hit the mic and say your own.

## 2026-05-26

🪧 **Cleaner empty screens across the app.** Empty pages used to be a wall of grey text. Now Enquiries, Expenses, Stock, Documents, RAMS, CIS, Subcontractors and Purchase Orders all have proper "here's what this is for" cards with a clear next action. Add the first item, or tell PA out loud.

# Changelog

## 2026-05-26

📝 **Quote updates by AI.** Tell your PA "change the Halliday quote to £4,200 and add a line for skirting £180" and it'll update the quote in place. No more delete-and-redo. Works for amount, customer, validity date, status (draft/sent/accepted/declined/expired), address, VAT, and adding or removing line items.

📞 **Tap-to-call now works without a business line.** Before this, tapping a customer or supplier phone number without Twilio set up just popped an alert. Now it opens your phone's dialer so you can call them direct from your own number. Once you set up a Twilio business line, calls route through that instead so the other side sees your business number.


🚚 **Supplier orders are back, properly this time.** Open any supplier and tap **Email order or request** to send a material order or price request straight from the app. Pick your items, set the quantities, add a job ref or notes, hit send. Goes out from your connected Gmail or Outlook so it lands in your sent folder like normal. Every order is now logged so you can see what you ordered from who, and when.

🤖 **AI can do it too.** Tell your PA "order 30m of 22mm copper from Plumb Centre for job 14" and it'll put the email together and send it to them. Same flow, just hands-free. Useful on site when you can't be typing.

🛟 **Fixed an email outage** earlier today that knocked out Gmail and Outlook sign-in and inbox loading for about an hour. Root cause was a botched supplier-order endpoint added overnight that crashed the whole email function on cold start. Removed and rebuilt cleanly with its own isolated endpoint so this can't take down sign-in again.

✏️ **Sharper text everywhere.** Material names, job titles and stock items were rendering with a fake "browser bold" because the right font weights weren't loading. Now all weights from 200 through 800 of Plus Jakarta Sans load up front, with proper anti-aliasing. Bold text is genuinely bold instead of pixel-mashed.

📐 **Tidied list rows** in Materials, Mileage, Expenses and Stock so titles read at the same size and weight as Customers and Jobs (14px / 700). Small change, but the screens feel more consistent now.

🧹 **Cleaned up the Materials screen.** The old Supplier Quick Dial card and the duplicate supplier modal are gone now that Suppliers has its own tab. The "Order materials" button at the top of Materials still works, it just routes you to the new Suppliers tab.

## 2026-05-22

🤖 Trade PA is now on Google Play alongside the App Store. Both badges are live across the marketing site and landing page.

## 2026-05-18

📞 Fixed Gmail, Outlook, Xero, QuickBooks and Stripe connect buttons in the mobile apps. They now open in your phone's browser to complete OAuth rather than getting stuck on a blank screen.

## 2026-05-17

📑 Documents tab now shows everything in one place. Files, certificates, compliance docs, RAMS, and worker docs. Filter by type or job.

## 2026-05-15

💳 Card details are no longer required to start a trial. Sign up, use the app for 30 days, add a card when you're ready to stay.
