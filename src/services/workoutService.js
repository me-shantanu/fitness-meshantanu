import { supabase } from '../lib/supabase';
import { nutritionService } from './nutritionService';

export const workoutService = {
  // Create weekly workout plan
  createWeeklyPlan: async (userId, planData, days) => {
    try {
      // Start transaction
      const { data: plan, error: planError } = await supabase
        .from('workout_plans')
        .insert({
          user_id: userId,
          name: planData.name,
          start_date: planData.startDate,
          end_date: planData.endDate,
          is_active: true
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
            is_rest_day: day.isRestDay || false
          })
          .select()
          .single();

        if (dayError) throw dayError;

        // Add exercises to the day if not rest day
        if (!day.isRestDay && day.exercises) {
          for (const [index, exercise] of day.exercises.entries()) {
            const { error: exerciseError } = await supabase
              .from('planned_exercises')
              .insert({
                workout_day_id: workoutDay.id,
                exercise_id: exercise.id,
                exercise_name: exercise.name,
                exercise_type: exercise.type || 'strength',
                target_sets: exercise.sets,
                target_reps: exercise.reps,
                target_weight: exercise.weight,
                notes: exercise.notes,
                order_index: index
              });

            if (exerciseError) throw exerciseError;
          }
        }
      }

      return { success: true, planId: plan.id };
    } catch (error) {
      console.error('Error creating workout plan:', error);
      return { success: false, error };
    }
  },

  // Get user's active workout plan
  getActiveWorkoutPlan: async (userId) => {
    try {
      const { data: plan, error } = await supabase
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

      if (error) throw error;
      return plan;
    } catch (error) {
      console.error('Error fetching workout plan:', error);
      return null;
    }
  },

  // Start a workout session
  startWorkoutSession: async (userId, workoutDayId) => {
    try {
      const { data: session, error } = await supabase
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
      return session;
    } catch (error) {
      console.error('Error starting workout session:', error);
      return null;
    }
  },

  // Complete a workout session
  completeWorkoutSession: async (sessionId, caloriesBurned) => {
    try {
      const { data: session, error } = await supabase
        .from('workout_sessions')
        .update({
          completed_at: new Date().toISOString(),
          total_calories_burned: caloriesBurned
        })
        .eq('id', sessionId)
        .select()
        .single();

      if (error) throw error;

      // Calculate and update nutrition targets
      await nutritionService.updateDailyNutrition(session.user_id, caloriesBurned);

      return session;
    } catch (error) {
      console.error('Error completing workout session:', error);
      return null;
    }
  },

  // Log exercise set
  logExerciseSet: async (sessionId, setData) => {
    try {
      const { data: set, error } = await supabase
        .from('exercise_sets')
        .insert({
          session_id: sessionId,
          planned_exercise_id: setData.plannedExerciseId,
          exercise_name: setData.exerciseName,
          set_number: setData.setNumber,
          reps: setData.reps,
          weight: setData.weight,
          notes: setData.notes,
          is_pr: setData.isPR || false
        })
        .select()
        .single();

      if (error) throw error;

      // Check and update personal records if it's a PR
      if (setData.isPR) {
        await workoutService.updatePersonalRecord(
          setData.userId,
          setData.exerciseId,
          setData.exerciseName,
          setData.weight,
          setData.reps,
          sessionId
        );
      }

      return set;
    } catch (error) {
      console.error('Error logging exercise set:', error);
      return null;
    }
  },

  // Update personal record
  updatePersonalRecord: async (userId, exerciseId, exerciseName, weight, reps, sessionId) => {
    try {
      // Check if PR already exists for this exercise
      const { data: existingPR } = await supabase
        .from('personal_records')
        .select('*')
        .eq('user_id', userId)
        .eq('exercise_id', exerciseId)
        .single();

      let prData;
      
      if (existingPR) {
        // Update if new weight is higher or same weight with more reps
        const shouldUpdate = weight > existingPR.max_weight || 
          (weight === existingPR.max_weight && reps > existingPR.max_reps);
        
        if (shouldUpdate) {
          const { data: updatedPR } = await supabase
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
          
          prData = updatedPR;
        }
      } else {
        // Create new PR
        const { data: newPR } = await supabase
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
        
        prData = newPR;
      }

      return prData;
    } catch (error) {
      console.error('Error updating personal record:', error);
      return null;
    }
  },

  // Get workout history
  getWorkoutHistory: async (userId, limit = 30) => {
    try {
      const { data: sessions, error } = await supabase
        .from('workout_sessions')
        .select(`
          *,
          workout_days (
            name
          ),
          exercise_sets (
            *,
            planned_exercises (
              exercise_name
            )
          )
        `)
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return sessions;
    } catch (error) {
      console.error('Error fetching workout history:', error);
      return [];
    }
  },

  getSessionDetails: async (sessionId) => {
  try {
    const { data: session, error } = await supabase
      .from('workout_sessions')
      .select(`
        *,
        workout_days (
          name,
          is_rest_day
        ),
        exercise_sets (
          *,
          planned_exercises (
            exercise_name,
            target_sets,
            target_reps
          )
        )
      `)
      .eq('id', sessionId)
      .single();

    if (error) throw error;
    return session;
  } catch (error) {
    console.error('Error fetching session details:', error);
    return null;
  }
},
};