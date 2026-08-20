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
import { supabase } from '../lib/supabase';
import { nutritionService } from '../services/nutritionService';
import { useAuthStore } from '../store/authStore';
import { useWorkoutStore } from '../store/workoutStore';
import AntDesign from '@expo/vector-icons/AntDesign';
import Feather from '@expo/vector-icons/Feather';
import { WorkoutSession, ExerciseSet, PlannedExercise } from '@/types/workout';
import { showAlert } from '@/utils/alert';
import { useThemeStore } from '@/store/useThemeStore';

export default function WorkoutSessionScreen() {
  const router = useRouter();
  const { colors } = useThemeStore();
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
  const [discarding, setDiscarding] = useState(false);

  // Rest timer: end timestamp; remaining seconds derived from it each tick
  const REST_SECONDS = 90;
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [restRemaining, setRestRemaining] = useState(0);

  useEffect(() => {
    if (restEndsAt === null) return;

    const tick = () => {
      const remaining = Math.ceil((restEndsAt - Date.now()) / 1000);
      if (remaining <= 0) {
        setRestEndsAt(null);
        setRestRemaining(0);
      } else {
        setRestRemaining(remaining);
      }
    };

    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [restEndsAt]);

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

  // Prefill weight/reps from the last set logged for this exercise in this
  // session; fall back to the plan targets when nothing is logged yet.
  const prefillInputs = (exercise: PlannedExercise, allSets: ExerciseSet[]) => {
    const logged = allSets.filter(s => s.planned_exercise_id === exercise.id);
    const lastSet = logged[logged.length - 1];

    if (lastSet) {
      setRepsInput(lastSet.reps.toString());
      setWeightInput(lastSet.weight ? lastSet.weight.toString() : '');
    } else {
      setRepsInput(exercise.target_reps.toString());
      setWeightInput(exercise.target_weight ? exercise.target_weight.toString() : '');
    }
  };

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
        prefillInputs(firstExercise, loadedSets);
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

        // Prefill the next set from what was just lifted
        setRepsInput(savedSet.reps.toString());
        setWeightInput(savedSet.weight ? savedSet.weight.toString() : '');

        // Start (or restart) the rest countdown
        setRestEndsAt(Date.now() + REST_SECONDS * 1000);

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
    setRestEndsAt(null);
    prefillInputs(nextEx, sets);
  };

  const previousExercise = () => {
    if (currentExerciseIndex === 0) return;

    const prevIndex = currentExerciseIndex - 1;
    setCurrentExerciseIndex(prevIndex);
    setRestEndsAt(null);

    if (session?.workout_days?.planned_exercises) {
      const prevEx = session.workout_days.planned_exercises[prevIndex];
      setCurrentSet(sets.filter(s => s.planned_exercise_id === prevEx.id).length + 1);
      prefillInputs(prevEx, sets);
    } else {
      setRepsInput('');
      setWeightInput('');
      setCurrentSet(1);
    }
  };

  const discardSession = async () => {
    if (!user?.id || !sessionId || discarding) return;

    setDiscarding(true);
    try {
      const { error } = await supabase
        .from('workout_sessions')
        .delete()
        .eq('id', sessionId)
        .eq('user_id', user.id);

      if (error) {
        showAlert('Error', 'Could not discard the workout. Please try again.');
        return;
      }
      router.back();
    } finally {
      setDiscarding(false);
    }
  };

  const handleClose = () => {
    // Completed sessions have nothing to abandon — just leave
    if (session?.completed_at) {
      router.back();
      return;
    }

    showAlert(
      'Leave workout?',
      'You can keep this workout in progress and resume it later from History, or discard it entirely.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Keep in progress', onPress: () => router.back() },
        { text: 'Discard', style: 'destructive', onPress: discardSession },
      ]
    );
  };

  const handleCompleteWorkout = () => {
    if (completing) return;

    setRestEndsAt(null);

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
          <ActivityIndicator size="large" color={colors.brand} />
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
            className="bg-primary px-6 py-3 rounded-lg mt-4"
            onPress={() => router.back()}
            accessibilityRole="button"
          >
            <Text className="text-on-brand font-bold">Go Back</Text>
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
            className="bg-primary px-6 py-3 rounded-lg mt-4"
            onPress={() => router.push('/edit-plan' as any)}
            accessibilityRole="button"
          >
            <Text className="text-on-brand font-bold">Edit Plan</Text>
          </TouchableOpacity>
          <TouchableOpacity className="mt-3" onPress={() => router.back()} accessibilityRole="button">
            <Text className="text-text-light">Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg">
      {/* Header */}
      <View className="px-4 py-4 flex-row justify-between items-center border-b border-border">
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Leave workout"
          onPress={handleClose}
          disabled={discarding}
        >
          <AntDesign name="close" size={24} color={colors.text} />
        </TouchableOpacity>

        <View className="items-center">
          <Text className="text-text text-lg font-bold">{formatTime(workoutDuration)}</Text>
          <Text className="text-text-light text-sm">{caloriesBurned} cal</Text>
        </View>

        <TouchableOpacity onPress={handleCompleteWorkout} disabled={completing} accessibilityRole="button">
          <Text className={`text-primary font-bold ${completing ? 'opacity-50' : ''}`}>Finish</Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1">
        {/* Current Exercise */}
        <View className="px-4 py-6">
          <View className="bg-surface rounded-2xl border border-border p-6">
            <View className="flex-row justify-between items-center mb-4">
              <View className="flex-1">
                <Text className="text-text-light text-sm mb-1">
                  Exercise {currentExerciseIndex + 1} of {session.workout_days?.planned_exercises?.length || 0}
                </Text>
                <Text className="text-text text-2xl font-bold">
                  {currentExercise.exercise_name}
                </Text>
              </View>

              <View className="bg-primary/15 px-4 py-2 rounded-lg">
                <Text className="text-primary font-bold text-lg">
                  Set {currentSet}
                </Text>
              </View>
            </View>

            <View className="flex-row justify-between mt-4 pt-4 border-t border-border">
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

        {/* Rest Timer */}
        {restEndsAt !== null && (
          <View className="px-4 mb-6">
            <View className="bg-primary/15 border border-primary/40 rounded-2xl p-4 flex-row items-center justify-between">
              <View>
                <Text className="text-primary font-bold mb-1">Rest</Text>
                <Text className="text-text text-3xl font-bold">
                  {formatTime(restRemaining)}
                </Text>
              </View>
              <View className="flex-row">
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Add 30 seconds to rest timer"
                  className="bg-surface-2 border border-border px-4 py-2 rounded-lg mr-2"
                  onPress={() => setRestEndsAt((prev) => (prev ?? Date.now()) + 30000)}
                >
                  <Text className="text-text font-bold">+30s</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Skip rest"
                  className="bg-surface-2 border border-border px-4 py-2 rounded-lg"
                  onPress={() => setRestEndsAt(null)}
                >
                  <Text className="text-text-light font-bold">Skip</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Log Set */}
        <View className="px-4 mb-6">
          <Text className="text-text text-lg font-bold mb-3">Log Set #{currentSet}</Text>
          <View className="bg-surface rounded-2xl border border-border p-6">
            <View className="flex-row justify-between mb-6">
              <View className="flex-1 mr-2">
                <Text className="text-text-light mb-2">Weight (kg)</Text>
                <TextInput
                  className="bg-surface-2 border border-border text-text text-center py-3 rounded-xl text-xl"
                  placeholder="0"
                  placeholderTextColor={colors.textLight}
                  value={weightInput}
                  onChangeText={setWeightInput}
                  keyboardType="numeric"
                  accessibilityLabel="Weight (kg)"
                />
              </View>
              <View className="flex-1 ml-2">
                <Text className="text-text-light mb-2">Reps</Text>
                <TextInput
                  className="bg-surface-2 border border-border text-text text-center py-3 rounded-xl text-xl"
                  placeholder="0"
                  placeholderTextColor={colors.textLight}
                  value={repsInput}
                  onChangeText={setRepsInput}
                  keyboardType="numeric"
                  accessibilityLabel="Reps"
                />
              </View>
            </View>

            <TouchableOpacity
              className={`bg-primary py-4 rounded-lg mb-3 ${logging ? 'opacity-50' : ''}`}
              disabled={logging}
              onPress={logSet}
              accessibilityRole="button"
            >
              <Text className="text-on-brand text-center font-bold text-lg">Log Set</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="bg-surface-2 border border-border py-4 rounded-lg"
              onPress={skipSet}
              accessibilityRole="button"
            >
              <Text className="text-text-light text-center font-bold text-lg">Skip Set</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Previous Sets */}
        {currentExerciseSets.length > 0 && (
          <View className="px-4 mb-6">
            <Text className="text-text text-lg font-bold mb-3">
              Previous Sets ({currentExerciseSets.length})
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {currentExerciseSets.map((set, index) => (
                <View key={set.id} className="bg-surface rounded-2xl border border-border p-4 mr-3 min-w-[120px]">
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-text font-bold">Set {set.set_number}</Text>
                    {set.is_pr && <Text className="text-accent">🏆</Text>}
                  </View>
                  <Text className="text-primary text-lg font-bold">
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
              className={`py-3 px-6 rounded-lg border border-border ${currentExerciseIndex === 0 ? 'bg-surface-2 opacity-50' : 'bg-surface'
                }`}
              onPress={previousExercise}
              disabled={currentExerciseIndex === 0}
              accessibilityRole="button"
            >
              <Text className={`${currentExerciseIndex === 0 ? 'text-text-light' : 'text-text'
                } font-bold`}>
                ← Previous
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="bg-primary py-3 px-6 rounded-lg"
              onPress={nextExercise}
              accessibilityRole="button"
            >
              <Text className="text-on-brand font-bold">
                {currentExerciseIndex === (session.workout_days?.planned_exercises?.length || 0) - 1
                  ? 'Finish →'
                  : 'Next Exercise →'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Exercise List */}
        <View className="px-4 pb-8">
          <Text className="text-text text-lg font-bold mb-3">Exercise List</Text>
          {session.workout_days?.planned_exercises?.map((exercise, index) => {
            const exerciseSets = sets.filter(s => s.planned_exercise_id === exercise.id);
            const isCompleted = exerciseSets.length >= exercise.target_sets;
            const isCurrent = index === currentExerciseIndex;

            return (
              <TouchableOpacity
                key={exercise.id}
                className={`bg-surface rounded-2xl p-4 mb-3 border ${isCurrent ? 'border-2 border-primary' : 'border-border'
                  }`}
                onPress={() => {
                  setCurrentExerciseIndex(index);
                  setCurrentSet(exerciseSets.length + 1);
                  setRepsInput(exercise.target_reps.toString());
                  if (exercise.target_weight) {
                    setWeightInput(exercise.target_weight.toString());
                  }
                }}
                accessibilityRole="button"
                accessibilityLabel={`Go to exercise ${exercise.exercise_name}`}
                accessibilityState={{ selected: isCurrent }}
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
                      <Text className="text-primary text-sm mt-1">
                        {exerciseSets.length} / {exercise.target_sets} sets completed
                      </Text>
                    )}
                  </View>

                  {isCompleted && (
                    <Feather name="check-circle" size={24} color={colors.brand} />
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