import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { useWorkoutStore } from '../../store/workoutStore';
import { workoutService } from '../../services/workoutService';
import { nutritionService } from '../../services/nutritionService';
import AntDesign from '@expo/vector-icons/AntDesign';
import FontAwesome from '@expo/vector-icons/FontAwesome';

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  console.log('User in HomeScreen:', user);
  const [activePlan, setActivePlan] = useState(null);
  const [todayWorkout, setTodayWorkout] = useState(null);
  const [nutrition, setNutrition] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    workoutsThisWeek: 0,
    totalVolume: 0,
    prsThisMonth: 0,
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [
        plan,
        nutritionData,
        history
      ] = await Promise.all([
        workoutService.getActiveWorkoutPlan(user.id),
        nutritionService.calculateDailyTargets(user.id),
        workoutService.getWorkoutHistory(user.id, 7)
      ]);

      setActivePlan(plan);
      setNutrition(nutritionData);

      // Calculate stats
      const workoutsThisWeek = history.filter(s => 
        new Date(s.date) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      ).length;

      const totalVolume = history.reduce((sum, session) => {
        return sum + (session.exercise_sets?.reduce((setSum, set) => 
          setSum + (set.weight * set.reps), 0) || 0);
      }, 0);

      setStats({
        workoutsThisWeek,
        totalVolume,
        prsThisMonth: 0, // You'll need to fetch this
      });

      // Get today's workout
      if (plan) {
        const today = new Date().getDay(); // 0 = Sunday, 1 = Monday, etc.
        const adjustedDay = today === 0 ? 6 : today - 1; // Convert to 0-6 where 0=Monday
        const todayWorkoutDay = plan.workout_days?.find(d => d.day_of_week === adjustedDay);
        setTodayWorkout(todayWorkoutDay);
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
    }
    setLoading(false);
  };

  const startWorkout = async () => {
    if (!todayWorkout) return;
    
    const session = await workoutService.startWorkoutSession(user.id, todayWorkout.id);
    if (session) {
      router.push({
        pathname: '/workout-session',
        params: { sessionId: session.id }
      });
    }
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
        {/* Welcome Header */}
        <View className="px-4 pt-4 pb-2">
          <Text className="text-text text-2xl font-bold">Welcome back {user?.name || 'User'}!</Text>
          <Text className="text-text-light">Ready for your workout today?</Text>
        </View>

        {/* Today's Workout Card */}
        <View className="px-4 mt-4">
          <View className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-6">
            <Text className="text-text text-lg font-bold mb-2">Today's Workout</Text>
            {todayWorkout ? (
              <>
                <Text className="text-text text-2xl font-bold mb-2">
                  {todayWorkout.is_rest_day ? 'Rest Day' : todayWorkout.name}
                </Text>
                {!todayWorkout.is_rest_day && (
                  <>
                    <Text className="text-text opacity-90 mb-4">
                      {todayWorkout.planned_exercises?.length || 0} exercises
                    </Text>
                    <TouchableOpacity 
                      className="bg-white py-3 rounded-lg"
                      onPress={startWorkout}
                    >
                      <Text className="text-blue-600 text-center font-bold text-lg">
                        START WORKOUT
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </>
            ) : (
              <>
                <Text className="text-text text-xl mb-4">No workout scheduled</Text>
                <TouchableOpacity 
                  className="bg-white py-3 rounded-lg"
                  onPress={() => router.push('/create-plan')}
                >
                  <Text className="text-blue-600 text-center font-bold text-lg">
                    CREATE WORKOUT PLAN
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* Nutrition Summary */}
        {nutrition && (
          <View className="px-4 mt-6">
            <Text className="text-text text-xl font-bold mb-4">Nutrition Today</Text>
            <View className="bg-surface rounded-xl p-4">
              <View className="flex-row justify-between mb-4">
                <View className="items-center">
                  <Text className="text-text text-2xl font-bold">{nutrition.calories}</Text>
                  <Text className="text-text-light">Calories</Text>
                </View>
                <View className="items-center">
                  <Text className="text-text text-2xl font-bold">{nutrition.protein}g</Text>
                  <Text className="text-text-light">Protein</Text>
                </View>
                <View className="items-center">
                  <Text className="text-text text-2xl font-bold">{nutrition.carbs}g</Text>
                  <Text className="text-text-light">Carbs</Text>
                </View>
                <View className="items-center">
                  <Text className="text-text text-2xl font-bold">{nutrition.fats}g</Text>
                  <Text className="text-text-light">Fats</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => router.push('/nutrition')}>
                <Text className="text-blue-400 text-center">View Details →</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Stats Grid */}
        <View className="px-4 mt-6">
          <Text className="text-text text-xl font-bold mb-4">Your Stats</Text>
          <View className="flex-row flex-wrap justify-between">
            <View className="bg-surface w-[48%] rounded-xl p-4 mb-4">
              <FontAwesome name="calendar-check-o" size={24} color="#3B82F6" />
              <Text className="text-text text-2xl font-bold mt-2">{stats.workoutsThisWeek}</Text>
              <Text className="text-text-light">Workouts this week</Text>
            </View>
            
            <View className="bg-surface w-[48%] rounded-xl p-4 mb-4">
              <FontAwesome name="line-chart" size={24} color="#10B981" />
              <Text className="text-text text-2xl font-bold mt-2">
                {Math.round(stats.totalVolume)}kg
              </Text>
              <Text className="text-text-light">Total volume</Text>
            </View>
            
            <View className="bg-surface w-[48%] rounded-xl p-4">
              <FontAwesome name="trophy" size={24} color="#F59E0B" />
              <Text className="text-text text-2xl font-bold mt-2">{stats.prsThisMonth}</Text>
              <Text className="text-text-light">PRs this month</Text>
            </View>
            
            <View className="bg-surface w-[48%] rounded-xl p-4">
              <FontAwesome name="fire" size={24} color="#EF4444" />
              <Text className="text-text text-2xl font-bold mt-2">
                {nutrition?.tdee || 0}
              </Text>
              <Text className="text-text-light">Daily calories</Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View className="px-4 mt-6 mb-8">
          <Text className="text-text text-xl font-bold mb-4">Quick Actions</Text>
          <View className="flex-row justify-between">
            <TouchableOpacity 
              className="bg-surface flex-1 mr-2 rounded-xl p-4 items-center"
              onPress={() => router.push('/exercises')}
            >
              <AntDesign name="pluscircleo" size={24} color="#3B82F6" />
              <Text className="text-text mt-2 text-center">Add Exercise</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              className="bg-surface flex-1 mx-2 rounded-xl p-4 items-center"
              onPress={() => router.push('/history')}
            >
              <AntDesign name="calendar" size={24} color="#10B981" />
              <Text className="text-text mt-2 text-center">History</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              className="bg-surface flex-1 ml-2 rounded-xl p-4 items-center"
              onPress={() => router.push('/progress')}
            >
              <AntDesign name="linechart" size={24} color="#F59E0B" />
              <Text className="text-text mt-2 text-center">Progress</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}