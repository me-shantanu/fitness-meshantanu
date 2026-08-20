import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { nutritionService } from '../services/nutritionService';
import { supabase } from '../lib/supabase';
import AntDesign from '@expo/vector-icons/AntDesign';
import Feather from '@expo/vector-icons/Feather';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useThemeStore } from '@/store/useThemeStore';
import { showAlert } from '@/utils/alert';
import { localDateString } from '../utils/date';

const INITIAL_FOOD_FORM = {
  name: '',
  calories: '',
  protein: '',
  carbs: '',
  fats: '',
  servingSize: '',
};

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

// Time-based default: 5-11 breakfast, 11-16 lunch, 16-22 dinner, else snack
const defaultMealType = (): MealType => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return 'breakfast';
  if (hour >= 11 && hour < 16) return 'lunch';
  if (hour >= 16 && hour < 22) return 'dinner';
  return 'snack';
};

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface FoodEntry {
  id: string;
  food_name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  serving_size: string | null;
  meal_type: string;
  logged_at: string;
}

export default function NutritionScreen() {
  const router = useRouter();
  const { user, profile } = useAuthStore();
  const { vars, mode, colors } = useThemeStore();

  const [nutrition, setNutrition] = useState(null);
  const [dailyLog, setDailyLog] = useState(null);
  const [foodEntries, setFoodEntries] = useState<FoodEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showAddFood, setShowAddFood] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [addingWater, setAddingWater] = useState(false);
  const [foodForm, setFoodForm] = useState(INITIAL_FOOD_FORM);
  const [mealType, setMealType] = useState<MealType>(defaultMealType());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  // Memoized local date string for the viewed day (YYYY-MM-DD, local TZ)
  const dateString = useMemo(() => localDateString(selectedDate), [selectedDate]);

  const isToday = dateString === localDateString();

  // Water goal from body weight: 35 ml/kg rounded to the nearest 250ml glass
  const waterGoalMl = useMemo(
    () => (profile?.weight ? Math.round((profile.weight * 35) / 250) * 250 : 2500),
    [profile?.weight]
  );

  // Header label: Today / Yesterday / "MMM d"
  const dateLabel = useMemo(() => {
    if (dateString === localDateString()) return 'Today';
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (dateString === localDateString(yesterday)) return 'Yesterday';
    return `${MONTH_NAMES[selectedDate.getMonth()]} ${selectedDate.getDate()}`;
  }, [dateString, selectedDate]);

  const changeDay = useCallback((delta: number) => {
    setSelectedDate(prev => {
      const next = new Date(prev);
      next.setDate(next.getDate() + delta);
      // Never navigate past today
      if (localDateString(next) > localDateString()) return prev;
      return next;
    });
  }, []);

  // Load nutrition data on mount and date change
  useEffect(() => {
    if (!user?.id) return;
    loadNutritionData(dateString);
  }, [dateString, user?.id]);

  const loadNutritionData = async (dateStr: string) => {
    if (!user?.id) return;

    try {
      setLoading(true);

      // Fetch nutrition targets, daily log and food log in parallel
      const [nutritionData, logData, foodData]: [any, any, any] = await Promise.all([
        nutritionService.calculateDailyTargets(user.id),
        supabase
          .from('daily_nutrition')
          .select('*')
          .eq('user_id', user.id)
          .eq('date', dateStr)
          .maybeSingle(),
        supabase
          .from('food_log')
          .select('id, food_name, calories, protein, carbs, fats, serving_size, meal_type, logged_at')
          .eq('user_id', user.id)
          .eq('date', dateStr)
          .order('logged_at', { ascending: true })
      ]);

      // Handle incomplete profile
      if (nutritionData && nutritionData.error === 'incomplete_profile') {
        showAlert(
          'Complete Your Profile',
          'Please complete your profile (weight, height, age, gender) to calculate nutrition targets.',
          [
            { text: 'Later', style: 'cancel' },
            { text: 'Go to Profile', onPress: () => router.push('/profile') }
          ]
        );
        setNutrition(null);
      } else if (nutritionData && nutritionData.success) {
        setNutrition(nutritionData);
      } else {
        console.error('Failed to load nutrition data');
        setNutrition(null);
      }

      // Set daily log or default values
      if (logData.data) {
        setDailyLog(logData.data);
      } else {
        setDailyLog({
          calories_consumed: 0,
          protein_consumed: 0,
          carbs_consumed: 0,
          fats_consumed: 0,
          water_intake_ml: 0,
          calories_burned: 0
        });
      }

      // Set food log entries for the day
      if (foodData.error) {
        console.error('Error loading food log:', foodData.error);
        setFoodEntries([]);
      } else {
        setFoodEntries(foodData.data || []);
      }
    } catch (error) {
      console.error('Error loading nutrition data:', error);
      showAlert('Error', 'Failed to load nutrition data. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Keep the latest date string in a ref so onRefresh never captures a stale one
  const dateStringRef = React.useRef(dateString);
  dateStringRef.current = dateString;

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadNutritionData(dateStringRef.current);
  }, [user?.id]);

  const addFood = async () => {
    if (!user?.id) return;

    // Prevent double submission
    if (submitting) return;

    try {
      setSubmitting(true);

      // Validate input
      const validatedFood = nutritionService.validateFoodInput(foodForm);

      // Food is always logged against TODAY, regardless of the viewed date
      const today = localDateString();

      // Atomic get-or-create + accumulate (targets only apply on the day's
      // first insert; the RPC keeps existing targets otherwise)
      const targets: any = nutrition;
      const { data: updatedLog, error: rpcError } = await supabase.rpc('increment_daily_nutrition', {
        p_date: today,
        p_calories: validatedFood.calories,
        p_protein: validatedFood.protein,
        p_carbs: validatedFood.carbs,
        p_fats: validatedFood.fats,
        p_water_ml: 0,
        p_calories_burned: 0,
        p_target_calories: targets?.calories ?? null,
        p_target_protein: targets?.protein ?? null,
        p_target_carbs: targets?.carbs ?? null,
        p_target_fats: targets?.fats ?? null
      });

      if (rpcError) throw rpcError;
      if (updatedLog) setDailyLog(updatedLog);

      // Add to food log history
      const { error: foodError } = await supabase
        .from('food_log')
        .insert({
          user_id: user.id,
          date: today,
          food_name: validatedFood.name,
          calories: validatedFood.calories,
          protein: validatedFood.protein,
          carbs: validatedFood.carbs,
          fats: validatedFood.fats,
          serving_size: validatedFood.servingSize || null,
          meal_type: mealType,
          logged_at: new Date().toISOString()
        });

      if (foodError) throw foodError;

      // Success
      showAlert('Success', `${validatedFood.name} added successfully!`);
      setShowAddFood(false);
      setFoodForm(INITIAL_FOOD_FORM);
      loadNutritionData(dateString);
    } catch (error) {
      console.error('Error adding food:', error);
      showAlert(
        'Error',
        error.message || 'Failed to add food. Please check your input and try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const addWater = async (amount) => {
    if (!user?.id) return;

    // Prevent overlapping read-modify-writes from double-taps
    if (addingWater) return;
    setAddingWater(true);

    try {
      // Atomic get-or-create + accumulate (only water changes here).
      // Water is always logged against TODAY, regardless of the viewed date.
      const targets: any = nutrition;
      const { data: updatedLog, error } = await supabase.rpc('increment_daily_nutrition', {
        p_date: localDateString(),
        p_calories: 0,
        p_protein: 0,
        p_carbs: 0,
        p_fats: 0,
        p_water_ml: amount,
        p_calories_burned: 0,
        p_target_calories: targets?.calories ?? null,
        p_target_protein: targets?.protein ?? null,
        p_target_carbs: targets?.carbs ?? null,
        p_target_fats: targets?.fats ?? null
      });

      if (error) throw error;
      if (updatedLog) setDailyLog(updatedLog);

      loadNutritionData(dateString);
    } catch (error) {
      console.error('Error adding water:', error);
      showAlert('Error', 'Failed to add water intake');
    } finally {
      setAddingWater(false);
    }
  };

  const performRemoveFood = async (entry: FoodEntry) => {
    // In-flight guard per entry
    if (deletingIds.has(entry.id)) return;
    setDeletingIds(prev => new Set(prev).add(entry.id));

    try {
      // Atomic delete + decrement of the day's totals
      const { data: updatedLog, error } = await supabase.rpc('remove_food_log_entry', {
        p_id: entry.id
      });

      if (error) throw error;
      if (updatedLog) setDailyLog(updatedLog);
      setFoodEntries(prev => prev.filter(e => e.id !== entry.id));
    } catch (error) {
      console.error('Error removing food entry:', error);
      showAlert('Error', error.message || 'Failed to remove food entry. Please try again.');
    } finally {
      setDeletingIds(prev => {
        const next = new Set(prev);
        next.delete(entry.id);
        return next;
      });
    }
  };

  const confirmRemoveFood = (entry: FoodEntry) => {
    if (deletingIds.has(entry.id)) return;
    showAlert(
      `Remove ${entry.food_name}?`,
      'Its calories and macros will be subtracted from today\'s totals.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => performRemoveFood(entry) }
      ]
    );
  };

  const calculateRemaining = useCallback((consumed, target) => {
    if (!target || target <= 0) return 0;
    const remaining = target - consumed;
    return Math.max(0, remaining);
  }, []);

  const calculatePercentage = useCallback((consumed, target) => {
    if (!target || target <= 0) return 0;
    const percentage = (consumed / target) * 100;
    return Math.min(100, percentage);
  }, []);

  const renderMacroCard = useCallback((title, consumed, target, unit, color) => {
    const safeTarget = typeof target === 'number' && target > 0 ? target : 0;
    const remaining = calculateRemaining(consumed, safeTarget);
    const percentage = calculatePercentage(consumed, safeTarget);
    const isOverTarget = safeTarget > 0 && consumed > safeTarget;

    return (
      <View className="bg-surface rounded-2xl border border-border p-4 mb-3">
        <View className="flex-row justify-between items-center mb-2">
          <Text className="text-text font-bold text-base">{title}</Text>
          <View className="flex-row items-center">
            <Text className="text-text-light mr-2 text-sm">
              {consumed.toFixed(0)}/{safeTarget} {unit}
            </Text>
            <Text className={`font-bold text-sm ${isOverTarget ? 'text-accent' : 'text-primary'}`}>
              {isOverTarget ? `+${(consumed - safeTarget).toFixed(0)} over` : `${remaining} left`}
            </Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View className="h-2 bg-surface-2 rounded-full overflow-hidden">
          <View
            className={`h-full ${color} rounded-full`}
            style={{ width: `${percentage}%` }}
          />
        </View>

        <View className="flex-row justify-between mt-1">
          <Text className="text-text-light text-xs">0 {unit}</Text>
          <Text className="text-text-light text-xs">{target} {unit}</Text>
        </View>
      </View>
    );
  }, [calculateRemaining, calculatePercentage]);

  const openAddFood = () => {
    setMealType(defaultMealType());
    setShowAddFood(true);
  };

  const quickAddFood = (name, calories, protein, carbs, fats, servingSize) => {
    setFoodForm({
      name,
      calories: String(calories),
      protein: String(protein),
      carbs: String(carbs),
      fats: String(fats),
      servingSize
    });
    setMealType(defaultMealType());
    setShowAddFood(true);
  };

  // Group food entries by meal in fixed order, omitting empty groups
  const groupedFoodEntries = useMemo(
    () =>
      MEAL_ORDER
        .map(meal => ({ meal, entries: foodEntries.filter(e => e.meal_type === meal) }))
        .filter(group => group.entries.length > 0),
    [foodEntries]
  );

  // Show loading state
  if (loading && !refreshing) {
    return (
      <SafeAreaView className="flex-1 bg-bg">
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={colors.brand} />
          <Text className="text-text-light mt-4">Loading nutrition data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Show incomplete profile message
  if (!nutrition) {
    return (
      <SafeAreaView className="flex-1 bg-bg">
        <View className="flex-1 justify-center items-center px-6">
          <Feather name="alert-circle" size={64} color={colors.accent} />
          <Text className="text-text text-xl font-bold mt-6 text-center">
            Complete Your Profile
          </Text>
          <Text className="text-text-light text-center mt-2 mb-6">
            Please update your profile with weight, height, age, and gender to calculate your nutrition targets.
          </Text>
          <TouchableOpacity
            className="bg-primary px-8 py-4 rounded-xl"
            onPress={() => router.push('/profile')}
            accessibilityRole="button"
          >
            <Text className="text-on-brand font-bold text-lg">Go to Profile</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Whether a daily_nutrition row actually exists for the viewed day
  // (the fallback object built in loadNutritionData has no id)
  const hasLogRow = !!dailyLog?.id;

  // For past days prefer the targets snapshotted on that day's row;
  // fall back to current targets (shown greyed when no row exists).
  const usePastTargets = !isToday && hasLogRow;
  const displayTargets = {
    calories: usePastTargets && dailyLog?.target_calories ? dailyLog.target_calories : nutrition.calories,
    protein: usePastTargets && dailyLog?.target_protein ? dailyLog.target_protein : nutrition.protein,
    carbs: usePastTargets && dailyLog?.target_carbs ? dailyLog.target_carbs : nutrition.carbs,
    fats: usePastTargets && dailyLog?.target_fats ? dailyLog.target_fats : nutrition.fats,
  };
  const targetsGreyed = !isToday && !hasLogRow;

  // Calories consumed that day; the target is already adjusted upward by calories burned
  const netCalories = dailyLog?.calories_consumed || 0;
  const adjustedTarget = displayTargets.calories + (dailyLog?.calories_burned || 0);

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <ScrollView 
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />
        }
      >
        {/* Header */}
        <View className="px-4 pt-4 pb-2">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-text text-3xl font-bold">Nutrition</Text>
            <View className="flex-row items-center">
              <TouchableOpacity
                className="bg-surface-2 border border-border p-2 rounded-lg"
                onPress={() => changeDay(-1)}
                accessibilityRole="button"
                accessibilityLabel="Previous day"
              >
                <Feather name="chevron-left" size={20} color={colors.text} />
              </TouchableOpacity>
              <Text className="text-text font-bold mx-3 text-center" style={{ minWidth: 72 }}>
                {dateLabel}
              </Text>
              <TouchableOpacity
                className={`bg-surface-2 border border-border p-2 rounded-lg ${isToday ? 'opacity-40' : ''}`}
                onPress={() => changeDay(1)}
                disabled={isToday}
                accessibilityRole="button"
                accessibilityLabel="Next day"
              >
                <Feather name="chevron-right" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Daily Goals Card */}
          <View className={`bg-surface rounded-2xl border border-border p-4 mb-4 ${targetsGreyed ? 'opacity-60' : ''}`}>
            <Text className="text-text font-bold text-lg mb-3">
              Daily Targets
            </Text>
            <View className="flex-row justify-between">
              <View className="items-center">
                <Text className="text-text text-2xl font-bold">
                  {displayTargets.calories}
                </Text>
                <Text className="text-text-light text-sm">Calories</Text>
              </View>
              <View className="items-center">
                <Text className="text-text text-2xl font-bold">
                  {displayTargets.protein}g
                </Text>
                <Text className="text-text-light text-sm">Protein</Text>
              </View>
              <View className="items-center">
                <Text className="text-text text-2xl font-bold">
                  {displayTargets.carbs}g
                </Text>
                <Text className="text-text-light text-sm">Carbs</Text>
              </View>
              <View className="items-center">
                <Text className="text-text text-2xl font-bold">
                  {displayTargets.fats}g
                </Text>
                <Text className="text-text-light text-sm">Fats</Text>
              </View>
            </View>
            
            {/* Show BMR and TDEE info */}
            <View className="mt-3 pt-3 border-t border-border">
              <View className="flex-row justify-between">
                <Text className="text-text-light text-xs">BMR: {nutrition.bmr} kcal</Text>
                <Text className="text-text-light text-xs">TDEE: {nutrition.tdee} kcal</Text>
                <Text className="text-text-light text-xs capitalize">Goal: {nutrition.goal?.replace('_', ' ')}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Calories Card */}
        <View className="px-4 mb-6">
          <Text className="text-text text-lg font-bold mb-3">Calories</Text>

          <View className="bg-primary rounded-2xl p-6">
            <View className="flex-row justify-between items-center mb-4">
              <View>
                <Text className="text-on-brand font-bold text-lg">Daily Intake</Text>
                <Text className="text-on-brand/80">
                  {netCalories} / {adjustedTarget} kcal
                </Text>
                {dailyLog?.calories_burned > 0 && (
                  <Text className="text-on-brand/70 text-xs mt-1">
                    Burned: {dailyLog.calories_burned} kcal
                  </Text>
                )}
              </View>

              <View className="bg-on-brand/20 px-4 py-2 rounded-full">
                <Text className="text-on-brand font-bold">
                  {calculateRemaining(netCalories, adjustedTarget)} kcal left
                </Text>
              </View>
            </View>

            {/* Progress Circle */}
            <View className="items-center my-4">
              <View className="relative items-center justify-center">
                <View className="w-40 h-40 rounded-full border-8 border-on-brand/25 items-center justify-center">
                  <Text className="text-on-brand text-3xl font-bold">
                    {calculatePercentage(netCalories, adjustedTarget).toFixed(0)}%
                  </Text>
                  <Text className="text-on-brand/80 text-sm">of goal</Text>
                </View>
              </View>
            </View>

            {isToday && (
              <TouchableOpacity
                className="bg-surface py-3 rounded-lg mt-4"
                onPress={openAddFood}
                accessibilityRole="button"
              >
                <Text className="text-primary text-center font-bold text-lg">
                  + Add Food
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Macros */}
        <View className="px-4 mb-6">
          <Text className="text-text text-lg font-bold mb-3">Macronutrients</Text>

          {renderMacroCard(
            'Protein',
            dailyLog?.protein_consumed || 0,
            displayTargets.protein,
            'g',
            'bg-primary'
          )}

          {renderMacroCard(
            'Carbohydrates',
            dailyLog?.carbs_consumed || 0,
            displayTargets.carbs,
            'g',
            'bg-primary'
          )}

          {renderMacroCard(
            'Fats',
            dailyLog?.fats_consumed || 0,
            displayTargets.fats,
            'g',
            'bg-accent'
          )}
        </View>

        {/* Water Tracking */}
        <View className="px-4 mb-6">
          <Text className="text-text text-lg font-bold mb-3">Water Intake</Text>

          <View className="bg-surface rounded-2xl border border-border p-6">
            <View className="flex-row justify-between items-center mb-6">
              <View>
                <Text className="text-text font-bold text-lg">
                  Daily Goal: {(waterGoalMl / 1000).toFixed(1)}L
                </Text>
                {profile?.weight ? (
                  <Text className="text-text-light text-xs">(based on your weight)</Text>
                ) : null}
                <Text className="text-text-light">
                  {((dailyLog?.water_intake_ml || 0) / 1000).toFixed(1)}L / {(waterGoalMl / 1000).toFixed(1)}L
                </Text>
              </View>

              <View className="bg-primary/15 px-4 py-2 rounded-full">
                <Text className="text-primary font-bold">
                  {Math.min(100, ((dailyLog?.water_intake_ml || 0) / waterGoalMl * 100)).toFixed(0)}%
                </Text>
              </View>
            </View>

            {isToday && (
              <View className="flex-row justify-between mb-4">
                {[250, 500, 1000].map((amount) => (
                  <TouchableOpacity
                    key={amount}
                    className="bg-primary/15 px-4 py-3 rounded-lg border border-primary/30 flex-1 mx-1"
                    onPress={() => addWater(amount)}
                    accessibilityRole="button"
                    accessibilityLabel={`Add ${amount}ml water`}
                  >
                    <Text className="text-primary font-bold text-center">
                      +{amount}ml
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View className="flex-row items-center">
              <FontAwesome name="tint" size={24} color={colors.brand} />
              <View className="flex-1 ml-3">
                <View className="flex-row justify-between mb-1">
                  <Text className="text-text-light text-sm">Water Intake</Text>
                  <Text className="text-text font-bold text-sm">
                    {dailyLog?.water_intake_ml || 0}ml
                  </Text>
                </View>
                <View className="h-2 bg-surface-2 rounded-full overflow-hidden">
                  <View
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${Math.min(100, ((dailyLog?.water_intake_ml || 0) / waterGoalMl) * 100)}%` }}
                  />
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Quick Add */}
        {isToday && (
          <View className="px-4 mb-6">
            <Text className="text-text text-lg font-bold mb-3">Quick Add</Text>

            <View className="flex-row justify-between">
              <TouchableOpacity
                className="bg-surface flex-1 mr-2 rounded-2xl border border-border p-4 items-center"
                onPress={() => quickAddFood('Chicken Breast', 165, 31, 0, 3.6, '100g')}
                accessibilityRole="button"
                accessibilityLabel="Quick add Chicken Breast"
              >
                <MaterialIcons name="fastfood" size={24} color={colors.brand} />
                <Text className="text-text mt-2 text-center text-sm">Chicken Breast</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="bg-surface flex-1 mx-2 rounded-2xl border border-border p-4 items-center"
                onPress={() => quickAddFood('Brown Rice', 111, 2.6, 23, 0.9, '100g')}
                accessibilityRole="button"
                accessibilityLabel="Quick add Brown Rice"
              >
                <FontAwesome name="spoon" size={24} color={colors.accent} />
                <Text className="text-text mt-2 text-center text-sm">Brown Rice</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="bg-surface flex-1 ml-2 rounded-2xl border border-border p-4 items-center"
                onPress={() => quickAddFood('Protein Shake', 120, 25, 3, 1, '1 scoop')}
                accessibilityRole="button"
                accessibilityLabel="Quick add Protein Shake"
              >
                <MaterialIcons name="local-cafe" size={24} color={colors.brand} />
                <Text className="text-text mt-2 text-center text-sm">Protein Shake</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Food Log */}
        <View className="px-4 mb-8">
          <Text className="text-text text-lg font-bold mb-3">
            {isToday ? "Today's Food Log" : 'Food Log'}
          </Text>

          {groupedFoodEntries.length === 0 ? (
            <View className="bg-surface rounded-2xl border border-border p-6 items-center">
              <Text className="text-text-light">
                {isToday ? 'Nothing logged today yet.' : 'Nothing logged on this day.'}
              </Text>
            </View>
          ) : (
            groupedFoodEntries.map(group => (
              <View key={group.meal} className="mb-4">
                <Text className="text-text-light font-bold text-sm uppercase mb-2">
                  {MEAL_LABELS[group.meal]}
                </Text>

                {group.entries.map(entry => {
                  const isDeleting = deletingIds.has(entry.id);
                  return (
                    <View
                      key={entry.id}
                      className="bg-surface rounded-2xl border border-border px-4 py-3 mb-2 flex-row items-center"
                    >
                      <View className="flex-1">
                        <Text className="text-text font-bold">
                          {entry.food_name}
                          {entry.serving_size ? (
                            <Text className="text-text-light font-normal text-sm">
                              {'  ·  '}{entry.serving_size}
                            </Text>
                          ) : null}
                        </Text>
                        <Text className="text-text-light text-xs mt-1">
                          {entry.calories} kcal  ·  P {entry.protein}g  ·  C {entry.carbs}g  ·  F {entry.fats}g
                        </Text>
                      </View>

                      {isToday && (
                        <TouchableOpacity
                          className="p-2 ml-2"
                          onPress={() => confirmRemoveFood(entry)}
                          disabled={isDeleting}
                          accessibilityRole="button"
                          accessibilityLabel={`Remove ${entry.food_name} from log`}
                        >
                          {isDeleting ? (
                            <ActivityIndicator size="small" color={colors.danger} />
                          ) : (
                            <AntDesign name="close" size={16} color={colors.danger} />
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Add Food Modal */}
      <Modal
        visible={showAddFood}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddFood(false)}
      >
        <View style={vars} key={mode} className="flex-1 bg-black/50 justify-end">
          <View style={{ maxHeight: '75%' }} className="bg-bg rounded-t-3xl p-6" accessibilityViewIsModal={true}>
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-text text-2xl font-bold">Add Food</Text>
              <TouchableOpacity
                onPress={() => setShowAddFood(false)}
                accessibilityRole="button"
                accessibilityLabel="Close add food form"
              >
                <AntDesign name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="space-y-4">
                <View className="mb-4">
                  <Text className="text-text-light mb-2">Meal</Text>
                  <View className="flex-row justify-between">
                    {MEAL_ORDER.map((meal) => {
                      const selected = mealType === meal;
                      return (
                        <TouchableOpacity
                          key={meal}
                          className={`flex-1 mx-1 py-2 rounded-lg border ${
                            selected
                              ? 'bg-primary border-primary'
                              : 'bg-surface-2 border-border'
                          }`}
                          onPress={() => setMealType(meal)}
                          disabled={submitting}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                        >
                          <Text
                            className={`text-center text-sm ${
                              selected ? 'text-on-brand font-bold' : 'text-text-light'
                            }`}
                          >
                            {MEAL_LABELS[meal]}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <View className="mb-4">
                  <Text className="text-text-light mb-2">Food Name *</Text>
                  <TextInput
                    className="bg-surface-2 border border-border text-text rounded-xl p-4"
                    placeholder="e.g., Chicken Breast"
                    placeholderTextColor={colors.textLight}
                    value={foodForm.name}
                    onChangeText={(text) => setFoodForm({ ...foodForm, name: text })}
                    editable={!submitting}
                    accessibilityLabel="Food Name"
                  />
                </View>

                <View className="mb-4">
                  <Text className="text-text-light mb-2">Calories *</Text>
                  <TextInput
                    className="bg-surface-2 border border-border text-text rounded-xl p-4"
                    placeholder="e.g., 165"
                    placeholderTextColor={colors.textLight}
                    value={foodForm.calories}
                    onChangeText={(text) => setFoodForm({ ...foodForm, calories: text.replace(/[^0-9]/g, '') })}
                    keyboardType="numeric"
                    editable={!submitting}
                    accessibilityLabel="Calories"
                  />
                </View>

                <View className="flex-row justify-between mb-4">
                  <View className="flex-1 mr-2">
                    <Text className="text-text-light mb-2">Protein (g)</Text>
                    <TextInput
                      className="bg-surface-2 border border-border text-text rounded-xl p-4"
                      placeholder="0"
                      placeholderTextColor={colors.textLight}
                      value={foodForm.protein}
                      onChangeText={(text) => setFoodForm({ ...foodForm, protein: text.replace(/[^0-9.]/g, '') })}
                      keyboardType="decimal-pad"
                      editable={!submitting}
                      accessibilityLabel="Protein (g)"
                    />
                  </View>

                  <View className="flex-1 mx-2">
                    <Text className="text-text-light mb-2">Carbs (g)</Text>
                    <TextInput
                      className="bg-surface-2 border border-border text-text rounded-xl p-4"
                      placeholder="0"
                      placeholderTextColor={colors.textLight}
                      value={foodForm.carbs}
                      onChangeText={(text) => setFoodForm({ ...foodForm, carbs: text.replace(/[^0-9.]/g, '') })}
                      keyboardType="decimal-pad"
                      editable={!submitting}
                      accessibilityLabel="Carbs (g)"
                    />
                  </View>

                  <View className="flex-1 ml-2">
                    <Text className="text-text-light mb-2">Fats (g)</Text>
                    <TextInput
                      className="bg-surface-2 border border-border text-text rounded-xl p-4"
                      placeholder="0"
                      placeholderTextColor={colors.textLight}
                      value={foodForm.fats}
                      onChangeText={(text) => setFoodForm({ ...foodForm, fats: text.replace(/[^0-9.]/g, '') })}
                      keyboardType="decimal-pad"
                      editable={!submitting}
                      accessibilityLabel="Fats (g)"
                    />
                  </View>
                </View>

                <View className="mb-4">
                  <Text className="text-text-light mb-2">Serving Size</Text>
                  <TextInput
                    className="bg-surface-2 border border-border text-text rounded-xl p-4"
                    placeholder="e.g., 100g, 1 cup"
                    placeholderTextColor={colors.textLight}
                    value={foodForm.servingSize}
                    onChangeText={(text) => setFoodForm({ ...foodForm, servingSize: text })}
                    editable={!submitting}
                    accessibilityLabel="Serving Size"
                  />
                </View>
              </View>
            </ScrollView>

            <TouchableOpacity
              className={`py-4 rounded-xl mt-6 ${submitting ? 'bg-primary/50' : 'bg-primary'}`}
              onPress={addFood}
              disabled={submitting}
              accessibilityRole="button"
            >
              {submitting ? (
                <ActivityIndicator color={colors.onBrand} />
              ) : (
                <Text className="text-on-brand text-center font-bold text-lg">
                  Add to Daily Log
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}