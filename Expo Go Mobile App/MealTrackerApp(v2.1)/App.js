/**
 * App.js
 * Root of the MealTracker app.
 * Bonus Task 2 additions:
 *   - Registers for push notifications on first launch
 *   - Schedules the nightly local reminder (8 PM)
 *   - Listens for incoming notifications (foreground + tap)
 *   - Navigates to MealLog when user taps a notification
 */

import 'react-native-url-polyfill/auto';
import React, { useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';

import MealLogScreen from './screens/MealLogScreen';
import AddEditMealScreen from './screens/AddEditMealScreen';
import {
  registerForPushNotificationsAsync,
  scheduleDailyReminder,
} from './lib/notifications';

const Stack = createNativeStackNavigator();

export default function App() {
  const navigationRef = useRef(null);
  // Refs hold the listeners so we can cleanly remove them on unmount
  const notificationListener = useRef(null);
  const responseListener = useRef(null);

  useEffect(() => {
    // ── 1. Request permission & register / save push token ─────────────────
    registerForPushNotificationsAsync().catch(console.error);

    // ── 2. Schedule daily 8 PM reminder (idempotent — safe on every launch) ─
    scheduleDailyReminder(20, 0).catch(console.error);

    // ── 3. Foreground notification listener ────────────────────────────────
    //    expo-notifications' setNotificationHandler (in notifications.js)
    //    already ensures the alert is shown; this hook lets us log / act further.
    notificationListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        const { type } = notification.request.content.data ?? {};
        console.log('[App] Notification received in foreground, type:', type);
      });

    // ── 4. Response listener — user tapped a notification ──────────────────
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const { type } = response.notification.request.content.data ?? {};
        console.log('[App] Notification tapped, type:', type);
        // Bring the user straight to the meal list
        if (navigationRef.current) {
          navigationRef.current.navigate('MealLog');
        }
      });

    return () => {
      Notifications.removeNotificationSubscription(notificationListener.current);
      Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, []);

  return (
    <NavigationContainer ref={navigationRef}>
      <StatusBar style="light" />
      <Stack.Navigator
        initialRouteName="MealLog"
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: '#0F1117' },
        }}
      >
        <Stack.Screen name="MealLog" component={MealLogScreen} />
        <Stack.Screen
          name="AddEditMeal"
          component={AddEditMealScreen}
          options={{ animation: 'slide_from_bottom' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
