# CalorAI — Telegram Chatbot & A/B Testing

A full-stack health chatbot system built on Telegram, n8n, and Supabase. The project includes an A/B test experiment with Statsig, an AI-powered meal tracking chatbot, a React Native mobile app, real-time sync with push notifications, and an analytics dashboard.

---

## What's Included

| Task | Description |
|---|---|
| **A/B Test Chatbot** | New users are randomly assigned to Control (generic welcome) or Test (guided 3-step onboarding) via Statsig. All events are logged to Supabase and Statsig. |
| **Health Chatbot** | AI-powered Telegram bot where users can log, view, edit, and delete meals using natural language. Backed by GPT-4.1-mini and Supabase. |
| **Expo Go Mobile App** | React Native app synced with the same Supabase backend. Users can view, add, edit, and delete meals from the app. |
| **Real-time Sync & Push Notifications** | Supabase Realtime reflects meal changes instantly in the app. Daily reminder and summary push notifications via Expo. |
| **Analytics Dashboard** | Single-page HTML dashboard visualising daily meal activity, A/B group distribution, and onboarding funnel completion. |

---

## Repository Structure

```
.
├── A-B Test Chatbot/          # n8n A/B test chatbot workflow
│   ├── README.md
│   ├── Test Chatbot.json
│   ├── evaluation_plan.md
│   └── workflow.png
├── Analytics Dashboard/         # Sample filled Analytics Dashboard
│   ├── siteImages/
│   ├── README.md
│   └── calorai_dashboard.html
├── Expo Go Mobile App/                   # Expo Go React Native app
│   ├── MealTrackerApp(v1.1)/
│   │   └──...
│   ├── MealTrackerApp(v2.1)/
│   │   └──...
├── Health Chatbot (Tele)          # n8n health chatbot workflow
│   ├── README.md
│   ├── health_chatbot.json
│   └── workflow.png
├── LICENSE        
└── README.md                     # This file
```

---

## Architecture Overview

```
User (Telegram)
      │
      ▼
  n8n Workflows
  ├── A/B Test Chatbot
  │     ├── Statsig  → group assignment (Control / Test)
  │     └── Supabase → users, events tables
  └── Health Chatbot
        ├── GPT-4.1-mini (AI Agent)
        └── Supabase → meals table
                │
                ▼
         Supabase Realtime
                │
                ▼
         Expo Mobile App
         ├── Live meal sync
         └── Push Notifications (Expo)
                │
                ▼
      Analytics Dashboard (HTML + Chart.js)
      └── reads from users, events, meals tables
```

---

## Tools & Services

| Tool | Why |
|---|---|
| **n8n** | Visual workflow automation — handles Telegram webhooks, branching logic, and all database operations without custom backend code |
| **Statsig** | Purpose-built A/B testing platform with deterministic user assignment and a built-in stats engine for analysing results |
| **Supabase** | Managed Postgres with a REST API, Realtime subscriptions, and row-level security — single backend for both the chatbot and mobile app |
| **GPT-4.1-mini** | Fast and cost-efficient model well-suited for intent classification and structured tool-calling in the health chatbot |
| **Expo Go** | Quickest way to ship a cross-platform React Native app without native build tooling |
| **Chart.js** | Lightweight charting library with zero build step — sufficient for the three visualisations needed in the dashboard |

---

## Database Schema

### `users`
| Column | Type | Notes |
|---|---|---|
| `user_id` | int8 · PK | Telegram chat ID |
| `username` | text | Telegram handle |
| `first_name` | text | Display name |
| `group` | text | `"control"` or `"test"` |
| `onboarding_step` | int4 | 0 = new · 1–3 = in progress · 4 = complete |
| `created_at` | timestamptz | Auto-set |

### `events`
| Column | Type | Notes |
|---|---|---|
| `id` | int8 · PK | Auto-increment |
| `user_id` | int8 · FK | References `users` |
| `event_name` | text | `user_assigned`, `onboarding_step_1_sent`, `onboarding_complete`, `returning_user`, etc. |
| `value` | text | Group name or answer text |
| `event_time` | timestamptz | Auto-set |

### `messages`
| Column | Type | Notes |
|---|---|---|
| `id` | int8 · PK | Auto-increment |
| `user_id` | int8 · FK | References `users` |
| `message` | text | Raw onboarding reply text |
| `msg_time` | timestamptz | Auto-set |

### `meals`
| Column | Type | Notes |
|---|---|---|
| `id` | int8 · PK | Auto-increment |
| `user_id` | int8 · FK | Telegram chat ID |
| `meal` | text | Free-text meal description |
| `meal_type` | text | breakfast / lunch / dinner / snack |
| `date` | date | Defaults to today |
| `created_at` | timestamptz | Auto-set |

---

## Environment Variables

Create a `.env` file in the `mobile-app/` directory:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

For n8n, configure the following credentials inside the n8n UI:

| Credential | Used By |
|---|---|
| Telegram API (`SK_Prop_Ass`) | Both chatbot workflows |
| Supabase API (`SK Account`) | Both chatbot workflows |
| PostgreSQL (`SK Postgres account`) | A/B test workflow (user existence check) + chat memory |
| OpenAI API | Health chatbot (GPT-4.1-mini) |
| Statsig API key (in HTTP Request headers) | A/B test workflow |

> ⚠️ Rotate the Statsig API key before making the repository public.

---

## Setup Instructions

### 1 · Supabase

1. Create a new Supabase project.
2. Run the following in the SQL editor to create the required tables:

```sql
create table users (
  user_id bigint primary key,
  username text,
  first_name text,
  "group" text,
  onboarding_step int default 0,
  created_at timestamptz default now()
);

create table events (
  id bigserial primary key,
  user_id bigint references users(user_id),
  event_name text,
  value text,
  event_time timestamptz default now()
);

create table messages (
  id bigserial primary key,
  user_id bigint references users(user_id),
  message text,
  msg_time timestamptz default now()
);

create table meals (
  id bigserial primary key,
  user_id bigint,
  meal text,
  meal_type text,
  date date default current_date,
  created_at timestamptz default now()
);
```

3. Enable **Realtime** on the `meals` table: Supabase → Database → Replication → `meals`.

### 2 · Telegram Bots

Create two bots via [@BotFather](https://t.me/BotFather) — one for the A/B test workflow and one for the health chatbot. Set the webhook for each:

```
https://api.telegram.org/bot<TOKEN>/setWebhook?url=<YOUR_N8N_WEBHOOK_URL>
```

### 3 · n8n Workflows

1. Open your n8n instance.
2. Import `calorai_ab_test.json` and `health_chatbot.json` via **Workflows → Import from File**.
3. Update all credentials (Telegram, Supabase, Postgres, OpenAI, Statsig key).
4. Activate both workflows.

### 4 · Mobile App

```bash
cd mobile-app
npm install
npx expo start
```

Scan the QR code with the Expo Go app on your device. Make sure `.env` is configured with your Supabase credentials.

---

## Assumptions & Trade-offs

- **user_id = Telegram chat.id** — Used the Telegram `chat.id` as the primary user identifier across all tables and tools. This is consistent and requires no auth layer, but means one Supabase row per Telegram chat (not per Telegram account, which would differ in group chats).
- **Statsig implicit gate read** — The A/B test workflow reads `Object.values(feature_gates)[0]` rather than a named gate. This works as long as only one gate is active in the Statsig project.
- **No command parser in A/B bot** — Every message triggers the entry flow. A `/log` or `/start` command router was out of scope for the A/B test workflow; the health chatbot handles this via AI intent detection instead.
- **Sample data in dashboard** — The analytics dashboard renders realistic mock data aligned to the schema. Wiring it to live Supabase requires adding `fetch()` calls with the project's anon key (documented in the dashboard README).
- **Chat memory window set to 8** — The Postgres-backed chat memory in the health chatbot retains the last 8 messages per user. Sufficient for meal operations but would need tuning for longer conversational flows.

---

## Time Breakdown

| Task | Time Spent |
|---|---|
| A/B Test Chatbot | ~5h 23m (Lap 1 + Lap 5) |
| Health Chatbot | ~52m (Lap 2) |
| Expo Go Mobile App | ~25m (Lap 3) |
| Real-time Sync & Push Notifications | ~48m (Lap 4) |
| Analytics Dashboard | ~28m (Lap 6) |
| **Total** | **~7h 57m** |

---
