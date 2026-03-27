# CalorAI — A/B Test Chatbot

A Telegram chatbot that automatically assigns every new user to a Control or Test group via Statsig, runs a differentiated onboarding experience for each group, and logs every key event to Supabase.

---

## What It Does

Every new user is silently assigned by **Statsig** to one of two groups:

| Group | Experience |
|---|---|
| **Control** | Receives a single generic welcome message and is free to explore |
| **Test** | Walks through a guided 3-step onboarding flow — breakfast log, health goal, and daily meal count |

Returning users are routed based on their stored group and onboarding progress. All events are logged to Supabase and mirrored to Statsig.

---

## Tech Stack

| Component | Technology |
|---|---|
| Chatbot interface | Telegram Bot API |
| Workflow automation | n8n |
| A/B assignment | Statsig (`/v1/initialize` + `/v1/log_event`) |
| Database | Supabase (PostgreSQL) |

---

## Database Schema

### `users`

| Column | Type | Notes |
|---|---|---|
| `user_id` | int8 · PK | Telegram user ID |
| `username` | text | Telegram handle |
| `first_name` | text | Display name |
| `group` | text | `"control"` or `"test"` — set by Statsig |
| `onboarding_step` | int4 | `0` = new · `1–3` = in progress · `4` = complete |
| `created_at` | timestamptz | Auto-set on insert |

### `events`

Append-only log of every tracked action.

| Column | Type | Notes |
|---|---|---|
| `id` | int8 · PK | Auto-increment |
| `user_id` | int8 · FK | References `users.user_id` |
| `event_name` | text | See event taxonomy below |
| `value` | text | Group name or answer text |
| `event_time` | timestamptz | Auto-set on insert |

### `messages`

Stores raw user replies during onboarding.

| Column | Type | Notes |
|---|---|---|
| `id` | int8 · PK | Auto-increment |
| `user_id` | int8 · FK | References `users.user_id` |
| `message` | text | Full text of the user's reply |
| `msg_time` | timestamptz | Auto-set on insert |

---

## Event Taxonomy

| Event Name | When It Fires | Group |
|---|---|---|
| `user_assigned` | New user is assigned a group | Both |
| `control_start` | Control welcome message is sent | Control |
| `onboarding_step_1_sent` | Breakfast prompt is delivered | Test |
| `onboarding_step_2_sent` | Health goal prompt is delivered | Test |
| `onboarding_step_3_sent` | Meal count prompt is delivered | Test |
| `onboarding_complete` | User answers all 3 steps | Test |
| `returning_user` | Existing user sends any message | Both |

---

## n8n Workflow Overview

The workflow (`calorai_ab_test.json`) contains 34 nodes across two branches.

**New user flow:**
```
Telegram Trigger → Extract User → Check User Exists → Statsig Assign
  → Extract Group → Insert User → Log Assignment
  → Control or Test?
      ├── Control → Send Welcome Message → Log control_start
      └── Test    → Send Step 1 Prompt   → Set Step 1 → Log step_1_sent
```

**Returning user flow:**
```
→ Get User Details → Control or Test?
    ├── Control → Send Welcome Back → Log returning_user
    └── Test    → Route by Onboarding Step (Switch)
                    ├── Step 1 → Store Answer → Send Step 2 → Set Step 2
                    ├── Step 2 → Store Answer → Send Step 3 → Set Step 3
                    ├── Step 3 → Store Answer → Send Complete Message → Set Step 4 → Log onboarding_complete
                    └── Done   → Send Welcome Back → Log returning_user
```

---

## Setup & Credentials

### Telegram Bot
- Credential type: **Telegram API**
- Obtain a bot token from [@BotFather](https://t.me/BotFather)

### Supabase
- Credential type: **Supabase API**
- Project URL and Service Role Key from Supabase → Settings → API

### Postgres (direct)
- Used only by the Check User Exists node for a raw `COUNT(*)` query
- Host: `db.your-project-id.supabase.co` · Port: `5432` · Database: `postgres`

### Statsig
- API key is passed directly in HTTP Request headers (no n8n credential object needed)
- Key: `STATSIG-API-KEY: secret-xxxx`

---

## How to Import the Workflow

1. Open your n8n instance.
2. Go to **Workflows → Import from File**.
3. Select `calorai_ab_test.json`.
4. Update the Telegram, Supabase, and Postgres credentials to your own.
5. Click **Activate**.

---
