import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { workoutService } from '../services/workoutService';
import { exerciseService } from '../services/exerciseService';
import AntDesign from '@expo/vector-icons/AntDesign';
import Feather from '@expo/vector-icons/Feather';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

export default function CreatePlanScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  // Plan details
  const [planName, setPlanName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [daysPerWeek, setDaysPerWeek] = useState(3);
  
  // Workout days
  const [workoutDays, setWorkoutDays] = useState([
    { dayOfWeek: 0, name: 'Chest & Triceps', isRestDay: false, exercises: [] },
    { dayOfWeek: 1, name: 'Back & Biceps', isRestDay: false, exercises: [] },
    { dayOfWeek: 2, name: 'Legs & Shoulders', isRestDay: false, exercises: [] },
    { dayOfWeek: 3, name: '', isRestDay: true, exercises: [] },
    { dayOfWeek: 4, name: 'Chest & Triceps', isRestDay: false, exercises: [] },
    { dayOfWeek: 5, name: 'Back & Biceps', isRestDay: false, exercises: [] },
    { dayOfWeek: 6, name: '', isRestDay: true, exercises: [] },
  ]);
  
  // For adding exercises
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [selectedDayIndex, setSelectedDayIndex] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    // Set default dates
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    
    setStartDate(today.toISOString().split('T')[0]);
    setEndDate(nextWeek.toISOString().split('T')[0]);
  }, []);

  const handleSearch = async (query) => {
    setSearchQuery(query);
    
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    
    setSearching(true);
    try {
      const results = await exerciseService.searchExercises(query);
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching exercises:', error);
    }
    setSearching(false);
  };

  const addExerciseToDay = (exercise) => {
    if (selectedDayIndex === null) return;
    
    const updatedDays = [...workoutDays];
    updatedDays[selectedDayIndex].exercises.push({
      id: exercise.id,
      name: exercise.name,
      sets: 3,
      reps: 10,
      weight: null,
      type: 'strength'
    });
    
    setWorkoutDays(updatedDays);
    setShowAddExercise(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  const removeExercise = (dayIndex, exerciseIndex) => {
    const updatedDays = [...workoutDays];
    updatedDays[dayIndex].exercises.splice(exerciseIndex, 1);
    setWorkoutDays(updatedDays);
  };

  const updateExercise = (dayIndex, exerciseIndex, field, value) => {
    const updatedDays = [...workoutDays];
    updatedDays[dayIndex].exercises[exerciseIndex][field] = value;
    setWorkoutDays(updatedDays);
  };

  const toggleRestDay = (index) => {
    const updatedDays = [...workoutDays];
    updatedDays[index].isRestDay = !updatedDays[index].isRestDay;
    
    if (updatedDays[index].isRestDay) {
      updatedDays[index].exercises = [];
    }
    
    setWorkoutDays(updatedDays);
  };

  const createPlan = async () => {
    if (!planName.trim()) {
      Alert.alert('Error', 'Please enter a plan name');
      return;
    }

    if (!startDate || !endDate) {
      Alert.alert('Error', 'Please select start and end dates');
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      Alert.alert('Error', 'Start date must be before end date');
      return;
    }

    const workoutDaysCount = workoutDays.filter(d => !d.isRestDay).length;
    if (workoutDaysCount === 0) {
      Alert.alert('Error', 'Please add at least one workout day');
      return;
    }

    setLoading(true);
    
    const planData = {
      name: planName,
      startDate,
      endDate,
      daysPerWeek: workoutDays.filter(d => !d.isRestDay).length
    };

    try {
      const result = await workoutService.createWeeklyPlan(
        user.id,
        planData,
        workoutDays
      );

      if (result.success) {
        Alert.alert(
          'Success',
          'Workout plan created successfully!',
          [{ text: 'OK', onPress: () => router.replace('/(tabs)/workouts') }]
        );
      } else {
        Alert.alert('Error', result.error?.message || 'Failed to create plan');
      }
    } catch (error) {
      console.error('Error creating plan:', error);
      Alert.alert('Error', 'Failed to create workout plan');
    }
    
    setLoading(false);
  };

  const renderStep1 = () => (
    <View>
      <Text className="text-white text-2xl font-bold mb-6">Plan Details</Text>
      
      <View className="space-y-4">
        <View>
          <Text className="text-gray-400 mb-2">Plan Name</Text>
          <TextInput
            className="bg-gray-800 text-white rounded-xl p-4"
            placeholder="e.g., Beginner Strength Program"
            placeholderTextColor="#6B7280"
            value={planName}
            onChangeText={setPlanName}
          />
        </View>
        
        <View className="flex-row justify-between">
          <View className="flex-1 mr-2">
            <Text className="text-gray-400 mb-2">Start Date</Text>
            <TextInput
              className="bg-gray-800 text-white rounded-xl p-4"
              value={startDate}
              onChangeText={setStartDate}
              placeholder="YYYY-MM-DD"
            />
          </View>
          
          <View className="flex-1 ml-2">
            <Text className="text-gray-400 mb-2">End Date</Text>
            <TextInput
              className="bg-gray-800 text-white rounded-xl p-4"
              value={endDate}
              onChangeText={setEndDate}
              placeholder="YYYY-MM-DD"
            />
          </View>
        </View>
        
        <View>
          <Text className="text-gray-400 mb-2">Days Per Week</Text>
          <View className="flex-row">
            {[2, 3, 4, 5, 6].map((days) => (
              <TouchableOpacity
                key={days}
                className={`flex-1 mx-1 py-3 rounded-lg ${
                  daysPerWeek === days ? 'bg-blue-600' : 'bg-gray-800'
                }`}
                onPress={() => setDaysPerWeek(days)}
              >
                <Text className={`text-center font-bold ${
                  daysPerWeek === days ? 'text-white' : 'text-gray-400'
                }`}>
                  {days} days
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
      
      <TouchableOpacity
        className="bg-blue-600 py-4 rounded-xl mt-8"
        onPress={() => setStep(2)}
        disabled={!planName.trim()}
      >
        <Text className="text-white text-center font-bold text-lg">
          Next: Add Workout Days
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderStep2 = () => (
    <View>
      <Text className="text-white text-2xl font-bold mb-6">Weekly Schedule</Text>
      
      <ScrollView className="max-h-96">
        {workoutDays.map((day, index) => (
          <View key={index} className="mb-4 bg-gray-800 rounded-xl p-4">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-white font-bold text-lg">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][day.dayOfWeek]}
              </Text>
              
              <TouchableOpacity
                className={`px-4 py-2 rounded ${
                  day.isRestDay ? 'bg-purple-600' : 'bg-blue-600'
                }`}
                onPress={() => toggleRestDay(index)}
              >
                <Text className="text-white font-bold">
                  {day.isRestDay ? 'Rest Day' : 'Workout Day'}
                </Text>
              </TouchableOpacity>
            </View>
            
            {!day.isRestDay && (
              <>
                <TextInput
                  className="bg-gray-700 text-white rounded-lg p-3 mb-4"
                  placeholder="Workout name (e.g., Chest Day)"
                  placeholderTextColor="#6B7280"
                  value={day.name}
                  onChangeText={(text) => {
                    const updatedDays = [...workoutDays];
                    updatedDays[index].name = text;
                    setWorkoutDays(updatedDays);
                  }}
                />
                
                <TouchableOpacity
                  className="flex-row items-center justify-center bg-gray-700 py-3 rounded-lg mb-4"
                  onPress={() => {
                    setSelectedDayIndex(index);
                    setShowAddExercise(true);
                  }}
                >
                  <AntDesign name="plus" size={20} color="#3B82F6" />
                  <Text className="text-blue-400 font-bold ml-2">Add Exercise</Text>
                </TouchableOpacity>
                
                {day.exercises.length > 0 && (
                  <View>
                    <Text className="text-gray-400 mb-2">Exercises:</Text>
                    {day.exercises.map((exercise, exIndex) => (
                      <View key={exIndex} className="bg-gray-700 rounded-lg p-3 mb-2">
                        <View className="flex-row justify-between items-center mb-2">
                          <Text className="text-white font-bold flex-1">
                            {exercise.name}
                          </Text>
                          <TouchableOpacity
                            onPress={() => removeExercise(index, exIndex)}
                          >
                            <AntDesign name="close" size={20} color="#EF4444" />
                          </TouchableOpacity>
                        </View>
                        
                        <View className="flex-row justify-between">
                          <View className="flex-1 mr-2">
                            <Text className="text-gray-400 text-xs mb-1">Sets</Text>
                            <TextInput
                              className="bg-gray-800 text-white rounded p-2 text-center"
                              value={exercise.sets.toString()}
                              onChangeText={(text) => updateExercise(index, exIndex, 'sets', parseInt(text) || 0)}
                              keyboardType="numeric"
                            />
                          </View>
                          
                          <View className="flex-1 mx-2">
                            <Text className="text-gray-400 text-xs mb-1">Reps</Text>
                            <TextInput
                              className="bg-gray-800 text-white rounded p-2 text-center"
                              value={exercise.reps.toString()}
                              onChangeText={(text) => updateExercise(index, exIndex, 'reps', parseInt(text) || 0)}
                              keyboardType="numeric"
                            />
                          </View>
                          
                          <View className="flex-1 ml-2">
                            <Text className="text-gray-400 text-xs mb-1">Weight (kg)</Text>
                            <TextInput
                              className="bg-gray-800 text-white rounded p-2 text-center"
                              placeholder="Optional"
                              placeholderTextColor="#6B7280"
                              value={exercise.weight ? exercise.weight.toString() : ''}
                              onChangeText={(text) => updateExercise(index, exIndex, 'weight', text ? parseFloat(text) : null)}
                              keyboardType="numeric"
                            />
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}
          </View>
        ))}
      </ScrollView>
      
      <View className="flex-row justify-between mt-8">
        <TouchableOpacity
          className="bg-gray-800 flex-1 mr-2 py-4 rounded-xl"
          onPress={() => setStep(1)}
        >
          <Text className="text-white text-center font-bold">Back</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          className="bg-blue-600 flex-1 ml-2 py-4 rounded-xl"
          onPress={createPlan}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white text-center font-bold text-lg">
              Create Plan
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderAddExerciseModal = () => (
    <View className="absolute inset-0 bg-black/50 justify-end">
      <View className="bg-gray-900 rounded-t-3xl p-6 h-3/4">
        <View className="flex-row justify-between items-center mb-6">
          <Text className="text-white text-2xl font-bold">Add Exercise</Text>
          <TouchableOpacity onPress={() => setShowAddExercise(false)}>
            <AntDesign name="close" size={24} color="white" />
          </TouchableOpacity>
        </View>
        
        <TextInput
          className="bg-gray-800 text-white rounded-xl p-4 mb-4"
          placeholder="Search exercises..."
          placeholderTextColor="#6B7280"
          value={searchQuery}
          onChangeText={handleSearch}
          autoFocus
        />
        
        {searching ? (
          <ActivityIndicator size="large" color="#3B82F6" />
        ) : (
          <ScrollView className="flex-1">
            {searchResults.map((exercise, index) => (
              <TouchableOpacity
                key={index}
                className="bg-gray-800 rounded-xl p-4 mb-3"
                onPress={() => addExerciseToDay(exercise)}
              >
                <Text className="text-white font-bold text-lg mb-1">
                  {exercise.name}
                </Text>
                {exercise.category && (
                  <Text className="text-gray-400 text-sm">{exercise.category}</Text>
                )}
              </TouchableOpacity>
            ))}
            
            {searchQuery && searchResults.length === 0 && !searching && (
              <View className="items-center py-8">
                <Feather name="search" size={48} color="#6B7280" />
                <Text className="text-gray-400 mt-4">
                  No exercises found for "{searchQuery}"
                </Text>
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-900">
      <ScrollView className="flex-1 p-4">
        <View className="flex-row items-center mb-6">
          <TouchableOpacity onPress={() => router.back()}>
            <AntDesign name="arrowleft" size={24} color="white" />
          </TouchableOpacity>
          <Text className="text-white text-2xl font-bold ml-4">Create Workout Plan</Text>
        </View>
        
        {/* Progress Steps */}
        <View className="flex-row justify-between mb-8">
          {[1, 2].map((stepNum) => (
            <View key={stepNum} className="flex-1 items-center">
              <View className={`w-8 h-8 rounded-full justify-center items-center mb-2 ${
                step >= stepNum ? 'bg-blue-600' : 'bg-gray-800'
              }`}>
                <Text className={`font-bold ${
                  step >= stepNum ? 'text-white' : 'text-gray-400'
                }`}>
                  {stepNum}
                </Text>
              </View>
              <Text className={`text-sm ${
                step >= stepNum ? 'text-blue-400' : 'text-gray-500'
              }`}>
                {stepNum === 1 ? 'Details' : 'Schedule'}
              </Text>
            </View>
          ))}
        </View>
        
        {step === 1 ? renderStep1() : renderStep2()}
      </ScrollView>
      
      {showAddExercise && renderAddExerciseModal()}
    </SafeAreaView>
  );
}