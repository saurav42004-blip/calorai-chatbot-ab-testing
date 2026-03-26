import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase, TELEGRAM_USER_ID } from '../lib/supabase';

// ── Meal type options ─────────────────────────────────────────────────────────
const MEAL_TYPES = [
  { label: 'Breakfast', value: 'breakfast', emoji: '🌅', color: '#F59E0B' },
  { label: 'Lunch',     value: 'lunch',     emoji: '☀️', color: '#10B981' },
  { label: 'Snack',     value: 'snack',     emoji: '🍎', color: '#6366F1' },
  { label: 'Dinner',    value: 'dinner',    emoji: '🌙', color: '#3B82F6' },
];

// ── Quick-add meal suggestions ────────────────────────────────────────────────
const SUGGESTIONS = {
  breakfast: ['Oats & banana', 'Eggs & toast', 'Greek yogurt', 'Smoothie bowl', 'Avocado toast'],
  lunch:     ['Rice & dal', 'Grilled chicken salad', 'Veggie wrap', 'Pasta', 'Quinoa bowl'],
  snack:     ['Mixed nuts', 'Protein bar', 'Fruit salad', 'Hummus & veggies', 'Green tea'],
  dinner:    ['Roti & sabzi', 'Grilled salmon', 'Stir fry', 'Lentil soup', 'Paneer curry'],
};

// ── Today's date as YYYY-MM-DD ────────────────────────────────────────────────
const todayISO = () => new Date().toISOString().split('T')[0];

// ── Meal type selector pill ───────────────────────────────────────────────────
const MealTypePill = ({ type, selected, onPress }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.92, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();
    onPress(type.value);
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={[
          styles.typePill,
          selected && { backgroundColor: type.color, borderColor: type.color },
        ]}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        <Text style={styles.typePillEmoji}>{type.emoji}</Text>
        <Text style={[styles.typePillLabel, selected && styles.typePillLabelSelected]}>
          {type.label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN SCREEN
// ═══════════════════════════════════════════════════════════════════════════════
export default function AddEditMealScreen({ navigation, route }) {
  const existingMeal = route.params?.meal ?? null;
  const isEditing = !!existingMeal;

  const [meal, setMeal] = useState(existingMeal?.meal ?? '');
  const [mealType, setMealType] = useState(existingMeal?.meal_type?.toLowerCase() ?? '');
  const [date, setDate] = useState(existingMeal?.date ?? todayISO());
  const [saving, setSaving] = useState(false);

  const inputRef = useRef(null);
  const slideAnim = useRef(new Animated.Value(60)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0, duration: 320, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 320, useNativeDriver: true }),
    ]).start();

    // Auto-focus input after animation
    setTimeout(() => inputRef.current?.focus(), 350);
  }, []);

  // ── Save (create or update) ─────────────────────────────────────────────────
  const handleSave = async () => {
    const trimmed = meal.trim();
    if (!trimmed) {
      Alert.alert('Missing info', 'Please enter what you ate.');
      return;
    }
    if (!mealType) {
      Alert.alert('Missing info', 'Please select a meal type.');
      return;
    }

    Keyboard.dismiss();
    setSaving(true);

    try {
      if (isEditing) {
        const { error } = await supabase
          .from('meals')
          .update({ meal: trimmed, meal_type: mealType, date })
          .eq('id', existingMeal.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('meals').insert({
          user_id: TELEGRAM_USER_ID,
          meal: trimmed,
          meal_type: mealType,
          date,
        });
        if (error) throw error;
      }
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', `Could not ${isEditing ? 'update' : 'log'} meal. Please try again.`);
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const selectedType = MEAL_TYPES.find((t) => t.value === mealType);
  const suggestions = mealType ? SUGGESTIONS[mealType] : [];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* ── Top bar ── */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.screenTitle}>{isEditing ? 'Edit Meal' : 'Log a Meal'}</Text>
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>{isEditing ? 'Update' : 'Log'}</Text>
            )}
          </TouchableOpacity>
        </View>

        <Animated.ScrollView
          style={[styles.scroll, { opacity: opacityAnim, transform: [{ translateY: slideAnim }] }]}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Meal Type Selector ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>MEAL TYPE</Text>
            <View style={styles.typePillRow}>
              {MEAL_TYPES.map((type) => (
                <MealTypePill
                  key={type.value}
                  type={type}
                  selected={mealType === type.value}
                  onPress={setMealType}
                />
              ))}
            </View>
          </View>

          {/* ── Meal Input ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>WHAT DID YOU EAT?</Text>
            <View style={[styles.inputWrapper, selectedType && { borderColor: selectedType.color + '66' }]}>
              {selectedType && (
                <Text style={styles.inputEmoji}>{selectedType.emoji}</Text>
              )}
              <TextInput
                ref={inputRef}
                style={styles.input}
                value={meal}
                onChangeText={setMeal}
                placeholder="e.g. Rice, dal, roti"
                placeholderTextColor="#4B5563"
                multiline
                maxLength={200}
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />
            </View>
            <Text style={styles.charCount}>{meal.length}/200</Text>
          </View>

          {/* ── Quick Suggestions ── */}
          {suggestions.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>QUICK ADD</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.suggestionRow}>
                  {suggestions.map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[
                        styles.suggestionChip,
                        meal === s && selectedType && { borderColor: selectedType.color },
                      ]}
                      onPress={() => setMeal(s)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.suggestionText}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          {/* ── Date Selector ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>DATE</Text>
            <View style={styles.dateRow}>
              {[
                { label: 'Yesterday', value: new Date(Date.now() - 86400000).toISOString().split('T')[0] },
                { label: 'Today', value: todayISO() },
              ].map((d) => (
                <TouchableOpacity
                  key={d.value}
                  style={[styles.dateChip, date === d.value && styles.dateChipSelected]}
                  onPress={() => setDate(d.value)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.dateChipText, date === d.value && styles.dateChipTextSelected]}>
                    {d.label}
                  </Text>
                </TouchableOpacity>
              ))}
              <TextInput
                style={[styles.dateInput, !['', todayISO(), new Date(Date.now() - 86400000).toISOString().split('T')[0]].includes(date) && styles.dateInputActive]}
                value={date}
                onChangeText={setDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#4B5563"
                keyboardType="numeric"
                maxLength={10}
              />
            </View>
          </View>

          {/* ── Sync info ── */}
          <View style={styles.syncNote}>
            <Text style={styles.syncNoteText}>
              🔄  Changes sync instantly with your Telegram bot
            </Text>
          </View>
        </Animated.ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  STYLES
// ═══════════════════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1117',
  },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1C1F2E',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#1C1F2E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtnText: {
    color: '#9CA3AF',
    fontSize: 16,
    fontWeight: '600',
  },
  screenTitle: {
    color: '#F9FAFB',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  saveBtn: {
    backgroundColor: '#6366F1',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 60,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 60,
    gap: 28,
  },

  // Sections
  section: {
    gap: 12,
  },
  sectionLabel: {
    color: '#4B5563',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },

  // Meal type pills
  typePillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#2D3246',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#1C1F2E',
  },
  typePillEmoji: {
    fontSize: 16,
  },
  typePillLabel: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '600',
  },
  typePillLabelSelected: {
    color: '#fff',
  },

  // Input
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#1C1F2E',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#2D3246',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
    minHeight: 80,
  },
  inputEmoji: {
    fontSize: 22,
    marginTop: 2,
  },
  input: {
    flex: 1,
    color: '#F9FAFB',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 24,
    padding: 0,
    margin: 0,
  },
  charCount: {
    color: '#374151',
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'right',
    marginTop: -6,
  },

  // Suggestions
  suggestionRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 4,
  },
  suggestionChip: {
    backgroundColor: '#1C1F2E',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#2D3246',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  suggestionText: {
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '500',
  },

  // Date
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateChip: {
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#2D3246',
    backgroundColor: '#1C1F2E',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dateChipSelected: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  dateChipText: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '600',
  },
  dateChipTextSelected: {
    color: '#fff',
  },
  dateInput: {
    flex: 1,
    backgroundColor: '#1C1F2E',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#2D3246',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '500',
  },
  dateInputActive: {
    borderColor: '#6366F1',
    color: '#F9FAFB',
  },

  // Sync note
  syncNote: {
    backgroundColor: '#1C2B1C',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1E3A1E',
  },
  syncNoteText: {
    color: '#4ADE80',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
});
