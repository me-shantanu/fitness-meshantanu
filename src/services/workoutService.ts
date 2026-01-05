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

  // Activate a template as current plan (keeps it as template)
  async activateTemplate(
    userId: string,
    templateId: string,
    startDate: string,
    endDate: string
  ): Promise<{ success: boolean; planId?: string; error?: any }> {
    try {
      // Deactivate all other active plans
      await supabase
        .from('workout_plans')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('is_active', true);

      // Activate this template (but keep it as a template!)
      const { data: activatedPlan, error: updateError } = await supabase
        .from('workout_plans')
        .update({
          is_active: true,
          // is_template stays as it was (true or false)
          start_date: startDate,
          end_date: endDate
        })
        .eq('id', templateId)
        .select()
        .single();

      if (updateError) throw updateError;

      return { success: true, planId: activatedPlan.id };
    } catch (error) {
      console.error('Error activating template:', error);
      return { success: false, error };
    }
  }

  // Convert active plan back to template
  async convertToTemplate(planId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('workout_plans')
        .update({
          is_active: false,
          is_template: true
        })
        .eq('id', planId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error converting to template:', error);
      return false;
    }
  }

  // Deactivate current plan (archive it)
  async deactivatePlan(planId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('workout_plans')
        .update({ is_active: false })
        .eq('id', planId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deactivating plan:', error);
      return false;
    }
  }

  // Delete plan - PRODUCTION READY VERSION
  async deletePlan(planId: string): Promise<boolean> {
    try {
      console.log('🗑️ Starting delete for plan:', planId);
      
      // Always use manual cascade delete for reliability
      // This ensures we handle all foreign keys properly
      return await this.manualCascadeDelete(planId);
    } catch (error: any) {
      console.error('❌ Fatal error in deletePlan:', error);
      return false;
    }
  }

  // Manual cascade delete - handles all foreign key relationships
  private async manualCascadeDelete(planId: string): Promise<boolean> {
    try {
      console.log('📋 Step 1: Fetching plan details...');
      
      // Get plan details
      const { data: plan, error: planFetchError } = await supabase
        .from('workout_plans')
        .select('name, is_active, is_template')
        .eq('id', planId)
        .single();

      if (planFetchError) {
        console.error('❌ Plan not found:', planFetchError);
        return false;
      }

      console.log('✓ Found plan:', plan);

      // Step 1: Get all workout days for this plan
      console.log('📋 Step 2: Fetching workout days...');
      const { data: workoutDays, error: daysError } = await supabase
        .from('workout_days')
        .select('id')
        .eq('plan_id', planId);

      if (daysError) {
        console.error('❌ Error fetching workout days:', daysError);
        throw daysError;
      }

      console.log(`✓ Found ${workoutDays?.length || 0} workout days`);

      if (!workoutDays || workoutDays.length === 0) {
        console.log('📋 No workout days, deleting plan directly...');
        const { error: planDeleteError } = await supabase
          .from('workout_plans')
          .delete()
          .eq('id', planId);
        
        if (planDeleteError) {
          console.error('❌ Error deleting plan:', planDeleteError);
          return false;
        }
        console.log('✅ Plan deleted successfully');
        return true;
      }

      const dayIds = workoutDays.map(d => d.id);
      console.log('Day IDs to process:', dayIds);

      // Step 2: Handle workout sessions
      console.log('📋 Step 3: Handling workout sessions...');
      const { data: sessions, error: sessionsError } = await supabase
        .from('workout_sessions')
        .select('id')
        .in('workout_day_id', dayIds);

      if (sessionsError) {
        console.error('⚠️ Error fetching sessions:', sessionsError);
      } else {
        console.log(`✓ Found ${sessions?.length || 0} workout sessions`);
      }

      // Step 3: Delete exercise sets from sessions
      if (sessions && sessions.length > 0) {
        const sessionIds = sessions.map(s => s.id);
        console.log('📋 Step 4: Deleting exercise sets...');
        
        const { error: setsError } = await supabase
          .from('exercise_sets')
          .delete()
          .in('session_id', sessionIds);
        
        if (setsError) {
          console.error('❌ Error deleting exercise sets:', setsError);
          // Continue anyway - not critical
        } else {
          console.log('✓ Exercise sets deleted');
        }

        // Step 4: Update sessions to remove workout_day_id reference
        console.log('📋 Step 5: Updating workout sessions...');
        const { error: updateSessionsError } = await supabase
          .from('workout_sessions')
          .update({ workout_day_id: null })
          .in('workout_day_id', dayIds);
        
        if (updateSessionsError) {
          console.error('❌ Error updating sessions:', updateSessionsError);
          // Try to delete them instead
          console.log('📋 Attempting to delete sessions...');
          const { error: deleteSessionsError } = await supabase
            .from('workout_sessions')
            .delete()
            .in('workout_day_id', dayIds);
          
          if (deleteSessionsError) {
            console.error('❌ Error deleting sessions:', deleteSessionsError);
            throw deleteSessionsError;
          } else {
            console.log('✓ Sessions deleted');
          }
        } else {
          console.log('✓ Sessions updated (workout_day_id set to null)');
        }
      }

      // Step 5: Delete planned exercises
      console.log('📋 Step 6: Deleting planned exercises...');
      const { error: plannedExError } = await supabase
        .from('planned_exercises')
        .delete()
        .in('workout_day_id', dayIds);
      
      if (plannedExError) {
        console.error('❌ Error deleting planned exercises:', plannedExError);
        throw plannedExError;
      }
      console.log('✓ Planned exercises deleted');

      // Step 6: Delete workout days
      console.log('📋 Step 7: Deleting workout days...');
      const { error: deleteDaysError } = await supabase
        .from('workout_days')
        .delete()
        .eq('plan_id', planId);
      
      if (deleteDaysError) {
        console.error('❌ Error deleting workout days:', deleteDaysError);
        throw deleteDaysError;
      }
      console.log('✓ Workout days deleted');

      // Step 7: Finally delete the plan
      console.log('📋 Step 8: Deleting workout plan...');
      const { error: finalDeleteError } = await supabase
        .from('workout_plans')
        .delete()
        .eq('id', planId);

      if (finalDeleteError) {
        console.error('❌ Error deleting plan:', finalDeleteError);
        throw finalDeleteError;
      }

      console.log('✅ PLAN DELETED SUCCESSFULLY');
      return true;
    } catch (error: any) {
      console.error('❌ Fatal error in manual cascade delete:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
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