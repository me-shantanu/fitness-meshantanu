import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { workoutService } from '../../services/workoutService';
import { supabase } from '../../lib/supabase';
import AntDesign from '@expo/vector-icons/AntDesign';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Feather from '@expo/vector-icons/Feather';

export default function WorkoutsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  
  const [activePlan, setActivePlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreatePlan, setShowCreatePlan] = useState(false);
  const [showDayModal, setShowDayModal] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);

  useEffect(() => {
    loadActivePlan();
  }, []);

  const loadActivePlan = async () => {
    setLoading(true);
    try {
      const plan = await workoutService.getActiveWorkoutPlan(user.id);
      setActivePlan(plan);
    } catch (error) {
      console.error('Error loading active plan:', error);
    }
    setLoading(false);
  };

  const startWorkout = async (workoutDay) => {
    if (workoutDay.is_rest_day) {
      Alert.alert('Rest Day', 'Today is a rest day! Take it easy and recover.');
      return;
    }

    const session = await workoutService.startWorkoutSession(user.id, workoutDay.id);
    if (session) {
      router.push({
        pathname: '/workout-session',
        params: { sessionId: session.id }
      });
    }
  };

  const deletePlan = async () => {
    Alert.alert(
      'Delete Workout Plan',
      'Are you sure you want to delete this workout plan?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('workout_plans')
                .delete()
                .eq('id', activePlan.id);

              if (error) throw error;
              
              setActivePlan(null);
              Alert.alert('Success', 'Workout plan deleted successfully');
            } catch (error) {
              console.error('Error deleting plan:', error);
              Alert.alert('Error', 'Failed to delete workout plan');
            }
          }
        }
      ]
    );
  };

  const editWorkoutDay = (day) => {
    setSelectedDay(day);
    setShowDayModal(true);
  };

  const renderWorkoutDay = (day, index) => {
    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    
    return (
      <TouchableOpacity
        key={day.id}
        className={`mb-4 mx-4 rounded-xl p-4 ${
          day.is_rest_day ? 'bg-gray-800' : 'bg-gray-800 border border-blue-500/30'
        }`}
        onPress={() => editWorkoutDay(day)}
      >
        <View className="flex-row justify-between items-center mb-3">
          <View className="flex-row items-center">
            <View className={`w-10 h-10 rounded-lg justify-center items-center mr-3 ${
              day.is_rest_day ? 'bg-gray-700' : 'bg-blue-500/20'
            }`}>
              <Text className={`font-bold text-lg ${
                day.is_rest_day ? 'text-gray-400' : 'text-blue-400'
              }`}>
                {index + 1}
              </Text>
            </View>
            <View>
              <Text className="text-white font-bold text-lg">
                {daysOfWeek[day.day_of_week]}
              </Text>
              <Text className={`text-sm ${
                day.is_rest_day ? 'text-gray-400' : 'text-blue-400'
              }`}>
                {day.is_rest_day ? 'Rest Day' : day.name || 'Workout Day'}
              </Text>
            </View>
          </View>
          
          {!day.is_rest_day && (
            <TouchableOpacity
              className="bg-blue-600 px-4 py-2 rounded-lg"
              onPress={(e) => {
                e.stopPropagation();
                startWorkout(day);
              }}
            >
              <Text className="text-white font-bold">Start</Text>
            </TouchableOpacity>
          )}
        </View>

        {!day.is_rest_day && day.planned_exercises && day.planned_exercises.length > 0 && (
          <View className="mt-3">
            <Text className="text-gray-400 text-sm mb-2">Exercises:</Text>
            {day.planned_exercises.slice(0, 3).map((exercise, exIndex) => (
              <View key={exIndex} className="flex-row items-center mb-1">
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
      <SafeAreaView className="flex-1 bg-gray-900">
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      </SafeAreaView>
    );
  }

  if (!activePlan) {
    return (
      <SafeAreaView className="flex-1 bg-gray-900">
        <ScrollView className="flex-1">
          <View className="px-4 pt-4">
            <Text className="text-white text-3xl font-bold mb-2">Workout Plans</Text>
            <Text className="text-gray-400 mb-8">Create and manage your workout routines</Text>
          </View>

          {/* Empty State */}
          <View className="flex-1 justify-center items-center px-4 mt-20">
            <View className="bg-gray-800 rounded-2xl p-8 items-center">
              <MaterialIcons name="fitness-center" size={64} color="#6B7280" />
              <Text className="text-white text-xl font-bold mt-6 mb-3">
                No Active Workout Plan
              </Text>
              <Text className="text-gray-400 text-center mb-8">
                Create a workout plan to start tracking your progress and achieving your fitness goals.
              </Text>
              
              <TouchableOpacity
                className="bg-blue-600 py-4 rounded-xl w-full items-center"
                onPress={() => router.push('/create-plan')}
              >
                <Text className="text-white font-bold text-lg">Create Workout Plan</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                className="mt-4 py-4 rounded-xl w-full items-center border border-gray-700"
                onPress={() => router.push('/browse-templates')}
              >
                <Text className="text-gray-300">Browse Templates</Text>
              </TouchableOpacity>
            </View>

            {/* Quick Stats */}
            <View className="mt-8 w-full">
              <Text className="text-white text-lg font-bold mb-4">Why Create a Plan?</Text>
              
              <View className="flex-row justify-between">
                <View className="bg-gray-800 p-4 rounded-xl flex-1 mr-2">
                  <Feather name="target" size={24} color="#10B981" />
                  <Text className="text-white font-bold mt-2">Stay Consistent</Text>
                  <Text className="text-gray-400 text-xs mt-1">
                    Follow a structured routine
                  </Text>
                </View>
                
                <View className="bg-gray-800 p-4 rounded-xl flex-1 mx-2">
                  <Feather name="trending-up" size={24} color="#3B82F6" />
                  <Text className="text-white font-bold mt-2">Track Progress</Text>
                  <Text className="text-gray-400 text-xs mt-1">
                    Monitor improvements over time
                  </Text>
                </View>
                
                <View className="bg-gray-800 p-4 rounded-xl flex-1 ml-2">
                  <Feather name="award" size={24} color="#F59E0B" />
                  <Text className="text-white font-bold mt-2">Achieve Goals</Text>
                  <Text className="text-gray-400 text-xs mt-1">
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
    <SafeAreaView className="flex-1 bg-gray-900">
      <ScrollView className="flex-1">
        {/* Header */}
        <View className="px-4 pt-4">
          <View className="flex-row justify-between items-center mb-4">
            <View>
              <Text className="text-white text-3xl font-bold">Workout Plan</Text>
              <Text className="text-gray-400">{activePlan.name}</Text>
            </View>
            
            <TouchableOpacity
              className="bg-gray-800 p-2 rounded-lg"
              onPress={() => router.push('/create-plan')}
            >
              <AntDesign name="edit" size={20} color="white" />
            </TouchableOpacity>
          </View>

          {/* Plan Details */}
          <View className="bg-gray-800 rounded-xl p-4 mb-6">
            <View className="flex-row justify-between mb-4">
              <View>
                <Text className="text-gray-400 text-sm">Start Date</Text>
                <Text className="text-white font-bold">
                  {new Date(activePlan.start_date).toLocaleDateString()}
                </Text>
              </View>
              
              <View>
                <Text className="text-gray-400 text-sm">End Date</Text>
                <Text className="text-white font-bold">
                  {new Date(activePlan.end_date).toLocaleDateString()}
                </Text>
              </View>
              
              <View>
                <Text className="text-gray-400 text-sm">Days</Text>
                <Text className="text-white font-bold">
                  {activePlan.workout_days?.filter(d => !d.is_rest_day).length || 0}
                </Text>
              </View>
            </View>
            
            <View className="flex-row justify-between">
              <TouchableOpacity
                className="bg-blue-600 flex-1 mr-2 py-3 rounded-lg items-center"
                onPress={() => router.push('/edit-plan')}
              >
                <Text className="text-white font-bold">Edit Plan</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                className="bg-red-500/20 flex-1 ml-2 py-3 rounded-lg items-center border border-red-500/30"
                onPress={deletePlan}
              >
                <Text className="text-red-400 font-bold">Delete Plan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Weekly Schedule */}
        <View className="px-4 mb-6">
          <Text className="text-white text-xl font-bold mb-4">Weekly Schedule</Text>
          
          {activePlan.workout_days && activePlan.workout_days.length > 0 ? (
            activePlan.workout_days
              .sort((a, b) => a.day_of_week - b.day_of_week)
              .map((day, index) => renderWorkoutDay(day, index))
          ) : (
            <View className="bg-gray-800 rounded-xl p-6 items-center">
              <MaterialIcons name="schedule" size={48} color="#6B7280" />
              <Text className="text-white text-lg font-bold mt-4 mb-2">
                No Workout Days
              </Text>
              <Text className="text-gray-400 text-center mb-4">
                Add workout days to your plan to get started
              </Text>
              <TouchableOpacity
                className="bg-blue-600 px-6 py-3 rounded-lg"
                onPress={() => router.push('/edit-plan')}
              >
                <Text className="text-white font-bold">Add Workout Days</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Stats */}
        <View className="px-4 mb-8">
          <Text className="text-white text-xl font-bold mb-4">Plan Stats</Text>
          
          <View className="flex-row flex-wrap justify-between">
            <View className="bg-gray-800 w-[48%] rounded-xl p-4 mb-4">
              <Feather name="check-circle" size={24} color="#10B981" />
              <Text className="text-white text-2xl font-bold mt-2">
                {activePlan.workout_days?.filter(d => !d.is_rest_day).length || 0}
              </Text>
              <Text className="text-gray-400">Workout Days</Text>
            </View>
            
            <View className="bg-gray-800 w-[48%] rounded-xl p-4 mb-4">
              <Feather name="moon" size={24} color="#8B5CF6" />
              <Text className="text-white text-2xl font-bold mt-2">
                {activePlan.workout_days?.filter(d => d.is_rest_day).length || 0}
              </Text>
              <Text className="text-gray-400">Rest Days</Text>
            </View>
            
            <View className="bg-gray-800 w-[48%] rounded-xl p-4">
              <Feather name="activity" size={24} color="#3B82F6" />
              <Text className="text-white text-2xl font-bold mt-2">
                {activePlan.workout_days?.reduce((total, day) => 
                  total + (day.planned_exercises?.length || 0), 0) || 0
                }
              </Text>
              <Text className="text-gray-400">Total Exercises</Text>
            </View>
            
            <View className="bg-gray-800 w-[48%] rounded-xl p-4">
              <Feather name="clock" size={24} color="#F59E0B" />
              <Text className="text-white text-2xl font-bold mt-2">
                {Math.ceil(
                  (new Date(activePlan.end_date) - new Date(activePlan.start_date)) / 
                  (1000 * 60 * 60 * 24)
                )}
              </Text>
              <Text className="text-gray-400">Plan Days</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Workout Day Modal */}
      <Modal
        visible={showDayModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDayModal(false)}
      >
        {selectedDay && <WorkoutDayModal 
          day={selectedDay}
          onClose={() => setShowDayModal(false)}
          onStartWorkout={() => {
            setShowDayModal(false);
            startWorkout(selectedDay);
          }}
        />}
      </Modal>
    </SafeAreaView>
  );
}

// Workout Day Modal Component
function WorkoutDayModal({ day, onClose, onStartWorkout }) {
  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  
  return (
    <View className="flex-1 bg-black/50 justify-end">
      <View className="bg-gray-900 rounded-t-3xl p-6 max-h-3/4">
        <View className="flex-row justify-between items-center mb-6">
          <Text className="text-white text-2xl font-bold">
            {daysOfWeek[day.day_of_week]}
          </Text>
          <TouchableOpacity onPress={onClose}>
            <AntDesign name="close" size={24} color="white" />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {day.is_rest_day ? (
            <View className="items-center py-8">
              <Feather name="moon" size={64} color="#8B5CF6" />
              <Text className="text-white text-xl font-bold mt-6 mb-3">
                Rest Day
              </Text>
              <Text className="text-gray-400 text-center">
                Take this day to recover and let your muscles repair. Rest is just as important as training!
              </Text>
            </View>
          ) : (
            <>
              <View className="mb-6">
                <Text className="text-white text-lg font-bold mb-4">
                  {day.name || 'Workout Day'}
                </Text>
                
                {day.planned_exercises && day.planned_exercises.length > 0 ? (
                  <>
                    <Text className="text-gray-400 mb-3">Exercises:</Text>
                    {day.planned_exercises.map((exercise, index) => (
                      <View key={index} className="bg-gray-800 rounded-xl p-4 mb-3">
                        <View className="flex-row justify-between items-start mb-2">
                          <Text className="text-white font-bold text-lg flex-1">
                            {exercise.exercise_name}
                          </Text>
                          <View className="bg-blue-500/20 px-3 py-1 rounded">
                            <Text className="text-blue-400 font-bold">
                              {exercise.target_sets}×{exercise.target_reps}
                            </Text>
                          </View>
                        </View>
                        
                        {exercise.target_weight && (
                          <Text className="text-gray-400 mb-2">
                            Weight: {exercise.target_weight}kg
                          </Text>
                        )}
                        
                        {exercise.notes && (
                          <Text className="text-gray-400 text-sm">
                            Notes: {exercise.notes}
                          </Text>
                        )}
                      </View>
                    ))}
                  </>
                ) : (
                  <View className="bg-gray-800 rounded-xl p-6 items-center">
                    <MaterialIcons name="fitness-center" size={48} color="#6B7280" />
                    <Text className="text-white text-lg font-bold mt-4 mb-2">
                      No Exercises
                    </Text>
                    <Text className="text-gray-400 text-center">
                      Add exercises to this workout day
                    </Text>
                  </View>
                )}
              </View>

              <TouchableOpacity
                className="bg-blue-600 py-4 rounded-xl mb-3"
                onPress={onStartWorkout}
              >
                <Text className="text-white text-center font-bold text-lg">
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