# 🥗 MealTracker — Expo App (Bonus Task 2)

A React Native app (Expo Go) that syncs in real-time with your n8n Telegram meal-tracking bot via Supabase, **plus push notifications** for daily reminders and daily summaries.

---

## 🆕 What's New in v2 (Bonus Task 2)

| Feature | How it works |
|---|---|
| **Real-time sync** | Supabase Realtime `postgres_changes` WebSocket — app updates the moment Telegram bot writes a meal, no refresh needed |
| **Daily reminder (8 PM)** | Local scheduled notification set by the app itself via `expo-notifications` |
| **Daily summary (9 PM)** | n8n cron job queries Supabase → sends per-user push via Expo Push API |
| **📊 button** | Tap the button in the header to fire an instant local summary anytime |

---

## 🚀 Quick Start

### 1. Install dependencies

```bash
cd MealTrackerApp
npm install
```

### 2. Configure credentials in `lib/supabase.js`

```js
const SUPABASE_URL      = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
export const TELEGRAM_USER_ID = 'YOUR_TELEGRAM_CHAT_ID';
```

### 3. Create the `push_tokens` table in Supabase SQL Editor

```sql
CREATE TABLE IF NOT EXISTS push_tokens (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     TEXT        NOT NULL UNIQUE,
  token       TEXT        NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON push_tokens FOR ALL USING (true) WITH CHECK (true);
```

### 4. Enable Supabase Realtime on the `meals` table

Dashboard → Database → Replication → toggle `meals`.

### 5. Start the app

```bash
npx expo start
```

On first launch the app will ask for notification permission, save your Expo push token to Supabase, and schedule the 8 PM daily reminder automatically.

---

## 🔔 n8n Push Notification Workflows

Import both JSON files into n8n (New Workflow → ⋮ → Import from file):

| File | Schedule | What it sends |
|---|---|---|
| `n8n_daily_reminder_workflow.json` | Every day 8:00 PM | "Time to log your meals!" |
| `n8n_daily_summary_workflow.json`  | Every day 9:00 PM | Meal count + types logged today |

After importing, update the Supabase credential to your existing account and **Activate** each workflow.

---

## 🏗 Project Structure

```
MealTrackerApp/
├── App.js                             # Navigation + notification bootstrap
├── app.json                           # Expo config (notification plugin)
├── package.json                       # expo-notifications, expo-device added
├── lib/
│   ├── supabase.js                    # Supabase client
│   └── notifications.js              # 🆕 Permissions, token, scheduling
├── screens/
│   ├── MealLogScreen.js              # Meal list + 📊 summary button
│   └── AddEditMealScreen.js
├── n8n_daily_reminder_workflow.json  # 🆕 8 PM reminder n8n workflow
└── n8n_daily_summary_workflow.json   # 🆕 9 PM summary n8n workflow
```

---

## 🔄 Full System Architecture

```
┌──────────────────────────────────────────────────────────┐
│                      SUPABASE                            │
│   ┌─────────────┐         ┌──────────────┐              │
│   │  meals      │◄───────►│  push_tokens │              │
│   └──────┬──────┘         └──────┬───────┘              │
│          │ Realtime WS           │ Read by n8n          │
└──────────┼───────────────────────┼──────────────────────┘
           │                       │
    ┌──────▼──────┐       ┌────────▼──────────────────┐
    │  Expo App   │       │  n8n                      │
    │  • Realtime │       │  8 PM: reminder workflow  │
    │  • 8 PM     │       │  9 PM: summary  workflow  │
    │    local    │       └──────────┬────────────────┘
    │    reminder │                  │ HTTP POST
    └──────┬──────┘         ┌───────▼──────────┐
           │◄───────────────│ Expo Push API    │
           │  push notif    │ exp.host         │
    ┌──────▼──────┐         └──────────────────┘
    │  Telegram   │──► writes meals ──► Supabase
    └─────────────┘
```

---

## 🛠 New Supabase Table

### `push_tokens`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | text | Telegram chat.id (UNIQUE) |
| `token` | text | `ExponentPushToken[…]` |
| `updated_at` | timestamptz | Auto |

---

## ❓ Troubleshooting

**No notifications** → Allowed notifications when prompted? iOS: Settings → MealTracker → Notifications.

**Push token not saved** → Check `push_tokens` table exists and RLS allows anon inserts.

**Wrong summary count** → Check n8n Code node execution log; verify `date` field format matches `yyyy-MM-dd`.

**"Live" badge red** → Supabase Realtime WebSocket failed. Check URL and anon key in `supabase.js`.
