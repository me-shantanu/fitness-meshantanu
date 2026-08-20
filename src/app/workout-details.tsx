// app/workout-details.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { workoutService } from '../services/workoutService';
import AntDesign from '@expo/vector-icons/AntDesign';
import Feather from '@expo/vector-icons/Feather';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { WorkoutSession, ExerciseSet } from '@/types/workout';
import { useThemeStore } from '@/store/useThemeStore';

export default function WorkoutDetailsScreen() {
  const router = useRouter();
  const { colors } = useThemeStore();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { user } = useAuthStore();

  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (sessionId && user?.id) {
      loadSession();
    } else {
      setLoading(false);
    }
  }, [sessionId, user?.id]);

  const loadSession = async () => {
    if (!sessionId || !user?.id) return;

    setLoading(true);
    const sessionData = await workoutService.getSessionDetails(sessionId, user.id);
    setSession(sessionData);
    setLoading(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-bg">
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={colors.brand} />
        </View>
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView className="flex-1 bg-bg">
        <View className="px-4 pt-4 pb-2 flex-row items-center">
          <TouchableOpacity onPress={() => router.back()}>
            <AntDesign name="arrow-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text className="text-text text-2xl font-bold ml-4">Workout Details</Text>
        </View>

        <View className="flex-1 justify-center items-center px-4">
          <View className="bg-surface rounded-2xl border border-border p-8 items-center">
            <Feather name="alert-circle" size={48} color={colors.textLight} />
            <Text className="text-text text-lg font-bold mt-4 mb-2">
              Workout Not Found
            </Text>
            <Text className="text-text-light text-center mb-4">
              This workout could not be loaded. It may have been deleted.
            </Text>
            <TouchableOpacity
              className="bg-primary px-6 py-3 rounded-lg"
              onPress={() => router.back()}
            >
              <Text className="text-on-brand font-bold">Go Back</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const exerciseSets = session.exercise_sets || [];
  const totalVolume = exerciseSets.reduce((sum, set) =>
    sum + ((set.weight || 0) * set.reps), 0);
  const exerciseNames = [...new Set(exerciseSets.map(s => s.exercise_name))];

  const duration = session.completed_at
    ? Math.round((new Date(session.completed_at).getTime() - new Date(session.started_at).getTime()) / 60000)
    : null;

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <ScrollView className="flex-1">
        {/* Header */}
        <View className="px-4 pt-4 pb-2 flex-row items-center">
          <TouchableOpacity onPress={() => router.back()}>
            <AntDesign name="arrow-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text className="text-text text-2xl font-bold ml-4">Workout Details</Text>
        </View>

        {/* Summary Card */}
        <View className="bg-surface rounded-2xl border border-border p-4 mb-6 mx-4 mt-4">
          <View className="flex-row justify-between items-start mb-3">
            <View className="flex-1">
              <Text className="text-text font-bold text-lg mb-1">
                {session.workout_days?.name || 'Quick Workout'}
              </Text>
              <Text className="text-text-light text-sm">
                {formatDate(session.date)}
              </Text>
            </View>

            <View className={`px-3 py-1 rounded-full ${session.completed_at ? 'bg-primary/15' : 'bg-accent/15'}`}>
              <Text className={`text-sm font-bold ${session.completed_at ? 'text-primary' : 'text-accent'}`}>
                {session.completed_at ? 'Completed' : 'In Progress'}
              </Text>
            </View>
          </View>

          <View className="flex-row justify-between mt-3 pt-3 border-t border-border">
            <View className="items-center flex-1">
              <Feather name="activity" size={20} color={colors.brand} />
              <Text className="text-text font-bold mt-1">{exerciseSets.length}</Text>
              <Text className="text-text-light text-xs">Sets</Text>
            </View>

            <View className="items-center flex-1">
              <Feather name="bar-chart-2" size={20} color={colors.brand} />
              <Text className="text-text font-bold mt-1">{Math.round(totalVolume)}</Text>
              <Text className="text-text-light text-xs">Volume (kg)</Text>
            </View>

            <View className="items-center flex-1">
              <AntDesign name="fire" size={20} color={colors.danger} />
              <Text className="text-text font-bold mt-1">{session.total_calories_burned || 0}</Text>
              <Text className="text-text-light text-xs">Calories</Text>
            </View>

            {duration !== null && (
              <View className="items-center flex-1">
                <Feather name="clock" size={20} color={colors.accent} />
                <Text className="text-text font-bold mt-1">{duration}</Text>
                <Text className="text-text-light text-xs">Minutes</Text>
              </View>
            )}
          </View>
        </View>

        {/* Sets grouped by exercise */}
        <View className="px-4 mb-8">
          <Text className="text-text text-lg font-bold mb-3">Exercises</Text>

          {exerciseNames.length > 0 ? (
            exerciseNames.map((exerciseName) => {
              const setsForExercise = exerciseSets.filter(
                s => s.exercise_name === exerciseName
              );

              return (
                <View key={exerciseName} className="bg-surface rounded-2xl border border-border p-4 mb-3">
                  <View className="flex-row justify-between items-center mb-3">
                    <Text className="text-text font-bold text-lg flex-1">
                      {exerciseName}
                    </Text>
                    {setsForExercise.some(s => s.is_pr) && (
                      <View className="bg-accent/15 px-3 py-1 rounded-full">
                        <Text className="text-accent font-bold text-xs">PR 🏆</Text>
                      </View>
                    )}
                  </View>

                  {setsForExercise.map((set: ExerciseSet) => (
                    <View
                      key={set.id}
                      className="flex-row justify-between items-center py-2 border-t border-border"
                    >
                      <Text className="text-text-light">Set {set.set_number}</Text>
                      <Text className="text-text font-bold">
                        {set.reps} reps
                      </Text>
                      <Text className="text-primary font-bold">
                        {set.weight ? `${set.weight}kg` : 'BW'}
                      </Text>
                    </View>
                  ))}
                </View>
              );
            })
          ) : (
            <View className="bg-surface rounded-2xl border border-border p-8 items-center">
              <MaterialIcons name="fitness-center" size={48} color={colors.textLight} />
              <Text className="text-text text-lg font-bold mt-4 mb-2">
                No Sets Logged
              </Text>
              <Text className="text-text-light text-center">
                No exercise sets were recorded for this workout.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
