import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
  Animated,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase, TELEGRAM_USER_ID } from '../lib/supabase';

// ── Meal type config ──────────────────────────────────────────────────────────
const MEAL_TYPE_CONFIG = {
  breakfast: { emoji: '🌅', color: '#F59E0B', order: 1 },
  lunch:     { emoji: '☀️', color: '#10B981', order: 2 },
  snack:     { emoji: '🍎', color: '#6366F1', order: 3 },
  dinner:    { emoji: '🌙', color: '#3B82F6', order: 4 },
};

const getMealConfig = (type = '') => {
  const key = type.toLowerCase();
  return MEAL_TYPE_CONFIG[key] ?? { emoji: '🍽', color: '#8B5CF6', order: 99 };
};

// ── Helper: format date nicely ────────────────────────────────────────────────
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  if (dateStr === today) return 'Today';
  if (dateStr === yesterday) return 'Yesterday';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

// ── Group meals by date ───────────────────────────────────────────────────────
const groupByDate = (meals) => {
  const grouped = {};
  meals.forEach((m) => {
    const d = m.date ?? 'Unknown';
    if (!grouped[d]) grouped[d] = [];
    grouped[d].push(m);
  });

  // Sort each day's meals by meal type order
  Object.keys(grouped).forEach((date) => {
    grouped[date].sort(
      (a, b) => getMealConfig(a.meal_type).order - getMealConfig(b.meal_type).order
    );
  });

  // Return sorted by date descending
  return Object.entries(grouped).sort(([a], [b]) => (a > b ? -1 : 1));
};

// ── Animated Meal Card ────────────────────────────────────────────────────────
const MealCard = ({ item, onEdit, onDelete, index }) => {
  const slideAnim = useRef(new Animated.Value(40)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const config = getMealConfig(item.meal_type);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 280,
        delay: index * 50,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 280,
        delay: index * 50,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleDelete = () => {
    Alert.alert(
      'Delete Meal',
      `Remove "${item.meal}" from your log?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDelete(item.id),
        },
      ]
    );
  };

  return (
    <Animated.View
      style={[
        styles.card,
        { transform: [{ translateY: slideAnim }], opacity: opacityAnim },
      ]}
    >
      {/* Color accent bar */}
      <View style={[styles.cardAccent, { backgroundColor: config.color }]} />

      <View style={styles.cardContent}>
        <View style={styles.cardLeft}>
          <Text style={styles.mealEmoji}>{config.emoji}</Text>
          <View style={styles.mealInfo}>
            <Text style={styles.mealName} numberOfLines={2}>{item.meal}</Text>
            <View style={[styles.mealTypeBadge, { backgroundColor: config.color + '22' }]}>
              <Text style={[styles.mealTypeText, { color: config.color }]}>
                {item.meal_type}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => onEdit(item)}
            activeOpacity={0.7}
          >
            <Text style={styles.actionIcon}>✏️</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.deleteBtn]}
            onPress={handleDelete}
            activeOpacity={0.7}
          >
            <Text style={styles.actionIcon}>🗑️</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
};

// ── Date Section Header ───────────────────────────────────────────────────────
const DateHeader = ({ date, count }) => (
  <View style={styles.dateHeader}>
    <Text style={styles.dateHeaderText}>{formatDate(date)}</Text>
    <View style={styles.dateHeaderLine} />
    <Text style={styles.dateCount}>{count} meal{count !== 1 ? 's' : ''}</Text>
  </View>
);

// ── Stats Bar ─────────────────────────────────────────────────────────────────
const StatsBar = ({ meals }) => {
  const today = new Date().toISOString().split('T')[0];
  const todayMeals = meals.filter((m) => m.date === today);

  const types = ['breakfast', 'lunch', 'snack', 'dinner'];
  return (
    <View style={styles.statsBar}>
      {types.map((type) => {
        const config = getMealConfig(type);
        const has = todayMeals.some((m) => m.meal_type?.toLowerCase() === type);
        return (
          <View key={type} style={styles.statItem}>
            <Text style={[styles.statEmoji, !has && styles.statInactive]}>
              {config.emoji}
            </Text>
            <Text style={[styles.statLabel, !has && styles.statInactive]}>
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </Text>
            {has && <View style={[styles.statDot, { backgroundColor: config.color }]} />}
          </View>
        );
      })}
    </View>
  );
};

// ── Empty State ───────────────────────────────────────────────────────────────
const EmptyState = ({ onAdd }) => (
  <View style={styles.emptyState}>
    <Text style={styles.emptyEmoji}>🥗</Text>
    <Text style={styles.emptyTitle}>No meals logged yet</Text>
    <Text style={styles.emptySubtitle}>
      Start tracking your meals here or via your Telegram bot — they sync automatically!
    </Text>
    <TouchableOpacity style={styles.emptyBtn} onPress={onAdd} activeOpacity={0.8}>
      <Text style={styles.emptyBtnText}>+ Log Your First Meal</Text>
    </TouchableOpacity>
  </View>
);

// ── Realtime Badge ────────────────────────────────────────────────────────────
const RealtimeBadge = ({ connected }) => (
  <View style={styles.realtimeBadge}>
    <View style={[styles.realtimeDot, { backgroundColor: connected ? '#10B981' : '#EF4444' }]} />
    <Text style={styles.realtimeText}>{connected ? 'Live' : 'Offline'}</Text>
  </View>
);

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN SCREEN
// ═══════════════════════════════════════════════════════════════════════════════
export default function MealLogScreen({ navigation }) {
  const [meals, setMeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const channelRef = useRef(null);

  // ── Fetch meals ─────────────────────────────────────────────────────────────
  const fetchMeals = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data, error } = await supabase
        .from('meals')
        .select('*')
        .eq('user_id', TELEGRAM_USER_ID)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMeals(data ?? []);
    } catch (err) {
      Alert.alert('Error', 'Could not load meals. Check your Supabase config.');
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // ── Supabase Realtime subscription ─────────────────────────────────────────
  useEffect(() => {
    fetchMeals();

    const channel = supabase
      .channel('meals-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'meals',
          filter: `user_id=eq.${TELEGRAM_USER_ID}`,
        },
        (payload) => {
          console.log('Realtime event:', payload.eventType);
          if (payload.eventType === 'INSERT') {
            setMeals((prev) => [payload.new, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setMeals((prev) =>
              prev.map((m) => (m.id === payload.new.id ? payload.new : m))
            );
          } else if (payload.eventType === 'DELETE') {
            setMeals((prev) => prev.filter((m) => m.id !== payload.old.id));
          }
        }
      )
      .subscribe((status) => {
        setRealtimeConnected(status === 'SUBSCRIBED');
      });

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // ── Refresh when screen focused ─────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      fetchMeals(true);
    }, [fetchMeals])
  );

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    try {
      const { error } = await supabase.from('meals').delete().eq('id', id);
      if (error) throw error;
      // Realtime will update the list, but also update locally for speed
      setMeals((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      Alert.alert('Error', 'Could not delete meal.');
      console.error(err);
    }
  };

  // ── Build list data ─────────────────────────────────────────────────────────
  const grouped = groupByDate(meals);
  const listData = [];
  grouped.forEach(([date, dateMeals]) => {
    listData.push({ type: 'header', date, count: dateMeals.length, id: `h-${date}` });
    dateMeals.forEach((m, i) => {
      listData.push({ type: 'meal', ...m, _index: i });
    });
  });

  const renderItem = ({ item }) => {
    if (item.type === 'header') {
      return <DateHeader date={item.date} count={item.count} />;
    }
    return (
      <MealCard
        item={item}
        index={item._index}
        onEdit={(meal) => navigation.navigate('AddEditMeal', { meal })}
        onDelete={handleDelete}
      />
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerGreeting}>
            {new Date().getHours() < 12
              ? 'Good morning'
              : new Date().getHours() < 17
              ? 'Good afternoon'
              : 'Good evening'} 👋
          </Text>
          <Text style={styles.headerTitle}>Meal Tracker</Text>
        </View>
        <RealtimeBadge connected={realtimeConnected} />
      </View>

      {/* ── Today's stats ── */}
      <StatsBar meals={meals} />

      {/* ── Meal List ── */}
      {loading ? (
        <View style={styles.loadingState}>
          <Text style={styles.loadingText}>Loading your meals...</Text>
        </View>
      ) : meals.length === 0 ? (
        <EmptyState onAdd={() => navigation.navigate('AddEditMeal', { meal: null })} />
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(item) => item.id?.toString() ?? item.date}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchMeals(true);
              }}
              tintColor="#6366F1"
            />
          }
        />
      )}

      {/* ── FAB ── */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('AddEditMeal', { meal: null })}
        activeOpacity={0.85}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
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

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  headerGreeting: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  headerTitle: {
    color: '#F9FAFB',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },

  // Realtime badge
  realtimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1F2E',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 5,
    marginTop: 4,
  },
  realtimeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  realtimeText: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },

  // Stats bar
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#1C1F2E',
    marginHorizontal: 16,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 8,
    marginBottom: 20,
  },
  statItem: {
    alignItems: 'center',
    gap: 3,
    position: 'relative',
  },
  statEmoji: {
    fontSize: 22,
  },
  statInactive: {
    opacity: 0.3,
  },
  statLabel: {
    color: '#9CA3AF',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  statDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    position: 'absolute',
    bottom: -6,
  },

  // List
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },

  // Date header
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 10,
    gap: 10,
  },
  dateHeaderText: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  dateHeaderLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#1F2937',
  },
  dateCount: {
    color: '#4B5563',
    fontSize: 11,
    fontWeight: '600',
  },

  // Card
  card: {
    backgroundColor: '#1C1F2E',
    borderRadius: 16,
    marginBottom: 10,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  cardAccent: {
    width: 4,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  cardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  cardLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mealEmoji: {
    fontSize: 28,
  },
  mealInfo: {
    flex: 1,
    gap: 6,
  },
  mealName: {
    color: '#F9FAFB',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  mealTypeBadge: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  mealTypeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize',
    letterSpacing: 0.4,
  },

  // Actions
  cardActions: {
    flexDirection: 'row',
    gap: 6,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#252836',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteBtn: {
    backgroundColor: '#2D1B1B',
  },
  actionIcon: {
    fontSize: 15,
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 32,
    right: 24,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  fabIcon: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '300',
    lineHeight: 30,
  },

  // States
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#4B5563',
    fontSize: 15,
    fontWeight: '500',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyEmoji: {
    fontSize: 60,
    marginBottom: 8,
  },
  emptyTitle: {
    color: '#F9FAFB',
    fontSize: 20,
    fontWeight: '700',
  },
  emptySubtitle: {
    color: '#6B7280',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyBtn: {
    marginTop: 16,
    backgroundColor: '#6366F1',
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 13,
  },
  emptyBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
