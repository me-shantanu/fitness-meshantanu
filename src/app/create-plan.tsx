// app/create-plan.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { workoutService } from '../services/workoutService';
import { exerciseService } from '../services/exerciseService';
import AntDesign from '@expo/vector-icons/AntDesign';
import Feather from '@expo/vector-icons/Feather';
import { useThemeStore } from '@/store/useThemeStore';
import { WorkoutDayForm, ExerciseForm, Exercise } from '@/types/workout';
import { showAlert } from '@/utils/alert';

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const isValidDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));

export default function CreatePlanScreen() {
  const router = useRouter();
  const { vars, mode, colors } = useThemeStore();
  const { user } = useAuthStore();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Plan details
  const [planName, setPlanName] = useState('');
  const [planDescription, setPlanDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isTemplate, setIsTemplate] = useState(false);

  // Workout days
  const [workoutDays, setWorkoutDays] = useState<WorkoutDayForm[]>([
    { dayOfWeek: 0, name: 'Chest & Triceps', isRestDay: false, exercises: [] },
    { dayOfWeek: 1, name: 'Back & Biceps', isRestDay: false, exercises: [] },
    { dayOfWeek: 2, name: 'Legs', isRestDay: false, exercises: [] },
    { dayOfWeek: 3, name: '', isRestDay: true, exercises: [] },
    { dayOfWeek: 4, name: 'Shoulders & Arms', isRestDay: false, exercises: [] },
    { dayOfWeek: 5, name: '', isRestDay: true, exercises: [] },
    { dayOfWeek: 6, name: '', isRestDay: true, exercises: [] },
  ]);

  // For adding exercises
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Exercise[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    setStartDate(today.toISOString().split('T')[0]);
    setEndDate(nextWeek.toISOString().split('T')[0]);
  }, []);

  // Debounced server-side search with a request-sequence guard so stale
  // responses never overwrite newer ones.
  const searchSeqRef = useRef(0);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  const handleSearch = (query: string) => {
    setSearchQuery(query);

    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    const seq = ++searchSeqRef.current;

    if (query.trim().length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const results: any = await exerciseService.searchExercisesServer(query);
        if (seq !== searchSeqRef.current) return;
        setSearchResults(results);
      } catch (error) {
        if (seq !== searchSeqRef.current) return;
        console.error('Error searching exercises:', error);
        setSearchResults([]);
      } finally {
        if (seq === searchSeqRef.current) setSearching(false);
      }
    }, 400);
  };

  const addExerciseToDay = (exercise: Exercise) => {
    if (selectedDayIndex === null) return;

    const updatedDays = [...workoutDays];
    const newExercise: ExerciseForm = {
      id: exercise.id,
      name: exercise.name,
      sets: 3,
      reps: 10,
      weight: null,
      type: 'strength',
      notes: ''
    };

    updatedDays[selectedDayIndex].exercises.push(newExercise);
    setWorkoutDays(updatedDays);
    setShowAddExercise(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  const removeExercise = (dayIndex: number, exerciseIndex: number) => {
    const updatedDays = [...workoutDays];
    updatedDays[dayIndex].exercises.splice(exerciseIndex, 1);
    setWorkoutDays(updatedDays);
  };

  const updateExercise = (
    dayIndex: number,
    exerciseIndex: number,
    field: keyof ExerciseForm,
    value: any
  ) => {
    const updatedDays:any = [...workoutDays];
    updatedDays[dayIndex].exercises[exerciseIndex][field] = value;
    setWorkoutDays(updatedDays);
  };

  const toggleRestDay = (index: number) => {
    const updatedDays = [...workoutDays];
    updatedDays[index].isRestDay = !updatedDays[index].isRestDay;

    if (updatedDays[index].isRestDay) {
      updatedDays[index].exercises = [];
      updatedDays[index].name = '';
    }

    setWorkoutDays(updatedDays);
  };

  const createPlan = async () => {
    if (!user?.id) return;

    if (!planName.trim()) {
      showAlert('Error', 'Please enter a plan name');
      return;
    }

    if (!isTemplate && (!startDate || !endDate)) {
      showAlert('Error', 'Please select start and end dates');
      return;
    }

    if (!isTemplate && (!isValidDate(startDate) || !isValidDate(endDate))) {
      showAlert('Error', 'Please enter valid dates in YYYY-MM-DD format');
      return;
    }

    if (!isTemplate && new Date(startDate) > new Date(endDate)) {
      showAlert('Error', 'Start date must be on or before the end date');
      return;
    }

    const workoutDaysCount = workoutDays.filter(d => !d.isRestDay).length;
    if (workoutDaysCount === 0) {
      showAlert('Error', 'Please add at least one workout day');
      return;
    }

    setLoading(true);

    const planData = {
      name: planName,
      description: planDescription,
      startDate: isTemplate ? new Date().toISOString().split('T')[0] : startDate,
      endDate: isTemplate ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : endDate,
      isTemplate
    };

    try {
      const result = await workoutService.createWeeklyPlan(
        user.id,
        planData,
        workoutDays
      );

      if (result.success) {
        showAlert(
          'Success',
          `${isTemplate ? 'Template' : 'Workout plan'} created successfully!`,
          [{
            text: 'OK',
            onPress: () => router.replace(isTemplate ? '/browse-templates' : '/(tabs)/workout' as any)
          }]
        );
      } else {
        showAlert('Error', result.error?.message || 'Failed to create plan');
      }
    } catch (error) {
      console.error('Error creating plan:', error);
      showAlert('Error', 'Failed to create workout plan');
    }

    setLoading(false);
  };

  const renderStep1 = () => (
    <View>
      <Text className="text-text text-2xl font-bold mb-6">Plan Details</Text>

      <View className="space-y-4">
        <View>
          <Text className="text-text-light mb-2">Plan Name</Text>
          <TextInput
            className="bg-surface-2 border border-border text-text rounded-xl p-4"
            placeholder="e.g., Beginner Strength Program"
            placeholderTextColor={colors.textLight}
            value={planName}
            onChangeText={setPlanName}
          />
        </View>

        <View>
          <Text className="text-text-light mb-2">Description (Optional)</Text>
          <TextInput
            className="bg-surface-2 border border-border text-text rounded-xl p-4"
            placeholder="Brief description of your plan"
            placeholderTextColor={colors.textLight}
            value={planDescription}
            onChangeText={setPlanDescription}
            multiline
            numberOfLines={3}
          />
        </View>

        <View>
          <TouchableOpacity
            className="flex-row items-center mb-4"
            onPress={() => setIsTemplate(!isTemplate)}
          >
            <View className={`w-5 h-5 rounded border-2 ${isTemplate ? 'bg-primary border-primary' : 'border-border'
              } mr-3 items-center justify-center`}>
              {isTemplate && <Feather name="check" size={14} color={colors.onBrand} />}
            </View>
            <Text className="text-text">Save as template</Text>
          </TouchableOpacity>
        </View>

        {!isTemplate && (
          <View className="flex-row justify-between">
            <View className="flex-1 mr-2">
              <Text className="text-text-light mb-2">Start Date</Text>
              <TextInput
                className="bg-surface-2 border border-border text-text rounded-xl p-4"
                value={startDate}
                onChangeText={setStartDate}
                placeholder="YYYY-MM-DD"
              />
            </View>

            <View className="flex-1 ml-2">
              <Text className="text-text-light mb-2">End Date</Text>
              <TextInput
                className="bg-surface-2 border border-border text-text rounded-xl p-4"
                value={endDate}
                onChangeText={setEndDate}
                placeholder="YYYY-MM-DD"
              />
            </View>
          </View>
        )}
      </View>

      <TouchableOpacity
        className={`py-4 rounded-xl mt-8 ${planName.trim() ? 'bg-primary' : 'bg-primary/40'
          }`}
        onPress={() => setStep(2)}
        disabled={!planName.trim()}
      >
        <Text className="text-on-brand text-center font-bold text-lg">
          Next: Add Workout Days
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderStep2 = () => (
    <View>
      <Text className="text-text text-2xl font-bold mb-6">Weekly Schedule</Text>

      <ScrollView className="max-h-96 mb-6">
        {workoutDays.map((day, index) => (
          <View key={index} className="mb-4 bg-surface rounded-2xl border border-border p-4">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-text font-bold text-lg">
                {DAYS_OF_WEEK[day.dayOfWeek]}
              </Text>

              <TouchableOpacity
                className={`px-4 py-2 rounded ${day.isRestDay ? 'bg-surface-2 border border-border' : 'bg-primary'
                  }`}
                onPress={() => toggleRestDay(index)}
              >
                <Text className={`font-bold ${day.isRestDay ? 'text-text-light' : 'text-on-brand'}`}>
                  {day.isRestDay ? 'Rest Day' : 'Workout Day'}
                </Text>
              </TouchableOpacity>
            </View>

            {!day.isRestDay && (
              <>
                <TextInput
                  className="bg-surface-2 border border-border text-text rounded-xl p-3 mb-4"
                  placeholder="Workout name (e.g., Chest Day)"
                  placeholderTextColor={colors.textLight}
                  value={day.name}
                  onChangeText={(text) => {
                    const updatedDays = [...workoutDays];
                    updatedDays[index].name = text;
                    setWorkoutDays(updatedDays);
                  }}
                />

                <TouchableOpacity
                  className="flex-row items-center justify-center bg-primary/15 border border-primary/30 py-3 rounded-lg mb-4"
                  onPress={() => {
                    setSelectedDayIndex(index);
                    setShowAddExercise(true);
                  }}
                >
                  <AntDesign name="plus" size={20} color={colors.brand} />
                  <Text className="text-primary font-bold ml-2">Add Exercise</Text>
                </TouchableOpacity>

                {day.exercises.length > 0 && (
                  <View>
                    <Text className="text-text-light mb-2">Exercises:</Text>
                    {day.exercises.map((exercise, exIndex) => (
                      <View key={exIndex} className="bg-surface-2 border border-border rounded-xl p-3 mb-2">
                        <View className="flex-row justify-between items-center mb-2">
                          <Text className="text-text font-bold flex-1">
                            {exercise.name}
                          </Text>
                          <TouchableOpacity
                            onPress={() => removeExercise(index, exIndex)}
                          >
                            <AntDesign name="close" size={20} color={colors.danger} />
                          </TouchableOpacity>
                        </View>

                        <View className="flex-row justify-between">
                          <View className="flex-1 mr-2">
                            <Text className="text-text-light text-xs mb-1">Sets</Text>
                            <TextInput
                              className="bg-surface border border-border text-text rounded p-2 text-center"
                              value={exercise.sets.toString()}
                              onChangeText={(text) => updateExercise(index, exIndex, 'sets', parseInt(text) || 0)}
                              keyboardType="numeric"
                            />
                          </View>

                          <View className="flex-1 mx-2">
                            <Text className="text-text-light text-xs mb-1">Reps</Text>
                            <TextInput
                              className="bg-surface border border-border text-text rounded p-2 text-center"
                              value={exercise.reps.toString()}
                              onChangeText={(text) => updateExercise(index, exIndex, 'reps', parseInt(text) || 0)}
                              keyboardType="numeric"
                            />
                          </View>

                          <View className="flex-1 ml-2">
                            <Text className="text-text-light text-xs mb-1">Weight (kg)</Text>
                            <TextInput
                              className="bg-surface border border-border text-text rounded p-2 text-center"
                              placeholder="Optional"
                              placeholderTextColor={colors.textLight}
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

      <View className="flex-row justify-between">
        <TouchableOpacity
          className="bg-surface-2 border border-border flex-1 mr-2 py-4 rounded-xl"
          onPress={() => setStep(1)}
        >
          <Text className="text-text text-center font-bold">Back</Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="bg-primary flex-1 ml-2 py-4 rounded-xl"
          onPress={createPlan}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.onBrand} />
          ) : (
            <Text className="text-on-brand text-center font-bold text-lg">
              {isTemplate ? 'Create Template' : 'Create Plan'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderAddExerciseModal = () => (
    <View style={vars} key={mode} className="absolute inset-0 bg-black/50 justify-end">
      <View className="bg-bg rounded-t-3xl p-6 h-3/4">
        <View className="flex-row justify-between items-center mb-6">
          <Text className="text-text text-2xl font-bold">Add Exercise</Text>
          <TouchableOpacity onPress={() => setShowAddExercise(false)}>
            <AntDesign name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <TextInput
          className="bg-surface-2 border border-border text-text rounded-xl p-4 mb-4"
          placeholder="Search exercises..."
          placeholderTextColor={colors.textLight}
          value={searchQuery}
          onChangeText={handleSearch}
          autoFocus
        />

        {searching ? (
          <ActivityIndicator size="large" color={colors.brand} />
        ) : (
          <ScrollView className="flex-1">
            {searchResults.map((exercise) => (
              <TouchableOpacity
                key={exercise.id}
                className="bg-surface rounded-2xl border border-border p-4 mb-3"
                onPress={() => addExerciseToDay(exercise)}
              >
                <Text className="text-text font-bold text-lg mb-1">
                  {exercise.name}
                </Text>
                {exercise.category && (
                  <Text className="text-text-light text-sm">{exercise.category}</Text>
                )}
              </TouchableOpacity>
            ))}

            {searchQuery && searchResults.length === 0 && !searching && (
              <View className="items-center py-8">
                <Feather name="search" size={48} color={colors.textLight} />
                <Text className="text-text-light mt-4">
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
    <SafeAreaView className="flex-1 bg-bg">
      <ScrollView className="flex-1 p-4">
        <View className="flex-row items-center mb-6">
          <TouchableOpacity onPress={() => router.back()}>
            <AntDesign name="arrow-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text className="text-text text-2xl font-bold ml-4">
            {isTemplate ? 'Create Template' : 'Create Workout Plan'}
          </Text>
        </View>

        <View className="flex-row justify-between mb-8">
          {[1, 2].map((stepNum) => (
            <View key={stepNum} className="flex-1 items-center">
              <View className={`w-8 h-8 rounded-full justify-center items-center mb-2 ${step >= stepNum ? 'bg-primary' : 'bg-surface-2 border border-border'
                }`}>
                <Text className={`font-bold ${step >= stepNum ? 'text-on-brand' : 'text-text-light'
                  }`}>
                  {stepNum}
                </Text>
              </View>
              <Text className={`text-sm ${step >= stepNum ? 'text-primary' : 'text-text-light'
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