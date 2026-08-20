// app/(tabs)/workouts.tsx
import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { useWorkoutStore } from '../../store/workoutStore';
import { workoutService } from '../../services/workoutService';
import AntDesign from '@expo/vector-icons/AntDesign';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Feather from '@expo/vector-icons/Feather';
import { useThemeStore } from '@/store/useThemeStore';
import { WorkoutDay } from '@/types/workout';
import { showAlert } from '@/utils/alert';

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function WorkoutsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { activePlan, loading, loadActivePlan, deletePlan: storeDeletePlan } = useWorkoutStore();

  const [showDayModal, setShowDayModal] = useState(false);
  const [selectedDay, setSelectedDay] = useState<WorkoutDay | null>(null);
  const [starting, setStarting] = useState(false);
  const startingRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (user?.id) {
        loadActivePlan(user.id);
      }
    }, [user?.id])
  );

  const startWorkout = async (workoutDay: WorkoutDay) => {
    if (!user?.id || !workoutDay.id) return;

    if (workoutDay.is_rest_day) {
      showAlert('Rest Day', 'Today is a rest day! Take it easy and recover.');
      return;
    }

    if (startingRef.current) return;
    startingRef.current = true;
    setStarting(true);

    try {
      const session = await workoutService.startWorkoutSession(user.id, workoutDay.id);
      if (session) {
        router.push({
          pathname: '/workout-session' as any,
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

  const deletePlan = () => {
    if (!user?.id || !activePlan?.id) return;
    const userId = user.id;
    const planId = activePlan.id;

    showAlert(
      'Delete Plan',
      'This permanently deletes the plan, its schedule and exercises. Workout history is kept.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const success = await storeDeletePlan(userId, planId);
            if (success) {
              showAlert('Success', 'Workout plan deleted successfully');
            } else {
              showAlert('Error', 'Failed to delete workout plan');
            }
          }
        }
      ]
    );
  };

  const editWorkoutDay = (day: WorkoutDay) => {
    setSelectedDay(day);
    setShowDayModal(true);
  };

  const renderWorkoutDay = (day: WorkoutDay, index: number) => {
    return (
      <TouchableOpacity
        key={day.id || index}
        className={`mb-4 mx-4 rounded-xl p-4 ${day.is_rest_day ? 'bg-surface' : 'bg-surface border border-blue-500/30'
          }`}
        onPress={() => editWorkoutDay(day)}
      >
        <View className="flex-row justify-between items-center mb-3">
          <View className="flex-row items-center">
            <View className={`w-10 h-10 rounded-lg justify-center items-center mr-3 ${day.is_rest_day ? 'bg-gray-700' : 'bg-blue-500/20'
              }`}>
              <Text className={`font-bold text-lg ${day.is_rest_day ? 'text-text-light' : 'text-blue-400'
                }`}>
                {index + 1}
              </Text>
            </View>
            <View>
              <Text className="text-text font-bold text-lg">
                {DAYS_OF_WEEK[day.day_of_week]}
              </Text>
              <Text className={`text-sm ${day.is_rest_day ? 'text-text-light' : 'text-blue-400'
                }`}>
                {day.is_rest_day ? 'Rest Day' : day.name || 'Workout Day'}
              </Text>
            </View>
          </View>

          {!day.is_rest_day && (
            <TouchableOpacity
              className={`bg-blue-600 px-4 py-2 rounded-lg ${starting ? 'opacity-50' : ''}`}
              disabled={starting}
              onPress={(e) => {
                e.stopPropagation();
                startWorkout(day);
              }}
            >
              <Text className="text-text font-bold">Start</Text>
            </TouchableOpacity>
          )}
        </View>

        {!day.is_rest_day && day.planned_exercises && day.planned_exercises.length > 0 && (
          <View className="mt-3">
            <Text className="text-text-light text-sm mb-2">Exercises:</Text>
            {day.planned_exercises.slice(0, 3).map((exercise, exIndex) => (
              <View key={exercise.id || exIndex} className="flex-row items-center mb-1">
                <View className="w-2 h-2 rounded-full bg-blue-400 mr-2" />
                <Text className="text-gray-300 text-sm flex-1">
                  {exercise.exercise_name}
                </Text>
                <Text className="text-gray-500 text-xs">
                  {exercise.target_sets}×{exercise.target_reps}
                  {exercise.target_weight ? ` @ ${exercise.target_weight}kg` : ''}
                </Text>
              </View>
            ))}
            {day.planned_exercises.length > 3 && (
              <Text className="text-gray-500 text-xs mt-1">
                +{day.planned_exercises.length - 3} more exercises
              </Text>
            )}
          </View>
        )}
      </TouchableOpacity>
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

  if (!activePlan) {
    return (
      <SafeAreaView className="flex-1 bg-bg">
        <ScrollView className="flex-1">
          <View className="px-4 pt-4">
            <Text className="text-text text-3xl font-bold mb-2">Workout Plans</Text>
            <Text className="text-text-light mb-8">Create and manage your workout routines</Text>
          </View>

          <View className="flex-1 justify-center items-center px-4 mt-20">
            <View className="bg-surface rounded-2xl p-8 items-center">
              <MaterialIcons name="fitness-center" size={64} color="#6B7280" />
              <Text className="text-text text-xl font-bold mt-6 mb-3">
                No Active Workout Plan
              </Text>
              <Text className="text-text-light text-center mb-8">
                Create a workout plan or choose from templates to start tracking your progress.
              </Text>

              <TouchableOpacity
                className="bg-blue-600 py-4 rounded-xl w-full items-center mb-3"
                onPress={() => router.push('/create-plan' as any)}
              >
                <Text className="text-text font-bold text-lg">Create Workout Plan</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="py-4 rounded-xl w-full items-center border border-gray-700"
                onPress={() => router.push('/browse-templates' as any)}
              >
                <Text className="text-gray-300">Browse Templates</Text>
              </TouchableOpacity>
            </View>

            <View className="mt-8 w-full">
              <Text className="text-text text-lg font-bold mb-4">Why Create a Plan?</Text>

              <View className="flex-row justify-between">
                <View className="bg-surface p-4 rounded-xl flex-1 mr-2">
                  <Feather name="target" size={24} color="#10B981" />
                  <Text className="text-text font-bold mt-2">Stay Consistent</Text>
                  <Text className="text-text-light text-xs mt-1">
                    Follow a structured routine
                  </Text>
                </View>

                <View className="bg-surface p-4 rounded-xl flex-1 mx-2">
                  <Feather name="trending-up" size={24} color="#3B82F6" />
                  <Text className="text-text font-bold mt-2">Track Progress</Text>
                  <Text className="text-text-light text-xs mt-1">
                    Monitor improvements over time
                  </Text>
                </View>

                <View className="bg-surface p-4 rounded-xl flex-1 ml-2">
                  <Feather name="award" size={24} color="#F59E0B" />
                  <Text className="text-text font-bold mt-2">Achieve Goals</Text>
                  <Text className="text-text-light text-xs mt-1">
                    Reach your fitness targets
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <ScrollView className="flex-1">
        <View className="px-4 pt-4">
          <View className="flex-row justify-between items-center mb-4">
            <View className="flex-1">
              <Text className="text-text text-3xl font-bold">Workout Plan</Text>
              <Text className="text-text-light">{activePlan.name}</Text>
            </View>

            <View className="flex-row">
              <TouchableOpacity
                className="bg-surface p-2 rounded-lg mr-2"
                onPress={() => router.push('/browse-templates' as any)}
              >
                <MaterialIcons name="content-copy" size={20} color="white" />
              </TouchableOpacity>

              <TouchableOpacity
                className="bg-surface p-2 rounded-lg"
                onPress={() => router.push('/edit-plan' as any)}
              >
                <AntDesign name="edit" size={20} color="white" />
              </TouchableOpacity>
            </View>
          </View>

          <View className="bg-surface rounded-xl p-4 mb-6">
            <View className="flex-row justify-between mb-4">
              <View>
                <Text className="text-text-light text-sm">Start Date</Text>
                <Text className="text-text font-bold">
                  {new Date(activePlan.start_date).toLocaleDateString()}
                </Text>
              </View>

              <View>
                <Text className="text-text-light text-sm">End Date</Text>
                <Text className="text-text font-bold">
                  {new Date(activePlan.end_date).toLocaleDateString()}
                </Text>
              </View>

              <View>
                <Text className="text-text-light text-sm">Days</Text>
                <Text className="text-text font-bold">
                  {activePlan.workout_days?.filter(d => !d.is_rest_day).length || 0}
                </Text>
              </View>
            </View>

            <View className="flex-row justify-between">
              <TouchableOpacity
                className="bg-blue-600 flex-1 mr-2 py-3 rounded-lg items-center"
                onPress={() => router.push('/edit-plan' as any)}
              >
                <Text className="text-text font-bold">Edit Plan</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="bg-red-500/20 flex-1 ml-2 py-3 rounded-lg items-center border border-red-500/30"
                onPress={() => deletePlan()}
              >
                <Text className="text-red-400 font-bold">Delete Plan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View className="px-4 mb-6">
          <Text className="text-text text-xl font-bold mb-4">Weekly Schedule</Text>

          {activePlan.workout_days && activePlan.workout_days.length > 0 ? (
            [...activePlan.workout_days]
              .sort((a, b) => a.day_of_week - b.day_of_week)
              .map((day, index) => renderWorkoutDay(day, index))
          ) : (
            <View className="bg-surface rounded-xl p-6 items-center">
              <MaterialIcons name="schedule" size={48} color="#6B7280" />
              <Text className="text-text text-lg font-bold mt-4 mb-2">
                No Workout Days
              </Text>
              <Text className="text-text-light text-center mb-4">
                Add workout days to your plan to get started
              </Text>
              <TouchableOpacity
                className="bg-blue-600 px-6 py-3 rounded-lg"
                onPress={() => router.push('/edit-plan' as any)}
              >
                <Text className="text-text font-bold">Add Workout Days</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View className="px-4 mb-8">
          <Text className="text-text text-xl font-bold mb-4">Plan Stats</Text>

          <View className="flex-row flex-wrap justify-between">
            <View className="bg-surface w-[48%] rounded-xl p-4 mb-4">
              <Feather name="check-circle" size={24} color="#10B981" />
              <Text className="text-text text-2xl font-bold mt-2">
                {activePlan.workout_days?.filter(d => !d.is_rest_day).length || 0}
              </Text>
              <Text className="text-text-light">Workout Days</Text>
            </View>

            <View className="bg-surface w-[48%] rounded-xl p-4 mb-4">
              <Feather name="moon" size={24} color="#8B5CF6" />
              <Text className="text-text text-2xl font-bold mt-2">
                {activePlan.workout_days?.filter(d => d.is_rest_day).length || 0}
              </Text>
              <Text className="text-text-light">Rest Days</Text>
            </View>

            <View className="bg-surface w-[48%] rounded-xl p-4">
              <Feather name="activity" size={24} color="#3B82F6" />
              <Text className="text-text text-2xl font-bold mt-2">
                {activePlan.workout_days?.reduce((total, day) =>
                  total + (day.planned_exercises?.length || 0), 0) || 0
                }
              </Text>
              <Text className="text-text-light">Total Exercises</Text>
            </View>

            <View className="bg-surface w-[48%] rounded-xl p-4">
              <Feather name="clock" size={24} color="#F59E0B" />
              <Text className="text-text text-2xl font-bold mt-2">
                {Math.ceil(
                  (new Date(activePlan.end_date).getTime() - new Date(activePlan.start_date).getTime()) /
                  (1000 * 60 * 60 * 24)
                )}
              </Text>
              <Text className="text-text-light">Plan Days</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={showDayModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDayModal(false)}
      >
        {selectedDay && (
          <WorkoutDayModal
            day={selectedDay}
            starting={starting}
            onClose={() => setShowDayModal(false)}
            onStartWorkout={() => {
              setShowDayModal(false);
              startWorkout(selectedDay);
            }}
          />
        )}
      </Modal>
    </SafeAreaView>
  );
}

interface WorkoutDayModalProps {
  day: WorkoutDay;
  starting: boolean;
  onClose: () => void;
  onStartWorkout: () => void;
}

function WorkoutDayModal({ day, starting, onClose, onStartWorkout }: WorkoutDayModalProps) {
  const { vars, mode } = useThemeStore();

  return (
    <View style={vars} key={mode} className="flex-1 bg-black/50 justify-end">
      <View className="bg-bg rounded-t-3xl p-6 max-h-3/4">
        <View className="flex-row justify-between items-center mb-6">
          <Text className="text-text text-2xl font-bold">
            {DAYS_OF_WEEK[day.day_of_week]}
          </Text>
          <TouchableOpacity onPress={onClose}>
            <AntDesign name="close" size={24} color="var(--text)" />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {day.is_rest_day ? (
            <View className="items-center py-8">
              <Feather name="moon" size={64} color="#8B5CF6" />
              <Text className="text-text text-xl font-bold mt-6 mb-3">
                Rest Day
              </Text>
              <Text className="text-text-light text-center">
                Take this day to recover and let your muscles repair. Rest is just as important as training!
              </Text>
            </View>
          ) : (
            <>
              <View className="mb-6">
                <Text className="text-text text-lg font-bold mb-4">
                  {day.name || 'Workout Day'}
                </Text>

                {day.planned_exercises && day.planned_exercises.length > 0 ? (
                  <>
                    <Text className="text-text-light mb-3">Exercises:</Text>
                    {day.planned_exercises.map((exercise, index) => (
                      <View key={exercise.id || index} className="bg-surface rounded-xl p-4 mb-3">
                        <View className="flex-row justify-between items-start mb-2">
                          <Text className="text-text font-bold text-lg flex-1">
                            {exercise.exercise_name}
                          </Text>
                          <View className="bg-blue-500/20 px-3 py-1 rounded">
                            <Text className="text-blue-400 font-bold">
                              {exercise.target_sets}×{exercise.target_reps}
                            </Text>
                          </View>
                        </View>

                        {exercise.target_weight && (
                          <Text className="text-text-light mb-2">
                            Weight: {exercise.target_weight}kg
                          </Text>
                        )}

                        {exercise.notes && (
                          <Text className="text-text-light text-sm">
                            Notes: {exercise.notes}
                          </Text>
                        )}
                      </View>
                    ))}
                  </>
                ) : (
                  <View className="bg-surface rounded-xl p-6 items-center">
                    <MaterialIcons name="fitness-center" size={48} color="#6B7280" />
                    <Text className="text-text text-lg font-bold mt-4 mb-2">
                      No Exercises
                    </Text>
                    <Text className="text-text-light text-center">
                      Add exercises to this workout day
                    </Text>
                  </View>
                )}
              </View>

              <TouchableOpacity
                className={`bg-blue-600 py-4 rounded-xl mb-3 ${starting ? 'opacity-50' : ''}`}
                disabled={starting}
                onPress={onStartWorkout}
              >
                <Text className="text-text text-center font-bold text-lg">
                  Start Workout
                </Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </View>
    </View>
  );
}