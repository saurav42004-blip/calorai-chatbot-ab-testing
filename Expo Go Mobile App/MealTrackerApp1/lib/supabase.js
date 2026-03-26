import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// ─────────────────────────────────────────────
//  🔑  REPLACE THESE WITH YOUR SUPABASE CREDENTIALS
//  Find them in: Supabase Dashboard → Settings → API
// ─────────────────────────────────────────────
const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// ─────────────────────────────────────────────
//  🔑  YOUR TELEGRAM CHAT ID (user_id in DB)
//  Get it by messaging @userinfobot on Telegram
//  This must match the chat.id used by your n8n bot
// ─────────────────────────────────────────────
export const TELEGRAM_USER_ID = 'YOUR_TELEGRAM_CHAT_ID';
