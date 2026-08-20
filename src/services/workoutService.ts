// services/workoutService.ts
import { supabase } from '../lib/supabase';
import {
  WorkoutPlan,
  WorkoutDay,
  WorkoutSession,
  ExerciseSet,
  PersonalRecord,
  CreatePlanData,
  WorkoutDayForm,
  PlannedExercise
} from '../types/workout';
import { localDateString } from '../utils/date';

class WorkoutService {
  // Create workout plan with days and exercises (atomic server-side RPC)
  async createWeeklyPlan(
    userId: string,
    planData: CreatePlanData,
    days: WorkoutDayForm[]
  ): Promise<{ success: boolean; planId?: string; error?: any }> {
    try {
      const p_days = days.map(day => ({
        day_of_week: day.dayOfWeek,
        name: day.name,
        is_rest_day: day.isRestDay,
        exercises: day.isRestDay ? [] : day.exercises.map((exercise, index) => ({
          exercise_id: exercise.id,
          exercise_name: exercise.name,
          exercise_type: exercise.type,
          target_sets: exercise.sets,
          target_reps: exercise.reps,
          target_weight: exercise.weight,
          target_duration: null,
          notes: exercise.notes ?? null,
          order_index: index
        }))
      }));

      const { data: planId, error } = await supabase.rpc('create_weekly_plan', {
        p_name: planData.name,
        p_description: planData.description ?? null,
        p_start_date: planData.startDate,
        p_end_date: planData.endDate,
        p_is_template: planData.isTemplate,
        p_days
      });

      if (error) throw error;

      return { success: true, planId: planId as string };
    } catch (error) {
      console.error('Error creating workout plan:', error);
      return { success: false, error };
    }
  }

  // Get active workout plan
  async getActiveWorkoutPlan(userId: string): Promise<WorkoutPlan | null> {
    try {
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
        // Don't filter by is_template - active plans can be templates too
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching active plan:', error);
      return null;
    }
  }

  // Get all templates (including active ones)
  async getTemplates(userId: string): Promise<WorkoutPlan[]> {
    try {
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
        .eq('is_template', true) // Show all templates, even if active
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching templates:', error);
      return [];
    }
  }

  // Activate a template: clones it into a fresh active plan (template untouched).
  // Returns the NEW cloned plan's id. RPC scopes by auth.uid(); userId kept
  // for caller compatibility.
  async activateTemplate(
    userId: string,
    templateId: string,
    startDate?: string,
    endDate?: string
  ): Promise<{ success: boolean; planId?: string; error?: any }> {
    try {
      const { data: newPlanId, error } = await supabase.rpc('activate_template', {
        p_template_id: templateId,
        p_start_date: startDate || null,
        p_end_date: endDate || null
      });

      if (error) throw error;

      return { success: true, planId: newPlanId as string };
    } catch (error) {
      console.error('Error activating template:', error);
      return { success: false, error };
    }
  }

  // Delete plan: DB has ON DELETE CASCADE for days/exercises and
  // ON DELETE SET NULL for sessions, so a single scoped delete suffices.
  async deletePlan(userId: string, planId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('workout_plans')
        .delete()
        .eq('id', planId)
        .eq('user_id', userId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting plan:', error);
      return false;
    }
  }

  // Start workout session
  async startWorkoutSession(
    userId: string,
    workoutDayId: string
  ): Promise<WorkoutSession | null> {
    try {
      const { data, error } = await supabase
        .from('workout_sessions')
        .insert({
          user_id: userId,
          workout_day_id: workoutDayId,
          date: localDateString(),
          started_at: new Date().toISOString()
        })
        .select(`
          *,
          workout_days (
            *,
            planned_exercises (*)
          )
        `)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error starting session:', error);
      return null;
    }
  }

  // Log exercise set (atomic insert + race-free PR detection server-side)
  async logExerciseSet(setData: {
    sessionId: string;
    plannedExerciseId?: string;
    exerciseId: string;
    exerciseName: string;
    setNumber: number;
    reps: number;
    weight?: number;
    duration?: number;
    notes?: string;
    userId: string;
  }): Promise<ExerciseSet | null> {
    try {
      const { data, error } = await supabase.rpc('log_exercise_set', {
        p_session_id: setData.sessionId,
        p_planned_exercise_id: setData.plannedExerciseId ?? null,
        p_exercise_id: setData.exerciseId,
        p_exercise_name: setData.exerciseName,
        p_set_number: setData.setNumber,
        p_reps: setData.reps,
        p_weight: setData.weight ?? null,
        p_duration: setData.duration ?? null,
        p_notes: setData.notes ?? null
      });

      if (error) throw error;
      return (data as ExerciseSet) ?? null;
    } catch (error) {
      console.error('Error logging set:', error);
      return null;
    }
  }

  // Complete workout session (idempotent server-side RPC; also rolls
  // burned calories into the day's nutrition row). RPC scopes by auth.uid();
  // userId kept for caller compatibility.
  async completeWorkoutSession(
    userId: string,
    sessionId: string,
    caloriesBurned: number
  ): Promise<WorkoutSession | null> {
    try {
      const { data, error } = await supabase.rpc('complete_workout_session', {
        p_session_id: sessionId,
        p_calories_burned: caloriesBurned
      });

      if (error) throw error;
      return (data as WorkoutSession) ?? null;
    } catch (error) {
      console.error('Error completing session:', error);
      return null;
    }
  }

  // Get session details
  async getSessionDetails(sessionId: string, userId: string): Promise<WorkoutSession | null> {
    try {
      const { data, error } = await supabase
        .from('workout_sessions')
        .select(`
          *,
          workout_days (
            *,
            planned_exercises (*)
          ),
          exercise_sets (*)
        `)
        .eq('id', sessionId)
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching session:', error);
      return null;
    }
  }

  // Get workout history
  async getWorkoutHistory(userId: string, limit = 30): Promise<WorkoutSession[]> {
    try {
      const { data, error } = await supabase
        .from('workout_sessions')
        .select(`
          *,
          workout_days (
            name,
            is_rest_day
          ),
          exercise_sets (
            weight,
            reps
          )
        `)
        .eq('user_id', userId)
        .not('completed_at', 'is', null)
        .order('date', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching history:', error);
      return [];
    }
  }

  // Get personal records
  async getPersonalRecords(userId: string): Promise<PersonalRecord[]> {
    try {
      const { data, error } = await supabase
        .from('personal_records')
        .select('*')
        .eq('user_id', userId)
        .order('achieved_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching PRs:', error);
      return [];
    }
  }
}

export const workoutService = new WorkoutService();