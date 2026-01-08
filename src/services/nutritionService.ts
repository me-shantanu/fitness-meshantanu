import { supabase } from '../lib/supabase';

/**
 * Production-ready Nutrition Service
 * Implements accurate BMR/TDEE calculations with proper error handling
 */
export const nutritionService = {
  /**
   * Calculate comprehensive daily nutrition targets for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} Nutrition targets or null on error
   */
  calculateDailyTargets: async (userId) => {
    try {
      // Validate input
      if (!userId) {
        throw new Error('User ID is required');
      }

      // Fetch user profile with error handling
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Profile fetch error:', error);
        throw new Error('Failed to fetch user profile');
      }

      if (!profile) {
        throw new Error('User profile not found');
      }

      // Validate required profile fields
      const requiredFields = ['weight', 'height', 'age', 'gender'];
      const missingFields = requiredFields.filter(field => !profile[field]);

      if (missingFields.length > 0) {
        console.warn('Missing profile fields:', missingFields);
        return {
          error: 'incomplete_profile',
          missingFields,
          message: 'Please complete your profile to calculate nutrition targets'
        };
      }

      // Calculate or retrieve BMR
      let bmr = profile.bmr;
      if (!bmr || bmr <= 0) {
        bmr = nutritionService.calculateBMR(
          profile.weight,
          profile.height,
          profile.age,
          profile.gender
        );
      }

      // Validate BMR result
      if (!bmr || bmr < 800 || bmr > 5000) {
        throw new Error('Invalid BMR calculation result');
      }

      // Calculate TDEE
      const activityLevel = profile.activity_level || 'moderate';
      const tdee = nutritionService.calculateTDEE(bmr, activityLevel);

      // Calculate macros
      const goal = profile.goal || 'maintain';
      const macros = nutritionService.calculateMacros(tdee, goal, profile.weight);

      return {
        success: true,
        bmr: Math.round(bmr),
        tdee: Math.round(tdee),
        ...macros,
        weight: profile.weight,
        height: profile.height,
        age: profile.age,
        gender: profile.gender,
        activityLevel,
        goal
      };
    } catch (error) {
      console.error('Error calculating nutrition targets:', error);
      return null;
    }
  },

  /**
   * Calculate Basal Metabolic Rate using Mifflin-St Jeor Equation
   * Most accurate formula for BMR calculation
   * @param {number} weight - Weight in kg
   * @param {number} height - Height in cm
   * @param {number} age - Age in years
   * @param {string} gender - 'male' or 'female'
   * @returns {number} BMR in calories
   */
  calculateBMR: (weight, height, age, gender) => {
    // Input validation
    if (!weight || !height || !age || !gender) {
      throw new Error('All parameters required for BMR calculation');
    }

    if (weight <= 0 || weight > 500) {
      throw new Error('Invalid weight value');
    }

    if (height <= 0 || height > 300) {
      throw new Error('Invalid height value');
    }

    if (age <= 0 || age > 120) {
      throw new Error('Invalid age value');
    }

    // Mifflin-St Jeor Equation (most accurate)
    // For men: BMR = (10 × weight in kg) + (6.25 × height in cm) - (5 × age in years) + 5
    // For women: BMR = (10 × weight in kg) + (6.25 × height in cm) - (5 × age in years) - 161

    let bmr;
    const normalizedGender = gender.toLowerCase();

    if (normalizedGender === 'male' || normalizedGender === 'm') {
      bmr = (10 * weight) + (6.25 * height) - (5 * age) + 5;
    } else if (normalizedGender === 'female' || normalizedGender === 'f') {
      bmr = (10 * weight) + (6.25 * height) - (5 * age) - 161;
    } else {
      // Use average if gender is not specified or non-binary
      const maleBMR = (10 * weight) + (6.25 * height) - (5 * age) + 5;
      const femaleBMR = (10 * weight) + (6.25 * height) - (5 * age) - 161;
      bmr = (maleBMR + femaleBMR) / 2;
    }

    return Math.round(bmr);
  },

  /**
   * Calculate Total Daily Energy Expenditure
   * @param {number} bmr - Basal Metabolic Rate
   * @param {string} activityLevel - Activity level
   * @returns {number} TDEE in calories
   */
  calculateTDEE: (bmr, activityLevel) => {
    if (!bmr || bmr <= 0) {
      throw new Error('Invalid BMR value');
    }

    // Activity multipliers based on research
    const multipliers = {
      sedentary: 1.2,        // Little to no exercise
      light: 1.375,          // Light exercise 1-3 days/week
      moderate: 1.55,        // Moderate exercise 3-5 days/week
      active: 1.725,         // Hard exercise 6-7 days/week
      very_active: 1.9       // Very hard exercise, physical job
    };

    const normalizedLevel = activityLevel?.toLowerCase() || 'moderate';
    const multiplier = multipliers[normalizedLevel] || multipliers.moderate;

    const tdee = bmr * multiplier;

    // Sanity check
    if (tdee < 1000 || tdee > 10000) {
      console.warn('TDEE outside normal range:', tdee);
    }

    return Math.round(tdee);
  },

  /**
   * Calculate macronutrient targets based on goal
   * @param {number} tdee - Total Daily Energy Expenditure
   * @param {string} goal - Fitness goal
   * @param {number} weight - Body weight in kg (for protein calculation)
   * @returns {Object} Macro targets
   */
  calculateMacros: (tdee, goal, weight = 70) => {
    if (!tdee || tdee <= 0) {
      throw new Error('Invalid TDEE value');
    }

    let targetCalories = tdee;
    let proteinGramsPerKg;
    let proteinRatio, carbRatio, fatRatio;

    const normalizedGoal = goal?.toLowerCase() || 'maintain';

    switch (normalizedGoal) {
      case 'lose_weight':
      case 'cut':
      case 'fat_loss':
        // 15-20% caloric deficit for sustainable fat loss
        targetCalories = Math.round(tdee * 0.85);
        proteinGramsPerKg = 2.2; // Higher protein to preserve muscle
        proteinRatio = 0.35;
        carbRatio = 0.35;
        fatRatio = 0.30;
        break;

      case 'gain_muscle':
      case 'bulk':
      case 'muscle_gain':
        // 10-15% caloric surplus for muscle gain
        targetCalories = Math.round(tdee * 1.12);
        proteinGramsPerKg = 2.0;
        proteinRatio = 0.30;
        carbRatio = 0.50;
        fatRatio = 0.20;
        break;

      case 'maintain':
      case 'maintenance':
      default:
        targetCalories = tdee;
        proteinGramsPerKg = 1.8;
        proteinRatio = 0.30;
        carbRatio = 0.45;
        fatRatio = 0.25;
        break;
    }

    // Calculate protein based on body weight (more accurate)
    const proteinFromWeight = Math.round(weight * proteinGramsPerKg);
    const proteinCalories = proteinFromWeight * 4;

    // Adjust if protein calories exceed ratio limits
    const maxProteinCalories = targetCalories * proteinRatio;
    const protein = Math.min(proteinFromWeight, Math.round(maxProteinCalories / 4));

    // Calculate remaining calories for carbs and fats
    const remainingCalories = targetCalories - (protein * 4);
    const carbCalories = remainingCalories * (carbRatio / (carbRatio + fatRatio));
    const fatCalories = remainingCalories - carbCalories;

    return {
      calories: targetCalories,
      protein: protein,
      carbs: Math.round(carbCalories / 4),
      fats: Math.round(fatCalories / 9),
      proteinRatio,
      carbRatio,
      fatRatio,
      // Additional helpful info
      proteinCalories: protein * 4,
      carbCalories: Math.round(carbCalories),
      fatCalories: Math.round(fatCalories)
    };
  },

  /**
   * Calculate calories burned during workout using MET values
   * @param {number} weight - Body weight in kg
   * @param {number} duration - Duration in minutes
   * @param {string} intensity - Workout intensity
   * @returns {number} Calories burned
   */
  calculateWorkoutCalories: (weight, duration, intensity = 'moderate') => {
    if (!weight || weight <= 0) {
      throw new Error('Invalid weight value');
    }

    if (!duration || duration <= 0) {
      throw new Error('Invalid duration value');
    }

    // MET (Metabolic Equivalent of Task) values
    const metValues = {
      light: 3.5,           // Light intensity (walking, stretching)
      moderate: 5.0,        // Moderate intensity (jogging, moderate weights)
      intense: 8.0,         // High intensity (running, heavy weights)
      very_intense: 10.0,   // Very high intensity (HIIT, sprinting)
      hiit: 12.0            // HIIT workouts
    };

    const normalizedIntensity = intensity?.toLowerCase() || 'moderate';
    const met = metValues[normalizedIntensity] || metValues.moderate;

    // Formula: Calories = (MET × body weight in kg × duration in hours)
    // Simplified: (MET × 3.5 × weight in kg × duration in min) / 200
    const caloriesPerMinute = (met * 3.5 * weight) / 200;
    const totalCalories = caloriesPerMinute * duration;

    return Math.round(totalCalories);
  },

  /**
   * Update daily nutrition log with workout calories
   * @param {string} userId - User ID
   * @param {number} caloriesBurned - Calories burned from workout
   * @returns {Promise<Object|null>} Updated nutrition record
   */
  updateDailyNutrition: async (userId, caloriesBurned) => {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }

      if (!caloriesBurned || caloriesBurned < 0) {
        throw new Error('Invalid calories burned value');
      }

      const today = new Date().toISOString().split('T')[0];

      // Try to get existing record
      const { data: existing, error: fetchError } = await supabase
        .from('daily_nutrition')
        .select('*')
        .eq('user_id', userId)
        .eq('date', today)
        .maybeSingle(); // Use maybeSingle instead of single to avoid error when no record

      if (fetchError) {
        throw fetchError;
      }

      if (existing) {
        // Update existing record
        const { data: updated, error: updateError } = await supabase
          .from('daily_nutrition')
          .update({
            calories_burned: (existing.calories_burned || 0) + caloriesBurned,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (updateError) throw updateError;
        return updated;
      } else {
        // Create new record with targets
        const targets: any = await nutritionService.calculateDailyTargets(userId);

        if (!targets || !targets.success) {
          throw new Error('Failed to calculate nutrition targets');
        }

        const { data: newRecord, error: insertError } = await supabase
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
            fats_consumed: 0,
            water_intake_ml: 0
          })
          .select()
          .single();

        if (insertError) throw insertError;
        return newRecord;
      }
    } catch (error) {
      console.error('Error updating daily nutrition:', error);
      return null;
    }
  },

  /**
   * Get or create today's nutrition log
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} Daily nutrition log
   */
  getTodayNutrition: async (userId) => {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }

      const today = new Date().toISOString().split('T')[0];

      const { data: existing, error: fetchError } = await supabase
        .from('daily_nutrition')
        .select('*')
        .eq('user_id', userId)
        .eq('date', today)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (existing) {
        return existing;
      }

      // Create new record if doesn't exist
      const targets: any = await nutritionService.calculateDailyTargets(userId);

      if (!targets || !targets.success) {
        return null;
      }

      const { data: newRecord, error: insertError } = await supabase
        .from('daily_nutrition')
        .insert({
          user_id: userId,
          date: today,
          target_calories: targets.calories,
          target_protein: targets.protein,
          target_carbs: targets.carbs,
          target_fats: targets.fats,
          calories_burned: 0,
          calories_consumed: 0,
          protein_consumed: 0,
          carbs_consumed: 0,
          fats_consumed: 0,
          water_intake_ml: 0
        })
        .select()
        .single();

      if (insertError) throw insertError;
      return newRecord;
    } catch (error) {
      console.error('Error getting today nutrition:', error);
      return null;
    }
  },

  /**
   * Validate and sanitize food input
   * @param {Object} foodData - Food data to validate
   * @returns {Object} Validated food data
   */
  validateFoodInput: (foodData) => {
    const validated = {
      name: String(foodData.name || '').trim(),
      calories: Math.max(0, parseInt(foodData.calories) || 0),
      protein: Math.max(0, parseFloat(foodData.protein) || 0),
      carbs: Math.max(0, parseFloat(foodData.carbs) || 0),
      fats: Math.max(0, parseFloat(foodData.fats) || 0),
      servingSize: String(foodData.servingSize || '').trim()
    };

    // Validate name
    if (!validated.name || validated.name.length < 2) {
      throw new Error('Food name must be at least 2 characters');
    }

    // Validate calories
    if (validated.calories === 0) {
      throw new Error('Calories must be greater than 0');
    }

    // Sanity check: calculated calories from macros shouldn't differ too much
    const calculatedCalories = (validated.protein * 4) + (validated.carbs * 4) + (validated.fats * 9);
    if (calculatedCalories > 0 && Math.abs(calculatedCalories - validated.calories) > validated.calories * 0.2) {
      console.warn('Calorie mismatch detected:', {
        provided: validated.calories,
        calculated: calculatedCalories
      });
    }

    return validated;
  }
};