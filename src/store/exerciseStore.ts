import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './authStore';

interface FavoriteExercise {
  id: string;
  user_id: string;
  exercise_id: string;
  exercise_name: string;
  exercise_type: 'workout' | 'warmup' | 'cooldown';
  created_at: string;
}

interface ExerciseStore {
  favorites: FavoriteExercise[];
  loading: boolean;
  recentSearches: string[];

  // Favorite methods
  loadFavorites: () => Promise<{ success: boolean; data?: FavoriteExercise[]; error?: any }>;
  addFavorite: (exerciseId: string | number, exerciseName: string, exerciseType?: string) => Promise<{ success: boolean; data?: any; error?: any }>;
  removeFavorite: (exerciseId: string | number) => Promise<{ success: boolean; error?: any }>;
  isFavorite: (exerciseId: string | number) => boolean;
  getFavoriteById: (exerciseId: string | number) => FavoriteExercise | undefined;
  getFavoritesByType: (type: string) => FavoriteExercise[];
  toggleFavorite: (exerciseId: string | number, exerciseName: string, exerciseType?: string) => Promise<{ success: boolean; data?: any; error?: any }>;
  getFavoritesCount: () => number;
  getFavoritesCountByType: (type: string) => number;
  syncFavorites: () => Promise<{ success: boolean; data?: FavoriteExercise[]; error?: any }>;

  // Search methods
  addRecentSearch: (searchTerm: string) => void;
  removeRecentSearch: (searchTerm: string) => void;
  clearRecentSearches: () => void;

  // Utility
  clear: () => void;
}

export const useExerciseStore = create<ExerciseStore>((set, get) => ({
  favorites: [],
  loading: false,
  recentSearches: [],

  // Load user's favorite exercises
  loadFavorites: async () => {
    try {
      const user = useAuthStore.getState().user;

      if (!user || !user.id) {
        set({ favorites: [], loading: false });
        return { success: false, error: 'No user logged in' };
      }

      set({ loading: true });

      const { data, error } = await supabase
        .from('favorite_exercises')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        set({ loading: false });
        throw error;
      }

      set({ favorites: data || [], loading: false });
      return { success: true, data: data || [] };
    } catch (error: any) {
      console.error('Error loading favorites:', error);
      set({ loading: false, favorites: [] });
      return { success: false, error: error.message || 'Failed to load favorites' };
    }
  },

  // Add exercise to favorites
  addFavorite: async (exerciseId, exerciseName, exerciseType = 'workout') => {
    try {
      const user = useAuthStore.getState().user;

      if (!user || !user.id) {
        return { success: false, error: 'No user logged in' };
      }

      const exerciseIdStr = exerciseId.toString();

      // Check if already exists to prevent duplicates
      const currentFavorites = get().favorites;

      const existingFavorite = currentFavorites.find(
        f => f.exercise_id === exerciseIdStr
      );

      if (existingFavorite) {
        return { success: true, data: existingFavorite };
      }

      // Optimistically update UI first
      const tempFavorite: FavoriteExercise = {
        id: `temp-${Date.now()}`,
        user_id: user.id,
        exercise_id: exerciseIdStr,
        exercise_name: exerciseName,
        exercise_type: exerciseType as any,
        created_at: new Date().toISOString(),
      };

      set({ favorites: [tempFavorite, ...currentFavorites] });

      // Add to database
      const insertData = {
        user_id: user.id,
        exercise_id: exerciseIdStr,
        exercise_name: exerciseName,
        exercise_type: exerciseType,
      };

      const { data, error } = await supabase
        .from('favorite_exercises')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        // Rollback optimistic update
        set({ favorites: currentFavorites });
        throw error;
      }

      // Replace temp favorite with real one
      const newFavorites = [data, ...currentFavorites];
      set({ favorites: newFavorites });

      return { success: true, data };
    } catch (error: any) {
      console.error('Error adding favorite:', error);
      return { success: false, error: error.message || 'Failed to add favorite' };
    }
  },

  // Remove exercise from favorites
  removeFavorite: async (exerciseId) => {
    try {
      const user = useAuthStore.getState().user;

      if (!user || !user.id) {
        return { success: false, error: 'No user logged in' };
      }

      const exerciseIdStr = exerciseId.toString();

      const currentFavorites = get().favorites;

      // Store the favorite to restore if deletion fails
      const removedFavorite = currentFavorites.find(f => f.exercise_id === exerciseIdStr);

      // Optimistically update UI first
      const newFavorites = currentFavorites.filter(f => f.exercise_id !== exerciseIdStr);
      set({ favorites: newFavorites });

      // Delete from database
      const { error } = await supabase
        .from('favorite_exercises')
        .delete()
        .eq('user_id', user.id)
        .eq('exercise_id', exerciseIdStr);

      if (error) {
        // Rollback optimistic update
        if (removedFavorite) {
          set({ favorites: currentFavorites });
        }
        throw error;
      }

      return { success: true };
    } catch (error: any) {
      console.error('Error removing favorite:', error);
      return { success: false, error: error.message || 'Failed to remove favorite' };
    }
  },

  // Check if exercise is favorited. Called per list row per render, so it
  // must stay cheap: no logging here.
  isFavorite: (exerciseId) => {
    const exerciseIdStr = exerciseId.toString();
    return get().favorites.some(f => f.exercise_id === exerciseIdStr);
  },

  // Get favorite exercise by ID
  getFavoriteById: (exerciseId) => {
    const exerciseIdStr = exerciseId.toString();
    return get().favorites.find(f => f.exercise_id === exerciseIdStr);
  },

  // Get favorites by type
  getFavoritesByType: (type) => {
    return get().favorites.filter(f => f.exercise_type === type);
  },

  // Toggle favorite status
  toggleFavorite: async (exerciseId, exerciseName, exerciseType = 'workout') => {
    if (get().isFavorite(exerciseId)) {
      return await get().removeFavorite(exerciseId);
    } else {
      return await get().addFavorite(exerciseId, exerciseName, exerciseType);
    }
  },

  // Add recent search
  addRecentSearch: (searchTerm) => {
    if (!searchTerm || searchTerm.trim() === '') return;

    const currentSearches = get().recentSearches;
    const trimmedSearch = searchTerm.trim();

    // Remove duplicates and add to front
    const newSearches = [
      trimmedSearch,
      ...currentSearches.filter(s => s !== trimmedSearch)
    ].slice(0, 10); // Keep only last 10 searches

    set({ recentSearches: newSearches });
  },

  // Remove a specific recent search
  removeRecentSearch: (searchTerm) => {
    set({
      recentSearches: get().recentSearches.filter(s => s !== searchTerm)
    });
  },

  // Clear recent searches
  clearRecentSearches: () => {
    set({ recentSearches: [] });
  },

  // Get total favorites count
  getFavoritesCount: () => {
    return get().favorites.length;
  },

  // Get favorites count by type
  getFavoritesCountByType: (type) => {
    return get().favorites.filter(f => f.exercise_type === type).length;
  },

  // Sync favorites from server (useful after login)
  syncFavorites: async () => {
    return await get().loadFavorites();
  },

  // Clear all store data
  clear: () => {
    set({
      favorites: [],
      loading: false,
      recentSearches: []
    });
  },
}));
