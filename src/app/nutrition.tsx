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

const INITIAL_FOOD_FORM = {
  name: '',
  calories: '',
  protein: '',
  carbs: '',
  fats: '',
  servingSize: '',
};

export default function NutritionScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { vars, mode } = useThemeStore();
  
  const [nutrition, setNutrition] = useState(null);
  const [dailyLog, setDailyLog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showAddFood, setShowAddFood] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [addingWater, setAddingWater] = useState(false);
  const [foodForm, setFoodForm] = useState(INITIAL_FOOD_FORM);

  // Load nutrition data on mount and date change
  useEffect(() => {
    if (!user?.id) return;
    loadNutritionData();
  }, [selectedDate, user?.id]);

  // Memoized date string
  const dateString = useMemo(() => 
    selectedDate.toISOString().split('T')[0],
    [selectedDate]
  );

  const loadNutritionData = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);

      // Fetch nutrition targets and daily log in parallel
      const [nutritionData, logData]: [any, any] = await Promise.all([
        nutritionService.calculateDailyTargets(user.id),
        supabase
          .from('daily_nutrition')
          .select('*')
          .eq('user_id', user.id)
          .eq('date', dateString)
          .maybeSingle()
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
    } catch (error) {
      console.error('Error loading nutrition data:', error);
      showAlert('Error', 'Failed to load nutrition data. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadNutritionData();
  }, []);

  const addFood = async () => {
    if (!user?.id) return;

    // Prevent double submission
    if (submitting) return;

    try {
      setSubmitting(true);

      // Validate input
      const validatedFood = nutritionService.validateFoodInput(foodForm);

      // Atomic get-or-create + accumulate (targets only apply on the day's
      // first insert; the RPC keeps existing targets otherwise)
      const targets: any = nutrition;
      const { data: updatedLog, error: rpcError } = await supabase.rpc('increment_daily_nutrition', {
        p_date: dateString,
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
          date: dateString,
          food_name: validatedFood.name,
          calories: validatedFood.calories,
          protein: validatedFood.protein,
          carbs: validatedFood.carbs,
          fats: validatedFood.fats,
          serving_size: validatedFood.servingSize || null,
          meal_type: 'snack',
          logged_at: new Date().toISOString()
        });

      if (foodError) throw foodError;

      // Success
      showAlert('Success', `${validatedFood.name} added successfully!`);
      setShowAddFood(false);
      setFoodForm(INITIAL_FOOD_FORM);
      loadNutritionData();
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
      // Atomic get-or-create + accumulate (only water changes here)
      const targets: any = nutrition;
      const { data: updatedLog, error } = await supabase.rpc('increment_daily_nutrition', {
        p_date: dateString,
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

      loadNutritionData();
    } catch (error) {
      console.error('Error adding water:', error);
      showAlert('Error', 'Failed to add water intake');
    } finally {
      setAddingWater(false);
    }
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
    const remaining = calculateRemaining(consumed, target);
    const percentage = calculatePercentage(consumed, target);
    const isOverTarget = consumed > target;

    return (
      <View className="bg-surface rounded-xl p-4 mb-3">
        <View className="flex-row justify-between items-center mb-2">
          <Text className="text-text font-bold text-base">{title}</Text>
          <View className="flex-row items-center">
            <Text className="text-text-light mr-2 text-sm">
              {consumed.toFixed(0)}/{target} {unit}
            </Text>
            <Text className={`font-bold text-sm ${isOverTarget ? 'text-orange-400' : 'text-green-400'}`}>
              {isOverTarget ? `+${(consumed - target).toFixed(0)} over` : `${remaining} left`}
            </Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View className="h-2 bg-gray-700 rounded-full overflow-hidden">
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

  const quickAddFood = (name, calories, protein, carbs, fats, servingSize) => {
    setFoodForm({
      name,
      calories: String(calories),
      protein: String(protein),
      carbs: String(carbs),
      fats: String(fats),
      servingSize
    });
    setShowAddFood(true);
  };

  // Show loading state
  if (loading && !refreshing) {
    return (
      <SafeAreaView className="flex-1 bg-bg">
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#3B82F6" />
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
          <Feather name="alert-circle" size={64} color="#F59E0B" />
          <Text className="text-text text-xl font-bold mt-6 text-center">
            Complete Your Profile
          </Text>
          <Text className="text-text-light text-center mt-2 mb-6">
            Please update your profile with weight, height, age, and gender to calculate your nutrition targets.
          </Text>
          <TouchableOpacity
            className="bg-blue-600 px-8 py-4 rounded-xl"
            onPress={() => router.push('/profile')}
          >
            <Text className="text-text font-bold text-lg">Go to Profile</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Calories consumed today; the target is already adjusted upward by calories burned
  const netCalories = dailyLog?.calories_consumed || 0;
  const adjustedTarget = nutrition.calories + (dailyLog?.calories_burned || 0);

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <ScrollView 
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" />
        }
      >
        {/* Header */}
        <View className="px-4 pt-4 pb-2">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-text text-3xl font-bold">Nutrition</Text>
            <TouchableOpacity
              className="bg-surface p-2 rounded-lg"
              onPress={() => setShowDatePicker(true)}
            >
              <Feather name="calendar" size={20} color="white" />
            </TouchableOpacity>
          </View>

          {/* Daily Goals Card */}
          <View className="bg-surface rounded-xl p-4 mb-4">
            <Text className="text-text font-bold text-lg mb-3">
              Daily Targets
            </Text>
            <View className="flex-row justify-between">
              <View className="items-center">
                <Text className="text-text text-2xl font-bold">
                  {nutrition.calories}
                </Text>
                <Text className="text-text-light text-sm">Calories</Text>
              </View>
              <View className="items-center">
                <Text className="text-text text-2xl font-bold">
                  {nutrition.protein}g
                </Text>
                <Text className="text-text-light text-sm">Protein</Text>
              </View>
              <View className="items-center">
                <Text className="text-text text-2xl font-bold">
                  {nutrition.carbs}g
                </Text>
                <Text className="text-text-light text-sm">Carbs</Text>
              </View>
              <View className="items-center">
                <Text className="text-text text-2xl font-bold">
                  {nutrition.fats}g
                </Text>
                <Text className="text-text-light text-sm">Fats</Text>
              </View>
            </View>
            
            {/* Show BMR and TDEE info */}
            <View className="mt-3 pt-3 border-t border-gray-700">
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
          <Text className="text-text text-xl font-bold mb-4">Calories</Text>

          <View className="bg-gradient-to-r from-orange-500 to-red-500 rounded-xl p-6">
            <View className="flex-row justify-between items-center mb-4">
              <View>
                <Text className="text-text font-bold text-lg">Daily Intake</Text>
                <Text className="text-text/80">
                  {netCalories} / {adjustedTarget} kcal
                </Text>
                {dailyLog?.calories_burned > 0 && (
                  <Text className="text-text/60 text-xs mt-1">
                    Burned: {dailyLog.calories_burned} kcal
                  </Text>
                )}
              </View>

              <View className="bg-white/20 px-4 py-2 rounded-full">
                <Text className="text-text font-bold">
                  {calculateRemaining(netCalories, adjustedTarget)} kcal left
                </Text>
              </View>
            </View>

            {/* Progress Circle */}
            <View className="items-center my-4">
              <View className="relative items-center justify-center">
                <View className="w-40 h-40 rounded-full border-8 border-gray-300/20 items-center justify-center">
                  <Text className="text-text text-3xl font-bold">
                    {calculatePercentage(netCalories, adjustedTarget).toFixed(0)}%
                  </Text>
                  <Text className="text-gray-300 text-sm">of goal</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              className="bg-white py-3 rounded-lg mt-4"
              onPress={() => setShowAddFood(true)}
            >
              <Text className="text-orange-600 text-center font-bold text-lg">
                + Add Food
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Macros */}
        <View className="px-4 mb-6">
          <Text className="text-text text-xl font-bold mb-4">Macronutrients</Text>

          {renderMacroCard(
            'Protein',
            dailyLog?.protein_consumed || 0,
            nutrition.protein,
            'g',
            'bg-blue-500'
          )}

          {renderMacroCard(
            'Carbohydrates',
            dailyLog?.carbs_consumed || 0,
            nutrition.carbs,
            'g',
            'bg-green-500'
          )}

          {renderMacroCard(
            'Fats',
            dailyLog?.fats_consumed || 0,
            nutrition.fats,
            'g',
            'bg-yellow-500'
          )}
        </View>

        {/* Water Tracking */}
        <View className="px-4 mb-6">
          <Text className="text-text text-xl font-bold mb-4">Water Intake</Text>

          <View className="bg-surface rounded-xl p-6">
            <View className="flex-row justify-between items-center mb-6">
              <View>
                <Text className="text-text font-bold text-lg">Daily Goal: 2.5L</Text>
                <Text className="text-text-light">
                  {((dailyLog?.water_intake_ml || 0) / 1000).toFixed(1)}L / 2.5L
                </Text>
              </View>

              <View className="bg-blue-500/20 px-4 py-2 rounded-full">
                <Text className="text-blue-400 font-bold">
                  {Math.min(100, ((dailyLog?.water_intake_ml || 0) / 2500 * 100)).toFixed(0)}%
                </Text>
              </View>
            </View>

            <View className="flex-row justify-between mb-4">
              {[250, 500, 1000].map((amount) => (
                <TouchableOpacity
                  key={amount}
                  className="bg-blue-600/20 px-4 py-3 rounded-lg border border-blue-500/30 flex-1 mx-1"
                  onPress={() => addWater(amount)}
                >
                  <Text className="text-blue-400 font-bold text-center">
                    +{amount}ml
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View className="flex-row items-center">
              <FontAwesome name="tint" size={24} color="#3B82F6" />
              <View className="flex-1 ml-3">
                <View className="flex-row justify-between mb-1">
                  <Text className="text-gray-300 text-sm">Water Intake</Text>
                  <Text className="text-text font-bold text-sm">
                    {dailyLog?.water_intake_ml || 0}ml
                  </Text>
                </View>
                <View className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <View
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${Math.min(100, ((dailyLog?.water_intake_ml || 0) / 2500) * 100)}%` }}
                  />
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Quick Add */}
        <View className="px-4 mb-8">
          <Text className="text-text text-xl font-bold mb-4">Quick Add</Text>

          <View className="flex-row justify-between">
            <TouchableOpacity
              className="bg-surface flex-1 mr-2 rounded-xl p-4 items-center"
              onPress={() => quickAddFood('Chicken Breast', 165, 31, 0, 3.6, '100g')}
            >
              <MaterialIcons name="fastfood" size={24} color="#10B981" />
              <Text className="text-text mt-2 text-center text-sm">Chicken Breast</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="bg-surface flex-1 mx-2 rounded-xl p-4 items-center"
              onPress={() => quickAddFood('Brown Rice', 111, 2.6, 23, 0.9, '100g')}
            >
              <FontAwesome name="spoon" size={24} color="#F59E0B" />
              <Text className="text-text mt-2 text-center text-sm">Brown Rice</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="bg-surface flex-1 ml-2 rounded-xl p-4 items-center"
              onPress={() => quickAddFood('Protein Shake', 120, 25, 3, 1, '1 scoop')}
            >
              <MaterialIcons name="local-cafe" size={24} color="#EF4444" />
              <Text className="text-text mt-2 text-center text-sm">Protein Shake</Text>
            </TouchableOpacity>
          </View>
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
          <View className="bg-bg rounded-t-3xl p-6 max-h-3/4">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-text text-2xl font-bold">Add Food</Text>
              <TouchableOpacity onPress={() => setShowAddFood(false)}>
                <AntDesign name="close" size={24} color="var(--text)" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="space-y-4">
                <View className="mb-4">
                  <Text className="text-text-light mb-2">Food Name *</Text>
                  <TextInput
                    className="bg-surface text-text rounded-xl p-4"
                    placeholder="e.g., Chicken Breast"
                    placeholderTextColor="#6B7280"
                    value={foodForm.name}
                    onChangeText={(text) => setFoodForm({ ...foodForm, name: text })}
                    editable={!submitting}
                  />
                </View>

                <View className="mb-4">
                  <Text className="text-text-light mb-2">Calories *</Text>
                  <TextInput
                    className="bg-surface text-text rounded-xl p-4"
                    placeholder="e.g., 165"
                    placeholderTextColor="#6B7280"
                    value={foodForm.calories}
                    onChangeText={(text) => setFoodForm({ ...foodForm, calories: text.replace(/[^0-9]/g, '') })}
                    keyboardType="numeric"
                    editable={!submitting}
                  />
                </View>

                <View className="flex-row justify-between mb-4">
                  <View className="flex-1 mr-2">
                    <Text className="text-text-light mb-2">Protein (g)</Text>
                    <TextInput
                      className="bg-surface text-text rounded-xl p-4"
                      placeholder="0"
                      placeholderTextColor="#6B7280"
                      value={foodForm.protein}
                      onChangeText={(text) => setFoodForm({ ...foodForm, protein: text.replace(/[^0-9.]/g, '') })}
                      keyboardType="decimal-pad"
                      editable={!submitting}
                    />
                  </View>

                  <View className="flex-1 mx-2">
                    <Text className="text-text-light mb-2">Carbs (g)</Text>
                    <TextInput
                      className="bg-surface text-text rounded-xl p-4"
                      placeholder="0"
                      placeholderTextColor="#6B7280"
                      value={foodForm.carbs}
                      onChangeText={(text) => setFoodForm({ ...foodForm, carbs: text.replace(/[^0-9.]/g, '') })}
                      keyboardType="decimal-pad"
                      editable={!submitting}
                    />
                  </View>

                  <View className="flex-1 ml-2">
                    <Text className="text-text-light mb-2">Fats (g)</Text>
                    <TextInput
                      className="bg-surface text-text rounded-xl p-4"
                      placeholder="0"
                      placeholderTextColor="#6B7280"
                      value={foodForm.fats}
                      onChangeText={(text) => setFoodForm({ ...foodForm, fats: text.replace(/[^0-9.]/g, '') })}
                      keyboardType="decimal-pad"
                      editable={!submitting}
                    />
                  </View>
                </View>

                <View className="mb-4">
                  <Text className="text-text-light mb-2">Serving Size</Text>
                  <TextInput
                    className="bg-surface text-text rounded-xl p-4"
                    placeholder="e.g., 100g, 1 cup"
                    placeholderTextColor="#6B7280"
                    value={foodForm.servingSize}
                    onChangeText={(text) => setFoodForm({ ...foodForm, servingSize: text })}
                    editable={!submitting}
                  />
                </View>
              </View>
            </ScrollView>

            <TouchableOpacity
              className={`py-4 rounded-xl mt-6 ${submitting ? 'bg-blue-600/50' : 'bg-blue-600'}`}
              onPress={addFood}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-text text-center font-bold text-lg">
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