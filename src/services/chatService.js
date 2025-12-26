import OpenAI from 'openai';
import { supabase } from '../lib/supabase';

// Initialize OpenAI (you'll need to set up an API key)
const openai = new OpenAI({
  apiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true // Only for development
});

export const chatService = {
  // Get workout recommendations
  getWorkoutRecommendations: async (userId, prompt) => {
    try {
      // Get user profile and history for context
      const [profile, history] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('workout_sessions').select('*').eq('user_id', userId).limit(10)
      ]);

      const systemPrompt = `You are a professional fitness coach. 
        User Profile: ${JSON.stringify(profile.data)}
        Recent Workout History: ${JSON.stringify(history.data)}
        
        Provide personalized workout recommendations. Format response as JSON with:
        - exercises: array of recommended exercises with sets, reps, rest time
        - tips: array of tips
        - weekly_structure: array of workout days`;

      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" }
      });

      return JSON.parse(completion.choices[0].message.content);
    } catch (error) {
      console.error('Error getting AI recommendations:', error);
      return null;
    }
  },

  // Generate workout plan
  generateWorkoutPlan: async (userId, goals, daysPerWeek) => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      const prompt = `Generate a ${daysPerWeek}-day workout plan for someone with:
        Goals: ${goals}
        Experience: ${profile.experience_level || 'beginner'}
        Available Equipment: ${profile.equipment || 'gym'}
        
        Return a structured weekly plan with exercises, sets, reps, and rest periods.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "You are an expert personal trainer. Create safe and effective workout plans." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" }
      });

      return JSON.parse(completion.choices[0].message.content);
    } catch (error) {
      console.error('Error generating workout plan:', error);
      return null;
    }
  }
};