import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './authStore';

export const useExerciseStore = create((set, get) => ({
  favorites: [],
  loading: false,
  recentSearches: [],

  // Load user's favorite exercises
  loadFavorites: async () => {
    try {
      const userId = useAuthStore.getState().user?.id;
      if (!userId) return;

      set({ loading: true });
      const { data, error } = await supabase
        .from('favorite_exercises')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      set({ favorites: data || [], loading: false });
    } catch (error) {
      console.error('Error loading favorites:', error);
      set({ loading: false });
    }
  },

  // Add exercise to favorites
  addFavorite: async (exerciseId, exerciseName, exerciseType = 'workout') => {
    try {
      const userId = useAuthStore.getState().user?.id;
      if (!userId) return { success: false, error: 'No user logged in' };

      const { data, error } = await supabase
        .from('favorite_exercises')
        .insert({
          user_id: userId,
          exercise_id: exerciseId.toString(),
          exercise_name: exerciseName,
          exercise_type: exerciseType,
        })
        .select()
        .single();

      if (error) throw error;

      set({ favorites: [...get().favorites, data] });
      return { success: true, data };
    } catch (error) {
      console.error('Error adding favorite:', error);
      return { success: false, error };
    }
  },

  // Remove exercise from favorites
  removeFavorite: async (exerciseId) => {
    try {
      const userId = useAuthStore.getState().user?.id;
      if (!userId) return { success: false, error: 'No user logged in' };

      const { error } = await supabase
        .from('favorite_exercises')
        .delete()
        .eq('user_id', userId)
        .eq('exercise_id', exerciseId.toString());

      if (error) throw error;

      set({ 
        favorites: get().favorites.filter(f => f.exercise_id !== exerciseId.toString()) 
      });
      return { success: true };
    } catch (error) {
      console.error('Error removing favorite:', error);
      return { success: false, error };
    }
  },

  // Check if exercise is favorited
  isFavorite: (exerciseId) => {
    return get().favorites.some(f => f.exercise_id === exerciseId.toString());
  },

  // Add recent search
  addRecentSearch: (searchTerm) => {
    const currentSearches = get().recentSearches;
    const newSearches = [
      searchTerm,
      ...currentSearches.filter(s => s !== searchTerm)
    ].slice(0, 10); // Keep only last 10 searches
    
    set({ recentSearches: newSearches });
  },

  // Clear recent searches
  clearRecentSearches: () => {
    set({ recentSearches: [] });
  },

  // Clear store
  clear: () => set({
    favorites: [],
    loading: false,
    recentSearches: []
  }),
}));