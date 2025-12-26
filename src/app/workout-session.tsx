import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { workoutService } from '../services/workoutService';
import { nutritionService } from '../services/nutritionService';
import { useAuthStore } from '../store/authStore';
import AntDesign from '@expo/vector-icons/AntDesign';

export default function WorkoutSessionScreen() {
  const router = useRouter();
  const { sessionId } = useLocalSearchParams();
  const { user } = useAuthStore();
  
  const [session, setSession] = useState(null);
  const [currentExercise, setCurrentExercise] = useState(0);
  const [currentSet, setCurrentSet] = useState(1);
  const [sets, setSets] = useState([]);
  const [workoutStart] = useState(new Date());
  const [workoutDuration, setWorkoutDuration] = useState(0);
  const [caloriesBurned, setCaloriesBurned] = useState(0);

  // Timer
  useEffect(() => {
    const interval = setInterval(() => {
      setWorkoutDuration(prev => {
        const newDuration = prev + 1;
        // Update calories burned every minute
        if (newDuration % 60 === 0) {
          const newCalories = nutritionService.calculateWorkoutCalories(
            user.weight || 70,
            newDuration / 60,
            'moderate'
          );
          setCaloriesBurned(newCalories);
        }
        return newDuration;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const logSet = async (reps, weight) => {
    const currentEx = session.workout_days.planned_exercises[currentExercise];
    
    const setData = {
      sessionId,
      plannedExerciseId: currentEx.id,
      exerciseName: currentEx.exercise_name,
      exerciseId: currentEx.exercise_id,
      setNumber: currentSet,
      reps,
      weight,
      userId: user.id
    };

    const savedSet = await workoutService.logExerciseSet(setData);
    if (savedSet) {
      setSets([...sets, savedSet]);
      setCurrentSet(currentSet + 1);
    }
  };

  const completeWorkout = async () => {
    Alert.alert(
      'Complete Workout',
      `Calories burned: ${caloriesBurned}\nDuration: ${formatTime(workoutDuration)}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          onPress: async () => {
            const completed = await workoutService.completeWorkoutSession(sessionId, caloriesBurned);
            if (completed) {
              router.push({
                pathname: '/workout-complete',
                params: {
                  calories: caloriesBurned,
                  duration: workoutDuration,
                  sessionId
                }
              });
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-bg">
      {/* Header */}
      <View className="px-4 py-4 flex-row justify-between items-center">
        <TouchableOpacity onPress={() => router.back()}>
          <AntDesign name="close" size={24} color="white" />
        </TouchableOpacity>
        
        <View className="items-center">
          <Text className="text-text text-lg font-bold">{formatTime(workoutDuration)}</Text>
          <Text className="text-text-light text-sm">{caloriesBurned} cal</Text>
        </View>
        
        <TouchableOpacity onPress={completeWorkout}>
          <Text className="text-blue-400 font-bold">Finish</Text>
        </TouchableOpacity>
      </View>

      {/* Current Exercise */}
      <View className="px-4 mb-6">
        {session?.workout_days?.planned_exercises[currentExercise] && (
          <View className="bg-surface rounded-xl p-6">
            <Text className="text-text-light text-sm">Current Exercise</Text>
            <Text className="text-text text-2xl font-bold mb-2">
              {session.workout_days.planned_exercises[currentExercise].exercise_name}
            </Text>
            <View className="flex-row justify-between mt-4">
              <View className="items-center">
                <Text className="text-text-light">Sets</Text>
                <Text className="text-text text-xl font-bold">
                  {session.workout_days.planned_exercises[currentExercise].target_sets}
                </Text>
              </View>
              <View className="items-center">
                <Text className="text-text-light">Reps</Text>
                <Text className="text-text text-xl font-bold">
                  {session.workout_days.planned_exercises[currentExercise].target_reps}
                </Text>
              </View>
              <View className="items-center">
                <Text className="text-text-light">Weight</Text>
                <Text className="text-text text-xl font-bold">
                  {session.workout_days.planned_exercises[currentExercise].target_weight || '--'}
                </Text>
              </View>
            </View>
          </View>
        )}
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
                keyboardType="numeric"
              />
            </View>
            <View className="flex-1 ml-2">
              <Text className="text-text-light mb-2">Reps</Text>
              <TextInput
                className="bg-gray-700 text-text text-center py-3 rounded-lg text-xl"
                placeholder="0"
                keyboardType="numeric"
              />
            </View>
          </View>
          
          <TouchableOpacity 
            className="bg-blue-600 py-4 rounded-lg mb-3"
            onPress={() => logSet(10, 50)}
          >
            <Text className="text-text text-center font-bold text-lg">Log Set</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            className="bg-green-600 py-4 rounded-lg"
            onPress={() => setCurrentSet(prev => prev + 1)}
          >
            <Text className="text-text text-center font-bold text-lg">Skip Set</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Previous Sets */}
      {sets.length > 0 && (
        <View className="px-4 mb-6">
          <Text className="text-text text-xl font-bold mb-4">Previous Sets</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {sets.map((set, index) => (
              <View key={index} className="bg-surface rounded-lg p-4 mr-3">
                <Text className="text-text font-bold">Set {set.set_number}</Text>
                <Text className="text-blue-400 text-lg">
                  {set.weight}kg × {set.reps}
                </Text>
                {set.is_pr && (
                  <Text className="text-yellow-400 text-sm mt-1">🏆 PR!</Text>
                )}
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Navigation */}
      <View className="px-4 pb-4">
        <View className="flex-row justify-between">
          <TouchableOpacity 
            className="bg-surface py-3 px-6 rounded-lg"
            onPress={() => setCurrentExercise(prev => Math.max(0, prev - 1))}
            disabled={currentExercise === 0}
          >
            <Text className="text-text">Previous</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            className="bg-blue-600 py-3 px-6 rounded-lg"
            onPress={() => setCurrentExercise(prev => {
              const next = prev + 1;
              if (next >= session.workout_days.planned_exercises.length) {
                completeWorkout();
                return prev;
              }
              setCurrentSet(1);
              return next;
            })}
          >
            <Text className="text-text">Next Exercise</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}