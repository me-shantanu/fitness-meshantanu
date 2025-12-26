import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './authStore';

export const useWorkoutStore = create((set, get) => ({
  activePlan: null,
  currentSession: null,
  workoutHistory: [],
  loading: false,

  // Load active workout plan
  loadActivePlan: async () => {
    try {
      const userId = useAuthStore.getState().user?.id;
      if (!userId) return;

      set({ loading: true });
      const { data, error } = await supabase
        .from('workout_plans')
        .select(`
          *,
          workout_days (
            *,
            planned_exercises (*)
          )
        `)
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      set({ activePlan: data, loading: false });
    } catch (error) {
      console.error('Error loading active plan:', error);
      set({ loading: false });
    }
  },

  // Start new workout session
  startSession: async (workoutDayId) => {
    try {
      const userId = useAuthStore.getState().user?.id;
      if (!userId) return null;

      const { data, error } = await supabase
        .from('workout_sessions')
        .insert({
          user_id: userId,
          workout_day_id: workoutDayId,
          date: new Date().toISOString().split('T')[0],
          started_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      set({ currentSession: data });
      return data;
    } catch (error) {
      console.error('Error starting session:', error);
      return null;
    }
  },

  // Complete session
  completeSession: async (sessionId, caloriesBurned) => {
    try {
      const { data, error } = await supabase
        .from('workout_sessions')
        .update({
          completed_at: new Date().toISOString(),
          total_calories_burned: caloriesBurned
        })
        .eq('id', sessionId)
        .select()
        .single();

      if (error) throw error;
      set({ currentSession: null });
      await get().loadActivePlan();
      return data;
    } catch (error) {
      console.error('Error completing session:', error);
      return null;
    }
  },

  // Load workout history
  loadWorkoutHistory: async (limit = 30) => {
    try {
      const userId = useAuthStore.getState().user?.id;
      if (!userId) return;

      const { data, error } = await supabase
        .from('workout_sessions')
        .select(`
          *,
          workout_days (
            name,
            is_rest_day
          ),
          exercise_sets (*)
        `)
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(limit);

      if (error) throw error;
      set({ workoutHistory: data || [] });
    } catch (error) {
      console.error('Error loading workout history:', error);
    }
  },

  // Clear store
  clear: () => set({
    activePlan: null,
    currentSession: null,
    workoutHistory: [],
    loading: false
  }),
}));