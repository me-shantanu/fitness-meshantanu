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

class WorkoutService {
  // Create workout plan with days and exercises
  async createWeeklyPlan(
    userId: string,
    planData: CreatePlanData,
    days: WorkoutDayForm[]
  ): Promise<{ success: boolean; planId?: string; error?: any }> {
    try {
      // Deactivate other active plans if this isn't a template
      if (!planData.isTemplate) {
        await supabase
          .from('workout_plans')
          .update({ is_active: false })
          .eq('user_id', userId)
          .eq('is_active', true);
      }

      // Create the plan
      const { data: plan, error: planError } = await supabase
        .from('workout_plans')
        .insert({
          user_id: userId,
          name: planData.name,
          description: planData.description,
          start_date: planData.startDate,
          end_date: planData.endDate,
          is_active: !planData.isTemplate,
          is_template: planData.isTemplate
        })
        .select()
        .single();

      if (planError) throw planError;

      // Create workout days
      for (const day of days) {
        const { data: workoutDay, error: dayError } = await supabase
          .from('workout_days')
          .insert({
            plan_id: plan.id,
            day_of_week: day.dayOfWeek,
            name: day.name,
            is_rest_day: day.isRestDay
          })
          .select()
          .single();

        if (dayError) throw dayError;

        // Add exercises if not a rest day
        if (!day.isRestDay && day.exercises.length > 0) {
          const exercisesToInsert = day.exercises.map((exercise, index) => ({
            workout_day_id: workoutDay.id,
            exercise_id: exercise.id,
            exercise_name: exercise.name,
            exercise_type: exercise.type,
            target_sets: exercise.sets,
            target_reps: exercise.reps,
            target_weight: exercise.weight,
            notes: exercise.notes,
            order_index: index
          }));

          const { error: exercisesError } = await supabase
            .from('planned_exercises')
            .insert(exercisesToInsert);

          if (exercisesError) throw exercisesError;
        }
      }

      return { success: true, planId: plan.id };
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
        .eq('is_template', false)
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

  // Get all templates
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
        .eq('is_template', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching templates:', error);
      return [];
    }
  }

  // Activate a template as current plan
  async activateTemplate(
    userId: string,
    templateId: string,
    startDate: string,
    endDate: string
  ): Promise<{ success: boolean; planId?: string; error?: any }> {
    try {
      // Get template with all days and exercises
      const { data: template, error: templateError } = await supabase
        .from('workout_plans')
        .select(`
          *,
          workout_days (
            *,
            planned_exercises (*)
          )
        `)
        .eq('id', templateId)
        .single();

      if (templateError) throw templateError;

      // Create new plan from template
      const planData: CreatePlanData = {
        name: template.name,
        description: template.description,
        startDate,
        endDate,
        isTemplate: false
      };

      const days: WorkoutDayForm[] = template.workout_days.map((day: WorkoutDay) => ({
        dayOfWeek: day.day_of_week,
        name: day.name,
        isRestDay: day.is_rest_day,
        exercises: (day.planned_exercises || []).map((ex: PlannedExercise) => ({
          id: ex.exercise_id,
          name: ex.exercise_name,
          sets: ex.target_sets,
          reps: ex.target_reps,
          weight: ex.target_weight || null,
          type: ex.exercise_type,
          notes: ex.notes
        }))
      }));

      return await this.createWeeklyPlan(userId, planData, days);
    } catch (error) {
      console.error('Error activating template:', error);
      return { success: false, error };
    }
  }

  // Delete plan (cascades to workout_days and planned_exercises)
  async deletePlan(planId: string): Promise<boolean> {
    try {
      // First get all workout days for this plan
      const { data: workoutDays, error: fetchError } = await supabase
        .from('workout_days')
        .select('id')
        .eq('plan_id', planId);

      if (fetchError) throw fetchError;

      // Delete all planned exercises for each workout day
      if (workoutDays && workoutDays.length > 0) {
        const dayIds = workoutDays.map(d => d.id);
        
        const { error: exercisesError } = await supabase
          .from('planned_exercises')
          .delete()
          .in('workout_day_id', dayIds);

        if (exercisesError) throw exercisesError;

        // Delete all workout days
        const { error: daysError } = await supabase
          .from('workout_days')
          .delete()
          .eq('plan_id', planId);

        if (daysError) throw daysError;
      }

      // Finally delete the plan
      const { error: planError } = await supabase
        .from('workout_plans')
        .delete()
        .eq('id', planId);

      if (planError) throw planError;

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
          date: new Date().toISOString().split('T')[0],
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

  // Log exercise set
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
      // Check for PR
      const isPR = await this.checkPersonalRecord(
        setData.userId,
        setData.exerciseId,
        setData.weight || 0,
        setData.reps
      );

      const { data: set, error } = await supabase
        .from('exercise_sets')
        .insert({
          session_id: setData.sessionId,
          planned_exercise_id: setData.plannedExerciseId,
          exercise_id: setData.exerciseId,
          exercise_name: setData.exerciseName,
          set_number: setData.setNumber,
          reps: setData.reps,
          weight: setData.weight,
          duration: setData.duration,
          notes: setData.notes,
          is_pr: isPR
        })
        .select()
        .single();

      if (error) throw error;

      // Update PR if needed
      if (isPR) {
        await this.updatePersonalRecord(
          setData.userId,
          setData.exerciseId,
          setData.exerciseName,
          setData.weight || 0,
          setData.reps,
          setData.sessionId
        );
      }

      return set;
    } catch (error) {
      console.error('Error logging set:', error);
      return null;
    }
  }

  // Check if this is a personal record
  async checkPersonalRecord(
    userId: string,
    exerciseId: string,
    weight: number,
    reps: number
  ): Promise<boolean> {
    try {
      const { data: existingPR } = await supabase
        .from('personal_records')
        .select('*')
        .eq('user_id', userId)
        .eq('exercise_id', exerciseId)
        .maybeSingle();

      if (!existingPR) return true;

      // PR if: higher weight OR same weight with more reps
      return weight > existingPR.max_weight ||
        (weight === existingPR.max_weight && reps > existingPR.max_reps);
    } catch (error) {
      console.error('Error checking PR:', error);
      return false;
    }
  }

  // Update personal record
  async updatePersonalRecord(
    userId: string,
    exerciseId: string,
    exerciseName: string,
    weight: number,
    reps: number,
    sessionId: string
  ): Promise<PersonalRecord | null> {
    try {
      const { data: existingPR } = await supabase
        .from('personal_records')
        .select('*')
        .eq('user_id', userId)
        .eq('exercise_id', exerciseId)
        .maybeSingle();

      if (existingPR) {
        const { data, error } = await supabase
          .from('personal_records')
          .update({
            max_weight: weight,
            max_reps: reps,
            achieved_at: new Date().toISOString(),
            session_id: sessionId
          })
          .eq('id', existingPR.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('personal_records')
          .insert({
            user_id: userId,
            exercise_id: exerciseId,
            exercise_name: exerciseName,
            max_weight: weight,
            max_reps: reps,
            session_id: sessionId
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    } catch (error) {
      console.error('Error updating PR:', error);
      return null;
    }
  }

  // Complete workout session
  async completeWorkoutSession(
    sessionId: string,
    caloriesBurned: number
  ): Promise<WorkoutSession | null> {
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
      return data;
    } catch (error) {
      console.error('Error completing session:', error);
      return null;
    }
  }

  // Get session details
  async getSessionDetails(sessionId: string): Promise<WorkoutSession | null> {
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