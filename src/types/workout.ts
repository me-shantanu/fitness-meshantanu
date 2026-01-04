// types/workout.ts
export interface Exercise {
  id: string;
  name: string;
  category?: string;
  muscle_group?: string;
  equipment?: string;
  instructions?: string;
}

export interface PlannedExercise {
  id?: string;
  workout_day_id?: string;
  exercise_id: string;
  exercise_name: string;
  exercise_type: 'strength' | 'cardio' | 'flexibility';
  target_sets: number;
  target_reps: number;
  target_weight?: number;
  target_duration?: number; // for cardio
  notes?: string;
  order_index: number;
}

export interface WorkoutDay {
  id?: string;
  plan_id?: string;
  day_of_week: number; // 0-6 (Monday-Sunday)
  name: string;
  is_rest_day: boolean;
  planned_exercises?: PlannedExercise[];
}

export interface WorkoutPlan {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  is_template: boolean;
  created_at: string;
  workout_days?: WorkoutDay[];
}

export interface WorkoutSession {
  id: string;
  user_id: string;
  workout_day_id: string;
  date: string;
  started_at: string;
  completed_at?: string;
  total_calories_burned?: number;
  notes?: string;
  workout_days?: WorkoutDay;
  exercise_sets?: ExerciseSet[];
}

export interface ExerciseSet {
  id: string;
  session_id: string;
  planned_exercise_id?: string;
  exercise_id?: string;
  exercise_name: string;
  set_number: number;
  reps: number;
  weight?: number;
  duration?: number;
  notes?: string;
  is_pr: boolean;
  created_at: string;
}

export interface PersonalRecord {
  id: string;
  user_id: string;
  exercise_id: string;
  exercise_name: string;
  max_weight: number;
  max_reps: number;
  achieved_at: string;
  session_id: string;
}

// Form types
export interface WorkoutDayForm {
  dayOfWeek: number;
  name: string;
  isRestDay: boolean;
  exercises: ExerciseForm[];
}

export interface ExerciseForm {
  id: string;
  name: string;
  sets: number;
  reps: number;
  weight: number | null;
  type: 'strength' | 'cardio' | 'flexibility';
  notes?: string;
}

export interface CreatePlanData {
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  isTemplate: boolean;
}