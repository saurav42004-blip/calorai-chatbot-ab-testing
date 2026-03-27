/**
 * notifications.js — MealTracker Bonus Task 2
 * ─────────────────────────────────────────────────────────────────────────────
 * Fixes vs previous version:
 *  - Removed Device.isDevice gate (was silently blocking on some setups)
 *  - Removed expo-constants import (caused silent crash if not installed)
 *  - Uses Alert for errors so they appear on screen, not just in terminal
 *  - getExpoPushTokenAsync called without projectId (correct for Expo Go)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform, Alert } from 'react-native';
import { supabase, TELEGRAM_USER_ID } from './supabase';

// ── How notifications appear when app is in FOREGROUND ───────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ── 1. REQUEST PERMISSIONS + GET PUSH TOKEN ──────────────────────────────────
export async function registerForPushNotificationsAsync() {
  console.log('[Notifications] Starting registration...');

  // Android requires channels to be created before any notification is shown
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('meal-reminders', {
      name: 'Meal Reminders',
      description: 'Daily reminders to log your meals',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#6366F1',
      sound: true,
    });
    await Notifications.setNotificationChannelAsync('meal-summary', {
      name: 'Daily Summary',
      description: 'End-of-day meal summary',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: true,
    });
    console.log('[Notifications] Android channels created.');
  }

  // Request permission
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  console.log('[Notifications] Existing permission status:', existingStatus);

  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    console.log('[Notifications] Requesting permission from user...');
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
    console.log('[Notifications] Permission result:', status);
  }

  if (finalStatus !== 'granted') {
    Alert.alert(
      '🔔 Notifications Disabled',
      'Enable notifications in your device Settings to receive meal reminders.',
      [{ text: 'OK' }]
    );
    return null;
  }

  // Get push token — projectId is required in SDK 49+
  // expo-constants is bundled with expo itself, no separate install needed
  try {
    console.log('[Notifications] Fetching Expo push token...');

    const projectId =
      Constants.easConfig?.projectId ??
      Constants.expoConfig?.extra?.eas?.projectId;

    if (!projectId) {
      throw new Error(
        'No EAS projectId found. Run "eas init" in your project to create one, ' +
        'then paste the projectId into app.json under expo.extra.eas.projectId'
      );
    }

    console.log('[Notifications] Using projectId:', projectId);
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data;
    console.log('[Notifications] Token received:', token);

    await _savePushTokenToSupabase(token);
    return token;
  } catch (err) {
    const msg = err?.message ?? String(err);
    console.error('[Notifications] getExpoPushTokenAsync failed:', msg);
    Alert.alert(
      'Push Token Error',
      `Could not get Expo push token:\n\n${msg}`,
      [{ text: 'OK' }]
    );
    return null;
  }
}

// ── 2. SAVE TOKEN TO SUPABASE ─────────────────────────────────────────────────
async function _savePushTokenToSupabase(token) {
  console.log('[Notifications] Saving token to Supabase, user_id:', String(TELEGRAM_USER_ID));
  try {
    const { error } = await supabase
      .from('push_tokens')
      .upsert(
        {
          user_id: String(TELEGRAM_USER_ID),
          token,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

    if (error) throw error;
    console.log('[Notifications] Token saved to Supabase successfully.');
  } catch (err) {
    const msg = err?.message ?? String(err);
    console.error('[Notifications] Failed to save token:', msg);
    Alert.alert(
      'Supabase Save Failed',
      `Could not save push token:\n\n${msg}\n\nCheck the push_tokens table exists and RLS allows inserts.`,
      [{ text: 'OK' }]
    );
  }
}

// ── 3. SCHEDULE DAILY LOCAL REMINDER ─────────────────────────────────────────
const REMINDER_IDENTIFIER = 'daily-meal-reminder';

export async function scheduleDailyReminder(hour = 20, minute = 0) {
  try {
    await Notifications.cancelScheduledNotificationAsync(REMINDER_IDENTIFIER).catch(() => {});
    await Notifications.scheduleNotificationAsync({
      identifier: REMINDER_IDENTIFIER,
      content: {
        title: '🍽 Time to log your meals!',
        body: "Don't forget to track everything you ate today. Tap to open Meal Tracker.",
        data: { type: 'daily_reminder' },
        sound: true,
        ...(Platform.OS === 'android' && { channelId: 'meal-reminders' }),
      },
      trigger: { hour, minute, repeats: true },
    });
    const t = `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
    console.log(`[Notifications] Daily reminder scheduled for ${t}.`);
  } catch (err) {
    console.error('[Notifications] Failed to schedule reminder:', err?.message ?? err);
  }
}

// ── 4. INSTANT LOCAL SUMMARY (📊 button) ─────────────────────────────────────
export async function sendLocalSummaryNotification(mealCount = 0, mealTypes = []) {
  const body =
    mealCount === 0
      ? "You haven't logged any meals today. Start fresh tomorrow! 💪"
      : `You logged ${mealCount} meal${mealCount !== 1 ? 's' : ''} today:\n` +
        [...new Set(mealTypes)]
          .map((t) => `  ${_emoji(t)} ${t.charAt(0).toUpperCase() + t.slice(1)}`)
          .join('\n');

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '📊 Daily Meal Summary',
        body,
        data: { type: 'daily_summary', mealCount },
        sound: true,
        ...(Platform.OS === 'android' && { channelId: 'meal-summary' }),
      },
      trigger: null,
    });
  } catch (err) {
    Alert.alert('Error', 'Could not send summary. Are notifications enabled?');
  }
}

function _emoji(type = '') {
  return ({ breakfast: '🌅', lunch: '☀️', snack: '🍎', dinner: '🌙' })[type.toLowerCase()] ?? '🍽';
}
