import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import AntDesign from '@expo/vector-icons/AntDesign';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/useThemeStore';
import { showAlert } from '@/utils/alert';

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export interface AddToPlanExercise {
  id: number | string;
  name: string;
  duration?: string;
}

interface AddToPlanSheetProps {
  visible: boolean;
  exercise: AddToPlanExercise | null;
  exerciseType?: 'workout' | 'warmup' | 'cooldown';
  onClose: () => void;
}

interface PlanDay {
  id: string;
  day_of_week: number;
  name: string | null;
  is_rest_day: boolean;
  planName: string;
}

/**
 * Bottom sheet that lists the active plan's non-rest days and inserts the
 * given exercise into the tapped day. Reused by the exercises tab (quick "+")
 * and the exercise detail screen.
 */
export default function AddToPlanSheet({
  visible,
  exercise,
  exerciseType = 'workout',
  onClose,
}: AddToPlanSheetProps) {
  const router = useRouter();
  const { user } = useAuthStore();
  const { vars, mode } = useThemeStore();

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [days, setDays] = useState<PlanDay[]>([]);
  const [addingDayId, setAddingDayId] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      loadPlanDays();
    }
  }, [visible]);

  const loadPlanDays = async () => {
    if (!user?.id) {
      setDays([]);
      return;
    }

    setLoading(true);
    setLoadError(false);
    try {
      const { data: plans, error } = await supabase
        .from('workout_plans')
        .select(`
          *,
          workout_days (
            id,
            day_of_week,
            name,
            is_rest_day
          )
        `)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const planDays: PlanDay[] = [];
      (plans || []).forEach((plan: any) => {
        (plan.workout_days || [])
          .filter((d: any) => !d.is_rest_day)
          .sort((a: any, b: any) => a.day_of_week - b.day_of_week)
          .forEach((d: any) => planDays.push({ ...d, planName: plan.name }));
      });

      setDays(planDays);
    } catch (error) {
      console.error('Error loading plan days:', error);
      setDays([]);
      setLoadError(true);
    }
    setLoading(false);
  };

  const dayLabel = (day: PlanDay) =>
    `${DAYS_OF_WEEK[day.day_of_week]} — ${day.name || 'Workout Day'}`;

  const handleAddToDay = async (day: PlanDay) => {
    if (!exercise || !user?.id || addingDayId) return;

    setAddingDayId(day.id);
    try {
      const exerciseId = String(exercise.id);

      // Duplicate check: don't add the same exercise to a day twice.
      const { data: existing, error: dupError } = await supabase
        .from('planned_exercises')
        .select('id')
        .eq('workout_day_id', day.id)
        .eq('exercise_id', exerciseId)
        .limit(1);

      if (dupError) throw dupError;

      if (existing && existing.length > 0) {
        showAlert('Already in that day', `"${exercise.name}" is already in ${dayLabel(day)}.`);
        return;
      }

      // Next order index for the day.
      const { data: lastExercise, error: fetchError } = await supabase
        .from('planned_exercises')
        .select('order_index')
        .eq('workout_day_id', day.id)
        .order('order_index', { ascending: false })
        .limit(1);

      if (fetchError) throw fetchError;

      const nextOrderIndex =
        lastExercise && lastExercise.length > 0 ? lastExercise[0].order_index + 1 : 0;

      const isWarmupOrCooldown = exerciseType === 'warmup' || exerciseType === 'cooldown';

      const { error: insertError } = await supabase
        .from('planned_exercises')
        .insert({
          workout_day_id: day.id,
          exercise_id: exerciseId,
          exercise_name: exercise.name,
          exercise_type: isWarmupOrCooldown ? exerciseType : 'strength',
          target_sets: isWarmupOrCooldown ? 1 : 3,
          target_reps: 10,
          target_duration: exercise.duration || null,
          order_index: nextOrderIndex,
          user_id: user.id,
        });

      if (insertError) throw insertError;

      onClose();
      showAlert('Added', `"${exercise.name}" added to ${dayLabel(day)}.`);
    } catch (error: any) {
      console.error('Error adding exercise to plan:', error);
      showAlert('Error', error.message || 'Failed to add exercise to plan');
    } finally {
      setAddingDayId(null);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={vars} key={mode} className="flex-1 bg-black/50 justify-end">
        <View className="bg-bg rounded-t-3xl p-6" style={{ maxHeight: '75%' }}>
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-text text-2xl font-bold">Add to Plan</Text>
            <TouchableOpacity onPress={onClose} className="p-2">
              <AntDesign name="close" size={24} color={vars['--text'] as string} />
            </TouchableOpacity>
          </View>

          {exercise && (
            <View className="bg-surface rounded-xl p-4 mb-4">
              <Text className="text-text font-bold text-lg">{exercise.name}</Text>
              <Text className="text-text-light text-sm mt-1">
                Pick a day to add this exercise to
              </Text>
            </View>
          )}

          {loading ? (
            <View className="py-10 items-center">
              <ActivityIndicator size="large" color={vars['--primary'] as string} />
            </View>
          ) : loadError ? (
            <View className="bg-surface rounded-xl p-6 items-center">
              <Text className="text-text text-lg font-bold mb-2">Couldn't load your plan</Text>
              <Text className="text-text-light text-center mb-4">Check your connection.</Text>
              <TouchableOpacity
                className="bg-blue-600 px-6 py-3 rounded-lg"
                onPress={loadPlanDays}
              >
                <Text className="text-white font-bold">Retry</Text>
              </TouchableOpacity>
            </View>
          ) : days.length === 0 ? (
            <View className="bg-surface rounded-xl p-6 items-center">
              <MaterialIcons
                name="fitness-center"
                size={48}
                color={vars['--text-light'] as string}
              />
              <Text className="text-text text-lg font-bold mt-4 mb-2">No active plan</Text>
              <Text className="text-text-light text-center mb-4">
                Create a workout plan first to add exercises
              </Text>
              <TouchableOpacity
                className="bg-blue-600 px-6 py-3 rounded-lg"
                onPress={() => {
                  onClose();
                  router.push('/create-plan');
                }}
              >
                <Text className="text-white font-bold">Create Plan</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {days.map((day) => (
                <TouchableOpacity
                  key={day.id}
                  className="bg-surface rounded-xl p-4 mb-3 flex-row items-center justify-between"
                  onPress={() => handleAddToDay(day)}
                  disabled={addingDayId !== null}
                  activeOpacity={0.7}
                >
                  <View className="flex-1 mr-3">
                    <Text className="text-text font-bold">
                      {DAYS_OF_WEEK[day.day_of_week]}
                      {day.name ? ` — ${day.name}` : ''}
                    </Text>
                    <Text className="text-text-light text-sm mt-0.5">{day.planName}</Text>
                  </View>
                  {addingDayId === day.id ? (
                    <ActivityIndicator size="small" color={vars['--primary'] as string} />
                  ) : (
                    <MaterialIcons
                      name="add-circle-outline"
                      size={24}
                      color={vars['--text-light'] as string}
                    />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}
