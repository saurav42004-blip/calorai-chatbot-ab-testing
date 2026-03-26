# 🥗 MealTracker — Expo Go App

A React Native app (Expo Go) that syncs in real-time with your n8n Telegram meal-tracking bot via Supabase.

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Expo Go app installed on your phone ([iOS](https://apps.apple.com/app/expo-go/id982107779) / [Android](https://play.google.com/store/apps/details?id=host.exp.exponent))

### 1. Install dependencies

```bash
cd MealTrackerApp
npm install
```

### 2. Configure credentials

Open `lib/supabase.js` and fill in your values:

```js
// Your Supabase project URL (Settings → API → Project URL)
const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';

// Your anon/public key (Settings → API → Project API keys)
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

// Your Telegram Chat ID — message @userinfobot on Telegram to get it
// This MUST match the chat.id your n8n bot is using as user_id
export const TELEGRAM_USER_ID = 'YOUR_TELEGRAM_CHAT_ID';
```

> **Where to find your Supabase credentials:**  
> Supabase Dashboard → Your Project → Settings → API

> **Where to find your Telegram Chat ID:**  
> Open Telegram → search `@userinfobot` → send any message → it replies with your ID

### 3. Enable Supabase Realtime

In your Supabase dashboard:
1. Go to **Database → Replication**
2. Enable **realtime** for the `meals` table
3. Also go to **Database → Tables → meals → RLS Policies** and make sure the table allows `SELECT`, `INSERT`, `UPDATE`, `DELETE` using the anon key (or disable RLS for development)

### 4. Start the app

```bash
npx expo start
```

Scan the QR code with Expo Go on your phone.

---

## 📱 Features

| Feature | Description |
|---|---|
| **Meal Log** | Lists all meals grouped by date, sorted by meal type order (breakfast → dinner) |
| **Real-time Sync** | Uses Supabase Realtime — changes from Telegram bot appear instantly |
| **Add Meal** | Tap `+` FAB to log a new meal with type, description, and date |
| **Edit Meal** | Tap ✏️ on any card to edit it |
| **Delete Meal** | Tap 🗑️ on any card to delete with confirmation |
| **Today's Progress** | Stats bar at the top shows which meal types you've logged today |
| **Quick Suggestions** | Pre-filled meal suggestions per meal type |
| **Pull to Refresh** | Manual refresh on the meal list |

---

## 🏗 Project Structure

```
MealTrackerApp/
├── App.js                    # Navigation setup
├── app.json                  # Expo config
├── package.json              # Dependencies
├── babel.config.js           # Babel config
├── lib/
│   └── supabase.js           # Supabase client + user ID config
└── screens/
    ├── MealLogScreen.js      # Main screen: list, delete, realtime
    └── AddEditMealScreen.js  # Add & edit screen
```

---

## 🔄 How Sync Works

```
Telegram message
      │
      ▼
n8n Workflow ──► Supabase `meals` table ◄──► Expo App
                         │
                  Supabase Realtime
                  (postgres_changes)
                         │
                    App updates
                    instantly ✅
```

Both the Telegram bot (via n8n) and the mobile app read/write to the **same Supabase table** using the **same `user_id`** (your Telegram chat ID). Supabase Realtime pushes changes to the app as WebSocket events.

---

## 🛠 Supabase Table Schema (reference)

Your `meals` table should have these columns:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid / int | Primary key, auto-generated |
| `user_id` | text | Telegram chat.id |
| `meal` | text | What was eaten |
| `meal_type` | text | breakfast / lunch / snack / dinner |
| `date` | date | YYYY-MM-DD |
| `created_at` | timestamptz | Auto-set by Supabase |

---

## ❓ Troubleshooting

**"Could not load meals"** → Check your `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `lib/supabase.js`

**Realtime not working** → Make sure Realtime is enabled for the `meals` table in Supabase Dashboard

**Data not syncing with Telegram bot** → Confirm `TELEGRAM_USER_ID` matches exactly the `chat.id` your n8n workflow uses

**RLS errors** → Either add an RLS policy that allows anon access, or temporarily disable RLS on the `meals` table during development
