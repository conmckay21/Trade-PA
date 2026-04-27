# Uptime Monitoring Setup — Trade PA
**Created:** 27 April 2026
**Effort:** ~30 minutes setup, fully automated thereafter
**Cost:** Free tier covers everything we need

---

## What this gives you

External monitoring that pings critical Trade PA endpoints every 5 minutes from multiple global locations. If anything goes down — DNS, Vercel, Supabase, Anthropic API — you get an SMS/email alert within ~10 minutes instead of waiting for a user to complain.

**Without this:** the first sign of an outage is an unhappy customer.
**With this:** you know about outages before customers do, and have data on uptime % for SLA conversations later.

---

## Recommended provider: UptimeRobot

**Why UptimeRobot specifically:**
- Free tier: 50 monitors, 5-minute interval, 12-month log retention. We need ~6 monitors total.
- SMS alerts on free tier (limited to a few/month — fine for genuine outages)
- Email alerts unlimited
- Status page (public) included free — useful for the website footer later
- 17-year-old company, reliable themselves

**Alternatives if you prefer:**
- **BetterUptime / Better Stack:** Slicker UI, status pages built-in, better incident management. Free tier 10 monitors. Worth $18/mo at scale.
- **Pingdom:** Industry standard, more expensive, overkill for now.
- **Cronitor:** Specialised for cron job heartbeats. Could be paired with UptimeRobot if you want stronger cron monitoring.

Going with UptimeRobot below — easy to migrate later if you outgrow it.

---

## Step-by-step setup

### 1. Create the account (5 min)

1. Go to **https://uptimerobot.com/signUp**
2. Sign up with `connor@tradespa.co.uk` (or whichever inbox you watch most)
3. Verify the email
4. Skip the upgrade prompts — free tier is plenty for now

### 2. Add the monitors (15 min)

For each one below, click **"+ New monitor"** in the dashboard.

#### Monitor 1: Marketing site / app entry point
- **Type:** HTTPS
- **Friendly name:** `tradespa.co.uk — main site`
- **URL:** `https://tradespa.co.uk`
- **Monitoring interval:** 5 minutes
- **What it catches:** DNS issues, Vercel outage, expired SSL cert

#### Monitor 2: Claude API gateway (the most important user-facing endpoint)
- **Type:** HTTP(S) — Keyword
- **Friendly name:** `tradespa.co.uk — /api/claude (auth)`
- **URL:** `https://tradespa.co.uk/api/claude`
- **HTTP method:** POST
- **Keyword:** `Authentication required`
- **Keyword exists:** Yes (alert if this string is NOT in the response)
- **Monitoring interval:** 5 minutes
- **What it catches:** API gateway down, env vars wiped, deployment failure
- **Why this works:** an unauthenticated POST gets a 401 with body `{"error":"Authentication required"}`. We're checking the AUTH layer is up — without exposing real data to UptimeRobot.

#### Monitor 3: Reminder cron heartbeat
- **Type:** HTTPS
- **Friendly name:** `Reminders cron — last run`
- **URL:** `https://tradespa.co.uk/api/cron/process-reminders` (returns 401 without auth — that's a healthy sign the route exists)
- **Expected status code:** 401
- **Monitoring interval:** 5 minutes
- **What it catches:** Vercel cron infrastructure broken (the 401 actually proves the function is reachable; if it's a 404 or 500 something's wrong)

#### Monitor 4: Stripe webhook handler
- **Type:** HTTPS
- **Friendly name:** `Stripe webhook endpoint`
- **URL:** `https://tradespa.co.uk/api/stripe/webhook`
- **HTTP method:** POST
- **Expected status code:** 400  *(no signature → Stripe SDK throws → 400)*
- **Monitoring interval:** 5 minutes
- **What it catches:** webhook handler crashed = silently broken billing

#### Monitor 5: Customer portal (quote/invoice viewing)
- **Type:** HTTPS
- **Friendly name:** `Customer portal`
- **URL:** `https://tradespa.co.uk/api/portal?action=ping`
- **Expected status code:** 400 *(missing token = 400, but route exists)*
- **Monitoring interval:** 5 minutes
- **What it catches:** customer-facing quote-acceptance flow broken

#### Monitor 6: Anthropic API reachability (canary)
- **Type:** HTTPS
- **Friendly name:** `Anthropic API canary`
- **URL:** `https://api.anthropic.com/v1/messages`
- **HTTP method:** POST
- **Expected status code:** 401 *(no API key = 401, route healthy)*
- **Monitoring interval:** 15 minutes *(don't hammer their endpoint)*
- **What it catches:** Anthropic API outage. You'll see this BEFORE your users do.

### 3. Configure alerts (5 min)

In **My Settings → Alert Contacts**:

1. Add primary contact: `connor@tradespa.co.uk` (alert on Down + Up + SSL warnings)
2. Add SMS contact: your mobile number (alert on Down only — saves SMS quota)
3. **Optional:** Slack/Discord webhook if you want it in a channel

In **My Settings → Notifications**:
- **Notify when monitor is down:** YES (alert after 2 consecutive failures — avoids one-off blips)
- **Notify when monitor is up:** YES (so you know when it's recovered)
- **Daily/weekly status report:** YES, weekly — useful for spotting trends

### 4. Optional: public status page (5 min)

In **Status Pages → + New Public Status Page**:
- Name: `Trade PA Status`
- Subdomain: `tradepa` → gives you `https://stats.uptimerobot.com/tradepa`
- Add all 6 monitors to the page
- Custom CSS (optional): match the amber/black brand colours

You can later link this from the marketing site footer ("System status →") or in your transactional emails. Useful trust signal for B2B customers.

---

## What "good" looks like

After 7 days of monitoring you should see:
- All 6 monitors at >99.5% uptime
- No more than 1-2 alerts per week (Vercel deploys cause brief blips)
- Average response time on `/api/claude`: <500ms

If you see any monitor consistently below 99% — that's a real signal worth investigating.

---

## What this DOESN'T cover

Be honest with yourself about the gaps:

- **Doesn't catch:** slow queries, intermittent JS errors, broken voice flow, AI returning wrong answers
- **Does catch:** total outages, expired SSL, route 500s, third-party dependency failures

For deeper observability later (when you have 100+ users):
- Sentry already covers JS errors and slow API routes
- Consider adding Logtail / Better Stack Logs for structured request logging
- Consider pgHero on Supabase for slow query detection

---

## Maintenance

- **Monthly:** glance at the dashboard, look at the response-time graphs
- **After deploys:** if a monitor goes red for >5 min, rollback in Vercel
- **At ~500 users:** consider upgrading to UptimeRobot Pro ($7/mo) for 1-minute interval + more SMS

---

## Done — you'll know setup worked when...

1. All 6 monitors show green "Up" status within 10 minutes
2. You receive a "Monitor X is now monitored" email per monitor
3. (Optional test) Manually take down a monitor by changing its URL to `https://tradespa.co.uk/this-does-not-exist` — within ~10 min you should get a Down alert. Reset the URL afterwards.

---

*Setup time: 30 min. Maintenance: <5 min/week. Coverage: catches 90% of real outage classes before users do.*
