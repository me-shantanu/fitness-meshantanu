import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { workoutService } from '../../services/workoutService';
import { nutritionService } from '../../services/nutritionService';
import AntDesign from '@expo/vector-icons/AntDesign';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Icon from '@/components/Icon';
import { User } from '@supabase/supabase-js';
import { showAlert } from '@/utils/alert';

export default function HomeScreen() {
  const router = useRouter();
  const { user, profile } = useAuthStore();
  const [activePlan, setActivePlan] = useState(null);
  const [todayWorkout, setTodayWorkout] = useState(null);
  const [nutrition, setNutrition] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const startingRef = useRef(false);
  const [stats, setStats] = useState({
    workoutsThisWeek: 0,
    totalVolume: 0,
    prsThisMonth: 0,
  });

  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [user?.id])
  );

  const loadDashboardData = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [
        plan,
        nutritionData,
        history,
        personalRecords
      ] = await Promise.all([
        workoutService.getActiveWorkoutPlan(user.id),
        nutritionService.calculateDailyTargets(user.id),
        workoutService.getWorkoutHistory(user.id, 50),
        workoutService.getPersonalRecords(user.id)
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

      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const prsThisMonth = (personalRecords || []).filter(
        (pr: any) => pr.achieved_at && new Date(pr.achieved_at) >= monthStart
      ).length;

      setStats({
        workoutsThisWeek,
        totalVolume,
        prsThisMonth,
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
    if (!todayWorkout || !user?.id) return;

    if (startingRef.current) return;
    startingRef.current = true;
    setStarting(true);

    try {
      const session = await workoutService.startWorkoutSession(user.id, todayWorkout.id);
      if (session) {
        router.push({
          pathname: '/workout-session',
          params: { sessionId: session.id }
        });
      } else {
        showAlert('Error', 'Could not start workout. Please try again.');
      }
    } finally {
      startingRef.current = false;
      setStarting(false);
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
          <Text className="text-text text-2xl font-bold">Welcome back {profile?.full_name?.split(' ')[0] || 'User'}</Text>
          <Text className="text-text-light">Ready for your workout today?</Text>
        </View>

        {/* Today's Workout Card */}
        <View className="px-4 mt-4">
          <View className="bg-blue-600 rounded-2xl p-6">
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
                      className={`bg-white py-3 rounded-lg ${starting ? 'opacity-50' : ''}`}
                      disabled={starting}
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
        {nutrition?.error === 'incomplete_profile' && (
          <View className="px-4 mt-6">
            <View className="bg-surface rounded-xl p-4">
              <Text className="text-text font-bold mb-1">Complete your profile</Text>
              <Text className="text-text-light text-sm mb-3">
                Add your weight, height, age and gender to see nutrition targets.
              </Text>
              <TouchableOpacity onPress={() => router.push('/profile-setup')}>
                <Text className="text-blue-400 font-bold">Complete Profile →</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        {nutrition?.success && (
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
              <Icon name="CirclePlus" size={24} color="#3B82F6" />
              <Text className="text-text mt-2 text-center">Add Exercise</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="bg-surface flex-1 mx-2 rounded-xl p-4 items-center"
              onPress={() => router.push('/history')}
            >
              <Icon name="Calendars" size={24} color="#10B981" />
              <Text className="text-text mt-2 text-center">History</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="bg-surface flex-1 ml-2 rounded-xl p-4 items-center"
              onPress={() => router.push('/progress')}
            >
              <Icon name="ChartColumnIncreasing" size={24} color="#F59E0B" />
              <Text className="text-text mt-2 text-center">Progress</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}