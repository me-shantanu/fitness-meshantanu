// app/workout-session.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { workoutService } from '../services/workoutService';
import { nutritionService } from '../services/nutritionService';
import { useAuthStore } from '../store/authStore';
import { useWorkoutStore } from '../store/workoutStore';
import AntDesign from '@expo/vector-icons/AntDesign';
import Feather from '@expo/vector-icons/Feather';
import { WorkoutSession, ExerciseSet, PlannedExercise } from '@/types/workout';
import { showAlert } from '@/utils/alert';

export default function WorkoutSessionScreen() {
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { user, profile }: { user: any; profile: any } = useAuthStore();
  const { completeSession } = useWorkoutStore();

  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [currentSet, setCurrentSet] = useState(1);
  const [sets, setSets] = useState<ExerciseSet[]>([]);

  // Input values
  const [repsInput, setRepsInput] = useState('');
  const [weightInput, setWeightInput] = useState('');

  // Timer
  const [workoutDuration, setWorkoutDuration] = useState(0);
  const [caloriesBurned, setCaloriesBurned] = useState(0);

  // In-flight guards
  const [logging, setLogging] = useState(false);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    if (sessionId && user?.id) {
      loadSession();
    }
  }, [sessionId, user?.id]);

  // Derive the timer from session.started_at so refresh/resume shows real duration
  useEffect(() => {
    if (!session?.started_at) return;

    const startedAt = new Date(session.started_at).getTime();
    const tick = () => {
      const elapsed = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
      setWorkoutDuration(elapsed);
      if (profile?.weight) {
        const newCalories = nutritionService.calculateWorkoutCalories(
          profile.weight,
          elapsed / 60,
          'moderate'
        );
        setCaloriesBurned(newCalories);
      }
    };

    tick();
    const interval = setInterval(tick, 1000);

    return () => clearInterval(interval);
  }, [session?.started_at, profile?.weight]);

  const loadSession = async () => {
    if (!sessionId || !user?.id) return;

    setLoading(true);
    const sessionData = await workoutService.getSessionDetails(sessionId, user.id);
    if (sessionData) {
      setSession(sessionData);
      const loadedSets = sessionData.exercise_sets || [];
      setSets(loadedSets);

      // Set default values from planned exercise
      if (sessionData.workout_days?.planned_exercises?.[0]) {
        const firstExercise = sessionData.workout_days.planned_exercises[0];
        // Resume the set counter from the sets already logged for this exercise
        const loggedSets = loadedSets.filter(
          s => s.planned_exercise_id === firstExercise.id
        ).length;
        setCurrentSet(loggedSets + 1);
        setRepsInput(firstExercise.target_reps.toString());
        if (firstExercise.target_weight) {
          setWeightInput(firstExercise.target_weight.toString());
        }
      }
    }
    setLoading(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const currentExercise = session?.workout_days?.planned_exercises?.[currentExerciseIndex];
  const currentExerciseSets = sets.filter(
    s => s.planned_exercise_id === currentExercise?.id
  );

  const logSet = async () => {
    if (!user?.id || !sessionId || !currentExercise) return;
    if (logging) return;

    const reps = parseInt(repsInput) || 0;
    const weight = parseFloat(weightInput) || 0;

    if (reps <= 0) {
      showAlert('Error', 'Please enter valid reps');
      return;
    }

    const setData = {
      sessionId,
      plannedExerciseId: currentExercise.id,
      exerciseId: currentExercise.exercise_id,
      exerciseName: currentExercise.exercise_name,
      setNumber: currentSet,
      reps,
      weight: weight > 0 ? weight : undefined,
      userId: user.id
    };

    setLogging(true);
    try {
      const savedSet = await workoutService.logExerciseSet(setData);
      if (savedSet) {
        setSets([...sets, savedSet]);
        setCurrentSet(currentSet + 1);

        if (savedSet.is_pr) {
          showAlert('🏆 Personal Record!', `New PR for ${currentExercise.exercise_name}!`);
        }
      } else {
        showAlert('Error', 'Set could not be saved. Check your connection and try again.');
      }
    } finally {
      setLogging(false);
    }
  };

  const skipSet = () => {
    setCurrentSet(currentSet + 1);
  };

  const nextExercise = () => {
    if (!session?.workout_days?.planned_exercises) return;

    const nextIndex = currentExerciseIndex + 1;
    if (nextIndex >= session.workout_days.planned_exercises.length) {
      handleCompleteWorkout();
      return;
    }

    const nextEx = session.workout_days.planned_exercises[nextIndex];
    setCurrentExerciseIndex(nextIndex);
    setCurrentSet(sets.filter(s => s.planned_exercise_id === nextEx.id).length + 1);
    setRepsInput('');
    setWeightInput('');

    // Set default values for next exercise
    setRepsInput(nextEx.target_reps.toString());
    if (nextEx.target_weight) {
      setWeightInput(nextEx.target_weight.toString());
    }
  };

  const previousExercise = () => {
    if (currentExerciseIndex === 0) return;

    const prevIndex = currentExerciseIndex - 1;
    setCurrentExerciseIndex(prevIndex);
    setRepsInput('');
    setWeightInput('');

    if (session?.workout_days?.planned_exercises) {
      const prevEx = session.workout_days.planned_exercises[prevIndex];
      setCurrentSet(sets.filter(s => s.planned_exercise_id === prevEx.id).length + 1);
      setRepsInput(prevEx.target_reps.toString());
      if (prevEx.target_weight) {
        setWeightInput(prevEx.target_weight.toString());
      }
    } else {
      setCurrentSet(1);
    }
  };

  const handleCompleteWorkout = () => {
    if (completing) return;

    // Compute elapsed time and calories from started_at (not the 60s display boundary)
    const startedAt = session?.started_at
      ? new Date(session.started_at).getTime()
      : Date.now();
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
    const finalCalories = profile?.weight
      ? nutritionService.calculateWorkoutCalories(profile.weight, elapsedSeconds / 60, 'moderate')
      : caloriesBurned;

    showAlert(
      'Complete Workout',
      `Duration: ${formatTime(elapsedSeconds)}\nCalories burned: ${finalCalories} cal\n\nAre you sure you want to finish?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          onPress: async () => {
            if (!user?.id) return;
            if (completing) return;

            setCompleting(true);
            try {
              const success = await completeSession(sessionId, finalCalories, user.id);
              if (success) {
                router.replace({
                  pathname: '/workout-complete' as any,
                  params: {
                    calories: finalCalories.toString(),
                    duration: elapsedSeconds.toString(),
                    sessionId
                  }
                });
              } else {
                showAlert('Error', 'Failed to complete workout');
              }
            } finally {
              setCompleting(false);
            }
          }
        }
      ]
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

  if (!session) {
    return (
      <SafeAreaView className="flex-1 bg-bg">
        <View className="flex-1 justify-center items-center px-4">
          <Text className="text-text text-xl">Session not found</Text>
          <TouchableOpacity
            className="bg-blue-600 px-6 py-3 rounded-lg mt-4"
            onPress={() => router.back()}
          >
            <Text className="text-text font-bold">Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!currentExercise) {
    return (
      <SafeAreaView className="flex-1 bg-bg">
        <View className="flex-1 justify-center items-center px-4">
          <Text className="text-text text-xl font-bold">No exercises in this workout</Text>
          <Text className="text-text-light text-center mt-2">
            Add exercises to this day in your plan before starting the workout.
          </Text>
          <TouchableOpacity
            className="bg-blue-600 px-6 py-3 rounded-lg mt-4"
            onPress={() => router.push('/edit-plan' as any)}
          >
            <Text className="text-text font-bold">Edit Plan</Text>
          </TouchableOpacity>
          <TouchableOpacity className="mt-3" onPress={() => router.back()}>
            <Text className="text-text-light">Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg">
      {/* Header */}
      <View className="px-4 py-4 flex-row justify-between items-center border-b border-gray-800">
        <TouchableOpacity onPress={() => router.back()}>
          <AntDesign name="close" size={24} color="white" />
        </TouchableOpacity>

        <View className="items-center">
          <Text className="text-text text-lg font-bold">{formatTime(workoutDuration)}</Text>
          <Text className="text-text-light text-sm">{caloriesBurned} cal</Text>
        </View>

        <TouchableOpacity onPress={handleCompleteWorkout} disabled={completing}>
          <Text className={`text-blue-400 font-bold ${completing ? 'opacity-50' : ''}`}>Finish</Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1">
        {/* Current Exercise */}
        <View className="px-4 py-6">
          <View className="bg-surface rounded-xl p-6">
            <View className="flex-row justify-between items-center mb-4">
              <View className="flex-1">
                <Text className="text-text-light text-sm mb-1">
                  Exercise {currentExerciseIndex + 1} of {session.workout_days?.planned_exercises?.length || 0}
                </Text>
                <Text className="text-text text-2xl font-bold">
                  {currentExercise.exercise_name}
                </Text>
              </View>

              <View className="bg-blue-500/20 px-4 py-2 rounded-lg">
                <Text className="text-blue-400 font-bold text-lg">
                  Set {currentSet}
                </Text>
              </View>
            </View>

            <View className="flex-row justify-between mt-4 pt-4 border-t border-gray-700">
              <View className="items-center">
                <Text className="text-text-light text-sm">Target Sets</Text>
                <Text className="text-text text-xl font-bold mt-1">
                  {currentExercise.target_sets}
                </Text>
              </View>
              <View className="items-center">
                <Text className="text-text-light text-sm">Target Reps</Text>
                <Text className="text-text text-xl font-bold mt-1">
                  {currentExercise.target_reps}
                </Text>
              </View>
              <View className="items-center">
                <Text className="text-text-light text-sm">Target Weight</Text>
                <Text className="text-text text-xl font-bold mt-1">
                  {currentExercise.target_weight || '--'} kg
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Log Set */}
        <View className="px-4 mb-6">
          <Text className="text-text text-xl font-bold mb-4">Log Set #{currentSet}</Text>
          <View className="bg-surface rounded-xl p-6">
            <View className="flex-row justify-between mb-6">
              <View className="flex-1 mr-2">
                <Text className="text-text-light mb-2">Weight (kg)</Text>
                <TextInput
                  className="bg-gray-700 text-text text-center py-3 rounded-lg text-xl"
                  placeholder="0"
                  placeholderTextColor="#6B7280"
                  value={weightInput}
                  onChangeText={setWeightInput}
                  keyboardType="numeric"
                />
              </View>
              <View className="flex-1 ml-2">
                <Text className="text-text-light mb-2">Reps</Text>
                <TextInput
                  className="bg-gray-700 text-text text-center py-3 rounded-lg text-xl"
                  placeholder="0"
                  placeholderTextColor="#6B7280"
                  value={repsInput}
                  onChangeText={setRepsInput}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <TouchableOpacity
              className={`bg-blue-600 py-4 rounded-lg mb-3 ${logging ? 'opacity-50' : ''}`}
              disabled={logging}
              onPress={logSet}
            >
              <Text className="text-text text-center font-bold text-lg">Log Set</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="bg-gray-700 py-4 rounded-lg"
              onPress={skipSet}
            >
              <Text className="text-text-light text-center font-bold text-lg">Skip Set</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Previous Sets */}
        {currentExerciseSets.length > 0 && (
          <View className="px-4 mb-6">
            <Text className="text-text text-xl font-bold mb-4">
              Previous Sets ({currentExerciseSets.length})
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {currentExerciseSets.map((set, index) => (
                <View key={set.id} className="bg-surface rounded-lg p-4 mr-3 min-w-[120px]">
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-text font-bold">Set {set.set_number}</Text>
                    {set.is_pr && <Text className="text-yellow-400">🏆</Text>}
                  </View>
                  <Text className="text-blue-400 text-lg font-bold">
                    {set.weight ? `${set.weight}kg` : 'BW'}
                  </Text>
                  <Text className="text-text-light">
                    {set.reps} reps
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Exercise Navigation */}
        <View className="px-4 pb-6">
          <View className="flex-row justify-between">
            <TouchableOpacity
              className={`py-3 px-6 rounded-lg ${currentExerciseIndex === 0 ? 'bg-gray-800' : 'bg-surface'
                }`}
              onPress={previousExercise}
              disabled={currentExerciseIndex === 0}
            >
              <Text className={`${currentExerciseIndex === 0 ? 'text-gray-600' : 'text-text'
                } font-bold`}>
                ← Previous
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="bg-blue-600 py-3 px-6 rounded-lg"
              onPress={nextExercise}
            >
              <Text className="text-text font-bold">
                {currentExerciseIndex === (session.workout_days?.planned_exercises?.length || 0) - 1
                  ? 'Finish →'
                  : 'Next Exercise →'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Exercise List */}
        <View className="px-4 pb-8">
          <Text className="text-text text-xl font-bold mb-4">Exercise List</Text>
          {session.workout_days?.planned_exercises?.map((exercise, index) => {
            const exerciseSets = sets.filter(s => s.planned_exercise_id === exercise.id);
            const isCompleted = exerciseSets.length >= exercise.target_sets;
            const isCurrent = index === currentExerciseIndex;

            return (
              <TouchableOpacity
                key={exercise.id}
                className={`bg-surface rounded-lg p-4 mb-3 ${isCurrent ? 'border-2 border-blue-500' : ''
                  }`}
                onPress={() => {
                  setCurrentExerciseIndex(index);
                  setCurrentSet(exerciseSets.length + 1);
                  setRepsInput(exercise.target_reps.toString());
                  if (exercise.target_weight) {
                    setWeightInput(exercise.target_weight.toString());
                  }
                }}
              >
                <View className="flex-row justify-between items-center">
                  <View className="flex-1">
                    <Text className="text-text font-bold text-lg mb-1">
                      {exercise.exercise_name}
                    </Text>
                    <Text className="text-text-light text-sm">
                      {exercise.target_sets} sets × {exercise.target_reps} reps
                      {exercise.target_weight && ` @ ${exercise.target_weight}kg`}
                    </Text>
                    {exerciseSets.length > 0 && (
                      <Text className="text-blue-400 text-sm mt-1">
                        {exerciseSets.length} / {exercise.target_sets} sets completed
                      </Text>
                    )}
                  </View>

                  {isCompleted && (
                    <Feather name="check-circle" size={24} color="#10B981" />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}