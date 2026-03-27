# Health Chatbot

A Telegram-based meal tracking chatbot powered by an AI agent. Users can log, view, edit, and delete meals through natural language — no commands or strict formatting required.

---

## What It Does

| Action | What the User Says (examples) |
|---|---|
| **Log a meal** | "I had oats for breakfast" · "Add rice and dal for lunch" |
| **View meals** | "What did I eat today?" · "Show my meals" |
| **Edit a meal** | "Change my lunch to pasta" · "Update breakfast to eggs" |
| **Delete a meal** | "Remove my dinner entry" · "Delete the snack I logged" |

The AI agent interprets the user's intent and calls the appropriate Supabase tool automatically. If a required field (meal or meal type) is missing, it asks only for what's needed, then acts immediately.

---

## Tech Stack

| Component | Technology |
|---|---|
| Chatbot interface | Telegram Bot API |
| Workflow automation | n8n |
| AI agent & reasoning | GPT-4.1-mini (OpenAI) via n8n LangChain agent |
| Conversation memory | Postgres-backed chat memory (last 8 messages) |
| Database | Supabase (PostgreSQL) |

---

## Workflow Overview

```
Telegram Trigger
  → Switch (text message only?)
      ├── Non-text → Send error message ("Please use text format only")
      └── Text     → Edit Fields (extract message text)
                       → AI Agent
                           ├── [tool] create_meals
                           ├── [tool] get_meals
                           ├── [tool] update_meal
                           └── [tool] delete_meal
                       → Send reply to user
```

The Switch node filters out non-text messages (images, stickers, voice notes) before they reach the agent.

---

## AI Agent Tools

| Tool | Operation | Trigger Condition |
|---|---|---|
| `create_meals` | INSERT into `meals` | User wants to log a new meal |
| `get_meals` | SELECT from `meals` filtered by `user_id` and `date` | User wants to view meals, or before any edit/delete |
| `update_meal` | UPDATE `meals` by `id` | User wants to change a logged entry |
| `delete_meal` | DELETE from `meals` by `id` | User wants to remove a logged entry |

All tools are scoped to the user's Telegram `chat.id`, so data is always user-specific.

---

## Database Schema

### `meals`

| Column | Type | Notes |
|---|---|---|
| `id` | int8 · PK | Auto-increment |
| `user_id` | int8 | Telegram `chat.id` |
| `meal` | text | Preserved exactly as the user described it |
| `meal_type` | text | Normalised: breakfast / lunch / dinner / snack |
| `date` | date | Defaults to today if not specified |
| `created_at` | timestamptz | Auto-set on insert |

---

## Setup & Credentials

### Telegram Bot
- Credential type: **Telegram API**
- Obtain a token from [@BotFather](https://t.me/BotFather)
- Set the webhook:
```
https://api.telegram.org/bot<TOKEN>/setWebhook?url=<YOUR_N8N_WEBHOOK_URL>
```

### OpenAI
- Credential type: **OpenAI API**
- Model used: `gpt-4.1-mini`

### Supabase
- Credential type: **Supabase API**
- Project URL and Service Role Key from Supabase → Settings → API

### Postgres (Chat Memory)
- Used by the Chat Memory node to persist conversation context per user
- Same Postgres instance as Supabase: `db.your-project-id.supabase.co`

---

## How to Import the Workflow

1. Open your n8n instance.
2. Go to **Workflows → Import from File**.
3. Select `health_chatbot.json`.
4. Update the Telegram, OpenAI, Supabase, and Postgres credentials to your own.
5. Click **Activate**.

---
