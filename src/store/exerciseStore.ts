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
      console.log('🔍 [loadFavorites] Starting to load favorites...');
      
      const user = useAuthStore.getState().user;
      console.log('👤 [loadFavorites] User:', user ? user.id : 'No user');
      
      if (!user || !user.id) {
        console.warn('⚠️ [loadFavorites] No user logged in, clearing favorites');
        set({ favorites: [], loading: false });
        return { success: false, error: 'No user logged in' };
      }

      set({ loading: true });
      
      console.log('📡 [loadFavorites] Querying Supabase for user:', user.id);
      
      const { data, error } = await supabase
        .from('favorite_exercises')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ [loadFavorites] Supabase error:', error);
        set({ loading: false });
        throw error;
      }

      console.log(`✅ [loadFavorites] Loaded ${data?.length || 0} favorites:`, data);
      set({ favorites: data || [], loading: false });
      return { success: true, data: data || [] };
    } catch (error: any) {
      console.error('❌ [loadFavorites] Error:', error);
      set({ loading: false, favorites: [] });
      return { success: false, error: error.message || 'Failed to load favorites' };
    }
  },

  // Add exercise to favorites
  addFavorite: async (exerciseId, exerciseName, exerciseType = 'workout') => {
    try {
      console.log('➕ [addFavorite] Starting to add favorite...');
      console.log('   Exercise ID:', exerciseId);
      console.log('   Exercise Name:', exerciseName);
      console.log('   Exercise Type:', exerciseType);
      
      const user = useAuthStore.getState().user;
      console.log('👤 [addFavorite] User:', user ? user.id : 'No user');
      
      if (!user || !user.id) {
        console.error('❌ [addFavorite] Cannot add favorite: No user logged in');
        return { success: false, error: 'No user logged in' };
      }

      const exerciseIdStr = exerciseId.toString();
      console.log('🔢 [addFavorite] Exercise ID as string:', exerciseIdStr);

      // Check if already exists to prevent duplicates
      const currentFavorites = get().favorites;
      console.log('📋 [addFavorite] Current favorites count:', currentFavorites.length);
      
      const existingFavorite = currentFavorites.find(
        f => f.exercise_id === exerciseIdStr
      );

      if (existingFavorite) {
        console.log('⚠️ [addFavorite] Exercise already in favorites:', existingFavorite);
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
      
      console.log('🎯 [addFavorite] Creating temp favorite:', tempFavorite);
      set({ favorites: [tempFavorite, ...currentFavorites] });
      console.log('✨ [addFavorite] Optimistically updated UI, new count:', get().favorites.length);

      // Add to database
      console.log('📡 [addFavorite] Inserting into Supabase...');
      const insertData = {
        user_id: user.id,
        exercise_id: exerciseIdStr,
        exercise_name: exerciseName,
        exercise_type: exerciseType,
      };
      console.log('📝 [addFavorite] Insert data:', insertData);
      
      const { data, error } = await supabase
        .from('favorite_exercises')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('❌ [addFavorite] Supabase error:', error);
        console.error('   Error details:', JSON.stringify(error, null, 2));
        // Rollback optimistic update
        set({ favorites: currentFavorites });
        console.log('↩️ [addFavorite] Rolled back optimistic update');
        throw error;
      }

      console.log('✅ [addFavorite] Successfully inserted into database:', data);
      
      // Replace temp favorite with real one
      const newFavorites = [data, ...currentFavorites];
      set({ favorites: newFavorites });
      console.log(`🎉 [addFavorite] Successfully added favorite: ${exerciseName}`);
      console.log('   New favorites count:', newFavorites.length);
      
      return { success: true, data };
    } catch (error: any) {
      console.error('❌ [addFavorite] Caught error:', error);
      return { success: false, error: error.message || 'Failed to add favorite' };
    }
  },

  // Remove exercise from favorites
  removeFavorite: async (exerciseId) => {
    try {
      console.log('➖ [removeFavorite] Starting to remove favorite...');
      console.log('   Exercise ID:', exerciseId);
      
      const user = useAuthStore.getState().user;
      console.log('👤 [removeFavorite] User:', user ? user.id : 'No user');
      
      if (!user || !user.id) {
        console.error('❌ [removeFavorite] Cannot remove favorite: No user logged in');
        return { success: false, error: 'No user logged in' };
      }

      const exerciseIdStr = exerciseId.toString();
      console.log('🔢 [removeFavorite] Exercise ID as string:', exerciseIdStr);
      
      const currentFavorites = get().favorites;
      console.log('📋 [removeFavorite] Current favorites count:', currentFavorites.length);
      
      // Store the favorite to restore if deletion fails
      const removedFavorite = currentFavorites.find(f => f.exercise_id === exerciseIdStr);
      console.log('🔍 [removeFavorite] Found favorite to remove:', removedFavorite);
      
      // Optimistically update UI first
      const newFavorites = currentFavorites.filter(f => f.exercise_id !== exerciseIdStr);
      set({ favorites: newFavorites });
      console.log('✨ [removeFavorite] Optimistically updated UI, new count:', newFavorites.length);

      // Delete from database
      console.log('📡 [removeFavorite] Deleting from Supabase...');
      const { error } = await supabase
        .from('favorite_exercises')
        .delete()
        .eq('user_id', user.id)
        .eq('exercise_id', exerciseIdStr);

      if (error) {
        console.error('❌ [removeFavorite] Supabase error:', error);
        // Rollback optimistic update
        if (removedFavorite) {
          set({ favorites: currentFavorites });
          console.log('↩️ [removeFavorite] Rolled back optimistic update');
        }
        throw error;
      }

      console.log(`✅ [removeFavorite] Successfully removed favorite: ${exerciseId}`);
      return { success: true };
    } catch (error: any) {
      console.error('❌ [removeFavorite] Caught error:', error);
      return { success: false, error: error.message || 'Failed to remove favorite' };
    }
  },

  // Check if exercise is favorited
  isFavorite: (exerciseId) => {
    const exerciseIdStr = exerciseId.toString();
    const currentFavorites = get().favorites;
    const isFav = currentFavorites.some(f => f.exercise_id === exerciseIdStr);
    console.log(`❓ [isFavorite] Checking ${exerciseId}: ${isFav} (Total favorites: ${currentFavorites.length})`);
    return isFav;
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
    console.log('🔄 [toggleFavorite] Toggling favorite...');
    const isFav = get().isFavorite(exerciseId);
    console.log(`   Current state: ${isFav ? 'Favorited' : 'Not favorited'}`);
    
    if (isFav) {
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
    console.log('🔄 [syncFavorites] Syncing favorites from server...');
    return await get().loadFavorites();
  },

  // Clear all store data
  clear: () => {
    console.log('🗑️ [clear] Clearing exercise store');
    set({
      favorites: [],
      loading: false,
      recentSearches: []
    });
  },
}));