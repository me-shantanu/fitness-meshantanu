// app/edit-plan.tsx
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
import { useWorkoutStore } from '../store/workoutStore';
import { exerciseService } from '../services/exerciseService';
import { supabase } from '../lib/supabase';
import AntDesign from '@expo/vector-icons/AntDesign';
import Feather from '@expo/vector-icons/Feather';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useThemeStore } from '@/store/useThemeStore';
import { WorkoutDay, PlannedExercise, Exercise } from '@/types/workout';
import { showAlert } from '@/utils/alert';

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function EditPlanScreen() {
    const router = useRouter();
    const { user } = useAuthStore();
    const { activePlan, loadActivePlan } = useWorkoutStore();

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Plan details
    const [planName, setPlanName] = useState('');
    const [planDescription, setPlanDescription] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Workout days
    const [workoutDays, setWorkoutDays] = useState<WorkoutDay[]>([]);

    // For adding exercises
    const [showAddExercise, setShowAddExercise] = useState(false);
    const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<Exercise[]>([]);
    const [searching, setSearching] = useState(false);

    useEffect(() => {
        if (activePlan) {
            setPlanName(activePlan.name);
            setPlanDescription(activePlan.description || '');
            setStartDate(activePlan.start_date);
            setEndDate(activePlan.end_date);
            setWorkoutDays(activePlan.workout_days || []);
        }
    }, [activePlan]);

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

    const addExerciseToDay = async (exercise: Exercise) => {
        if (!selectedDayId) return;

        try {
            // Find the day
            const day = workoutDays.find(d => d.id === selectedDayId);
            if (!day) return;

            // Get the max order_index
            const maxOrder = day.planned_exercises?.length || 0;

            // Add exercise to database
            const { data, error } = await supabase
                .from('planned_exercises')
                .insert({
                    workout_day_id: selectedDayId,
                    exercise_id: exercise.id,
                    exercise_name: exercise.name,
                    exercise_type: 'strength',
                    target_sets: 3,
                    target_reps: 10,
                    target_weight: null,
                    order_index: maxOrder
                })
                .select()
                .single();

            if (error) throw error;

            // Update local state
            const updatedDays = workoutDays.map(d => {
                if (d.id === selectedDayId) {
                    return {
                        ...d,
                        planned_exercises: [...(d.planned_exercises || []), data]
                    };
                }
                return d;
            });

            setWorkoutDays(updatedDays);
            setShowAddExercise(false);
            setSearchQuery('');
            setSearchResults([]);
            showAlert('Success', 'Exercise added successfully');
        } catch (error) {
            console.error('Error adding exercise:', error);
            showAlert('Error', 'Failed to add exercise');
        }
    };

    const removeExercise = async (exerciseId: string, dayId: string) => {
        showAlert(
            'Remove Exercise',
            'Are you sure you want to remove this exercise?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const { error } = await supabase
                                .from('planned_exercises')
                                .delete()
                                .eq('id', exerciseId);

                            if (error) throw error;

                            // Update local state
                            const updatedDays = workoutDays.map(d => {
                                if (d.id === dayId) {
                                    return {
                                        ...d,
                                        planned_exercises: d.planned_exercises?.filter(e => e.id !== exerciseId) || []
                                    };
                                }
                                return d;
                            });

                            setWorkoutDays(updatedDays);
                            showAlert('Success', 'Exercise removed successfully');
                        } catch (error) {
                            console.error('Error removing exercise:', error);
                            showAlert('Error', 'Failed to remove exercise');
                        }
                    }
                }
            ]
        );
    };

    // Local-only update while typing (no network per keystroke)
    const updateExerciseLocal = (
        exerciseId: string,
        field: 'target_sets' | 'target_reps' | 'target_weight',
        value: number | null
    ) => {
        setWorkoutDays(prev => prev.map(day => ({
            ...day,
            planned_exercises: day.planned_exercises?.map(ex =>
                ex.id === exerciseId ? { ...ex, [field]: value } : ex
            )
        })));
    };

    // Persist once when editing ends (onEndEditing / onBlur). Silent on
    // success; alert only on failure.
    const persistExercise = async (
        exerciseId: string,
        field: 'target_sets' | 'target_reps' | 'target_weight',
        value: number | null
    ) => {
        try {
            const { error } = await supabase
                .from('planned_exercises')
                .update({ [field]: value })
                .eq('id', exerciseId);

            if (error) throw error;
        } catch (error) {
            console.error('Error updating exercise:', error);
            showAlert('Error', 'Failed to save exercise changes');
        }
    };

    const toggleRestDay = async (dayId: string) => {
        const day = workoutDays.find(d => d.id === dayId);
        if (!day) return;

        const newRestDayStatus = !day.is_rest_day;

        showAlert(
            newRestDayStatus ? 'Make Rest Day' : 'Make Workout Day',
            newRestDayStatus
                ? 'This will remove all exercises from this day. Continue?'
                : 'You can now add exercises to this day.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Continue',
                    onPress: async () => {
                        try {
                            // If making it a rest day, delete all exercises first
                            if (newRestDayStatus && day.planned_exercises && day.planned_exercises.length > 0) {
                                const { error: deleteError } = await supabase
                                    .from('planned_exercises')
                                    .delete()
                                    .eq('workout_day_id', dayId);

                                if (deleteError) throw deleteError;
                            }

                            // Update the day
                            const { error } = await supabase
                                .from('workout_days')
                                .update({
                                    is_rest_day: newRestDayStatus,
                                    name: newRestDayStatus ? '' : day.name
                                })
                                .eq('id', dayId);

                            if (error) throw error;

                            // Update local state
                            const updatedDays = workoutDays.map(d => {
                                if (d.id === dayId) {
                                    return {
                                        ...d,
                                        is_rest_day: newRestDayStatus,
                                        name: newRestDayStatus ? '' : d.name,
                                        planned_exercises: newRestDayStatus ? [] : d.planned_exercises
                                    };
                                }
                                return d;
                            });

                            setWorkoutDays(updatedDays);
                            showAlert('Success', `Day updated to ${newRestDayStatus ? 'rest day' : 'workout day'}`);
                        } catch (error) {
                            console.error('Error toggling rest day:', error);
                            showAlert('Error', 'Failed to update day');
                        }
                    }
                }
            ]
        );
    };

    // Local-only update while typing (no network per keystroke)
    const updateDayNameLocal = (dayId: string, name: string) => {
        setWorkoutDays(prev => prev.map(d =>
            d.id === dayId ? { ...d, name } : d
        ));
    };

    // Persist once when editing ends (onEndEditing / onBlur). Silent on
    // success; alert only on failure.
    const persistDayName = async (dayId: string, name: string) => {
        try {
            const { error } = await supabase
                .from('workout_days')
                .update({ name })
                .eq('id', dayId);

            if (error) throw error;
        } catch (error) {
            console.error('Error updating day name:', error);
            showAlert('Error', 'Failed to save workout name');
        }
    };

    const savePlanDetails = async () => {
        if (!activePlan?.id || !user?.id) return;

        if (!planName.trim()) {
            showAlert('Error', 'Please enter a plan name');
            return;
        }

        if (!startDate || !endDate) {
            showAlert('Error', 'Please select start and end dates');
            return;
        }

        const isValidDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
        if (!isValidDate(startDate) || !isValidDate(endDate)) {
            showAlert('Error', 'Please enter valid dates in YYYY-MM-DD format');
            return;
        }

        if (new Date(startDate) > new Date(endDate)) {
            showAlert('Error', 'Start date must be before end date');
            return;
        }

        setSaving(true);
        try {
            const { error } = await supabase
                .from('workout_plans')
                .update({
                    name: planName,
                    description: planDescription,
                    start_date: startDate,
                    end_date: endDate
                })
                .eq('id', activePlan.id);

            if (error) throw error;

            await loadActivePlan(user.id);
            showAlert('Success', 'Plan details updated successfully');
        } catch (error) {
            console.error('Error updating plan:', error);
            showAlert('Error', 'Failed to update plan details');
        }
        setSaving(false);
    };

    const addNewWorkoutDay = async () => {
        if (!activePlan?.id) return;

        // Find the next available day of week
        const usedDays = workoutDays.map(d => d.day_of_week);
        let nextDay = 0;
        for (let i = 0; i < 7; i++) {
            if (!usedDays.includes(i)) {
                nextDay = i;
                break;
            }
        }

        if (usedDays.length >= 7) {
            showAlert('Error', 'All days of the week are already used');
            return;
        }

        try {
            const { data, error } = await supabase
                .from('workout_days')
                .insert({
                    plan_id: activePlan.id,
                    day_of_week: nextDay,
                    name: 'New Workout Day',
                    is_rest_day: false
                })
                .select()
                .single();

            if (error) throw error;

            setWorkoutDays([...workoutDays, { ...data, planned_exercises: [] }]);
            showAlert('Success', 'New workout day added');
        } catch (error) {
            console.error('Error adding workout day:', error);
            showAlert('Error', 'Failed to add workout day');
        }
    };

    const removeWorkoutDay = async (dayId: string) => {
        showAlert(
            'Remove Day',
            'Are you sure you want to remove this workout day?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const { error } = await supabase
                                .from('workout_days')
                                .delete()
                                .eq('id', dayId);

                            if (error) throw error;

                            setWorkoutDays(workoutDays.filter(d => d.id !== dayId));
                            showAlert('Success', 'Workout day removed');
                        } catch (error) {
                            console.error('Error removing day:', error);
                            showAlert('Error', 'Failed to remove workout day');
                        }
                    }
                }
            ]
        );
    };

    const { vars, mode, colors } = useThemeStore();

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

    if (!activePlan) {
        return (
            <SafeAreaView className="flex-1 bg-bg">
                <View className="flex-1 justify-center items-center">
                    <Text className="text-text text-xl">No active plan to edit</Text>
                    <TouchableOpacity
                        className="bg-primary px-6 py-3 rounded-lg mt-4"
                        onPress={() => router.back()}
                    >
                        <Text className="text-on-brand font-bold">Go Back</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-bg">
            <ScrollView className="flex-1">
                <View className="px-4 pt-4">
                    <View className="flex-row items-center mb-6">
                        <TouchableOpacity onPress={() => router.back()}>
                            <AntDesign name="arrow-left" size={24} color={colors.text} />
                        </TouchableOpacity>
                        <Text className="text-text text-2xl font-bold ml-4">Edit Plan</Text>
                    </View>

                    {/* Plan Details */}
                    <View className="mb-6">
                        <Text className="text-text text-xl font-bold mb-4">Plan Details</Text>

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

                            <TouchableOpacity
                                className="bg-primary py-4 rounded-xl"
                                onPress={savePlanDetails}
                                disabled={saving}
                            >
                                {saving ? (
                                    <ActivityIndicator color={colors.onBrand} />
                                ) : (
                                    <Text className="text-on-brand text-center font-bold text-lg">
                                        Save Plan Details
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Workout Days */}
                    <View className="mb-6">
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-text text-xl font-bold">Workout Days</Text>
                            <TouchableOpacity
                                className="bg-primary px-4 py-2 rounded-lg flex-row items-center"
                                onPress={addNewWorkoutDay}
                            >
                                <AntDesign name="plus" size={18} color={colors.onBrand} />
                                <Text className="text-on-brand font-bold ml-2">Add Day</Text>
                            </TouchableOpacity>
                        </View>

                        {workoutDays
                            .sort((a, b) => a.day_of_week - b.day_of_week)
                            .map((day) => (
                                <View key={day.id} className="mb-4 bg-surface rounded-2xl border border-border p-4">
                                    <View className="flex-row justify-between items-center mb-4">
                                        <Text className="text-text font-bold text-lg">
                                            {DAYS_OF_WEEK[day.day_of_week]}
                                        </Text>

                                        <View className="flex-row items-center">
                                            <TouchableOpacity
                                                className={`px-4 py-2 rounded mr-2 ${day.is_rest_day ? 'bg-surface-2 border border-border' : 'bg-primary'
                                                    }`}
                                                onPress={() => day.id && toggleRestDay(day.id)}
                                            >
                                                <Text className={`font-bold text-sm ${day.is_rest_day ? 'text-text-light' : 'text-on-brand'}`}>
                                                    {day.is_rest_day ? 'Rest Day' : 'Workout'}
                                                </Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                onPress={() => day.id && removeWorkoutDay(day.id)}
                                            >
                                                <MaterialIcons name="delete" size={24} color={colors.danger} />
                                            </TouchableOpacity>
                                        </View>
                                    </View>

                                    {!day.is_rest_day && (
                                        <>
                                            <TextInput
                                                className="bg-surface-2 border border-border text-text rounded-xl p-3 mb-4"
                                                placeholder="Workout name (e.g., Chest Day)"
                                                placeholderTextColor={colors.textLight}
                                                value={day.name}
                                                onChangeText={(text) => day.id && updateDayNameLocal(day.id, text)}
                                                onEndEditing={() => day.id && persistDayName(day.id, day.name)}
                                                onBlur={() => day.id && persistDayName(day.id, day.name)}
                                            />

                                            <TouchableOpacity
                                                className="flex-row items-center justify-center bg-primary/15 border border-primary/30 py-3 rounded-lg mb-4"
                                                onPress={() => {
                                                    setSelectedDayId(day.id || null);
                                                    setShowAddExercise(true);
                                                }}
                                            >
                                                <AntDesign name="plus" size={20} color={colors.brand} />
                                                <Text className="text-primary font-bold ml-2">Add Exercise</Text>
                                            </TouchableOpacity>

                                            {day.planned_exercises && day.planned_exercises.length > 0 && (
                                                <View>
                                                    <Text className="text-text-light mb-2">Exercises:</Text>
                                                    {day.planned_exercises.map((exercise) => (
                                                        <View key={exercise.id} className="bg-surface-2 border border-border rounded-xl p-3 mb-2">
                                                            <View className="flex-row justify-between items-center mb-2">
                                                                <Text className="text-text font-bold flex-1">
                                                                    {exercise.exercise_name}
                                                                </Text>
                                                                <TouchableOpacity
                                                                    onPress={() => exercise.id && day.id && removeExercise(exercise.id, day.id)}
                                                                >
                                                                    <AntDesign name="close" size={20} color={colors.danger} />
                                                                </TouchableOpacity>
                                                            </View>

                                                            <View className="flex-row justify-between">
                                                                <View className="flex-1 mr-2">
                                                                    <Text className="text-text-light text-xs mb-1">Sets</Text>
                                                                    <TextInput
                                                                        className="bg-surface border border-border text-text rounded p-2 text-center"
                                                                        value={exercise.target_sets.toString()}
                                                                        onChangeText={(text) =>
                                                                            exercise.id && updateExerciseLocal(exercise.id, 'target_sets', parseInt(text) || 0)
                                                                        }
                                                                        onEndEditing={() =>
                                                                            exercise.id && persistExercise(exercise.id, 'target_sets', exercise.target_sets)
                                                                        }
                                                                        onBlur={() =>
                                                                            exercise.id && persistExercise(exercise.id, 'target_sets', exercise.target_sets)
                                                                        }
                                                                        keyboardType="numeric"
                                                                    />
                                                                </View>

                                                                <View className="flex-1 mx-2">
                                                                    <Text className="text-text-light text-xs mb-1">Reps</Text>
                                                                    <TextInput
                                                                        className="bg-surface border border-border text-text rounded p-2 text-center"
                                                                        value={exercise.target_reps.toString()}
                                                                        onChangeText={(text) =>
                                                                            exercise.id && updateExerciseLocal(exercise.id, 'target_reps', parseInt(text) || 0)
                                                                        }
                                                                        onEndEditing={() =>
                                                                            exercise.id && persistExercise(exercise.id, 'target_reps', exercise.target_reps)
                                                                        }
                                                                        onBlur={() =>
                                                                            exercise.id && persistExercise(exercise.id, 'target_reps', exercise.target_reps)
                                                                        }
                                                                        keyboardType="numeric"
                                                                    />
                                                                </View>

                                                                <View className="flex-1 ml-2">
                                                                    <Text className="text-text-light text-xs mb-1">Weight (kg)</Text>
                                                                    <TextInput
                                                                        className="bg-surface border border-border text-text rounded p-2 text-center"
                                                                        placeholder="Optional"
                                                                        placeholderTextColor={colors.textLight}
                                                                        value={exercise.target_weight ? exercise.target_weight.toString() : ''}
                                                                        onChangeText={(text) =>
                                                                            exercise.id && updateExerciseLocal(exercise.id, 'target_weight', text ? parseFloat(text) : null)
                                                                        }
                                                                        onEndEditing={() =>
                                                                            exercise.id && persistExercise(exercise.id, 'target_weight', exercise.target_weight ?? null)
                                                                        }
                                                                        onBlur={() =>
                                                                            exercise.id && persistExercise(exercise.id, 'target_weight', exercise.target_weight ?? null)
                                                                        }
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
                    </View>
                </View>
            </ScrollView>

            {showAddExercise && renderAddExerciseModal()}
        </SafeAreaView>
    );
}