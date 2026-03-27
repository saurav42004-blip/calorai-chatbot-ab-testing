# CalorAI — Analytics Dashboard

> A minimal, self-contained analytics dashboard that visualises A/B test results for the CalorAI Telegram chatbot experiment.

---

## What It Does

The dashboard is a single HTML file (`calorai_dashboard.html`) that renders three key experiment visualisations in real time:

| # | Visualisation | Data Source |
|---|---|---|
| 1 | **Daily meal logging activity** — bar + trend line over the past 7 days | `meals` table (`created_at`, `user_id`) |
| 2 | **A/B group distribution** — donut chart of Control vs. Test users | `users` table (`group` column) |
| 3 | **Onboarding funnel** — step-by-step conversion with drop-off rates for the Test group | `events` table (`event_name` = `onboarding_step_*`, `onboarding_complete`) |

It also includes four top-level KPI cards (total users, meals logged in 7 days, onboarding completion rate, test/control split) and an event breakdown table showing returning-user rates by group.

---

## File

```
calorai_dashboard.html    ← everything in one file, zero build step
```

No framework, no bundler, no server required. Open in any browser.

---

## Tech Used

- **Chart.js 4.4** (loaded from cdnjs CDN) — bar chart and donut chart
- **Vanilla HTML + CSS + JS** — funnel bars, KPI cards, event table
- **Google Fonts** — Syne (headings) + IBM Plex Mono (data values)

---

## How to Run

### Option 1 — Open Directly

Download `calorai_dashboard.html` and double-click it. Works in Chrome, Firefox, Safari, and Edge with no installation.

### Option 2 — Serve Locally

```bash
# Python (any machine with Python 3)
python -m http.server 8080
# then open http://localhost:8080/calorai_dashboard.html
```

---

## Connecting to Live Supabase Data

The dashboard currently renders realistic sample data that mirrors the production schema. To wire it to your live database, replace the hardcoded values inside the `<script>` block with `fetch()` calls to the Supabase REST API.

### Step 1 — Add your credentials

At the top of the `<script>` block, add:

```js
const SUPABASE_URL = "https://your-project-id.supabase.co";
const SUPABASE_ANON_KEY = "your-anon-key";

const sb = (path, params = "") =>
  fetch(`${SUPABASE_URL}/rest/v1/${path}?${params}`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  }).then((r) => r.json());
```

### Step 2 — Fetch each dataset

**Daily meal counts (past 7 days)**

```js
const meals = await sb(
  "meals",
  "select=date,id&created_at=gte." +
    new Date(Date.now() - 7 * 864e5).toISOString()
);
```

**Group distribution**

```js
const users = await sb("users", "select=user_id,group");
const control = users.filter((u) => u.group === "control").length;
const test    = users.filter((u) => u.group === "test").length;
```

**Onboarding funnel events (Test group)**

```js
const events = await sb(
  "events",
  "select=event_name,user_id&value=eq.test"
);

const count = (name) =>
  new Set(events.filter((e) => e.event_name === name).map((e) => e.user_id)).size;

const funnel = {
  step1:    count("onboarding_step_1_sent"),
  step2:    count("onboarding_step_2_sent"),
  step3:    count("onboarding_step_3_sent"),
  complete: count("onboarding_complete"),
};
```

### Step 3 — Pass data into Chart.js

Replace the hardcoded arrays in the chart initialisations with the values fetched above. For example, for the meal bar chart:

```js
// Before (sample data)
const mealData = [142, 168, 155, 201, 189, 224, 263];

// After (live data)
const mealData = last7Days.map((day) =>
  meals.filter((m) => m.date === day).length
);
```

---

## Dashboard Sections

### KPI Cards

| Card | Value Shown | Accent Colour |
|---|---|---|
| Total Users | Count of all rows in `users` | Green |
| Meals Logged (7d) | Count of rows in `meals` in the last 7 days | Orange |
| Onboarding Rate | `onboarding_complete` / Test group size | Blue |
| Test / Control Split | Ratio of assigned groups | Purple |

### Chart 1 — Daily Meal Logging Activity

A bar chart with an overlaid trend line. Each bar represents the number of meals logged on that day. The most recent day is highlighted in full green. Sourced from the `meals` table grouped by `date`.

### Chart 2 — A/B Group Distribution

A donut chart showing the percentage of users in each group. The centre label shows the total user count. Sourced from `users.group`.

### Chart 3 — Onboarding Funnel (Test group only)

A horizontal funnel built with CSS bars showing conversion at each stage:

```
Step 1 — Breakfast prompt sent        100%  (126 users)
  ▼ −13% drop-off
Step 2 — Health goal prompt sent       87%  (110 users)
  ▼ −10% drop-off
Step 3 — Meal count prompt sent        77%   (97 users)
  ▼  −9% drop-off
Onboarding Complete                    68%   (86 users)
```

### Event Breakdown Table

Shows raw event counts and conversion rates for all key events split by group, sourced from the `events` table.

---

## Design Decisions

- **Single-file, zero dependencies (outside CDN)** — easiest to submit, host, or share. No npm, no build step.
- **Dark theme** — matches the Supabase schema aesthetic and suits a data-heavy dashboard.
- **Funnel built in CSS, not a chart library** — gives precise control over drop-off labels and avoids an extra JS dependency.
- **Chart.js over D3** — sufficient for these three chart types, far simpler to configure, and easy for reviewers to follow.

---

## Metrics Visualised and Why

| Metric | Why It Was Chosen |
|---|---|
| Daily meal logging (7d) | Primary experiment metric — tracks activation and early habit formation directly from the `meals` table |
| Group distribution | Validates that Statsig's random assignment produced a balanced split (target ≈ 50/50) |
| Onboarding funnel completion | Secondary metric — shows where Test-group users drop off during the guided flow, informing future copy or UX iterations |

---

## Database Schema Reference

```
users     → user_id (PK), username, first_name, group, onboarding_step, created_at
events    → id (PK), user_id (FK), event_name, value, event_time
messages  → id (PK), user_id (FK), message, msg_time
meals     → id (PK), user_id (FK), date, meal, meal_type, created_at
```

---

## Author

Built as Bonus Task 3 of the CalorAI A/B Test Chatbot assignment.
Stack: n8n · Statsig · Supabase · Telegram Bot API · Chart.js
