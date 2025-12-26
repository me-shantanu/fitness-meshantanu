// src/store/authStore.js
import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export const useAuthStore = create((set) => ({
  user: null,
  profile: null,
  loading: true,
  
  // Initialize auth state
  initialize: async () => {
    try {
      // Skip on server-side rendering
      if (typeof window === 'undefined') {
        set({ loading: false });
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        
        set({ user: session.user, profile, loading: false });
      } else {
        set({ user: null, profile: null, loading: false });
      }
    } catch (error) {
      console.error('Error initializing auth:', error);
      set({ loading: false });
    }
  },
  
  // Sign up
  signUp: async (email, password, fullName) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });
      
      if (error) throw error;
      
      // Update profile with full name
      if (data.user) {
        await supabase
          .from('profiles')
          .update({ full_name: fullName })
          .eq('id', data.user.id);
      }
      
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },
  
  // Sign in
  signIn: async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) throw error;
      
      if (data.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();
        
        set({ user: data.user, profile });
      }
      
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },
  
  // Sign out
  signOut: async () => {
    try {
      await supabase.auth.signOut();
      set({ user: null, profile: null });
    } catch (error) {
      console.error('Error signing out:', error);
    }
  },
  
  // Update profile
  updateProfile: async (updates) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', useAuthStore.getState().user.id)
        .select()
        .single();
      
      if (error) throw error;
      
      set({ profile: data });
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },
  
  // Refresh profile
  refreshProfile: async () => {
    try {
      const userId = useAuthStore.getState().user?.id;
      if (!userId) return;
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      set({ profile });
    } catch (error) {
      console.error('Error refreshing profile:', error);
    }
  },
}));