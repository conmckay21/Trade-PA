// ============================================================================
// helpContent.js
// ----------------------------------------------------------------------------
// Single source of truth for the in-app Help Centre.
// To add a new article: append an object to ARTICLES below. No code changes
// needed in HelpCentre.jsx.
//
// Field guide:
//   slug:       URL-safe id; used by OnboardingChecklist's `helpSlug` and by
//               openHelp(slug) deep-links from anywhere in the app.
//   title:      Plain-English question or task name.
//   category:   One of CATEGORIES below. Add new categories there.
//   summary:    One sentence shown in the search list.
//   steps:      Array of step strings. Keep each step under ~15 words.
//   voicePrompts: (optional) Array of example things the user can say.
//                 Shown in a highlighted box.
//   tips:       (optional) Array of short pro tips.
//   related:    (optional) Array of slugs to other articles.
// ============================================================================

export const CATEGORIES = [
  { id: 'getting-started', label: 'Getting started', icon: '🚀' },
  { id: 'customers-jobs',  label: 'Customers & jobs', icon: '📋' },
  { id: 'materials-pos',   label: 'Materials & POs', icon: '🧰' },
  { id: 'labour-mileage',  label: 'Labour & mileage', icon: '⏱️' },
  { id: 'voice-ai',        label: 'Voice & AI', icon: '🎙️' },
  { id: 'invoicing',       label: 'Invoicing & getting paid', icon: '💷' },
  { id: 'compliance',      label: 'RAMS & compliance', icon: '🦺' },
  { id: 'stock',           label: 'Stock & van', icon: '🚐' },
  { id: 'accounts',        label: 'Accountant & Xero', icon: '📊' },
  { id: 'troubleshooting', label: 'Troubleshooting', icon: '🛠️' },
];

export const ARTICLES = [
  // ---------- Getting started ----------
  {
    slug: 'first-90-seconds',
    title: 'Your first 90 seconds in Trade PA',
    category: 'getting-started',
    summary: 'The fastest path from signup to a working job card.',
    steps: [
      'Tap Customers, then Add. Use the mic to dictate name, phone and address.',
      'Tap Jobs, then Add. Pick the customer you just made.',
      "Open the AI assistant and say: \"Add 5 hours labour and 50m of 2.5mm cable.\"",
      'Tap Invoice. Send. Done.',
    ],
    tips: [
      'Voice works on every form — look for the mic icon.',
      'The AI assistant takes you straight to whatever it just made.',
    ],
    related: ['voice-fill', 'ai-assistant'],
  },
  {
    slug: 'install-pwa',
    title: 'Install Trade PA on your phone',
    category: 'getting-started',
    summary: 'Add to home screen so it behaves like a normal app.',
    steps: [
      'Open tradespa.co.uk in your phone browser.',
      'iPhone: tap Share → Add to Home Screen.',
      'Android: tap the menu → Install app (or Add to Home Screen).',
      'Open from the home-screen icon. No app store needed.',
    ],
  },

  // ---------- Customers & jobs ----------
  {
    slug: 'add-customer',
    title: 'Add a customer (by voice)',
    category: 'customers-jobs',
    summary: 'Get a customer in the system in under 10 seconds.',
    steps: [
      'Tap the Customers tab.',
      'Tap Add (or the + icon).',
      'Tap the mic icon at the top of the form.',
      'Speak naturally — name, phone, address, anything you know.',
      'Check the fields, fix anything that misheard, tap Save.',
    ],
    voicePrompts: [
      '"Dave Wilson, 07700 900123, 22 Mill Lane, Reading"',
      '"Mrs Patel, mobile is oh-seven-seven-five-five, lives at 14 Beech Road, Slough"',
    ],
    related: ['voice-fill'],
  },
  {
    slug: 'create-job',
    title: 'Create a job',
    category: 'customers-jobs',
    summary: 'One job card holds materials, labour, photos, notes and the invoice.',
    steps: [
      'Tap Jobs, then Add.',
      'Pick the customer (or add a new one inline).',
      'Fill in scope, site address (defaults to customer address) and dates.',
      'Save. The job card is now ready for materials, labour, photos and notes.',
    ],
    tips: [
      'Faster: ask the AI assistant — "Create a job for Mrs Patel, second-fix kitchen, two days".',
    ],
    related: ['ai-assistant', 'add-materials', 'log-labour'],
  },

  // ---------- Materials & POs ----------
  {
    slug: 'add-materials',
    title: 'Add materials to a job',
    category: 'materials-pos',
    summary: 'Voice-fill at the merchant so nothing falls off the invoice.',
    steps: [
      'Open the job card.',
      'Tap Materials → Add.',
      'Tap the mic. Say the item, quantity, and rough cost.',
      'Save. It links to this job and pulls into the invoice automatically.',
    ],
    voicePrompts: [
      '"50 metres of 2.5mm twin and earth, 75 quid"',
      '"Two boxes of 35mm screws, ten pounds each"',
    ],
    related: ['raise-po'],
  },
  {
    slug: 'raise-po',
    title: 'Raise a Purchase Order (and the hidden trick)',
    category: 'materials-pos',
    summary: 'A PO automatically creates the matching materials entries on the job.',
    steps: [
      'Open the job. Tap Purchase Orders → New PO.',
      'Pick the supplier and add line items (voice-fill works here too).',
      'Save / send.',
      'Check the Materials tab — the PO items are already there, linked to this job.',
    ],
    tips: [
      "Most users don't realise this for weeks. One tap, two boxes ticked.",
    ],
    related: ['add-materials', 'xero-sync'],
  },

  // ---------- Labour & mileage ----------
  {
    slug: 'log-labour',
    title: 'Log labour to a job',
    category: 'labour-mileage',
    summary: 'Days, hours, worker, type. Auto-totals to the invoice.',
    steps: [
      'Open the job. Tap Labour → Add.',
      'Pick the worker (you, a subbie, or "team").',
      'Enter days or hours, pick labour type (first-fix, second-fix, etc).',
      'Save. The cost rolls up into the job total.',
    ],
    tips: [
      'Log at the end of every day, not at the end of the week. You will forget.',
    ],
  },
  {
    slug: 'log-mileage',
    title: 'Log mileage by voice',
    category: 'labour-mileage',
    summary: 'Claim every mile you drive. Voice-log from the driveway.',
    steps: [
      'Open the Mileage tab.',
      'Tap Add, then the mic icon.',
      'Say the trip — "22 miles to Mrs Patel today".',
      'Save. End of year, it is all there for the accountant.',
    ],
    voicePrompts: [
      '"22 miles to the Mill Lane job today"',
      '"Round trip to Wickes, 14 miles, for the Patel job"',
    ],
    tips: [
      'Average sole-trader misses ~30% of claimable mileage. At 45p a mile that adds up fast.',
    ],
  },

  // ---------- Voice & AI ----------
  {
    slug: 'voice-fill',
    title: 'Use voice fill on any form',
    category: 'voice-ai',
    summary: 'Look for the mic icon on every form — speak naturally.',
    steps: [
      'Tap the mic icon (top of form, or next to a field).',
      'Speak as you would to a person — names, numbers, items, costs.',
      'The fields fill themselves. Check, fix any misheard bits, save.',
    ],
    tips: [
      'Voice is tuned for UK and regional accents. Speak normally, no need to slow down.',
      'Background noise is fine — vans, sites, traffic. Tested in all of them.',
    ],
    related: ['ai-assistant'],
  },
  {
    slug: 'ai-assistant',
    title: 'Tell the AI to do the work',
    category: 'voice-ai',
    summary: '23 actions the AI can take for you, from natural language.',
    steps: [
      'Tap the AI assistant button.',
      'Type or speak what you want done — naturally, no special syntax.',
      'It builds the job, materials, labour, PO, note (whatever you asked for).',
      'When done, it takes you straight to what it made.',
    ],
    voicePrompts: [
      '"Create a job for Mrs Patel at 14 Beech Road, second-fix kitchen, two days, John on labour"',
      '"Add 50m of 2.5mm cable and 8 single sockets to the Patel job"',
      '"Log 22 miles for me today on the Mill Lane job"',
      '"Raise a PO to Wickes for 4 sheets of 18mm ply on the Beech Road job"',
    ],
    tips: [
      'Specific is better. "Two days" beats "a couple of days".',
      "It can't undo things — review before confirming destructive actions.",
    ],
  },

  // ---------- Invoicing ----------
  {
    slug: 'send-invoice',
    title: 'Send your first invoice',
    category: 'invoicing',
    summary: 'Materials and labour pull through automatically. Add a Stripe link to get paid faster.',
    steps: [
      'Open the job, tap Invoice.',
      'Check the line items — materials and labour are already there.',
      'Add anything extra (call-out fee, parking, etc).',
      'Tap Send. Customer gets it by email with a pay-now link.',
    ],
    tips: [
      'Send the same day. Invoices sent within 24 hours get paid roughly 2x faster.',
    ],
    related: ['take-payment', 'xero-sync'],
  },
  {
    slug: 'take-payment',
    title: 'Take card payment via Stripe',
    category: 'invoicing',
    summary: 'Customer taps the link in your invoice email, pays by card. Money in days.',
    steps: [
      'Make sure Stripe is connected in Settings.',
      'When sending an invoice, leave "Include pay-now link" ticked.',
      "The customer's invoice email has a Pay Now button.",
      'You see paid status update in Trade PA the moment it clears.',
    ],
  },

  // ---------- Compliance ----------
  {
    slug: 'rams',
    title: 'Build a RAMS in three minutes',
    category: 'compliance',
    summary: 'Voice-fill on Steps 1 and 5 turns the worst job of the week into a quick one.',
    steps: [
      'Open the job, tap RAMS → New.',
      'Step 1 (Hazards): tap the mic, talk through what could go wrong on this site.',
      'Steps 2–4: pick from the standard options.',
      'Step 5 (Method): tap the mic, talk through how you will do it safely.',
      'Save. Site-ready PDF available to send.',
    ],
    voicePrompts: [
      '"Working at height on a dormer roof, scaffold tower, two operatives, weather is fine"',
      '"Hot works in a domestic loft, fire blanket and extinguisher on hand, no flammables nearby"',
    ],
  },

  // ---------- Stock ----------
  {
    slug: 'stock',
    title: 'Track van stock',
    category: 'stock',
    summary: 'Know what is on the van before you head to the merchant.',
    steps: [
      'Tap the Stock tab.',
      'Add an item (voice fill works here too).',
      'When you use stock on a job, deduct it from the count.',
      'Check Stock before any merchant trip — stop double-buying.',
    ],
  },

  // ---------- Accounts ----------
  {
    slug: 'xero-sync',
    title: 'Push bills to Xero',
    category: 'accounts',
    summary: 'Supplier bills auto-sync. Your accountant gets clean books.',
    steps: [
      'Connect Xero in Settings → Integrations.',
      "Once connected, supplier bills attached to POs sync automatically.",
      'Check the Xero log if anything looks off.',
    ],
    tips: [
      'Tell your accountant. Most charge less when the books arrive clean.',
    ],
  },

  // ---------- Troubleshooting ----------
  {
    slug: 'voice-not-working',
    title: 'Voice fill not working?',
    category: 'troubleshooting',
    summary: "Almost always a mic permission. Here's how to fix it.",
    steps: [
      'Check the mic permission for your browser (Settings → Apps → Browser → Permissions → Microphone).',
      'For installed PWA, check the same under the Trade PA app entry.',
      'Restart the app once permission is granted.',
      'Still stuck? Email support — include phone model and browser.',
    ],
  },
  {
    slug: 'ai-wrong-result',
    title: 'AI assistant did the wrong thing',
    category: 'troubleshooting',
    summary: 'Two quick fixes plus how to give better instructions.',
    steps: [
      'Open the thing it created and edit or delete as needed.',
      "Try again with more specific wording — names, numbers, units.",
      'If it keeps misunderstanding the same thing, screenshot it and email support.',
    ],
    tips: [
      'Specific beats short. "Two days, John on labour" beats "a couple of days".',
    ],
  },
];
