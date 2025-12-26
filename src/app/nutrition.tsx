import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { nutritionService } from '../services/nutritionService';
import { supabase } from '../lib/supabase';
import AntDesign from '@expo/vector-icons/AntDesign';
import Feather from '@expo/vector-icons/Feather';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

export default function NutritionScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  
  const [nutrition, setNutrition] = useState(null);
  const [dailyLog, setDailyLog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showAddFood, setShowAddFood] = useState(false);
  const [foodForm, setFoodForm] = useState({
    name: '',
    calories: '',
    protein: '',
    carbs: '',
    fats: '',
    servingSize: '',
  });

  useEffect(() => {
    loadNutritionData();
  }, [selectedDate]);

  const loadNutritionData = async () => {
    setLoading(true);
    try {
      // Get nutrition targets
      const nutritionData = await nutritionService.calculateDailyTargets(user.id);
      setNutrition(nutritionData);

      // Get daily log for selected date
      const dateString = selectedDate.toISOString().split('T')[0];
      const { data: logData } = await supabase
        .from('daily_nutrition')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', dateString)
        .single();

      setDailyLog(logData || {
        calories_consumed: 0,
        protein_consumed: 0,
        carbs_consumed: 0,
        fats_consumed: 0,
        water_intake_ml: 0,
      });
    } catch (error) {
      console.error('Error loading nutrition data:', error);
    }
    setLoading(false);
  };

  const addFood = async () => {
    if (!foodForm.name || !foodForm.calories) {
      Alert.alert('Error', 'Please enter food name and calories');
      return;
    }

    try {
      const dateString = selectedDate.toISOString().split('T')[0];
      
      // Check if daily log exists
      const { data: existingLog } = await supabase
        .from('daily_nutrition')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', dateString)
        .single();

      if (existingLog) {
        // Update existing log
        const { error } = await supabase
          .from('daily_nutrition')
          .update({
            calories_consumed: existingLog.calories_consumed + parseInt(foodForm.calories),
            protein_consumed: existingLog.protein_consumed + parseFloat(foodForm.protein || 0),
            carbs_consumed: existingLog.carbs_consumed + parseFloat(foodForm.carbs || 0),
            fats_consumed: existingLog.fats_consumed + parseFloat(foodForm.fats || 0),
            updated_at: new Date().toISOString()
          })
          .eq('id', existingLog.id);

        if (error) throw error;
      } else {
        // Create new log with nutrition targets
        const { error } = await supabase
          .from('daily_nutrition')
          .insert({
            user_id: user.id,
            date: dateString,
            target_calories: nutrition?.calories || 2000,
            target_protein: nutrition?.protein || 150,
            target_carbs: nutrition?.carbs || 250,
            target_fats: nutrition?.fats || 65,
            calories_consumed: parseInt(foodForm.calories),
            protein_consumed: parseFloat(foodForm.protein || 0),
            carbs_consumed: parseFloat(foodForm.carbs || 0),
            fats_consumed: parseFloat(foodForm.fats || 0),
            water_intake_ml: 0
          });

        if (error) throw error;
      }

      // Add to food log history
      const { error: foodError } = await supabase
        .from('food_log')
        .insert({
          user_id: user.id,
          date: dateString,
          food_name: foodForm.name,
          calories: parseInt(foodForm.calories),
          protein: parseFloat(foodForm.protein || 0),
          carbs: parseFloat(foodForm.carbs || 0),
          fats: parseFloat(foodForm.fats || 0),
          serving_size: foodForm.servingSize,
          meal_type: 'snack'
        });

      if (foodError) throw error;

      Alert.alert('Success', 'Food added successfully!');
      setShowAddFood(false);
      setFoodForm({
        name: '',
        calories: '',
        protein: '',
        carbs: '',
        fats: '',
        servingSize: '',
      });
      loadNutritionData();
    } catch (error) {
      console.error('Error adding food:', error);
      Alert.alert('Error', 'Failed to add food');
    }
  };

  const addWater = async (amount) => {
    try {
      const dateString = selectedDate.toISOString().split('T')[0];
      
      const { data: existingLog } = await supabase
        .from('daily_nutrition')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', dateString)
        .single();

      if (existingLog) {
        const { error } = await supabase
          .from('daily_nutrition')
          .update({
            water_intake_ml: (existingLog.water_intake_ml || 0) + amount,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingLog.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('daily_nutrition')
          .insert({
            user_id: user.id,
            date: dateString,
            water_intake_ml: amount,
            calories_consumed: 0,
            protein_consumed: 0,
            carbs_consumed: 0,
            fats_consumed: 0
          });

        if (error) throw error;
      }

      loadNutritionData();
    } catch (error) {
      console.error('Error adding water:', error);
    }
  };

  const calculateRemaining = (consumed, target) => {
    const remaining = target - consumed;
    return remaining > 0 ? remaining : 0;
  };

  const calculatePercentage = (consumed, target) => {
    if (target === 0) return 0;
    const percentage = (consumed / target) * 100;
    return percentage > 100 ? 100 : percentage;
  };

  const renderMacroCard = (title, consumed, target, unit, color) => {
    const remaining = calculateRemaining(consumed, target);
    const percentage = calculatePercentage(consumed, target);
    
    return (
      <View className="bg-surface rounded-xl p-4 mb-3">
        <View className="flex-row justify-between items-center mb-2">
          <Text className="text-text font-bold">{title}</Text>
          <View className="flex-row items-center">
            <Text className="text-text-light mr-2">
              {consumed.toFixed(0)}/{target} {unit}
            </Text>
            <Text className={`font-bold ${remaining > 0 ? 'text-green-400' : 'text-red-400'}`}>
              {remaining > 0 ? `${remaining} ${unit} left` : 'Goal reached!'}
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
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-bg">
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <ScrollView className="flex-1">
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
          
          <View className="bg-surface rounded-xl p-4 mb-4">
            <Text className="text-text font-bold text-lg mb-2">
              Daily Goals
            </Text>
            <View className="flex-row justify-between">
              <View className="items-center">
                <Text className="text-text text-2xl font-bold">
                  {nutrition?.calories || 0}
                </Text>
                <Text className="text-text-light text-sm">Calories</Text>
              </View>
              <View className="items-center">
                <Text className="text-text text-2xl font-bold">
                  {nutrition?.protein || 0}g
                </Text>
                <Text className="text-text-light text-sm">Protein</Text>
              </View>
              <View className="items-center">
                <Text className="text-text text-2xl font-bold">
                  {nutrition?.carbs || 0}g
                </Text>
                <Text className="text-text-light text-sm">Carbs</Text>
              </View>
              <View className="items-center">
                <Text className="text-text text-2xl font-bold">
                  {nutrition?.fats || 0}g
                </Text>
                <Text className="text-text-light text-sm">Fats</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Calories */}
        <View className="px-4 mb-6">
          <Text className="text-text text-xl font-bold mb-4">Calories</Text>
          
          <View className="bg-gradient-to-r from-orange-500 to-red-500 rounded-xl p-6">
            <View className="flex-row justify-between items-center mb-4">
              <View>
                <Text className="text-text font-bold text-lg">Daily Intake</Text>
                <Text className="text-text/80">
                  {dailyLog?.calories_consumed || 0} / {nutrition?.calories || 0} kcal
                </Text>
              </View>
              
              <View className="bg-white/20 px-4 py-2 rounded-full">
                <Text className="text-text font-bold">
                  {calculateRemaining(dailyLog?.calories_consumed || 0, nutrition?.calories || 0)} kcal left
                </Text>
              </View>
            </View>
            
            {/* Progress Circle */}
            <View className="items-center my-4">
              <View className="relative items-center justify-center">
                <View className="w-40 h-40 rounded-full border-8 border-gray-300/20 items-center justify-center">
                  <Text className="text-text text-3xl font-bold">
                    {calculatePercentage(dailyLog?.calories_consumed || 0, nutrition?.calories || 0).toFixed(0)}%
                  </Text>
                  <Text className="text-gray-300">of goal</Text>
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
            nutrition?.protein || 0,
            'g',
            'bg-blue-500'
          )}
          
          {renderMacroCard(
            'Carbohydrates',
            dailyLog?.carbs_consumed || 0,
            nutrition?.carbs || 0,
            'g',
            'bg-green-500'
          )}
          
          {renderMacroCard(
            'Fats',
            dailyLog?.fats_consumed || 0,
            nutrition?.fats || 0,
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
                  {(dailyLog?.water_intake_ml || 0) / 1000}L / 2.5L
                </Text>
              </View>
              
              <View className="bg-blue-500/20 px-4 py-2 rounded-full">
                <Text className="text-blue-400 font-bold">
                  {((dailyLog?.water_intake_ml || 0) / 2500 * 100).toFixed(0)}%
                </Text>
              </View>
            </View>
            
            <View className="flex-row justify-between mb-4">
              {[250, 500, 1000].map((amount) => (
                <TouchableOpacity
                  key={amount}
                  className="bg-blue-600/20 px-4 py-3 rounded-lg border border-blue-500/30"
                  onPress={() => addWater(amount)}
                >
                  <Text className="text-blue-400 font-bold">
                    +{amount}ml
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <View className="flex-row items-center">
              <FontAwesome name="tint" size={24} color="#3B82F6" />
              <View className="flex-1 ml-3">
                <View className="flex-row justify-between mb-1">
                  <Text className="text-gray-300">Water Intake</Text>
                  <Text className="text-text font-bold">
                    {dailyLog?.water_intake_ml || 0}ml
                  </Text>
                </View>
                <View className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <View 
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${((dailyLog?.water_intake_ml || 0) / 2500) * 100}%` }}
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
              onPress={() => {
                setFoodForm({
                  ...foodForm,
                  name: 'Chicken Breast',
                  calories: '165',
                  protein: '31',
                  carbs: '0',
                  fats: '3.6',
                  servingSize: '100g'
                });
                setShowAddFood(true);
              }}
            >
              <MaterialIcons name="fastfood" size={24} color="#10B981" />
              <Text className="text-text mt-2 text-center text-sm">Chicken Breast</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              className="bg-surface flex-1 mx-2 rounded-xl p-4 items-center"
              onPress={() => {
                setFoodForm({
                  ...foodForm,
                  name: 'Brown Rice',
                  calories: '111',
                  protein: '2.6',
                  carbs: '23',
                  fats: '0.9',
                  servingSize: '100g'
                });
                setShowAddFood(true);
              }}
            >
              <FontAwesome name="spoon" size={24} color="#F59E0B" />
              <Text className="text-text mt-2 text-center text-sm">Brown Rice</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              className="bg-surface flex-1 ml-2 rounded-xl p-4 items-center"
              onPress={() => {
                setFoodForm({
                  ...foodForm,
                  name: 'Protein Shake',
                  calories: '120',
                  protein: '25',
                  carbs: '3',
                  fats: '1',
                  servingSize: '1 scoop'
                });
                setShowAddFood(true);
              }}
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
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-bg rounded-t-3xl p-6 max-h-3/4">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-text text-2xl font-bold">Add Food</Text>
              <TouchableOpacity onPress={() => setShowAddFood(false)}>
                <AntDesign name="close" size={24} color="white" />
              </TouchableOpacity>
            </View>
            
            <ScrollView>
              <View className="space-y-4">
                <View>
                  <Text className="text-text-light mb-2">Food Name</Text>
                  <TextInput
                    className="bg-surface text-text rounded-xl p-4"
                    placeholder="e.g., Chicken Breast"
                    placeholderTextColor="#6B7280"
                    value={foodForm.name}
                    onChangeText={(text) => setFoodForm({...foodForm, name: text})}
                  />
                </View>
                
                <View>
                  <Text className="text-text-light mb-2">Calories</Text>
                  <TextInput
                    className="bg-surface text-text rounded-xl p-4"
                    placeholder="e.g., 165"
                    placeholderTextColor="#6B7280"
                    value={foodForm.calories}
                    onChangeText={(text) => setFoodForm({...foodForm, calories: text})}
                    keyboardType="numeric"
                  />
                </View>
                
                <View className="flex-row justify-between">
                  <View className="flex-1 mr-2">
                    <Text className="text-text-light mb-2">Protein (g)</Text>
                    <TextInput
                      className="bg-surface text-text rounded-xl p-4"
                      placeholder="0"
                      placeholderTextColor="#6B7280"
                      value={foodForm.protein}
                      onChangeText={(text) => setFoodForm({...foodForm, protein: text})}
                      keyboardType="numeric"
                    />
                  </View>
                  
                  <View className="flex-1 mx-2">
                    <Text className="text-text-light mb-2">Carbs (g)</Text>
                    <TextInput
                      className="bg-surface text-text rounded-xl p-4"
                      placeholder="0"
                      placeholderTextColor="#6B7280"
                      value={foodForm.carbs}
                      onChangeText={(text) => setFoodForm({...foodForm, carbs: text})}
                      keyboardType="numeric"
                    />
                  </View>
                  
                  <View className="flex-1 ml-2">
                    <Text className="text-text-light mb-2">Fats (g)</Text>
                    <TextInput
                      className="bg-surface text-text rounded-xl p-4"
                      placeholder="0"
                      placeholderTextColor="#6B7280"
                      value={foodForm.fats}
                      onChangeText={(text) => setFoodForm({...foodForm, fats: text})}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
                
                <View>
                  <Text className="text-text-light mb-2">Serving Size</Text>
                  <TextInput
                    className="bg-surface text-text rounded-xl p-4"
                    placeholder="e.g., 100g, 1 cup"
                    placeholderTextColor="#6B7280"
                    value={foodForm.servingSize}
                    onChangeText={(text) => setFoodForm({...foodForm, servingSize: text})}
                  />
                </View>
              </View>
            </ScrollView>
            
            <TouchableOpacity
              className="bg-blue-600 py-4 rounded-xl mt-6"
              onPress={addFood}
            >
              <Text className="text-text text-center font-bold text-lg">
                Add to Daily Log
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}