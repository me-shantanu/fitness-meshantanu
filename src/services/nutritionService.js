import { supabase } from '../lib/supabase';

export const nutritionService = {
  // Calculate daily nutrition targets
  calculateDailyTargets: async (userId) => {
    try {
      // Get user profile
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;

      // Calculate BMR if not set
      let bmr = profile.bmr;
      if (!bmr) {
        bmr = nutritionService.calculateBMR(
          profile.weight,
          profile.height,
          profile.age,
          profile.gender
        );
      }

      // Calculate TDEE based on activity level
      const tdee = nutritionService.calculateTDEE(bmr, profile.activity_level || 'moderate');

      // Calculate macros based on goal
      const macros = nutritionService.calculateMacros(tdee, profile.goal || 'maintain');

      return {
        bmr,
        tdee,
        ...macros,
        weight: profile.weight,
        height: profile.height,
        age: profile.age,
        gender: profile.gender
      };
    } catch (error) {
      console.error('Error calculating nutrition targets:', error);
      return null;
    }
  },

  // Calculate BMR using Mifflin-St Jeor Equation
  calculateBMR: (weight, height, age, gender) => {
    // Convert height from cm to meters if needed
    const weightKg = weight;
    const heightCm = height;
    
    let bmr;
    if (gender === 'male') {
      bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * age) + 5;
    } else {
      bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * age) - 161;
    }
    
    return Math.round(bmr);
  },

  // Calculate TDEE based on activity level
  calculateTDEE: (bmr, activityLevel) => {
    const multipliers = {
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      active: 1.725,
      very_active: 1.9
    };

    const multiplier = multipliers[activityLevel] || 1.55;
    return Math.round(bmr * multiplier);
  },

  // Calculate macros based on goal
  calculateMacros: (tdee, goal) => {
    let proteinRatio, carbRatio, fatRatio;

    switch (goal) {
      case 'lose_weight':
        proteinRatio = 0.35;
        carbRatio = 0.40;
        fatRatio = 0.25;
        tdee = Math.round(tdee * 0.8); // 20% deficit
        break;
      case 'gain_muscle':
        proteinRatio = 0.30;
        carbRatio = 0.50;
        fatRatio = 0.20;
        tdee = Math.round(tdee * 1.1); // 10% surplus
        break;
      default: // maintain
        proteinRatio = 0.30;
        carbRatio = 0.45;
        fatRatio = 0.25;
    }

    const proteinCalories = tdee * proteinRatio;
    const carbCalories = tdee * carbRatio;
    const fatCalories = tdee * fatRatio;

    return {
      calories: tdee,
      protein: Math.round(proteinCalories / 4), // 4 calories per gram
      carbs: Math.round(carbCalories / 4), // 4 calories per gram
      fats: Math.round(fatCalories / 9), // 9 calories per gram
      proteinRatio,
      carbRatio,
      fatRatio
    };
  },

  // Calculate calories burned during workout
  calculateWorkoutCalories: (weight, duration, intensity = 'moderate') => {
    const metValues = {
      light: 3.5,
      moderate: 5.0,
      intense: 8.0,
      very_intense: 10.0
    };

    const met = metValues[intensity] || 5.0;
    const caloriesPerMinute = (met * 3.5 * weight) / 200;
    return Math.round(caloriesPerMinute * duration);
  },

  // Update daily nutrition based on workout
  updateDailyNutrition: async (userId, caloriesBurned) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Get or create daily nutrition record
      const { data: existing, error: fetchError } = await supabase
        .from('daily_nutrition')
        .select('*')
        .eq('user_id', userId)
        .eq('date', today)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      if (existing) {
        // Update existing record
        const { data: updated } = await supabase
          .from('daily_nutrition')
          .update({
            calories_burned: (existing.calories_burned || 0) + caloriesBurned,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id)
          .select()
          .single();

        return updated;
      } else {
        // Get user's daily targets
        const targets = await nutritionService.calculateDailyTargets(userId);
        
        // Create new record
        const { data: newRecord } = await supabase
          .from('daily_nutrition')
          .insert({
            user_id: userId,
            date: today,
            target_calories: targets.calories,
            target_protein: targets.protein,
            target_carbs: targets.carbs,
            target_fats: targets.fats,
            calories_burned: caloriesBurned,
            calories_consumed: 0,
            protein_consumed: 0,
            carbs_consumed: 0,
            fats_consumed: 0
          })
          .select()
          .single();

        return newRecord;
      }
    } catch (error) {
      console.error('Error updating daily nutrition:', error);
      return null;
    }
  }
};