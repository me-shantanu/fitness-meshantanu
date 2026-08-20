// app/workout-complete.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { workoutService } from '../services/workoutService';
import { useAuthStore } from '../store/authStore';
import Feather from '@expo/vector-icons/Feather';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { WorkoutSession } from '@/types/workout';

export default function WorkoutCompleteScreen() {
  const router = useRouter();
  const { sessionId, calories, duration } = useLocalSearchParams<{
    sessionId: string;
    calories: string;
    duration: string;
  }>();
  
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
    
    const sessionData = await workoutService.getSessionDetails(sessionId, user.id);
    if (sessionData) {
      setSession(sessionData);
    }
    setLoading(false);
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${mins}m ${secs}s`;
    }
    return `${mins}m ${secs}s`;
  };

  const totalSets = session?.exercise_sets?.length || 0;
  const uniqueExercises = new Set(session?.exercise_sets?.map(s => s.exercise_name)).size;
  const prCount = session?.exercise_sets?.filter(s => s.is_pr).length || 0;

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
      <ScrollView className="flex-1" contentContainerClassName="flex-grow">
        <View className="flex-1 justify-center items-center px-4 py-8">
          {/* Success Icon */}
          <View className="bg-green-500/20 rounded-full p-8 mb-6">
            <Feather name="check" size={64} color="#10B981" />
          </View>

          {/* Title */}
          <Text className="text-text text-3xl font-bold mb-2">
            Workout Complete!
          </Text>
          <Text className="text-text-light text-center mb-8">
            Great job! You've completed your workout.
          </Text>

          {/* Stats Cards */}
          <View className="w-full mb-8">
            {/* Duration & Calories */}
            <View className="flex-row justify-between mb-4">
              <View className="bg-surface rounded-xl p-6 flex-1 mr-2">
                <Feather name="clock" size={32} color="#3B82F6" />
                <Text className="text-text text-2xl font-bold mt-3">
                  {formatTime(parseInt(duration || '0'))}
                </Text>
                <Text className="text-text-light">Duration</Text>
              </View>

              <View className="bg-surface rounded-xl p-6 flex-1 ml-2">
                <Feather name="zap" size={32} color="#F59E0B" />
                <Text className="text-text text-2xl font-bold mt-3">
                  {calories || 0}
                </Text>
                <Text className="text-text-light">Calories Burned</Text>
              </View>
            </View>

            {/* Sets & Exercises */}
            <View className="flex-row justify-between mb-4">
              <View className="bg-surface rounded-xl p-6 flex-1 mr-2">
                <Feather name="repeat" size={32} color="#8B5CF6" />
                <Text className="text-text text-2xl font-bold mt-3">
                  {totalSets}
                </Text>
                <Text className="text-text-light">Total Sets</Text>
              </View>

              <View className="bg-surface rounded-xl p-6 flex-1 ml-2">
                <MaterialIcons name="fitness-center" size={32} color="#10B981" />
                <Text className="text-text text-2xl font-bold mt-3">
                  {uniqueExercises}
                </Text>
                <Text className="text-text-light">Exercises</Text>
              </View>
            </View>

            {/* Personal Records */}
            {prCount > 0 && (
              <View className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-xl p-6 border border-yellow-500/30">
                <View className="flex-row items-center justify-center">
                  <Text className="text-4xl mr-3">🏆</Text>
                  <View>
                    <Text className="text-text text-2xl font-bold">
                      {prCount} New PR{prCount > 1 ? 's' : ''}!
                    </Text>
                    <Text className="text-yellow-400 font-bold">
                      Personal Record{prCount > 1 ? 's' : ''} Achieved
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* Workout Summary */}
          {session && session.exercise_sets && session.exercise_sets.length > 0 && (
            <View className="w-full mb-8">
              <Text className="text-text text-xl font-bold mb-4">Workout Summary</Text>
              <View className="bg-surface rounded-xl p-4">
                {Array.from(new Set(session.exercise_sets.map(s => s.exercise_name))).map((exerciseName) => {
                  const exerciseSets = session.exercise_sets?.filter(s => s.exercise_name === exerciseName) || [];
                  const totalReps = exerciseSets.reduce((sum, set) => sum + set.reps, 0);
                  const maxWeight = Math.max(...exerciseSets.map(s => s.weight || 0));
                  const hasPR = exerciseSets.some(s => s.is_pr);

                  return (
                    <View key={exerciseName} className="mb-4 pb-4 border-b border-gray-700 last:border-0 last:mb-0 last:pb-0">
                      <View className="flex-row justify-between items-start mb-2">
                        <Text className="text-text font-bold text-lg flex-1">
                          {exerciseName}
                        </Text>
                        {hasPR && <Text className="text-xl">🏆</Text>}
                      </View>
                      <View className="flex-row justify-between">
                        <Text className="text-text-light text-sm">
                          {exerciseSets.length} sets • {totalReps} total reps
                        </Text>
                        {maxWeight > 0 && (
                          <Text className="text-blue-400 text-sm font-bold">
                            Max: {maxWeight}kg
                          </Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Action Buttons */}
          <View className="w-full space-y-3">
            <TouchableOpacity
              className="bg-blue-600 py-4 rounded-xl"
              onPress={() => router.replace('/(tabs)/workout' as any)}
            >
              <Text className="text-text text-center font-bold text-lg">
                Back to Workouts
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="bg-surface py-4 rounded-xl border border-gray-700"
              onPress={() => router.replace('/(tabs)' as any)}
            >
              <Text className="text-text-light text-center font-bold">
                Go to Dashboard
              </Text>
            </TouchableOpacity>
          </View>

          {/* Motivational Message */}
          <View className="mt-8 bg-blue-500/10 rounded-xl p-4 border border-blue-500/30">
            <Text className="text-blue-400 text-center text-sm">
              💪 Keep up the great work! Consistency is key to reaching your fitness goals.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}