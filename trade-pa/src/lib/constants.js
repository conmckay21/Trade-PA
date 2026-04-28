// ─── App-wide constants ─────────────────────────────────────────────────────
// Default brand profile, supplier seed list, certification options,
// exempt accounts, navigation taxonomy, mileage rate.
// Pure data, no dependencies.

export const DEFAULT_BRAND = {
  logo: null,
  tradingName: "",
  tagline: "",
  phone: "",
  email: "",
  website: "",
  address: "",
  // Trade types (which registrations to show)
  tradeTypes: [],             // e.g. ["gas","electrical","oil","renewables","plumbing","glazing"]
  // Registration numbers — fed onto certificates automatically
  gasSafeNumber: "",          // Gas Safe Register — gas certs
  gasSafeLogo: null,
  niceicNumber: "",            // NICEIC — electrical certs
  napitNumber: "",             // NAPIT — electrical certs (alternative to NICEIC)
  elecsaNumber: "",            // ELECSA — electrical certs (alternative)
  oftecNumber: "",             // OFTEC — oil certs
  hetasNumber: "",             // HETAS — solid fuel certs
  fgasNumber: "",              // F-Gas — refrigeration/AC/heat pump certs
  mcsNumber: "",               // MCS — renewables certs
  aphcNumber: "",              // APHC/WaterSafe — plumbing certs
  fensaNumber: "",             // FENSA — window/glazing certs
  cscsNumber: "",              // CSCS card — general building
  // Verification status (stored per field)
  registrationVerifications: {}, // { gasSafeNumber: { verified: true, date: "2026-04-03", method: "manual" } }
  // Certificate numbering
  certNextNumber: 1,
  certPrefix: "CERT",
  // Financial
  vatNumber: "",
  utrNumber: "",
  bankName: "",
  sortCode: "",
  accountNumber: "",
  accountName: "",
  accentColor: "#f59e0b",
  paymentTerms: "14",
  quoteValidity: "30",
  invoiceNote: "Thank you for your business. Payment due within 30 days.",
  refFormat: "invoice_number",
  refPrefix: "",
  defaultPaymentMethod: "both",
  googleReviewUrl: "",
  reviewUrlGoogle: "",
  reviewUrlCheckatrade: "",
  reviewUrlTrustpilot: "",
  reviewUrlFacebook: "",
  reviewUrlWhich: "",
  reviewUrlMyBuilder: "",
  reviewUrlRatedPeople: "",
};

export const ALL_CERTS = [
  { label: "Gas Safe Registered", icon: "🔥", key: "cert_gassafe" },
  { label: "OFTEC Registered", icon: "🛢", key: "cert_oftec" },
  { label: "NICEIC Approved", icon: "⚡", key: "cert_niceic" },
  { label: "NAPIT Registered", icon: "🔌", key: "cert_napit" },
  { label: "Which? Trusted Trader", icon: "✓", key: "cert_which" },
  { label: "Federation of Master Builders", icon: "🏗", key: "cert_fmb" },
  { label: "TrustMark Registered", icon: "🛡", key: "cert_trustmark" },
  { label: "CORGI Registered", icon: "🔧", key: "cert_corgi" },
  { label: "CHAS Accredited", icon: "📋", key: "cert_chas" },
  { label: "SAFEcontractor Approved", icon: "🦺", key: "cert_safecontractor" },
  { label: "Checkatrade Member", icon: "🏠", key: "cert_checkatrade" },
  { label: "F-Gas Certified", icon: "❄", key: "cert_fgas" },
];

export const DEFAULT_SUPPLIERS = [
  { name: "City Plumbing", phone: "01483 123456", email: "", notes: "Main plumbing supplies" },
  { name: "Screwfix", phone: "03330 112112", email: "", notes: "Tools and fixings" },
  { name: "Wolseley", phone: "01926 701600", email: "", notes: "Heating and plumbing" },
  { name: "Toolstation", phone: "0330 333 3303", email: "", notes: "Tools and building supplies" },
  { name: "BSS", phone: "0115 953 0500", email: "", notes: "Commercial heating" },
  { name: "Plumb Center", phone: "0330 123 1456", email: "", notes: "Plumbing wholesale" },
];

export const MILEAGE_RATE = 0.45; // HMRC approved mileage rate

export const NAV_GROUPS = [
  { id: "home",   label: "Home",     views: ["AI Assistant"] },
  { id: "work",   label: "Jobs",     views: ["Enquiries", "Jobs", "Materials", "Stock", "RAMS", "Documents"] },
  { id: "diary",  label: "Diary",    views: ["Schedule", "Reminders"] },
  { id: "money",  label: "Accounts", views: ["Invoices", "Quotes", "Expenses", "Mileage", "Payments", "CIS", "Reports"] },
  { id: "people", label: "People",   views: ["Customers", "Workers", "Subcontractors", "Reviews"] },
  { id: "admin",  label: "Admin",    views: ["Inbox", "Settings"] },
];
// Flat list still used for permissions checks
export const VIEWS = NAV_GROUPS.flatMap(g => g.views);
// Helper: find which group a view belongs to
export const viewGroup = (v) => NAV_GROUPS.find(g => g.views.includes(v))?.id || "work";

// Exempt accounts — bypass all verification gates (test/owner accounts)
export const EXEMPT_EMAILS = [
  "thetradepa@gmail.com",
  "connor@tradespa.co.uk",
  "connor_mckay777@hotmail.com",
  "connor_mckay777@hotmail.co.uk",
  "landbheating@outlook.com",
  "shannonandrewsimpson@gmail.com",
];
