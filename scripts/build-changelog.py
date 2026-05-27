#!/usr/bin/env python3
"""
Renders trade-pa/public/changelog.md → trade-pa/public/changelog.html
using the same template as the blog posts.

Re-run after every changelog update:
    python3 scripts/build-changelog.py
"""
import re
import sys
from pathlib import Path

try:
    import markdown
except ImportError:
    print("pip install markdown")
    sys.exit(1)

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "trade-pa" / "public" / "changelog.md"
DST = ROOT / "trade-pa" / "public" / "changelog.html"

md_text = SRC.read_text(encoding="utf-8")

# Pre-process: bare emoji + ** ** at line start should keep emoji
# Markdown handles ** ** natively; emojis are passthrough.

html_body = markdown.markdown(
    md_text,
    extensions=["extra", "sane_lists", "smarty"],
    output_format="html5",
)

# H2 dates become anchored section headers
html_body = re.sub(
    r'<h2>(\d{4}-\d{2}-\d{2})</h2>',
    r'<h2 id="\1" class="release-date"><time datetime="\1">\1</time></h2>',
    html_body,
)

# Latest date for "last updated"
dates = re.findall(r'<h2[^>]*><time datetime="(\d{4}-\d{2}-\d{2})"', html_body)
latest = dates[0] if dates else "2026-05-27"

template = """<!DOCTYPE html>
<html lang="en-GB">
<head>
  <meta name="apple-itunes-app" content="app-id=6769395416">
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <title>Changelog | Trade PA</title>
  <meta name="description" content="Every update we've shipped to Trade PA. Bug fixes, new features, polish. Plain English, written like a tradie reads." />
  <link rel="canonical" href="https://www.tradespa.co.uk/changelog.html" />

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Trade PA" />
  <meta property="og:title" content="Changelog | Trade PA" />
  <meta property="og:description" content="Every update we've shipped to Trade PA. Bug fixes, new features, polish." />
  <meta property="og:url" content="https://www.tradespa.co.uk/changelog.html" />
  <meta property="og:image" content="https://www.tradespa.co.uk/og-card.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:locale" content="en_GB" />

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Changelog | Trade PA" />
  <meta name="twitter:description" content="Every update we've shipped to Trade PA. Bug fixes, new features, polish." />
  <meta name="twitter:image" content="https://www.tradespa.co.uk/og-card.png" />

  <!-- Favicons -->
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link rel="icon" type="image/png" sizes="32x32" href="/icon-32.png" />
  <link rel="icon" type="image/png" sizes="16x16" href="/icon-16.png" />
  <link rel="apple-touch-icon" href="/icon-180.png" />
  <meta name="theme-color" content="#f59e0b" />

  <!-- Schema -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Changelog | Trade PA",
    "description": "Every update we've shipped to Trade PA.",
    "url": "https://www.tradespa.co.uk/changelog.html",
    "dateModified": "__LATEST__",
    "publisher": {
      "@type": "Organization",
      "name": "Trade PA",
      "legalName": "TRADEPA LTD",
      "logo": { "@type": "ImageObject", "url": "https://www.tradespa.co.uk/icon-512.png" }
    }
  }
  </script>

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@200;300;400;500;600;700;800&display=swap" rel="stylesheet" />

  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: #0a0a0a; --surface: #141414; --surface-high: #1a1a1a;
      --border: #2a2a2a; --text: #f5f5f5; --text-dim: #c8c8c8;
      --muted: #888; --amber: #f59e0b;
    }
    html { scroll-behavior: smooth; }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: var(--bg); color: var(--text); line-height: 1.7;
      -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;
    }
    nav {
      position: sticky; top: 0; z-index: 100;
      background: rgba(10,10,10,0.85); backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border);
      height: 56px; padding: 0 24px;
      display: flex; align-items: center; justify-content: space-between;
    }
    .logo { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 14px; letter-spacing: 0.05em; color: var(--amber); text-decoration: none; }
    .logo-icon { width: 28px; height: 28px; background: var(--amber); border-radius: 6px; display: flex; align-items: center; justify-content: center; color: #000; font-size: 10px; font-weight: 900; letter-spacing: -0.02em; }
    .nav-links { display: flex; gap: 22px; font-size: 13px; color: var(--text-dim); align-items: center; }
    .nav-links a { color: inherit; text-decoration: none; }
    .nav-links a:hover { color: var(--amber); }
    .nav-cta { background: var(--amber); color: #000 !important; padding: 7px 14px; border-radius: 6px; font-weight: 600; }
    @media (max-width: 700px) { .nav-links a:not(.nav-cta) { display: none; } }

    main { max-width: 760px; margin: 0 auto; padding: 64px 24px 48px; }
    .kicker { font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--amber); margin-bottom: 20px; }
    h1.page-title { font-size: 44px; font-weight: 700; line-height: 1.1; letter-spacing: -0.02em; margin-bottom: 16px; }
    @media (max-width: 600px) { h1.page-title { font-size: 32px; } }
    .intro { font-size: 17px; color: var(--text-dim); margin-bottom: 56px; padding-bottom: 32px; border-bottom: 1px solid var(--border); }

    .release-date {
      font-size: 14px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase;
      color: var(--amber); margin: 56px 0 20px 0;
      padding-top: 28px; border-top: 1px solid var(--border);
    }
    .release-date:first-of-type { margin-top: 0; padding-top: 0; border-top: 0; }
    .release-date time { font-family: 'Plus Jakarta Sans', monospace; }

    main p { margin-bottom: 18px; font-size: 16px; color: var(--text-dim); }
    main p strong { color: var(--text); font-weight: 700; }
    main ul, main ol { margin: 0 0 18px 24px; }
    main li { margin-bottom: 8px; font-size: 16px; color: var(--text-dim); }
    main code { background: var(--surface-high); padding: 2px 6px; border-radius: 4px; font-size: 14px; color: var(--amber); font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace; }
    main a { color: var(--amber); text-decoration: none; }
    main a:hover { text-decoration: underline; }

    .cta-block { margin: 80px auto 0; max-width: 760px; padding: 32px; background: var(--surface); border: 1px solid var(--border); border-radius: 14px; text-align: center; }
    .cta-block h2 { font-size: 22px; font-weight: 700; margin-bottom: 8px; color: var(--text); }
    .cta-block p { color: var(--text-dim); font-size: 14px; margin-bottom: 20px; }
    .cta-btn { display: inline-block; background: var(--amber); color: #000; padding: 12px 22px; border-radius: 8px; font-weight: 700; font-size: 14px; text-decoration: none; }
    .cta-btn:hover { opacity: 0.88; }
    .cta-note { display: block; margin-top: 10px; font-size: 12px; color: var(--muted); }

    footer { max-width: 760px; margin: 64px auto 32px; padding: 24px; text-align: center; color: var(--muted); font-size: 12px; border-top: 1px solid var(--border); }
    footer a { color: var(--text-dim); text-decoration: none; margin: 0 10px; }
    footer a:hover { color: var(--amber); }
  </style>
</head>
<body>

  <nav>
    <a href="/" class="logo">
      <div class="logo-icon">TP</div>
      TRADE PA
    </a>
    <div class="nav-links">
      <a href="/about.html">About</a>
      <a href="/pricing.html">Pricing</a>
      <a href="/help.html">Help</a>
      <a href="/blog/">Blog</a>
      <a href="/signup.html" class="nav-cta">Start free trial →</a>
    </div>
  </nav>

  <main>
    <p class="kicker">Changelog</p>
    <h1 class="page-title">Everything we've shipped.</h1>
    <p class="intro">Every release of Trade PA, in plain English. Bug fixes, new features, the bits we polished. Newest at the top.</p>

__BODY__

  </main>

  <section class="cta-block">
    <h2>Get the latest, on every plan.</h2>
    <p>Everything below is included on every plan. New features ship continuously. You get them as soon as we deploy them.</p>
    <a href="/signup.html" class="cta-btn">Start free trial →</a>
    <span class="cta-note">Free for 30 days. No card needed.</span>
  </section>

  <footer>
    © 2026 TRADEPA LTD · Company No. 17176983 ·
    <a href="/privacy-policy.html">Privacy</a> ·
    <a href="/terms.html">Terms</a> ·
    <a href="/blog/">Blog</a> ·
    <a href="/">Home</a>
  </footer>

</body>
</html>
"""

output = template.replace("__BODY__", html_body).replace("__LATEST__", latest)
DST.write_text(output, encoding="utf-8")
print(f"OK rendered {SRC.name} → {DST.name} ({len(output)} bytes, latest update {latest})")
